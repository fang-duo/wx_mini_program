function normalizeMediaValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return normalizeMediaValue(value[0]);
  if (typeof value === 'object') {
    return value.url || value.src || value.tempFileURL || value.download_url || value.fileID || value.cloudID || '';
  }
  return '';
}

function normalizeMediaList(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(item => normalizeMediaValue(item))
      .filter(Boolean);
  }

  const singleValue = normalizeMediaValue(value);
  return singleValue ? [singleValue] : [];
}

function normalizeTextValue(value) {
  if (!value) return '';
  return typeof value === 'string' ? value.trim() : String(value).trim();
}

function normalizeGuideSections(sections) {
  if (!Array.isArray(sections)) return [];

  return sections
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;

      const badge = normalizeTextValue(item.badge);
      const introLabel = normalizeTextValue(item.introLabel);
      const detailLabel = normalizeTextValue(item.detailLabel);
      const title = normalizeTextValue(item.title);
      const intro = normalizeTextValue(item.intro || item.summary || item.desc);
      const text = normalizeTextValue(item.text);
      const images = normalizeMediaList(item.images && item.images.length ? item.images : item.image);
      const image = images[0] || '';
      const parsedSort = Number(item.sort);
      const sort = Number.isFinite(parsedSort) ? parsedSort : index + 1;

      if (!badge && !introLabel && !detailLabel && !title && !intro && !text && !image) return null;

      return { badge, introLabel, detailLabel, title, intro, text, image, images, sort };
    })
    .filter(Boolean)
    .sort((left, right) => left.sort - right.sort);
}

async function queryFirstAvailableCollection(db, collectionNames, executor) {
  let lastError = null;

  for (const name of collectionNames) {
    try {
      return await executor(db.collection(name), name);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return null;
}

Page({
  data: {
    loading: true,
    loadErrorTitle: '',
    loadErrorDesc: '',
    guide: null
  },

  onLoad(options) {
    const title = decodeURIComponent(options.title || '');
    const itemId = decodeURIComponent(options.itemId || '');
    const contentType = decodeURIComponent(options.contentType || 'heritage');
    wx.setNavigationBarTitle({
      title: contentType === 'campaign' ? '活动指引' : '练习指引'
    });
    this.loadGuideData({ title, itemId, contentType });
  },

  showLoadError(title, desc) {
    this.setData({
      loading: false,
      loadErrorTitle: title,
      loadErrorDesc: desc,
      guide: null
    });
  },

  async loadGuideData({ title, itemId, contentType }) {
    this.setData({
      loading: true,
      loadErrorTitle: '',
      loadErrorDesc: '',
      guide: null
    });

    if (!wx.cloud) {
      this.showLoadError('内容暂不可用', '当前指引暂时无法显示，请稍后再试。');
      return;
    }

    const db = wx.cloud.database();

    try {
      const collectionNames = contentType === 'campaign'
        ? ['campaign_contents']
        : ['heritage_contents', 'heritage_content'];

      const detailRes = await queryFirstAvailableCollection(db, collectionNames, async collection => {
        if (itemId) {
          try {
            return await collection.doc(itemId).get();
          } catch (error) {
            // Incoming itemId may be stale; fall back to title query.
          }
        }
        return collection.where({ title, status: true }).limit(1).get();
      });

      const cloudData = (detailRes.data && (Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data)) || null;
      if (!cloudData) {
        this.showLoadError('暂无图文指引', '当前指引暂未发布，请稍后再来查看。');
        return;
      }

      const guideSections = normalizeGuideSections(cloudData.guideSections);
      const guide = {
        title: normalizeTextValue(cloudData.guideTitle) || normalizeTextValue(cloudData.title) || (contentType === 'campaign' ? '活动指引' : '练习指引'),
        intro: normalizeTextValue(cloudData.guideIntro),
        tips: normalizeTextValue(cloudData.guideTips),
        cover: normalizeMediaValue(cloudData.cover),
        sections: guideSections
      };

      if (!guide.intro && !guide.tips && guide.sections.length === 0) {
        this.showLoadError('暂无图文指引', '当前内容暂未补充详细指引，请稍后再来查看。');
        return;
      }

      this.setData({
        guide,
        loading: false,
        loadErrorTitle: '',
        loadErrorDesc: ''
      });
    } catch (error) {
      console.error('图文指引加载失败：', error);
      this.showLoadError('指引加载失败', '图文指引加载失败，请稍后重试。');
    }
  }
});
