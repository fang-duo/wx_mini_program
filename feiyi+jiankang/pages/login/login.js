Page({
  data: {
    loading: false,
    showAvatarModal: false,
    showNicknameModal: false,
    userInfo: {
      avatarUrl: '',
      nickname: ''
    }
  },

  handleLogin() {
    console.log('handleLogin 被调用');
    if (this.data.loading) return;

    this.setData({ loading: true });

    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (userProfileRes) => {
        console.log('wx.getUserProfile 成功:', userProfileRes);
        const userProfile = userProfileRes.userInfo;
        
        const isAnonymous = !userProfile.avatarUrl || 
                           userProfile.nickName === '微信用户';
        
        if (isAnonymous) {
          console.log('获取到的是匿名数据，用户可能未授权或授权已过期');
          this.setData({
            userInfo: {
              avatarUrl: '',
              nickname: ''
            },
            showAvatarModal: true,
            loading: false
          });
          return;
        }
        
        this.setData({
          userInfo: {
            avatarUrl: userProfile.avatarUrl,
            nickname: userProfile.nickName
          },
          showAvatarModal: true,
          loading: false
        });
      },
      fail: (err) => {
        console.error('wx.getUserProfile 失败:', err);
        this.setData({ loading: false });
        
        if (err.errMsg && err.errMsg.includes('cancel')) {
          wx.showToast({ title: '已取消授权', icon: 'none' });
        } else {
          this.setData({
            userInfo: {
              avatarUrl: '',
              nickname: ''
            },
            showAvatarModal: true
          });
        }
      }
    });
  },

  selectWechatAvatar() {
    this.setData({ showAvatarModal: false });
    setTimeout(() => {
      this.setData({ showNicknameModal: true });
    }, 300);
  },

  selectFromAlbum() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatarUrl': tempFilePath,
          showAvatarModal: false
        });
        setTimeout(() => {
          this.setData({ showNicknameModal: true });
        }, 300);
      },
      fail: () => {
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  takePhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatarUrl': tempFilePath,
          showAvatarModal: false
        });
        setTimeout(() => {
          this.setData({ showNicknameModal: true });
        }, 300);
      },
      fail: () => {
        wx.showToast({ title: '拍照失败', icon: 'none' });
      }
    });
  },

  cancelAvatarModal() {
    this.setData({ showAvatarModal: false });
  },

  onNicknameInput(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  confirmNickname() {
    this.setData({ showNicknameModal: false });
    this.saveUserInfo();
  },

  cancelNicknameModal() {
    this.setData({ showNicknameModal: false });
  },

  async saveUserInfo() {
    this.setData({ loading: true });
    wx.showLoading({ title: '进入中...' });

    try {
      const { avatarUrl, nickname } = this.data.userInfo;
      const app = getApp();

      app.globalData.isLoggedIn = true;
      app.globalData.userInfo = { avatarUrl, nickname };
      wx.setStorageSync('local_user_info', { avatarUrl, nickname });

      try {
        const loginRes = await wx.cloud.callFunction({
          name: 'login'
        });
        if (loginRes.result && loginRes.result.openid) {
          app.globalData.openid = loginRes.result.openid;
          
          if (wx.cloud) {
            const db = wx.cloud.database();
            await db.collection('users').add({
              data: {
                openid: loginRes.result.openid,
                nickname: nickname,
                avatarUrl: avatarUrl,
                createTime: db.serverDate(),
                updateTime: db.serverDate()
              }
            });
          }
        }
      } catch (dbErr) {
        console.error('保存到数据库失败:', dbErr);
      }

      wx.hideLoading();
      wx.showToast({ title: '进入成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('进入失败:', error);
      wx.showToast({ title: '进入失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  stopPropagation() {
  },

  handleSkip() {
    wx.showToast({
      title: '已跳过',
      icon: 'none',
      duration: 1000
    });

    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' });
    }, 1000);
  },

  openPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '本应用重视用户隐私保护。我们承诺不会收集、使用或分享您的个人信息，除非经过您的明确授权。详细的隐私政策内容请查看我们的官方文档。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  openAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用遗韵养生应用。使用本应用即表示您同意遵守我们的用户协议。协议内容包括：用户权利与义务、服务条款、免责声明等。详细内容请查看我们的官方文档。',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
})
