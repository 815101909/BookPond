// 信使驿站页面逻辑
// 引入统一的云函数调用工具
const { messengerAPI } = require('../../utils/cloud-api.js');
const app = getApp();

Page({
  data: {
    messages: [],
    total: 0,
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true,
    // 头像背景颜色选项
    avatarColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFC145', '#9370DB', '#56C596', '#FF9A8B', '#725AC1', '#699E3E', '#DE5B6D']
  },

  onLoad: function (options) {
    // 加载消息
    this.loadMessages();
    
    // 处理分享链接进入的情况
    if (options.messageId) {
      console.log('通过分享链接进入，消息ID:', options.messageId);
      this.handleSharedMessage(options.messageId);
    }
  },
  
  // 处理通过分享链接进入的消息
  handleSharedMessage: function(messageId) {
    // 查找消息并滚动到该位置
    setTimeout(() => {
      // 查找消息在当前页面数据中的索引
      const index = this.data.messages.findIndex(msg => msg.id === messageId);
      if (index !== -1) {
        // 使用选择器获取该消息元素
        const query = wx.createSelectorQuery();
        query.select(`.message-item:nth-child(${index + 1})`).boundingClientRect();
        query.selectViewport().scrollOffset();
        query.exec((res) => {
          if (res[0] && res[1]) {
            // 滚动到该消息位置
            wx.pageScrollTo({
              scrollTop: res[0].top + res[1].scrollTop - 100, // 向上偏移100px，使消息更容易看到
              duration: 300
            });
            
            // 可以添加高亮动画等效果
          }
        });
      } else {
        // 如果在当前页面没找到，可能需要重新加载
        wx.showToast({
          title: '正在查找消息...',
          icon: 'loading'
        });
        
        // 重置页码并重新加载
        this.setData({
          page: 1,
          messages: [],
          hasMore: true
        }, () => {
          this.loadMessages(() => {
            // 加载完成后再次尝试查找
            this.handleSharedMessage(messageId);
          });
        });
      }
    }, 500);
  },

  onShow: function () {
    // 每次页面展示时刷新数据
    this.setData({
      page: 1,
      messages: [],
      hasMore: true
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

  // 获取随机颜色
  getRandomColor: function(id) {
    // 使用消息ID作为种子，生成一致的随机颜色
    const seed = id ? this.hashString(id) : Math.floor(Math.random() * 1000);
    const colorIndex = seed % this.data.avatarColors.length;
    return this.data.avatarColors[colorIndex];
  },

  // 简单的字符串哈希函数
  hashString: function(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash);
  },

  loadMessages: function (callback) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    wx.showLoading({ title: '加载中...' });
    
    // 使用云函数获取消息
    messengerAPI.getMessages({
      page: this.data.page,
      pageSize: this.data.pageSize,
      excludeSystemMessages: true
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const { list, total } = res.result.data;
        
        // 格式化消息列表用于显示
        const formattedMessages = list.map(item => {
          // 处理消息类型和头像
          let messageType = item.source === 'time_capsule' ? '时光宝盒' : '写作宝箱';
          
          // 为每个消息生成一个随机颜色
          const avatarColor = this.getRandomColor(item.id);
          
          return {
            id: item.id,
            _id: item._id,
            username: item.title || messageType,
            avatarColor: avatarColor, // 添加随机颜色
            content: item.content.length > 30 ? item.content.substring(0, 30) + '...' : item.content,
            time: this.formatTime(item.timestamp),
            type: messageType,
            unread: item.read ? 0 : 1,
            date: this.formatDate(item.timestamp),
            fullData: item.fullData || null,
            articleId: item.articleId || '',
            source: item.source, // 保存原始来源
            originalData: item // 保存完整的原始数据
          };
        });
        
        const hasMore = this.data.page * this.data.pageSize < total;
        
        this.setData({
          messages: this.data.page === 1 ? formattedMessages : this.data.messages.concat(formattedMessages),
          total: total,
          page: this.data.page + 1,
          loading: false,
          hasMore: hasMore
        });
        
        // 调试: 打印消息数据
        console.log('获取到的消息数量:', formattedMessages.length);
        console.log('总消息数:', total);
        console.log('是否有更多:', hasMore);
        
        if (formattedMessages.length > 0) {
          console.log('第一条消息示例:', formattedMessages[0]);
        }
      } else {
        this.setData({ loading: false });
        console.error('获取消息失败:', res);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
      
      if (callback) callback();
    }).catch(error => {
      wx.hideLoading();
      this.setData({ loading: false });
      console.error('加载消息失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      
      if (callback) callback();
    });
  },

  // 点击消息内容区域标记为已读
  markAsRead: function(e) {
    const messageId = e.currentTarget.dataset.id;
    const message = this.data.messages.find(msg => msg.id === messageId);
    
    if (!message) {
      wx.showToast({
        title: '找不到对应消息',
        icon: 'none'
      });
      return;
    }
    
    // 立即标记消息为已读
    this.markMessageAsRead(messageId, message.source);
    
    // 使用原始完整数据而不是格式化后的数据
    const originalMessage = message.originalData || message;
    
    // 跳转到消息详情页面，传递完整的消息数据
    wx.navigateTo({
      url: `/pages/message-detail/message-detail?messageData=${encodeURIComponent(JSON.stringify(originalMessage))}`
    });
  },

  navigateToVocabulary: function (e) {
    const messageId = e.currentTarget.dataset.id;
    
    // 找到对应的消息
    const selectedMessage = this.data.messages.find(msg => msg.id === messageId);
    
    if (!selectedMessage) {
      wx.showToast({
        title: '找不到对应文章',
        icon: 'none'
      });
      return;
    }
    
    // 标记为已读
    this.markMessageAsRead(messageId, selectedMessage.source);
    
    // 获取原始文章信息
    const articleInfo = selectedMessage.fullData ? selectedMessage.fullData : null;
    const articleId = articleInfo?.articleId || selectedMessage.articleId || '';
    const articleTitle = articleInfo?.title || selectedMessage.username || '我的写作';
    
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

  // 标记消息为已读
  markMessageAsRead: function(messageId, source) {
    messengerAPI.markAsRead({
      messageId: messageId,
      source: source
    }).then(res => {
      if (res.result && res.result.code === 0) {
        console.log('标记消息已读成功:', res.result);
        
        // 更新页面UI
        const updatedMessages = this.data.messages.map(item => {
          if (item.id === messageId) {
            return { ...item, unread: 0 };
          }
          return item;
        });
        
        this.setData({ messages: updatedMessages });
      } else {
        console.error('标记消息已读失败:', res);
      }
    }).catch(err => {
      console.error('标记消息已读失败:', err);
    });
  },

  deleteMessage: function (e) {
    const messageId = e.currentTarget.dataset.id;
    const message = this.data.messages.find(item => item.id === messageId);
    
    if (!message) {
      wx.showToast({
        title: '找不到消息',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: (res) => {
        if (res.confirm) {
          // 使用云函数删除消息
          messengerAPI.deleteMessage({
            messageId: messageId,
            source: message.source
          }).then(res => {
            if (res.result && res.result.code === 0) {
              console.log('删除消息成功:', res.result);
              
              // 从页面数据中删除消息
              const updatedMessages = this.data.messages.filter(item => item.id !== messageId);
              const newTotal = this.data.total - 1;
              
              this.setData({
                messages: updatedMessages,
                total: newTotal >= 0 ? newTotal : 0
              });
              
              wx.showToast({
                title: '已删除',
                icon: 'success'
              });
            } else {
              console.error('删除消息失败:', res);
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            console.error('删除消息失败:', err);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          });
        }
      }
    });
  },

  shareMessage: function (e) {
    const messageId = e.currentTarget.dataset.id;
    const message = this.data.messages.find(item => item.id === messageId);
    
    if (!message) return;
    
    // 保存当前要分享的消息ID到全局数据，供onShareAppMessage使用
    this.currentShareMessageId = messageId;
    this.currentShareMessage = message;
    
    // 显示分享菜单
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    // 显示自定义分享面板
    wx.showActionSheet({
      itemList: ['分享给朋友', '分享到朋友圈'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 分享给朋友 - 提示用户使用右上角的转发按钮
          wx.showToast({
            title: '请点击右上角"..."按钮，选择"转发"',
            icon: 'none',
            duration: 3000
          });
        } else if (res.tapIndex === 1) {
          // 分享到朋友圈
          wx.showToast({
            title: '请点击右上角"..."按钮，选择"分享到朋友圈"',
            icon: 'none',
            duration: 3000
          });
        }
      }
    });
  },
  
  // 添加小程序分享事件处理函数
  onShareAppMessage: function (res) {
    // 如果是从分享按钮触发的分享
    if (this.currentShareMessage) {
      const message = this.currentShareMessage;
      
      return {
        title: message.type + ': ' + (message.content || '信使驿站消息'),
        path: '/pages/messenger-station/messenger-station?messageId=' + message.id,
        imageUrl: '/images/avatar/default-avatar.png',
        success: function() {
          wx.showToast({
            title: '分享成功',
            icon: 'success'
          });
        },
        fail: function() {
          wx.showToast({
            title: '分享失败',
            icon: 'none'
          });
        }
      };
    }
    
    // 默认分享信息
    return {
      title: '信使驿站 - 我的学习记录',
      path: '/pages/messenger-station/messenger-station',
      imageUrl: '/images/avatar/default-avatar.png'
    };
  },
  
  // 添加朋友圈分享事件处理函数
  onShareTimeline: function () {
    // 如果是从分享按钮触发的分享
    if (this.currentShareMessage) {
      const message = this.currentShareMessage;
      
      return {
        title: message.type + ': ' + (message.content || '信使驿站消息'),
        query: 'messageId=' + message.id,
        imageUrl: '/images/avatar/default-avatar.png'
      };
    }
    
    // 默认分享信息
    return {
      title: '信使驿站 - 我的学习记录',
      query: '',
      imageUrl: '/images/avatar/default-avatar.png'
    };
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
  
  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      // 今天的消息显示时间
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    } else {
      // 非今天的消息显示日期
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  },
  
  // 格式化日期
  formatDate: function(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  },
  
  // 调试函数 - 打印消息数据结构
  debugMessages: function() {
    messengerAPI.getMessages({
      page: 1,
      pageSize: 1,
      excludeSystemMessages: true
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const { list } = res.result.data;
        
        if (list && list.length > 0) {
          console.log('===== 消息数据结构 =====');
          console.log('第一条消息:', list[0]);
          console.log('消息字段:', Object.keys(list[0]));
          
          // 检查是否有cover_url字段
          const hasCoverUrl = list.some(msg => msg.cover_url);
          console.log('是否有cover_url字段:', hasCoverUrl);
        }
      }
    }).catch(err => {
      console.error('调试消息失败:', err);
    });
  }
});