const {
  getContentFavoritesCache,
  fetchContentFavoritesFromCloud
} = require('../../utils/dataSync');

const {
  getAccessSummary
} = require('../../utils/access');

const LOGIN_REDIRECT_KEY = 'post_login_redirect';

Page({
  data: {
    favorites: [],
    loading: false,
    accessDenied: false,
    deniedReason: ''
  },

  async onShow() {
    const { isLoggedIn } = getAccessSummary();

    if (!isLoggedIn) {
      this.setData({
        accessDenied: true,
        deniedReason: '登录后可查看和同步首页收藏。'
      });
      return;
    }

    this.setData({
      accessDenied: false,
      deniedReason: ''
    });

    const cachedFavorites = getContentFavoritesCache();
    this.setData({ favorites: cachedFavorites });

    if (!wx.cloud) return;

    this.setData({ loading: true });
    try {
      const favorites = await fetchContentFavoritesFromCloud();
      this.setData({ favorites });
    } catch (error) {
      console.error('加载首页收藏失败：', error);
      if (!cachedFavorites.length) {
        wx.showToast({
          title: '收藏内容加载失败，请稍后重试',
          icon: 'none'
        });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const title = e.currentTarget.dataset.title;
    const itemId = e.currentTarget.dataset.itemId || '';
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
  },

  goToProfile() {
    wx.setStorageSync(LOGIN_REDIRECT_KEY, {
      mode: 'navigateTo',
      url: '/pages/favorites/favorites'
    });
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  }
})
