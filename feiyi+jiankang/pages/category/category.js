const {
  ensurePrivacyHomeLock
} = require('../../utils/access');

function normalizeMediaValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return normalizeMediaValue(value[0]);
  if (typeof value === 'object') {
    return value.url || value.src || value.tempFileURL || value.download_url || value.fileID || value.cloudID || '';
  }
  return '';
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

const CATEGORY_META_MAP = {
  sports: {
    title: '传统体育 (武)',
    desc: '精选内容持续更新中。'
  },
  food: {
    title: '传统饮食 (食)',
    desc: '精选内容持续更新中。'
  },
  medicine: {
    title: '传统医药 (医)',
    desc: '精选内容持续更新中。'
  },
  music: {
    title: '传统音乐 (乐)',
    desc: '精选内容持续更新中。'
  }
};

Page({
  data: {
    typeId: '',
    title: '',
    desc: '',
    list: []
  },

  onLoad(options) {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    const typeId = options.id || 'sports';
    this.loadCategoryData(typeId);
  },

  onShow() {
    ensurePrivacyHomeLock(this, { allowAgreement: true });
  },

  getCategoryMeta(typeId) {
    return CATEGORY_META_MAP[typeId] || CATEGORY_META_MAP.sports;
  },

  async loadCategoryData(typeId) {
    const categoryMeta = this.getCategoryMeta(typeId);

    this.setData({
      typeId,
      title: categoryMeta.title,
      desc: categoryMeta.desc,
      list: []
    });
    wx.setNavigationBarTitle({ title: categoryMeta.title });

    if (!wx.cloud) return;

    const db = wx.cloud.database();

    try {
      const heritageRes = await queryFirstAvailableCollection(db, ['heritage_contents', 'heritage_content'], collection =>
        collection.get()
      );

      const cloudList = (heritageRes.data || [])
        .filter(item => {
          const itemCategory = item.category || item.categoryId || '';
          const itemStatus = typeof item.status === 'boolean' ? item.status : true;
          return itemCategory === typeId && itemStatus;
        })
        .sort((a, b) => {
          const aSort = typeof a.sort === 'number' ? a.sort : 999;
          const bSort = typeof b.sort === 'number' ? b.sort : 999;
          return aSort - bSort;
        })
        .map(item => ({
        id: item._id || item.id,
        title: item.title || '',
        desc: item.summary || '',
        cover: normalizeMediaValue(item.cover),
        tag: categoryMeta.title.replace(/\s*\(.+\)$/, ''),
        contentType: 'heritage'
      })).filter(item => item.title);

      const finalData = {
        title: categoryMeta.title,
        desc: categoryMeta.desc,
        list: cloudList
      };

      this.setData(finalData);
      wx.setNavigationBarTitle({ title: finalData.title });
    } catch (error) {
      console.error('分类页云端内容加载失败：', error);
    }
  },

  goToDetail(e) {
    const title = e.currentTarget.dataset.title || '';
    const itemId = e.currentTarget.dataset.id || '';
    const contentType = e.currentTarget.dataset.contentType || 'heritage';
    const query = [
      `title=${encodeURIComponent(title)}`,
      `contentType=${encodeURIComponent(contentType)}`
    ];

    if (itemId) {
      query.push(`itemId=${encodeURIComponent(itemId)}`);
    }

    wx.navigateTo({
      url: `/pages/detail/detail?${query.join('&')}`
    });
  }
})
