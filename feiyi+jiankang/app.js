App({
  onLaunch: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud2-d5gq377icbed53c7e',
        traceUser: true,
      })
    }

    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    
    const localUserInfo = wx.getStorageSync('local_user_info')
    if (localUserInfo && localUserInfo.nickname && localUserInfo.nickname !== '点击获取昵称' && localUserInfo.nickname !== '体验用户') {
      this.globalData.userInfo = { ...localUserInfo }
    }
  },

  globalData: {
    userInfo: { 
      nickname: '', 
      avatarUrl: ''
    },
    isLoggedIn: true
  }
})