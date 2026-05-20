Page({
  data: {
    favorites: []
  },

  onShow() {
    // 每次显示页面时，从本地存储读取最新收藏列表
    const favorites = wx.getStorageSync('favorites') || [];
    this.setData({ favorites });
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
