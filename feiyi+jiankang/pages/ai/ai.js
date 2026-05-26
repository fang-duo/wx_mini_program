const DEFAULT_MESSAGE = {
  id: 'welcome',
  role: 'ai',
  content: '您好，我是非遗健康AI助手。请问有什么我可以帮您的？'
};

const {
  saveAiFavoritesToCloud
} = require('../../utils/dataSync');

const {
  getAccessSummary,
  ensurePrivacyHomeLock
} = require('../../utils/access');

const EXIT_REMIND_DISABLED_KEY = 'ai_exit_remind_disabled';
const FAVORITES_COLLECTION = 'ai_favorites';

function createDefaultMessages() {
  return [{ ...DEFAULT_MESSAGE }];
}

function decorateMessages(messages, qaPairs) {
  return messages.map(item => {
    if (!item.pairId) {
      return item;
    }

    const pair = qaPairs.find(pairItem => pairItem.id === item.pairId);
    return {
      ...item,
      pairSelected: !!(pair && pair.selected),
      pairIsFavorite: !!(pair && pair.isFavorite),
      pairSelectable: !!(pair && pair.answer && !pair.isFavorite && !pair.failed)
    };
  });
}

Page({
  data: {
    inputValue: '',
    messages: createDefaultMessages(),
    qaPairs: [],
    recommends: [
      '鹤舞养生怎么做？',
      '秋季适合喝什么养生茶？',
      '推拿有哪些注意事项？',
      '古琴音乐如何疗愈情绪？'
    ],
    scrollToMessage: '',
    isBatchMode: false,
    isAllSelected: false,
    selectedCount: 0,
    remindDisabled: false,
    sessionTipDeferred: false,
    isBrowseOnly: false,
    isLoggedIn: false
  },

  onLoad() {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    this.sessionStamp = Date.now();
    this.setData({
      remindDisabled: !!wx.getStorageSync(EXIT_REMIND_DISABLED_KEY)
    });
    this.refreshAccessState();
    this.updateLeaveReminder();
  },

  onShow() {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    this.refreshAccessState();
    this.updateLeaveReminder();
  },

  onTabItemTap() {
    ensurePrivacyHomeLock(this, { allowAgreement: true, showToast: true });
  },

  onHide() {
    this.resetSession();
  },

  onUnload() {
    this.resetSession();
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSendTag(e) {
    this.setData({ inputValue: e.currentTarget.dataset.text }, () => {
      this.onSend();
    });
  },

  onSend() {
    if (this.data.isBrowseOnly) {
      wx.showToast({
        title: '仅浏览模式下不可使用 AI 问答',
        icon: 'none'
      });
      return;
    }

    const text = this.data.inputValue.trim();
    if (!text) return;

    const pairId = `pair-${Date.now()}`;
    const userMsg = {
      id: `user-${pairId}`,
      role: 'user',
      content: text,
      pairId
    };

    const qaPair = {
      id: pairId,
      question: text,
      answer: '',
      selected: false,
      isFavorite: false,
      failed: false,
      timeText: this.formatTime(new Date())
    };

    const sessionStamp = this.sessionStamp;

    const nextMessages = decorateMessages([...this.data.messages, userMsg], [...this.data.qaPairs, qaPair]);

    this.setData({
      messages: nextMessages,
      qaPairs: [...this.data.qaPairs, qaPair],
      inputValue: '',
      scrollToMessage: `msg-${userMsg.id}`
    }, () => {
      this.updateSelectionState();
      this.updateLeaveReminder();
    });

    wx.showLoading({ title: '思考中...' });

    wx.cloud.callFunction({
      name: 'aiChat',
      data: { userInput: text },
      success: res => {
        if (sessionStamp !== this.sessionStamp) return;

        const success = !!(res.result && res.result.success);
        const answer = success && res.result.answer
          ? res.result.answer
          : '抱歉，本次回答暂时生成失败，请稍后重试。';

        const aiMsg = {
          id: `ai-${pairId}`,
          role: 'ai',
          content: answer,
          pairId,
          failed: !success
        };

        const qaPairs = this.data.qaPairs.map(item => {
          if (item.id !== pairId) return item;
          return {
            ...item,
            answer,
            failed: !success
          };
        });

        this.setData({
          messages: decorateMessages([...this.data.messages, aiMsg], qaPairs),
          qaPairs,
          scrollToMessage: `msg-${aiMsg.id}`
        }, () => {
          this.updateSelectionState();
          this.updateLeaveReminder();
        });
      },
      fail: err => {
        if (sessionStamp !== this.sessionStamp) return;

        console.error('云函数调用失败', err);
        const failAnswer = '抱歉，当前网络或服务异常，请稍后再试。';
        const aiMsg = {
          id: `ai-${pairId}`,
          role: 'ai',
          content: failAnswer,
          pairId,
          failed: true
        };

        const qaPairs = this.data.qaPairs.map(item => {
            if (item.id !== pairId) return item;
            return {
              ...item,
              answer: failAnswer,
              failed: true
            };
          });

        this.setData({
          messages: decorateMessages([...this.data.messages, aiMsg], qaPairs),
          qaPairs,
          scrollToMessage: `msg-${aiMsg.id}`
        }, () => {
          this.updateSelectionState();
          this.updateLeaveReminder();
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  toggleBatchMode() {
    if (!this.data.isLoggedIn) {
      this.promptLogin('收藏 AI 问答');
      return;
    }

    const selectablePairs = this.getSelectablePairs();
    if (!selectablePairs.length) {
      wx.showToast({
        title: '暂无可收藏问答',
        icon: 'none'
      });
      return;
    }

    const isBatchMode = !this.data.isBatchMode;
    const qaPairs = this.data.qaPairs.map(item => ({
      ...item,
      selected: false
    }));

    this.setData({
      isBatchMode,
      qaPairs,
      messages: decorateMessages(this.data.messages, qaPairs),
      isAllSelected: false,
      selectedCount: 0
    });
  },

  onMessageTap(e) {
    if (!this.data.isBatchMode) return;

    const { pairId } = e.currentTarget.dataset;
    const target = this.data.qaPairs.find(item => item.id === pairId);
    if (!target || !this.isSelectablePair(target)) return;

    const qaPairs = this.data.qaPairs.map(item => {
      if (item.id !== pairId) return item;
      return {
        ...item,
        selected: !item.selected
      };
    });

    this.setData({
      qaPairs,
      messages: decorateMessages(this.data.messages, qaPairs)
    }, () => {
      this.updateSelectionState();
    });
  },

  toggleSelectAll() {
    const selectablePairs = this.getSelectablePairs();
    if (!selectablePairs.length) return;

    const shouldSelectAll = !this.data.isAllSelected;
    const qaPairs = this.data.qaPairs.map(item => {
      if (!this.isSelectablePair(item)) {
        return {
          ...item,
          selected: false
        };
      }
      return {
        ...item,
        selected: shouldSelectAll
      };
    });

    this.setData({
      qaPairs,
      messages: decorateMessages(this.data.messages, qaPairs)
    }, () => {
      this.updateSelectionState();
    });
  },

  async saveSelectedFavorites() {
    if (!this.data.isLoggedIn) {
      this.promptLogin('收藏 AI 问答');
      return;
    }

    const selectedPairs = this.data.qaPairs.filter(item => item.selected && this.isSelectablePair(item));
    if (!selectedPairs.length) {
      wx.showToast({
        title: '请先选择要收藏的问答',
        icon: 'none'
      });
      return;
    }

    if (!wx.cloud) {
      wx.showToast({
        title: '当前环境未开启云能力',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '收藏中...' });

    try {
      const results = await saveAiFavoritesToCloud(selectedPairs);

      const favoriteIdMap = {};
      selectedPairs.forEach((item, index) => {
        if (results[index] && results[index]._id) {
          favoriteIdMap[item.id] = results[index]._id;
        }
      });

      const qaPairs = this.data.qaPairs.map(item => {
        if (!favoriteIdMap[item.id]) {
          return {
            ...item,
            selected: false
          };
        }
        return {
          ...item,
          selected: false,
          isFavorite: true,
          favoriteId: favoriteIdMap[item.id]
        };
      });

      this.setData({
        qaPairs,
        messages: decorateMessages(this.data.messages, qaPairs),
        isBatchMode: false
      }, () => {
        this.updateSelectionState();
        this.updateLeaveReminder();
      });

      wx.showToast({
        title: `已收藏 ${selectedPairs.length} 条`,
        icon: 'success'
      });
    } catch (error) {
      console.error('保存 AI 收藏失败：', error);
      wx.showToast({
        title: '收藏失败，请先确认 ai_favorites 集合已创建',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  goToFavorites() {
    if (!this.data.isLoggedIn) {
      this.promptLogin('查看 AI 收藏');
      return;
    }

    wx.navigateTo({
      url: '/pages/message/message'
    });
  },

  disableExitReminder() {
    wx.showModal({
      title: '关闭离开提醒',
      content: '关闭后，离开 AI 页面时将不再提醒你先收藏重要问答。',
      success: res => {
        if (!res.confirm) return;

        wx.setStorageSync(EXIT_REMIND_DISABLED_KEY, true);
        this.setData({
          remindDisabled: true
        }, () => {
          this.updateLeaveReminder();
        });

        wx.showToast({
          title: '已关闭提醒',
          icon: 'success'
        });
      }
    });
  },

  deferExitReminder() {
    this.setData({
      sessionTipDeferred: true
    });
    wx.showToast({
      title: '本次稍后提醒',
      icon: 'none'
    });
  },

  resetSession() {
    this.sessionStamp = Date.now();

    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }

    this.setData({
      inputValue: '',
      messages: createDefaultMessages(),
      qaPairs: [],
      scrollToMessage: '',
      isBatchMode: false,
      isAllSelected: false,
      selectedCount: 0,
      sessionTipDeferred: false
    });
  },

  updateLeaveReminder() {
    if (this.data.isBrowseOnly) {
      if (wx.disableAlertBeforeUnload) {
        wx.disableAlertBeforeUnload();
      }
      return;
    }

    const hasUnfavoritedPairs = this.data.qaPairs.some(item => item.answer && !item.isFavorite);

    if (!hasUnfavoritedPairs || this.data.remindDisabled) {
      if (wx.disableAlertBeforeUnload) {
        wx.disableAlertBeforeUnload();
      }
      return;
    }

    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({
        message: '离开页面后，未收藏的 AI 问答会被清空，请先收藏重要内容。'
      });
    }
  },

  getSelectablePairs() {
    return this.data.qaPairs.filter(item => this.isSelectablePair(item));
  },

  isSelectablePair(item) {
    return !!(item && item.answer && !item.isFavorite && !item.failed);
  },

  updateSelectionState() {
    const selectablePairs = this.getSelectablePairs();
    const selectedCount = selectablePairs.filter(item => item.selected).length;
    const isAllSelected = selectablePairs.length > 0 && selectedCount === selectablePairs.length;

    this.setData({
      selectedCount,
      isAllSelected
    });
  },

  formatTime(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  refreshAccessState() {
    const { privacyState, isLoggedIn } = getAccessSummary();
    const isBrowseOnly = privacyState.browseOnly || !privacyState.accepted;

    this.setData({
      isBrowseOnly,
      isLoggedIn: !isBrowseOnly && isLoggedIn
    });

    if (isBrowseOnly) {
      this.resetSession();
    }
  },

  promptLogin(featureName) {
    wx.showModal({
      title: '登录后可用',
      content: `${featureName}需要登录后使用。当前游客可继续体验临时 AI 问答，是否前往个人中心登录？`,
      confirmText: '去登录',
      success: res => {
        if (!res.confirm) return;
        wx.switchTab({
          url: '/pages/profile/profile'
        });
      }
    });
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
