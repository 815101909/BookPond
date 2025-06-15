// 消息详情页面
Page({
  data: {
    message: null,
    loading: true
  },

  onLoad: function(options) {
    const messageId = options.id;
    this.loadMessageById(messageId);
  },

  // 加载指定ID的消息
  loadMessageById: function(messageId) {
    // 获取所有消息
    const allMessages = wx.getStorageSync('messengerStationMessages') || [];
    
    // 查找指定ID的消息
    const message = allMessages.find(msg => msg.id === messageId);
    
    if (message) {
      // 格式化日期显示
      const dateObj = new Date(message.timestamp);
      const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
      
      message.formattedDate = formattedDate;
      
      this.setData({
        message: message,
        loading: false
      });
    } else {
      this.setData({
        loading: false
      });
      
      wx.showToast({
        title: '找不到该消息',
        icon: 'none',
        duration: 2000
      });
      
      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  },

  // 删除消息
  deleteMessage: function() {
    const that = this;
    
    wx.showModal({
      title: '删除确认',
      content: '确定要删除这条消息吗？',
      confirmColor: '#FF5252',
      success: function(res) {
        if (res.confirm) {
          // 获取所有消息
          const allMessages = wx.getStorageSync('messengerStationMessages') || [];
          
          // 过滤掉要删除的消息
          const updatedMessages = allMessages.filter(msg => msg.id !== that.data.message.id);
          
          // 更新存储
          wx.setStorageSync('messengerStationMessages', updatedMessages);
          
          wx.showToast({
            title: '已删除',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      }
    });
  }
}); 