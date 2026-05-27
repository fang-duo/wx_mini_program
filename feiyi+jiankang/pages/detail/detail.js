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

function createEmptyArticle({ title = '', itemId = '', contentType = 'heritage' } = {}) {
  const defaultTitle = title || (contentType === 'campaign' ? '活动详情' : '非遗详情');

  return {
    id: itemId,
    contentType,
    detailId: '',
    title: defaultTitle,
    cover: '',
    tag: contentType === 'campaign' ? '活动宣传' : '非遗内容',
    date: '',
    intro: '',
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
    loadingArticle: true,
    articleNotFound: false,
    isStarred: false,
    article: createEmptyArticle()
  },

  onLoad(options) {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    const title = decodeURIComponent(options.title || '');
    const itemId = decodeURIComponent(options.itemId || '');
    const contentType = decodeURIComponent(options.contentType || 'heritage');
    this.loadArticleData({ title, itemId, contentType });
  },

  onShow() {
    ensurePrivacyHomeLock(this, { allowAgreement: true });
  },

  async loadArticleData({ title, itemId, contentType }) {
    const emptyArticle = createEmptyArticle({ title, itemId, contentType });

    this.setData({
      loadingArticle: true,
      articleNotFound: false,
      isStarred: false,
      article: emptyArticle
    });
    wx.setNavigationBarTitle({ title: contentType === 'campaign' ? '活动详情' : '非遗详情' });

    if (!wx.cloud) {
      this.setData({
        loadingArticle: false,
        articleNotFound: true
      });
      wx.setNavigationBarTitle({ title: '暂无内容' });
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
            // Fallback to title query when the incoming itemId comes from local placeholder data.
          }
        }
        return collection.where({ title, status: true }).limit(1).get();
      });

      const cloudData = (detailRes.data && (Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data)) || null;
      if (!cloudData || (typeof cloudData.status === 'boolean' && !cloudData.status)) {
        this.setData({
          loadingArticle: false,
          articleNotFound: true
        });
        wx.setNavigationBarTitle({ title: '暂无内容' });
        return;
      }

      const article = {
        id: cloudData._id || itemId || '',
        contentType,
        detailId: cloudData.detailId || '',
        title: cloudData.title || emptyArticle.title,
        cover: normalizeMediaValue(cloudData.cover),
        tag: cloudData.tag || (contentType === 'campaign' ? '活动宣传' : '非遗内容'),
        date: cloudData.date || '',
        intro: cloudData.intro || cloudData.summary || cloudData.content || '',
        section1Title: cloudData.section1Title || ((cloudData.introduction || cloudData.section1Content) ? '内容介绍' : ''),
        section1Content: cloudData.introduction || cloudData.section1Content || '',
        section2Title: cloudData.section2Title || ((cloudData.tips || cloudData.section2Content) ? '补充说明' : ''),
        section2Content: cloudData.tips || cloudData.section2Content || '',
        hasPractice: typeof cloudData.hasPractice === 'boolean' ? cloudData.hasPractice : false,
        videoUrl: normalizeMediaValue(cloudData.videoUrl)
      };

      this.setData({
        article,
        loadingArticle: false,
        articleNotFound: false
      });
      wx.setNavigationBarTitle({ title: article.title || (contentType === 'campaign' ? '活动详情' : '非遗详情') });
      this.checkStarStatus();
    } catch (error) {
      console.error('详情页云端内容加载失败：', error);
      this.setData({
        loadingArticle: false,
        articleNotFound: true
      });
      wx.setNavigationBarTitle({ title: '暂无内容' });
    }
  },

  async checkStarStatus() {
    if (this.data.articleNotFound) {
      this.setData({ isStarred: false });
      return;
    }

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
