const {
  LOCAL_KEYS,
  loadUserInfoFromCloud,
  clearUserSessionCache,
  getCurrentOpenId
} = require('../../utils/dataSync');

const {
  getAccessSummary
} = require('../../utils/access');

const LOGIN_REDIRECT_KEY = 'post_login_redirect';

Page({
  data: {
    userInfo: {
      nickname: '',
      avatarUrl: ''
    },
    isLoggedIn: false,
    showLoginSheet: false,
    loginLoading: false
  },

  async onShow() {
    await this.refreshPageState();
  },

  async refreshPageState() {
    const { isLoggedIn } = getAccessSummary();
    const app = getApp();
    const localUserInfo = wx.getStorageSync(LOCAL_KEYS.USER_INFO);

    this.setData({
      isLoggedIn,
      showLoginSheet: false,
      loginLoading: false
    });

    if (!isLoggedIn) {
      this.setData({
        userInfo: {
          nickname: '',
          avatarUrl: ''
        }
      });
      return;
    }

    if (localUserInfo) {
      this.setData({ userInfo: { ...localUserInfo } });
      app.globalData.userInfo = { ...localUserInfo };
    }

    if (!isLoggedIn || !wx.cloud) return;

    try {
      const cloudUserInfo = await loadUserInfoFromCloud();
      if (!cloudUserInfo) return;

      const mergedUserInfo = {
        ...cloudUserInfo,
        ...this.data.userInfo
      };

      this.setData({ userInfo: { ...mergedUserInfo } });
      app.globalData.userInfo = { ...mergedUserInfo };
      wx.setStorageSync(LOCAL_KEYS.USER_INFO, { ...mergedUserInfo });
    } catch (error) {
      console.error('加载云端用户信息失败：', error);
    }
  },

  openLoginSheet() {
    this.setData({ showLoginSheet: true });
  },

  closeLoginSheet() {
    this.setData({
      showLoginSheet: false
    });
  },

  continueGuestMode() {
    this.closeLoginSheet();
    wx.showToast({
      title: '当前可继续浏览内容',
      icon: 'none'
    });
  },

  consumePendingLoginRedirect() {
    const redirectTarget = wx.getStorageSync(LOGIN_REDIRECT_KEY);
    wx.removeStorageSync(LOGIN_REDIRECT_KEY);

    if (!redirectTarget || typeof redirectTarget !== 'object' || !redirectTarget.url) {
      return null;
    }

    return redirectTarget;
  },

  runPendingLoginRedirect() {
    const redirectTarget = this.consumePendingLoginRedirect();
    if (!redirectTarget) {
      return false;
    }

    const navigate = redirectTarget.mode === 'switchTab'
      ? wx.switchTab
      : wx.navigateTo;

    setTimeout(() => {
      navigate({
        url: redirectTarget.url
      });
    }, 800);

    return true;
  },

  async submitLogin() {
    if (this.data.loginLoading) return;

    this.setData({ loginLoading: true });
    wx.showLoading({ title: '登录中...' });

    if (!wx.cloud) {
      wx.hideLoading();
      this.setData({ loginLoading: false });
      wx.showToast({
        title: '当前服务暂时不可用，请稍后再试',
        icon: 'none'
      });
      return;
    }

    try {
      const loginRes = await wx.cloud.callFunction({
        name: 'login'
      });
      const result = loginRes && loginRes.result ? loginRes.result : {};

      if (!result.success || !result.openid) {
        throw new Error(result.error || '未获取到有效登录态');
      }

      const app = getApp();
      const cachedUserInfo = wx.getStorageSync(LOCAL_KEYS.USER_INFO) || {};
      const cloudUserInfo = result.userInfo || {};
      const userInfo = {
        _id: cloudUserInfo._id || cachedUserInfo._id || '',
        openid: result.openid,
        nickname: cloudUserInfo.nickname || cachedUserInfo.nickname || '',
        avatarUrl: cloudUserInfo.avatarUrl || cachedUserInfo.avatarUrl || '',
        loggedIn: true
      };

      app.globalData.openid = result.openid;
      app.globalData.isLoggedIn = true;
      app.globalData.userInfo = { ...userInfo };
      wx.setStorageSync(LOCAL_KEYS.USER_INFO, { ...userInfo });

      const saveResult = await this.saveUserToCloud(userInfo);
      if (saveResult && saveResult._id) {
        userInfo._id = saveResult._id;
        app.globalData.userInfo = { ...userInfo };
        wx.setStorageSync(LOCAL_KEYS.USER_INFO, { ...userInfo });
      }

      await this.refreshPageState();

      const redirected = this.runPendingLoginRedirect();

      wx.showToast({
        title: redirected ? '登录成功，正在返回' : '登录成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('真实登录失败：', error);
      wx.showToast({
        title: '登录失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
      this.setData({
        loginLoading: false,
        showLoginSheet: false
      });
    }
  },

  showLoginRequiredDialog(featureName, redirectTarget) {
    wx.showModal({
      title: '登录后可用',
      content: `${featureName}需要登录后才可使用，是否现在去登录？`,
      confirmText: '去登录',
      success: res => {
        if (!res.confirm) return;
        if (redirectTarget && redirectTarget.url) {
          wx.setStorageSync(LOGIN_REDIRECT_KEY, redirectTarget);
        }
        this.openLoginSheet();
      }
    });
  },

  onNicknameInput(e) {
    const { value } = e.detail;
    if (!value) return;

    const newUserInfo = { ...this.data.userInfo, nickname: value };
    this.setData({ userInfo: newUserInfo });
    getApp().globalData.userInfo = { ...newUserInfo };
    wx.setStorageSync(LOCAL_KEYS.USER_INFO, newUserInfo);
  },

  async onNicknameBlur(e) {
    const { value } = e.detail;
    if (!value) return;

    const newUserInfo = { ...this.data.userInfo, nickname: value };
    await this.saveUserToCloud(newUserInfo);
  },

  async saveUserToCloud(userInfo) {
    if (!wx.cloud) return null;

    const db = wx.cloud.database();
    const _ = db.command;
    try {
      const openid = await getCurrentOpenId();
      const updatePayload = {
        nickname: userInfo.nickname,
        avatarUrl: userInfo.avatarUrl,
        updateTime: db.serverDate()
      };

      if (openid) {
        updatePayload.openid = openid;
      }

      if (userInfo._id) {
        await db.collection('users').doc(userInfo._id).update({
          data: updatePayload
        });
        return { _id: userInfo._id };
      } else {
        if (!openid) {
          return null;
        }

        const existed = openid
          ? await db.collection('users').where(_.or([
              { _openid: openid },
              { openid: openid }
            ])).limit(1).get()
          : { data: [] };

        if (existed.data && existed.data.length) {
          const existedDoc = existed.data[0];
          await db.collection('users').doc(existedDoc._id).update({
            data: updatePayload
          });

          getApp().globalData.userInfo._id = existedDoc._id;
          this.setData({ 'userInfo._id': existedDoc._id });
          wx.setStorageSync(LOCAL_KEYS.USER_INFO, {
            ...getApp().globalData.userInfo,
            _id: existedDoc._id
          });

          return { _id: existedDoc._id };
        }

        const res = await db.collection('users').add({
          data: {
            openid,
            nickname: userInfo.nickname,
            avatarUrl: userInfo.avatarUrl,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        
        getApp().globalData.userInfo._id = res._id;
        this.setData({ 'userInfo._id': res._id });
        wx.setStorageSync(LOCAL_KEYS.USER_INFO, { ...getApp().globalData.userInfo });
        
        return { _id: res._id };
      }
    } catch (error) {
      console.error('保存用户信息失败：', error);
      return null;
    }
  },

  async chooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) return;

    wx.showLoading({ title: '更新中...' });

    try {
      let finalAvatarUrl = avatarUrl;

      if (wx.cloud) {
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: avatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      const newUserInfo = { ...this.data.userInfo, avatarUrl: finalAvatarUrl };
      this.setData({ userInfo: newUserInfo });
      getApp().globalData.userInfo = { ...newUserInfo };
      
      wx.setStorageSync(LOCAL_KEYS.USER_INFO, newUserInfo);
      
      await this.saveUserToCloud(newUserInfo);

      wx.hideLoading();
      wx.showToast({ title: '头像更新成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      console.error('更新头像失败：', error);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  handleMenuClick(e) {
    const title = e.currentTarget.dataset.title;

    if (!this.data.isLoggedIn && ['账号信息管理', '我的收藏内容'].includes(title)) {
      const redirectTarget = title === '账号信息管理'
        ? { mode: 'navigateTo', url: '/pages/account/account' }
        : { mode: 'navigateTo', url: '/pages/favorites/favorites' };
      this.showLoginRequiredDialog(title, redirectTarget);
      return;
    }

    if (title === '账号信息管理') {
      wx.navigateTo({ url: '/pages/account/account' });
    } else if (title === '我的收藏内容') {
      wx.navigateTo({ url: '/pages/favorites/favorites' });
    } else if (title === '帮助与反馈') {
      wx.navigateTo({ url: '/pages/feedback/feedback' });
    } else if (title === '设置') {
      wx.navigateTo({ url: '/pages/settings/settings' });
    } else {
      wx.showToast({
        title: title + ' 当前暂不可用',
        icon: 'none'
      });
    }
  },

  switchAccount() {
    wx.showModal({
      title: '切换账号',
      content: '确定要切换当前账号吗？',
      success: res => {
        if (res.confirm) {
          clearUserSessionCache();
          getApp().globalData.isLoggedIn = false;
          getApp().globalData.openid = '';
          getApp().globalData.userInfo = {
            nickname: '',
            avatarUrl: ''
          };
          this.refreshPageState();
        }
      }
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: res => {
        if (res.confirm) {
          clearUserSessionCache();
          getApp().globalData.isLoggedIn = false;
          getApp().globalData.openid = '';
          getApp().globalData.userInfo = {
            nickname: '',
            avatarUrl: ''
          };
          this.refreshPageState();
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  stopPropagation() {
  }
})
