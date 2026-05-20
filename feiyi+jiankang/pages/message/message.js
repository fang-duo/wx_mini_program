const FAVORITES_COLLECTION = 'ai_favorites';

Page({
  data: {
    messages: [],
    isBatchMode: false,
    isAllSelected: false,
    selectedCount: 0,
    loading: false
  },

  onShow() {
    this.loadMessages();
  },

  async loadMessages() {
    if (!wx.cloud) {
      wx.showToast({
        title: '当前环境未开启云能力',
        icon: 'none'
      });
      return;
    }

    const db = wx.cloud.database();

    this.setData({ loading: true });

    try {
      const res = await db.collection(FAVORITES_COLLECTION)
        .orderBy('createTime', 'desc')
        .get();

      const messages = (res.data || []).map(item => ({
        ...item,
        selected: false,
        date: this.formatTime(item.createTime)
      }));

      this.setData({
        messages,
        isBatchMode: false,
        isAllSelected: false,
        selectedCount: 0
      });
    } catch (error) {
      console.error('加载 AI 收藏失败：', error);
      wx.showToast({
        title: '请先创建 ai_favorites 集合',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  toggleBatchMode() {
    const isBatchMode = !this.data.isBatchMode;
    const messages = this.data.messages.map(item => ({
      ...item,
      selected: false
    }));

    this.setData({
      isBatchMode,
      messages,
      isAllSelected: false,
      selectedCount: 0
    });
  },

  onItemClick(e) {
    if (!this.data.isBatchMode) return;

    const { index } = e.currentTarget.dataset;
    const key = `messages[${index}].selected`;

    this.setData({
      [key]: !this.data.messages[index].selected
    }, () => {
      this.updateSelectedState();
    });
  },

  toggleSelectAll() {
    const isAllSelected = !this.data.isAllSelected;
    const messages = this.data.messages.map(item => ({
      ...item,
      selected: isAllSelected
    }));

    this.setData({
      messages,
      isAllSelected
    }, () => {
      this.updateSelectedState();
    });
  },

  async removeFavorite(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.showModal({
      title: '取消收藏',
      content: '确定要移除这条 AI 问答收藏吗？',
      success: async res => {
        if (!res.confirm) return;

        await this.deleteFavoritesByIds([id], '已取消收藏');
      }
    });
  },

  deleteSelected() {
    if (!this.data.selectedCount) return;

    wx.showModal({
      title: '批量删除',
      content: `确定要删除选中的 ${this.data.selectedCount} 条收藏吗？`,
      success: async res => {
        if (!res.confirm) return;

        const ids = this.data.messages
          .filter(item => item.selected)
          .map(item => item._id);

        await this.deleteFavoritesByIds(ids, '已删除');
      }
    });
  },

  async deleteFavoritesByIds(ids, successTitle) {
    if (!ids.length || !wx.cloud) return;

    const db = wx.cloud.database();
    wx.showLoading({ title: '处理中...' });

    try {
      await Promise.all(
        ids.map(id => db.collection(FAVORITES_COLLECTION).doc(id).remove())
      );

      const messages = this.data.messages.filter(item => !ids.includes(item._id));
      this.setData({
        messages,
        isBatchMode: false
      }, () => {
        this.updateSelectedState();
      });

      wx.showToast({
        title: successTitle,
        icon: 'success'
      });
    } catch (error) {
      console.error('删除 AI 收藏失败：', error);
      wx.showToast({
        title: '删除失败，请稍后再试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  updateSelectedState() {
    const selectedCount = this.data.messages.filter(item => item.selected).length;
    const isAllSelected = this.data.messages.length > 0 && selectedCount === this.data.messages.length;

    this.setData({
      selectedCount,
      isAllSelected
    });
  },

  goToAI() {
    wx.switchTab({ url: '/pages/ai/ai' });
  },

  formatTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
});
