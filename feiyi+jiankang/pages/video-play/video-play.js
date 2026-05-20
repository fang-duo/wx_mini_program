// pages/video-play/video-play.js
Page({
  data: {
    finalUrl: '',
    title: '',
    cover: '',
    loading: true,
    errorMessage: ''
  },

  async onLoad(options) {
    const rawUrl = decodeURIComponent(options.url || '');
    const title = decodeURIComponent(options.title || '');
    const cover = decodeURIComponent(options.cover || '');

    this.setData({ title, cover });

    if (!rawUrl) {
      this.setData({
        loading: false,
        errorMessage: '当前内容暂无可播放视频'
      });
      return;
    }

    if (!rawUrl.startsWith('cloud://') || !wx.cloud) {
      this.setData({
        finalUrl: rawUrl,
        loading: false
      });
      return;
    }

    try {
      const result = await wx.cloud.getTempFileURL({
        fileList: [rawUrl]
      });
      const fileInfo = (result.fileList && result.fileList[0]) || {};
      const tempUrl = fileInfo.tempFileURL || fileInfo.download_url || '';

      if (!tempUrl) {
        throw new Error('未获取到视频临时地址');
      }

      this.setData({
        finalUrl: tempUrl,
        loading: false
      });
    } catch (error) {
      console.error('云存储视频地址解析失败：', error);
      this.setData({
        loading: false,
        errorMessage: '视频地址解析失败，请稍后重试'
      });
    }
  },

  handleVideoError() {
    this.setData({
      errorMessage: '视频播放失败，请检查云存储文件或稍后重试'
    });
  }
});
