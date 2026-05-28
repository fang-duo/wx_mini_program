Page({
  data: {
    inputValue: '',
    // 确保这里的变量名与 wxml 中的 wx:for 循环对象一致
    chatList: [{ 
      id: 'first', 
      role: 'ai', 
      content: '您好，我是遗韵养生 AI 助手。请问有什么我可以帮您的？' 
    }],
    scrollToMessage: '' // 用于控制页面滚动
  },

  // 绑定输入框内容
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 发送消息
  onSend() {
    const text = this.data.inputValue.trim();
    if (!text) return;

    // 1. 先把用户提问展示在页面上
    const userMsg = { 
      id: `user-${Date.now()}`, 
      role: 'user', 
      content: text 
    };

    this.setData({
      chatList: [...this.data.chatList, userMsg],
      inputValue: '', // 清空输入框
      scrollToMessage: `msg-${userMsg.id}` // 滚动到用户消息
    });

    wx.showLoading({ title: 'AI思考中...' });

    // 2. 调用云函数 aiChat
    wx.cloud.callFunction({
      name: 'aiChat',
      data: { 
        userInput: text 
      },
      success: res => {
        console.log("云函数返回原始数据：", res.result);

        // 判定云函数返回是否成功，并读取 answer 字段
        if (res.result && res.result.success) {
          const aiMsg = { 
            id: `ai-${Date.now()}`, 
            role: 'ai', 
            content: res.result.answer // 对应云函数返回的 answer
          };

          this.setData({
            chatList: [...this.data.chatList, aiMsg],
            scrollToMessage: `msg-${aiMsg.id}` // 自动滚动到 AI 的回答
          });
        } else {
          wx.showToast({
            title: '助理暂时掉线了',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error("云函数调用失败：", err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 如果你有点击“猜你想问”的快捷功能，可以复用这个逻辑
  onTapRecommend(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputValue: text }, () => {
      this.onSend();
    });
  }
})
