const {
  getContentFavoritesCache,
  fetchContentFavoritesFromCloud
} = require('../../utils/dataSync');

const {
  getAccessSummary,
  ensurePrivacyHomeLock
} = require('../../utils/access');

Page({
  data: {
    favorites: [],
    loading: false,
    accessDenied: false,
    deniedReason: ''
  },

  async onShow() {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }

    const { privacyState, isLoggedIn } = getAccessSummary();
    if (privacyState.browseOnly || !privacyState.accepted) {
      this.setData({
        accessDenied: true,
        deniedReason: '当前处于仅浏览模式，首页收藏功能暂不可用。'
      });
      return;
    }

    if (!isLoggedIn) {
      this.setData({
        accessDenied: true,
        deniedReason: '首页收藏需要登录后查看和同步。'
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
          title: '云端收藏加载失败',
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
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  }
})
