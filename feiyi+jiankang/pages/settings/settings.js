Page({
  data: {
    notify: true,
    darkMode: false,
    cacheSize: '12.5MB'
  },

  switchChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      [type]: e.detail.value
    });
  },

  clearCache() {
    wx.showModal({
      title: '提示',
      content: '确定要清除本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清理中...' });
          setTimeout(() => {
            wx.hideLoading();
            this.setData({ cacheSize: '0.0MB' });
            wx.showToast({ title: '清理完成', icon: 'success' });
          }, 1000);
        }
      }
    });
  },

  checkUpdate() {
    wx.showToast({
      title: '当前已是最新版本',
      icon: 'none'
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于遗韵养生',
      content: '一款致力于传承非物质文化遗产与倡导健康生活方式的小程序。\n\n版本：v1.0.0',
      showCancel: false
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success(res) {
        if (res.confirm) {
          getApp().globalData.isLoggedIn = false;
          getApp().globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
})