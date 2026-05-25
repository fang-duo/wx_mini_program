Page({
  data: {
    userInfo: {}
  },

  onShow() {
    const app = getApp();
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo });
    }
  },

  inputNickname(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  changeAvatar() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.setData({
          'userInfo.avatarUrl': tempFilePath
        });
      }
    });
  },

  saveInfo() {
    // 同步到全局
    getApp().globalData.userInfo = this.data.userInfo;
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
})