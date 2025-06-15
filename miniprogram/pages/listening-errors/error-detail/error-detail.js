// 错题详情页面
Page({
  data: {
    exerciseItem: null,
    optionLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  },

  onLoad: function(options) {
    // 从URL参数中获取习题信息
    if (options.item) {
      try {
        const item = JSON.parse(decodeURIComponent(options.item));
        this.setData({
          exerciseItem: item
        });
      } catch (error) {
        console.error('解析习题数据失败', error);
        wx.showToast({
          title: '加载数据失败',
          icon: 'none'
        });
      }
    }
  },
  
  // 关闭详情页返回上一级
  goBack: function() {
    wx.navigateBack();
  },
  
  // 重新听一遍
  listenAgain: function() {
    const item = this.data.exerciseItem;
    
    // 在实际应用中，这里应该跳转到听力界面，同时传递必要的参数
    wx.switchTab({
      url: '/pages/listen/listen'
    });
    
    // 可以通过全局状态或本地存储传递需要播放的音频信息
    getApp().globalData.pendingAudio = {
      audioType: item.audioType,
      difficulty: item.difficulty,
      language: item.language,
      date: item.date
    };
  }
}); 