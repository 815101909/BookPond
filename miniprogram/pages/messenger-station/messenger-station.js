// 信使驿站页面逻辑
const app = getApp();

Page({
  data: {
    messages: [],
    total: 0,
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true
  },

  onLoad: function (options) {
    // 测试函数 - 添加测试消息用于调试
    this.createTestMessageIfNeeded();
    
    this.loadMessagesFromStorage();
    
    // Update total count from storage
    const messages = wx.getStorageSync('messengerStationMessages') || [];
    this.setData({
      total: messages.length
    });
    
    this.loadMessages();
  },

  onShow: function () {
    // 每次页面展示时刷新数据
    this.setData({
      page: 1,
      messages: [],
      hasMore: true
    });
    
    this.loadMessagesFromStorage();
    
    // Update total count from storage
    const messages = wx.getStorageSync('messengerStationMessages') || [];
    this.setData({
      total: messages.length
    });
    
    this.loadMessages();
  },

  onPullDownRefresh: function () {
    this.setData({
      page: 1,
      messages: [],
      hasMore: true
    });
    this.loadMessages(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMessages();
    }
  },

  loadMessages: function (callback) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    wx.showLoading({ title: '加载中...' });
    
    // 从本地存储获取消息
    const stationMessages = wx.getStorageSync('messengerStationMessages') || [];
    
    // 处理分页逻辑
    const start = (this.data.page - 1) * this.data.pageSize;
    const end = start + this.data.pageSize;
    const currentPageMessages = stationMessages.slice(start, end);
    
    const hasMore = end < stationMessages.length;
    
    setTimeout(() => {
      this.setData({
        messages: this.data.page === 1 ? currentPageMessages : this.data.messages.concat(currentPageMessages),
        total: stationMessages.length,
        page: this.data.page + 1,
        loading: false,
        hasMore: hasMore
      });
      
      wx.hideLoading();
      
      if (callback) callback();
    }, 300);
  },

  navigateToVocabulary: function (e) {
    const messageId = e.currentTarget.dataset.id;
    
    // 更新消息已读状态
    let stationMessages = wx.getStorageSync('messengerStationMessages') || [];
    const selectedMessage = stationMessages.find(msg => msg.id === messageId);
    
    if (!selectedMessage) {
      wx.showToast({
        title: '找不到对应文章',
        icon: 'none'
      });
      return;
    }
    
    // 标记为已读
    stationMessages = stationMessages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, read: true };
      }
      return msg;
    });
    wx.setStorageSync('messengerStationMessages', stationMessages);
    
    // 更新页面UI
    const updatedMessages = this.data.messages.map(item => {
      if (item.id === messageId) {
        return { ...item, unread: 0 };
      }
      return item;
    });
    
    this.setData({ messages: updatedMessages });
    
    // 获取原始文章信息
    const articleInfo = selectedMessage.fullData ? selectedMessage.fullData : null;
    const articleId = articleInfo?.articleId || '';
    const articleTitle = articleInfo?.title || '我的写作';
    
    // 跳转到写一写页面，带上文章信息
    wx.switchTab({
      url: '/pages/write/write',
      success: () => {
        // 通过全局变量传递选中的文章信息，因为switchTab不能直接传参
        if (app.globalData) {
          app.globalData.selectedArticleFromMessenger = {
            id: articleId,
            title: articleTitle,
            fromMessenger: true
          };
          
          wx.showToast({
            title: '正在加载词汇',
            icon: 'loading',
            duration: 1000
          });
        }
      }
    });
  },

  deleteMessage: function (e) {
    const messageId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: (res) => {
        if (res.confirm) {
          // 从本地存储中删除消息
          let stationMessages = wx.getStorageSync('messengerStationMessages') || [];
          stationMessages = stationMessages.filter(msg => msg.id !== messageId);
          wx.setStorageSync('messengerStationMessages', stationMessages);
          
          // 从页面数据中删除消息
          const updatedMessages = this.data.messages.filter(item => item.id !== messageId);
          
          this.setData({
            messages: updatedMessages,
            total: stationMessages.length
          });
          
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  shareMessage: function (e) {
    const messageId = e.currentTarget.dataset.id;
    const message = this.data.messages.find(item => item.id === messageId);
    
    if (!message) return;
    
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    wx.showToast({
      title: '分享功能已启用',
      icon: 'success'
    });
  },

  backToProfile: function () {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  createNewMessage: function () {
    wx.switchTab({
      url: '/pages/write/write'
    });
  },

  // 从存储中加载消息
  loadMessagesFromStorage: function() {
    // 获取存储的消息列表
    const messagesFromStorage = wx.getStorageSync('messengerStationMessages') || [];
    
    // 格式化消息列表用于显示
    const formattedMessages = messagesFromStorage.map(item => {
      // 获取时间格式化
      const dateObj = new Date(item.timestamp);
      const today = new Date();
      let timeStr;

      if (dateObj.toDateString() === today.toDateString()) {
        // 今天的消息显示时间
        timeStr = `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
      } else {
        // 非今天的消息显示日期
        timeStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
      }

      // 处理消息类型和头像
      let messageType = item.source || '写作分享';
      let avatar = '/images/avatar1.jpg'; // 默认头像
      
      // 强制为所有消息显示2025年4月12日
      // 这是一个临时解决方案
      const writingDate = '2025年4月12日';
      
      return {
        id: item.id,
        username: '我的写作',
        avatar: avatar,
        content: item.content.length > 30 ? item.content.substring(0, 30) + '...' : item.content,
        time: timeStr,
        type: messageType,
        writingDate: writingDate, // 添加写作日期字段
        unread: item.read ? 0 : 1,
        fullData: item // 保存完整原始数据
      };
    });

    this.setData({
      messages: formattedMessages
    });
  },

  // 测试函数 - 创建带有特定日期的消息用于调试
  createTestMessageIfNeeded: function() {
    const messagesFromStorage = wx.getStorageSync('messengerStationMessages') || [];
    
    // 检查是否已经有测试消息
    const hasTestMessage = messagesFromStorage.some(msg => msg.isTestMessage);
    
    if (!hasTestMessage) {
      // 创建一个测试消息，包含明确的日期格式
      const testMessage = {
        id: 'test_' + Date.now().toString(),
        content: '这是一条测试消息，用于调试日期显示问题',
        date: '2025年4月12日',
        formattedDate: '2025.04.12',
        timestamp: new Date().getTime(),
        read: false,
        source: '测试消息',
        isTestMessage: true // 标记为测试消息
      };
      
      // 将测试消息添加到列表开头
      messagesFromStorage.unshift(testMessage);
      
      // 保存更新后的列表
      wx.setStorageSync('messengerStationMessages', messagesFromStorage);
      
      console.log('已创建测试消息:', testMessage);
    }
  }
}); 