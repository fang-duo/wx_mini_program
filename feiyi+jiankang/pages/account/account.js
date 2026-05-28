const {
  getAccessSummary,
  ensurePrivacyHomeLock
} = require('../../utils/access');

Page({
  data: {
    userInfo: {},
    accessDenied: false
  },

  onShow() {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }

    const { privacyState, isLoggedIn } = getAccessSummary();
    if (privacyState.browseOnly || !privacyState.accepted || !isLoggedIn) {
      this.setData({ accessDenied: true });
      return;
    }

    this.setData({ accessDenied: false });
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

  goToProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  }
})
