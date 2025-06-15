// 听力错题页面逻辑
const app = getApp();

Page({
  data: {
    errors: [],
    total: 0,
    optionLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    isNavigating: false
  },

  onLoad: function (options) {
    this.loadSavedErrors();
  },

  onShow: function () {
    // 每次页面展示时刷新数据
    this.loadSavedErrors();
  },

  // 加载保存的错题
  loadSavedErrors: function() {
    wx.getStorage({
      key: 'listening_mistakes',
      success: (res) => {
        const savedErrors = res.data || [];
        
        // 根据时间戳倒序排列，最新收藏的显示在最前面
        savedErrors.sort((a, b) => b.timestamp - a.timestamp);
        
        this.setData({
          total: savedErrors.length,
          errors: savedErrors
        });
      },
      fail: (err) => {
        console.error('获取收藏习题失败', err);
        this.setData({
          total: 0,
          errors: []
        });
      }
    });
  },

  // 直接开始练习
  navigateToDetail: function(e) {
    // 如果正在导航中，则忽略点击
    if (this.data.isNavigating) {
      console.log('已经在导航过程中，忽略重复点击');
      return;
    }
    
    // 设置导航状态为true
    this.setData({
      isNavigating: true
    });
    
    const index = e.currentTarget.dataset.index;
    const errorItem = this.data.errors[index];
    
    // 显示加载提示
    wx.showLoading({
      title: '正在准备练习...',
      mask: true
    });
    
    // 先将数据保存到本地存储，确保不会丢失
    const pendingAudioData = {
      audioType: errorItem.audioType, // 区分热点「晓」播客或名著「晓」喇叭
      difficulty: errorItem.difficulty, // 保留原始难度（萌芽岛/破茧谷/翱翔峰）
      language: errorItem.language || '中文（简体）', // 保留原始语言设置
      date: errorItem.date, // 保留原始习题日期
      exerciseQuestion: errorItem.question, // 传递原题目，以便listen页面可以加载相同的习题
      timestamp: errorItem.timestamp,
      options: errorItem.options, // 传递选项
      answer: errorItem.answer, // 传递答案
      explanation: errorItem.explanation, // 传递解析
      pendingTimestamp: Date.now() // 添加时间戳标记，确保能识别最新请求
    };
    
    // 同时保存到本地存储和全局状态
    wx.setStorage({
      key: 'pending_audio_exercise',
      data: pendingAudioData,
      success: () => {
        // 设置全局状态
        getApp().globalData.pendingAudio = pendingAudioData;
        
        // 延迟一点再跳转，确保数据已保存
        setTimeout(() => {
          // 直接跳转到听力页面开始练习
          wx.switchTab({
            url: '/pages/listen/listen',
            success: () => {
              // 隐藏加载提示
              setTimeout(() => {
                wx.hideLoading();
              }, 500);
            },
            fail: (err) => {
              console.error('跳转到听力页面失败', err);
              wx.hideLoading();
              wx.showToast({
                title: '跳转失败，请重试',
                icon: 'none'
              });
            }
          });
        }, 100); // 添加100ms延迟确保数据已保存
      },
      fail: (err) => {
        console.error('保存练习数据失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '准备数据失败，请重试',
          icon: 'none'
        });
      }
    });
  },
  
  // 删除收藏的错题
  deleteError: function(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这道习题吗？',
      success: (res) => {
        if (res.confirm) {
          // 复制当前数组，删除指定项
          const updatedErrors = [...this.data.errors];
          updatedErrors.splice(index, 1);
          
          // 更新存储和页面数据
          wx.setStorage({
            key: 'listening_mistakes',
            data: updatedErrors,
            success: () => {
              this.setData({
                total: updatedErrors.length,
                errors: updatedErrors
              });
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  backToProfile: function () {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  navigateToListen: function () {
    wx.switchTab({
      url: '/pages/listen/listen'
    });
  }
}); 