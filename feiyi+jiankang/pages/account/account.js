const {
  LOCAL_KEYS,
  getCurrentOpenId
} = require('../../utils/dataSync');

const { getAccessSummary } = require('../../utils/access');

const LOGIN_REDIRECT_KEY = 'post_login_redirect';

function normalizeUserInfo(userInfo = {}) {
  return {
    _id: userInfo._id || '',
    openid: userInfo.openid || '',
    nickname: typeof userInfo.nickname === 'string' ? userInfo.nickname : '',
    avatarUrl: typeof userInfo.avatarUrl === 'string' ? userInfo.avatarUrl : '',
    loggedIn: true
  };
}

Page({
  data: {
    userInfo: normalizeUserInfo(),
    accessDenied: false,
    saving: false
  },

  onShow() {
    const { isLoggedIn } = getAccessSummary();
    if (!isLoggedIn) {
      this.setData({
        accessDenied: true,
        saving: false
      });
      return;
    }

    this.setData({ accessDenied: false });
    const app = getApp();
    const localUserInfo = wx.getStorageSync(LOCAL_KEYS.USER_INFO) || {};
    const nextUserInfo = normalizeUserInfo({
      ...localUserInfo,
      ...(app.globalData.userInfo || {})
    });

    this.setData({ userInfo: nextUserInfo });
    app.globalData.userInfo = { ...nextUserInfo };
  },

  inputNickname(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  async changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          'userInfo.avatarUrl': tempFilePath
        });
      }
    });
  },

  async uploadAvatarIfNeeded(avatarUrl) {
    if (!avatarUrl || !wx.cloud || avatarUrl.startsWith('cloud://') || avatarUrl.startsWith('http')) {
      return avatarUrl;
    }

    const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.jpg`;
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl
    });
    return uploadRes.fileID || avatarUrl;
  },

  async saveUserInfo() {
    if (this.data.saving) return;

    const nickname = (this.data.userInfo.nickname || '').trim();
    if (!nickname) {
      wx.showToast({
        title: '请输入昵称后再保存',
        icon: 'none'
      });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const savedUserInfo = await this.persistUserInfo({
        ...this.data.userInfo,
        nickname
      });

      this.setData({
        userInfo: savedUserInfo
      });

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('保存账号信息失败：', error);
      wx.showToast({
        title: '保存失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },

  async persistUserInfo(userInfo) {
    const app = getApp();
    const nextUserInfo = normalizeUserInfo({
      ...(app.globalData.userInfo || {}),
      ...userInfo
    });

    const openid = nextUserInfo.openid || app.globalData.openid || await getCurrentOpenId();
    if (!openid) {
      throw new Error('未获取到有效登录身份');
    }

    nextUserInfo.openid = openid;
    nextUserInfo.avatarUrl = await this.uploadAvatarIfNeeded(nextUserInfo.avatarUrl);

    if (wx.cloud) {
      const db = wx.cloud.database();
      const _ = db.command;
      const updatePayload = {
        openid,
        nickname: nextUserInfo.nickname,
        avatarUrl: nextUserInfo.avatarUrl,
        updateTime: db.serverDate()
      };

      if (nextUserInfo._id) {
        await db.collection('users').doc(nextUserInfo._id).update({
          data: updatePayload
        });
      } else {
        const existed = await db.collection('users').where(_.or([
          { _openid: openid },
          { openid }
        ])).limit(1).get();

        if (existed.data && existed.data.length) {
          nextUserInfo._id = existed.data[0]._id;
          await db.collection('users').doc(nextUserInfo._id).update({
            data: updatePayload
          });
        } else {
          const addRes = await db.collection('users').add({
            data: {
              ...updatePayload,
              createTime: db.serverDate()
            }
          });
          nextUserInfo._id = addRes._id;
        }
      }
    }

    app.globalData.openid = openid;
    app.globalData.isLoggedIn = true;
    app.globalData.userInfo = { ...nextUserInfo };
    wx.setStorageSync(LOCAL_KEYS.USER_INFO, { ...nextUserInfo });

    return nextUserInfo;
  },

  goToProfile() {
    wx.setStorageSync(LOGIN_REDIRECT_KEY, {
      mode: 'navigateTo',
      url: '/pages/account/account'
    });
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  }
})
