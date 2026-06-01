const {
  buildFavoriteKey,
  getContentFavoritesCache,
  checkContentFavoriteInCloud,
  saveContentFavoriteToCloud,
  removeContentFavoriteFromCloud
} = require('../../utils/dataSync');

const {
  getAccessSummary
} = require('../../utils/access');

const LOGIN_REDIRECT_KEY = 'post_login_redirect';

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

Page({
  data: {
    isStarred: false,
    loading: true,
    loadErrorTitle: '',
    loadErrorDesc: '',
    article: null
  },

  onLoad(options) {
    const title = decodeURIComponent(options.title || '内容详情');
    const itemId = decodeURIComponent(options.itemId || '');
    const contentType = decodeURIComponent(options.contentType || 'heritage');
    this.loadArticleData({ title, itemId, contentType });
  },

  showLoadError(title, desc) {
    this.setData({
      loading: false,
      loadErrorTitle: title,
      loadErrorDesc: desc,
      article: null,
      isStarred: false
    });
  },

  async loadArticleData({ title, itemId, contentType }) {
    this.setData({
      loading: true,
      loadErrorTitle: '',
      loadErrorDesc: '',
      article: null,
      isStarred: false
    });
    wx.setNavigationBarTitle({ title: contentType === 'campaign' ? '活动详情' : '非遗详情' });

    if (!wx.cloud) {
      this.showLoadError('内容暂不可用', '当前环境暂不支持读取云端内容，请稍后再试。');
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
        this.showLoadError('暂无正式内容', '当前内容尚未在云端发布，请稍后再来查看。');
        return;
      }

      const article = {
        id: cloudData._id || itemId || '',
        contentType,
        detailId: cloudData.detailId || '',
        title: cloudData.title || title || (contentType === 'campaign' ? '活动详情' : '非遗详情'),
        cover: normalizeMediaValue(cloudData.cover),
        tag: cloudData.tag || (contentType === 'campaign' ? '活动宣传' : '非遗内容'),
        date: cloudData.date || '',
        intro: cloudData.intro || cloudData.content || '',
        section1Title: cloudData.section1Title || (contentType === 'campaign' ? '活动介绍' : ''),
        section1Content: cloudData.introduction || cloudData.section1Content || '',
        section2Title: cloudData.section2Title || (contentType === 'campaign' ? '温馨提示' : ''),
        section2Content: cloudData.tips || cloudData.section2Content || '',
        hasPractice: typeof cloudData.hasPractice === 'boolean' ? cloudData.hasPractice : false,
        videoUrl: normalizeMediaValue(cloudData.videoUrl)
      };

      this.setData({
        article,
        loading: false,
        loadErrorTitle: '',
        loadErrorDesc: ''
      });
      this.checkStarStatus();
    } catch (error) {
      console.error('详情页云端内容加载失败：', error);
      this.showLoadError('内容加载失败', '正式内容读取失败，请稍后重试。');
    }
  },

  async checkStarStatus() {
    if (!this.data.article) {
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
    if (!item) return '';
    return buildFavoriteKey(item);
  },

  async toggleStar() {
    const { isLoggedIn } = getAccessSummary();
    if (!isLoggedIn) {
      wx.showModal({
        title: '登录后可收藏',
        content: '内容收藏需要登录后使用，是否前往个人中心登录？',
        confirmText: '去登录',
        success: res => {
          if (!res.confirm) return;
          const currentArticle = this.data.article || {};
          const redirectQuery = [
            `title=${encodeURIComponent(currentArticle.title || '')}`,
            `contentType=${encodeURIComponent(currentArticle.contentType || 'heritage')}`
          ];
          if (currentArticle.id) {
            redirectQuery.push(`itemId=${encodeURIComponent(currentArticle.id)}`);
          }
          wx.setStorageSync(LOGIN_REDIRECT_KEY, {
            mode: 'navigateTo',
            url: `/pages/detail/detail?${redirectQuery.join('&')}`
          });
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
    if (!this.data.article) return;
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
  }
})
