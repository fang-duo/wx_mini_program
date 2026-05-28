const {
  buildFavoriteKey,
  getContentFavoritesCache,
  checkContentFavoriteInCloud,
  saveContentFavoriteToCloud,
  removeContentFavoriteFromCloud
} = require('../../utils/dataSync');

const {
  getAccessSummary,
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

function getFallbackArticleData(title) {
  return {
    detailId: '',
    title: title || '内容详情',
    cover: '',
    tag: '非遗内容',
    date: '',
    intro: '当前内容以云端发布为准，暂无详细介绍。',
    section1Title: '',
    section1Content: '',
    section2Title: '',
    section2Content: '',
    hasPractice: false,
    videoUrl: ''
  };
}

function getFallbackCampaignData(title) {
  return {
    title: title || '活动详情',
    cover: '',
    tag: '活动宣传',
    date: '',
    intro: '当前活动详情以云端发布为准，暂无详细介绍。',
    section1Title: '',
    section1Content: '',
    section2Title: '',
    section2Content: '',
    hasPractice: false,
    videoUrl: ''
  };
}

Page({
  data: {
    isStarred: false,
    article: {
      id: '',
      contentType: 'heritage',
      detailId: '',
      title: '加载中...',
      cover: '',
      tag: '',
      date: '',
      intro: '',
      section1Title: '',
      section1Content: '',
      section2Title: '',
      section2Content: '',
      hasPractice: false,
      videoUrl: ''
    }
  },

  onLoad(options) {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    const title = decodeURIComponent(options.title || '内容详情');
    const itemId = decodeURIComponent(options.itemId || '');
    const contentType = decodeURIComponent(options.contentType || 'heritage');
    this.loadArticleData({ title, itemId, contentType });
  },

  onShow() {
    ensurePrivacyHomeLock(this, { allowAgreement: true });
  },

  async loadArticleData({ title, itemId, contentType }) {
    const fallbackData = contentType === 'campaign'
      ? getFallbackCampaignData(title)
      : getFallbackArticleData(title);

    this.setData({
      article: {
        ...fallbackData,
        id: itemId || '',
        contentType,
        detailId: fallbackData.detailId || ''
      }
    });
    this.checkStarStatus();
    wx.setNavigationBarTitle({ title: contentType === 'campaign' ? '活动详情' : '非遗详情' });

    if (!wx.cloud) return;

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
            // Fallback to title query when the incoming itemId comes from local placeholder data.
          }
        }
        return collection.where({ title, status: true }).limit(1).get();
      });

      const cloudData = (detailRes.data && (Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data)) || null;
      if (!cloudData) return;

      const article = {
        id: cloudData._id || itemId || '',
        contentType,
        detailId: cloudData.detailId || fallbackData.detailId || '',
        title: cloudData.title || fallbackData.title,
        cover: normalizeMediaValue(cloudData.cover) || fallbackData.cover,
        tag: cloudData.tag || (contentType === 'campaign' ? '活动宣传' : fallbackData.tag),
        date: cloudData.date || fallbackData.date,
        intro: cloudData.intro || cloudData.content || fallbackData.intro,
        section1Title: cloudData.section1Title || (contentType === 'campaign' ? '活动介绍' : fallbackData.section1Title),
        section1Content: cloudData.introduction || cloudData.section1Content || fallbackData.section1Content,
        section2Title: cloudData.section2Title || (contentType === 'campaign' ? '温馨提示' : fallbackData.section2Title),
        section2Content: cloudData.tips || cloudData.section2Content || fallbackData.section2Content,
        hasPractice: typeof cloudData.hasPractice === 'boolean' ? cloudData.hasPractice : fallbackData.hasPractice,
        videoUrl: normalizeMediaValue(cloudData.videoUrl) || fallbackData.videoUrl
      };

      this.setData({ article });
      this.checkStarStatus();
    } catch (error) {
      console.error('详情页云端内容加载失败：', error);
    }
  },

  async checkStarStatus() {
    const currentKey = this.getFavoriteKey(this.data.article);
    if (!currentKey) {
      this.setData({ isStarred: false });
      return;
    }

    const cachedFavorites = getContentFavoritesCache();
    const cachedStarred = cachedFavorites.some(item => item.favoriteKey === currentKey);
    this.setData({ isStarred: cachedStarred });

    if (!wx.cloud) return;

    try {
      const cloudStarred = await checkContentFavoriteInCloud(currentKey);
      this.setData({ isStarred: cloudStarred });
    } catch (error) {
      console.error('检查云端收藏状态失败：', error);
    }
  },

  getFavoriteKey(item) {
    return buildFavoriteKey(item);
  },

  async toggleStar() {
    const { privacyState, isLoggedIn } = getAccessSummary();
    if (privacyState.browseOnly || !privacyState.accepted) {
      wx.showToast({
        title: '仅完整功能模式下可收藏',
        icon: 'none'
      });
      return;
    }

    if (!isLoggedIn) {
      wx.showModal({
        title: '登录后可收藏',
        content: '内容收藏需要登录后使用，是否前往个人中心登录？',
        confirmText: '去登录',
        success: res => {
          if (!res.confirm) return;
          wx.switchTab({
            url: '/pages/profile/profile'
          });
        }
      });
      return;
    }

    const isStarred = !this.data.isStarred;
    const currentItem = {
      ...this.data.article,
      favoriteKey: this.getFavoriteKey(this.data.article)
    };

    wx.showLoading({ title: isStarred ? '收藏中...' : '取消中...' });

    try {
      if (isStarred) {
        await saveContentFavoriteToCloud(currentItem);
      } else {
        await removeContentFavoriteFromCloud(currentItem.favoriteKey);
      }

      this.setData({ isStarred });
      wx.showToast({
        title: isStarred ? '已加入收藏' : '已取消收藏',
        icon: 'success'
      });
    } catch (error) {
      console.error('切换内容收藏失败：', error);
      wx.showToast({
        title: '收藏同步失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  goToVideo() {
    const finalUrl = this.data.article.videoUrl;

    if (!finalUrl) {
      wx.showToast({
        title: this.data.article.contentType === 'campaign' ? '该活动暂无视频内容' : '该项目暂无视频教程',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/video-play/video-play?url=${encodeURIComponent(finalUrl)}&title=${encodeURIComponent(this.data.article.title || '')}&cover=${encodeURIComponent(this.data.article.cover || '')}`
    });
  },

  startPractice() {
    wx.showToast({
      title: '当前内容暂不支持打卡',
      icon: 'none'
    });
  },

  askAI() {
    wx.switchTab({
      url: '/pages/ai/ai'
    });
  }
})
