const {
  LOCAL_KEYS,
  loadUserInfoFromCloud,
  clearUserSessionCache,
  getCurrentOpenId
} = require('../../utils/dataSync');

Page({
  data: {
    userInfo: {
      nickname: '',
      avatarUrl: ''
    }
  },

  async onShow() {
    const app = getApp();
    const localUserInfo = wx.getStorageSync(LOCAL_KEYS.USER_INFO);
    
    if (localUserInfo && localUserInfo.nickname) {
      this.setData({ userInfo: { ...localUserInfo } });
      app.globalData.userInfo = { ...localUserInfo };
    }

    if (!wx.cloud) return;

    try {
      const cloudUserInfo = await loadUserInfoFromCloud();
      if (!cloudUserInfo) return;

      this.setData({ userInfo: { ...cloudUserInfo } });
      app.globalData.userInfo = { ...cloudUserInfo };
      wx.setStorageSync(LOCAL_KEYS.USER_INFO, { ...cloudUserInfo });
    } catch (error) {
      console.error('加载云端用户信息失败：', error);
    }
  },

  async onNicknameBlur(e) {
    const { value } = e.detail;
    if (!value) return;

    const newUserInfo = { ...this.data.userInfo, nickname: value };
    this.setData({ userInfo: newUserInfo });
    getApp().globalData.userInfo = { ...newUserInfo };
    
    wx.setStorageSync(LOCAL_KEYS.USER_INFO, newUserInfo);
    
    await this.saveUserToCloud(newUserInfo);
  },

  async saveUserToCloud(userInfo) {
    if (!wx.cloud) return null;

    const db = wx.cloud.database();
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
          ? await db.collection('users').where({ openid }).limit(1).get()
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
    
    if (title === '账号信息管理') {
      wx.navigateTo({ url: '/pages/account/account' });
    } else if (title === '我的收藏内容') {
      wx.navigateTo({ url: '/pages/favorites/favorites' });
    } else if (title === 'AI问答收藏') {
      wx.navigateTo({ url: '/pages/message/message' });
    } else if (title === '帮助与反馈') {
      wx.navigateTo({ url: '/pages/feedback/feedback' });
    } else if (title === '设置') {
      wx.navigateTo({ url: '/pages/settings/settings' });
    } else {
      wx.showToast({
        title: title + ' 功能开发中',
        icon: 'none'
      });
    }
  },

  switchAccount() {
    wx.showModal({
      title: '切换账号',
      content: '确定要切换当前账号吗？',
      success(res) {
        if (res.confirm) {
          clearUserSessionCache();
          getApp().globalData.isLoggedIn = false;
          getApp().globalData.openid = '';
          getApp().globalData.userInfo = null;
          wx.redirectTo({ url: '/pages/login/login' });
        }
      }
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
          wx.redirectTo({ url: '/pages/login/login' });
        }
      }
    });
  }
})
