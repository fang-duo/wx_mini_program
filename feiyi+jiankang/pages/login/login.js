Page({
  data: {
    currentTab: 'login', // login, register, forgot
    phone: '',
    password: '',
    code: ''
  },
  
  switchTab(e) {
    this.setData({
      currentTab: e.currentTarget.dataset.tab,
      phone: '',
      password: '',
      code: ''
    });
  },

  goToForgot() {
    this.setData({
      currentTab: 'forgot'
    });
  },

  inputPhone(e) {
    this.setData({ phone: e.detail.value });
  },

  inputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  inputCode(e) {
    this.setData({ code: e.detail.value });
  },

  sendCode() {
    if (!this.data.phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    wx.showToast({ title: '验证码已发送', icon: 'success' });
  },

  handleLogin() {
    if (!this.data.phone || !this.data.password) {
      wx.showToast({ title: '请输入完整信息', icon: 'none' });
      return;
    }
    // 模拟登录成功
    getApp().globalData.isLoggedIn = true;
    getApp().globalData.userInfo = { phone: this.data.phone };
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  handleRegisterOrReset() {
    if (!this.data.phone || !this.data.password || !this.data.code) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    wx.showToast({
      title: this.data.currentTab === 'register' ? '注册成功' : '重置成功',
      icon: 'success'
    });
    setTimeout(() => {
      this.setData({ currentTab: 'login' });
    }, 1500);
  }
})
