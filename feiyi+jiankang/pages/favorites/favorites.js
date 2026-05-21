const {
  getContentFavoritesCache,
  fetchContentFavoritesFromCloud
} = require('../../utils/dataSync');

Page({
  data: {
    favorites: [],
    loading: false
  },

  async onShow() {
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
  }
})
