// 引入统一的云函数调用工具
const { messengerAPI } = require('../../utils/cloud-api.js');

// 本地存储键名
const READ_MESSAGES_KEY = 'read_messages';

// 本地存储辅助函数
const getReadMessages = () => {
  try {
    const readMessages = wx.getStorageSync(READ_MESSAGES_KEY);
    return readMessages ? JSON.parse(readMessages) : [];
  } catch (e) {
    console.error('读取已读消息失败:', e);
    return [];
  }
};

const saveReadMessages = (readMessageIds) => {
  try {
    wx.setStorageSync(READ_MESSAGES_KEY, JSON.stringify(readMessageIds));
  } catch (e) {
    console.error('保存已读消息失败:', e);
  }
};

const markMessageAsReadLocal = (messageId) => {
  const readMessages = getReadMessages();
  if (!readMessages.includes(messageId)) {
    readMessages.push(messageId);
    saveReadMessages(readMessages);
  }
};

const markAllMessagesAsReadLocal = (messageIds) => {
  const readMessages = getReadMessages();
  const newReadMessages = [...new Set([...readMessages, ...messageIds])];
  saveReadMessages(newReadMessages);
};

// 系统消息页面逻辑
Page({
  /**
   * 页面初始数据
   */
  data: {
    messages: [],
    unreadCount: 0,
    showModal: false,
    selectedMessage: null
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
    // 清理旧的本地存储数据（一次性操作）
    try {
      wx.removeStorageSync('readSystemMessages');
    } catch (e) {
      // 忽略错误
    }
    
    this.loadMessages();
  },

  /**
   * 加载消息数据
   */
  loadMessages: async function () {
    console.log('=== 开始加载系统消息 ===');
    try {
      // 系统消息是全局的，不需要登录验证
      console.log('开始获取系统消息（无需登录）');

      // 调用云函数获取系统消息
      console.log('调用云函数 jiuyu_messenger, action: getSystemMessages');
      const result = await messengerAPI.getSystemMessages();

      console.log('云函数返回结果:', result);
      console.log('result.result:', result.result);
      
      if (result.result && result.result.code === 0) {
        const messages = result.result.data.list || [];
        console.log('获取到的原始消息数据:', messages);
        console.log('消息数量:', messages.length);
        
        // 获取本地已读消息列表
        const readMessages = getReadMessages();
        console.log('本地已读消息ID列表:', readMessages);
        
        // 格式化消息数据
        const formattedMessages = messages.map((msg, index) => {
          console.log(`格式化第${index + 1}条消息:`, msg);
          const formatted = {
            id: msg._id,
            title: msg.title,
            content: msg.content,
            date: this.formatDate(msg.date),
            timestamp: msg.date, // 使用date字段作为时间戳
            read: readMessages.includes(msg._id) // 从本地存储判断是否已读
          };
          console.log(`格式化后:`, formatted);
          return formatted;
        });
        
        console.log('所有格式化后的消息:', formattedMessages);
        
        // 计算未读消息数
        const unreadCount = formattedMessages.filter(item => !item.read).length;
        console.log('未读消息数:', unreadCount);
        
        this.setData({
          messages: formattedMessages,
          unreadCount
        });
        
        // 根据未读消息数量控制tabbar红点
        if (unreadCount > 0) {
          wx.showTabBarRedDot({
            index: 2 // profile页面在tabbar中的索引
          });
        } else {
          wx.hideTabBarRedDot({
            index: 2
          });
        }
        
        console.log('页面数据设置完成');
      } else {
        console.error('获取系统消息失败:', result.result?.msg);
        console.error('完整错误信息:', result.result);
        wx.showToast({
          title: result.result?.msg || '获取消息失败',
          icon: 'none'
        });
      }
    } catch (e) {
      console.error('加载消息失败', e);
      console.error('错误堆栈:', e.stack);
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none'
      });
    }
    console.log('=== 加载系统消息结束 ===');
  },

  /**
   * 格式化日期
   */
  formatDate: function(timestamp) {
    if (!timestamp) return '';
    
    // 处理时间戳格式
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;
    
    // 自定义时间格式化，确保0点显示为0而不是12
    const formatTime = (dateObj) => {
      const hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };
    
    if (diff < oneDay && date.getDate() === now.getDate()) {
      // 今天
      return formatTime(date);
    } else if (diff < 2 * oneDay) {
      // 昨天
      return '昨天 ' + formatTime(date);
    } else {
      // 更早
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + formatTime(date);
    }
  },

  /**
   * 查看消息详情
   */
  viewMessageDetail: async function (e) {
    const index = e.currentTarget.dataset.index;
    const messages = this.data.messages;
    const message = messages[index];
    

    
    // 格式化日期显示
     let formattedDate = '';
     try {
       if (message.date) {
         // 如果date是字符串格式（如'07/16 上午12:00'），直接使用
         if (typeof message.date === 'string' && message.date.includes('/')) {
           // 处理'07/16 上午12:00'这种格式
           const currentYear = new Date().getFullYear();
           const dateStr = message.date.replace('上午', 'AM').replace('下午', 'PM');
           const fullDateStr = `${currentYear}/${dateStr}`;
           const dateObj = new Date(fullDateStr);
           
           if (!isNaN(dateObj.getTime())) {
             const hours = dateObj.getHours();
             const displayHours = hours === 0 ? 0 : hours; // 0点显示为0而不是12
             formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${displayHours}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
           } else {
             // 如果解析失败，直接显示原始字符串
             formattedDate = message.date;
           }
         } else {
           // 处理时间戳格式
           const timestamp = typeof message.date === 'string' ? parseInt(message.date) : message.date;
           const dateObj = new Date(timestamp);
           
           if (!isNaN(dateObj.getTime())) {
             const hours = dateObj.getHours();
             const displayHours = hours === 0 ? 0 : hours; // 0点显示为0而不是12
             formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${displayHours}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
           } else {
             formattedDate = '日期格式错误';
           }
         }
       } else {
         formattedDate = '无日期信息';
       }
     } catch (error) {
       console.error('日期格式化错误:', error);
       formattedDate = message.date || '日期解析失败';
     }
    

    
    // 设置选中的消息并显示弹窗
    this.setData({
      selectedMessage: {
        ...message,
        formattedDate: formattedDate
      },
      showModal: true
    });
  },

  /**
   * 关闭弹窗
   */
  closeModal: function() {
    this.setData({
      showModal: false,
      selectedMessage: null
    });
  },

  /**
   * 标记为已读（弹窗中的按钮）
   */
  markAsRead: function(e) {
    const messageId = e.currentTarget.dataset.id;
    const messageIndex = this.data.messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      this.markMessageAsRead(messageId, messageIndex);
      
      // 更新弹窗中的消息状态
      const updatedMessage = { ...this.data.selectedMessage, read: true };
      this.setData({
        selectedMessage: updatedMessage
      });
    }
  },

  /**
   * 标记消息为已读
   */
  markMessageAsRead: function(messageId, index) {
    try {
      // 保存到本地存储
      markMessageAsReadLocal(messageId);
      
      // 更新本地数据
      const messages = this.data.messages;
      messages[index].read = true;
      
      // 重新计算未读消息数
      const unreadCount = messages.filter(item => !item.read).length;
      
      this.setData({
        messages,
        unreadCount
      });
      
      // 根据未读消息数量控制tabbar红点
      if (unreadCount > 0) {
        wx.showTabBarRedDot({
          index: 2
        });
      } else {
        wx.hideTabBarRedDot({
          index: 2
        });
      }
      
      console.log(`消息 ${messageId} 已标记为已读`);
    } catch (e) {
      console.error('标记消息已读出错:', e);
    }
  },

  /**
   * 全部标记为已读
   */
  markAllAsRead: function () {
    if (this.data.unreadCount <= 0) return;
    
    wx.showModal({
      title: '确认操作',
      content: '确定将所有消息标记为已读吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            // 获取所有消息ID
            const messageIds = this.data.messages.map(msg => msg.id);
            
            // 保存到本地存储
            markAllMessagesAsReadLocal(messageIds);
            
            // 更新本地数据
            const messages = this.data.messages.map(msg => {
              return { ...msg, read: true };
            });
            
            this.setData({
              messages,
              unreadCount: 0
            });
            
            // 隐藏tabbar红点
            wx.hideTabBarRedDot({
              index: 2
            });
            
            wx.showToast({
              title: '已全部标记为已读',
              icon: 'success'
            });
            
            console.log('所有消息已标记为已读');
          } catch (e) {
            console.error('标记全部已读失败:', e);
            wx.showToast({
              title: '操作失败，请稍后重试',
              icon: 'none'
            });
          }
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