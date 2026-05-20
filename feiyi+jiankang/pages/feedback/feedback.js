Page({
  data: {
    content: '',
    contact: '',
    faqs: [
      {
        id: 1,
        q: '如何更换个人头像？',
        a: '在“个人中心”或“账号信息管理”页面，直接点击当前的头像图片，即可从手机相册中选择新照片进行更换。',
        open: false
      },
      {
        id: 2,
        q: '我的收藏在哪里查看？',
        a: '在“个人中心”页面点击“我的收藏内容”菜单，即可查看您所有已收藏的非遗文章与功法。',
        open: false
      },
      {
        id: 3,
        q: 'AI问答回复太慢怎么办？',
        a: 'AI需要进行数据检索与生成，通常需要1-3秒的响应时间，请您耐心等待。如遇网络不佳，请尝试切换网络环境。',
        open: false
      }
    ]
  },

  inputContent(e) {
    this.setData({ content: e.detail.value });
  },

  inputContact(e) {
    this.setData({ contact: e.detail.value });
  },

  toggleFaq(e) {
    const index = e.currentTarget.dataset.index;
    const faqs = this.data.faqs;
    faqs[index].open = !faqs[index].open;
    this.setData({ faqs });
  },

  async submitFeedback() {
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '提交中...' });
    
    try {
      if (wx.cloud) {
        const db = wx.cloud.database();
        await db.collection('user_feedback').add({
          data: {
            content: this.data.content,
            contact: this.data.contact || '',
            status: '待处理',
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
      }
      
      wx.hideLoading();
      wx.showToast({ title: '感谢您的反馈', icon: 'success' });
      
      this.setData({ content: '', contact: '' });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('提交反馈失败：', error);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  }
})