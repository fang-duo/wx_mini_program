const {
  DEFAULT_APP_PREFERENCES,
  getAppPreferencesCache,
  setAppPreferencesCache,
  loadAppPreferencesFromCloud,
  saveAppPreferencesToCloud,
  getAppCacheKeys,
  clearAppCache,
  clearUserSessionCache,
  getCacheSizeBytes,
  formatBytes
} = require('../../utils/dataSync');

Page({
  data: {
    notify: DEFAULT_APP_PREFERENCES.notify,
    loadingPreferences: false,
    cacheSize: '0.0KB'
  },

  async onShow() {
    await this.loadPreferences();
    this.updateCacheSize();
  },

  async loadPreferences() {
    const cachedPreferences = getAppPreferencesCache();
    this.setData({
      notify: cachedPreferences.notify
    });
    getApp().globalData.appPreferences = { ...cachedPreferences };

    if (!wx.cloud) return;

    try {
      const cloudPreferences = await loadAppPreferencesFromCloud();
      if (!cloudPreferences) return;

      this.setData({
        notify: cloudPreferences.notify
      });
      getApp().globalData.appPreferences = { ...cloudPreferences };
    } catch (error) {
      console.error('加载设置失败：', error);
    } finally {
      this.setData({ loadingPreferences: false });
    }
  },

  async switchChange(e) {
    const type = e.currentTarget.dataset.type;
    const nextPreferences = {
      notify: this.data.notify,
      [type]: e.detail.value
    };

    this.setData({
      notify: nextPreferences.notify
    });
    setAppPreferencesCache(nextPreferences);
    getApp().globalData.appPreferences = { ...nextPreferences };

    if (!wx.cloud) {
      wx.showToast({
        title: '设置已保存到本地',
        icon: 'success'
      });
      return;
    }

    try {
      await saveAppPreferencesToCloud(nextPreferences);
      wx.showToast({
        title: '设置已同步',
        icon: 'success'
      });
    } catch (error) {
      console.error('保存设置失败：', error);
      wx.showToast({
        title: '已先保存到本地',
        icon: 'none'
      });
    }
  },

  updateCacheSize() {
    const cacheSize = formatBytes(getCacheSizeBytes(getAppCacheKeys()));
    this.setData({ cacheSize });
  },

  clearCache() {
    wx.showModal({
      title: '提示',
      content: '确定要清除本地缓存吗？这不会删除云端收藏和云端打卡记录。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清理中...' });
          setTimeout(() => {
            clearAppCache();
            wx.hideLoading();
            this.updateCacheSize();
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
          clearUserSessionCache();
          getApp().globalData.isLoggedIn = false;
          getApp().globalData.openid = '';
          getApp().globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
})
