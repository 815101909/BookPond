// 系统消息页面逻辑
Page({
  /**
   * 页面初始数据
   */
  data: {
    messages: [],
    unreadCount: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadMessages();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadMessages();
  },

  /**
   * 加载消息数据
   */
  loadMessages: function () {
    // 模拟从本地或云端获取消息数据
    // 实际应用中应该从服务器或本地存储获取
    try {
      const messages = wx.getStorageSync('systemMessages') || [];
      
      // 计算未读消息数
      const unreadCount = messages.filter(item => !item.read).length;
      
      this.setData({
        messages,
        unreadCount
      });
    } catch (e) {
      console.error('加载消息失败', e);
      wx.showToast({
        title: '加载消息失败',
        icon: 'none'
      });
    }
  },

  /**
   * 查看消息详情
   */
  viewMessageDetail: function (e) {
    const index = e.currentTarget.dataset.index;
    const messages = this.data.messages;
    const message = messages[index];
    
    // 如果消息未读，标记为已读
    if (!message.read) {
      messages[index].read = true;
      
      // 更新缓存
      wx.setStorageSync('systemMessages', messages);
      
      // 重新计算未读消息数
      const unreadCount = messages.filter(item => !item.read).length;
      
      this.setData({
        messages,
        unreadCount
      });
    }
    
    // 显示消息详情
    wx.showModal({
      title: message.title,
      content: message.content,
      showCancel: false,
      confirmText: '关闭'
    });
  },

  /**
   * 全部标记为已读
   */
  markAllAsRead: function () {
    if (this.data.unreadCount <= 0) return;
    
    wx.showModal({
      title: '确认操作',
      content: '确定将所有消息标记为已读吗？',
      success: res => {
        if (res.confirm) {
          const messages = this.data.messages.map(msg => {
            return { ...msg, read: true };
          });
          
          // 更新缓存
          wx.setStorageSync('systemMessages', messages);
          
          this.setData({
            messages,
            unreadCount: 0
          });
          
          wx.showToast({
            title: '已全部标记为已读',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadMessages();
    wx.stopPullDownRefresh();
  }
}) 