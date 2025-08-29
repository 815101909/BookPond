// 听力错题页面
// 引入跨环境云函数调用工具
const { listeningAPI } = require('../../utils/cloud-api.js');
const app = getApp();

Page({
  data: {
    errors: [], // 错题列表
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
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 调用云函数获取错题列表
    listeningAPI.getMistakes(1, 100).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const { list, total } = res.result.data;
        
        // 转换数据格式以适配现有UI
        const formattedErrors = list.map(mistake => {
          return {
            _id: mistake._id,
            audioId: mistake.audio_id,
            question: mistake.exercise.question,
            options: mistake.exercise.options,
            answer: mistake.exercise.answer,
            explanation: mistake.exercise.explanation,
            difficulty: mistake.exercise.type === 'single' ? 'sprout' : 'forest',
            date: this.formatDate(mistake.created_at),
            timestamp: mistake.created_at,
            audioType: 'podcast', // 默认类型
            is_reviewed: mistake.is_reviewed, // 修正字段名
            userAnswer: mistake.user_answer
          };
        });
        
        this.setData({
          total: total,
          errors: formattedErrors
        });
      } else {
        console.error('获取错题失败:', res);
        wx.showToast({
          title: '获取错题失败',
          icon: 'none'
        });
        
        this.setData({
          total: 0,
          errors: []
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获取错题失败:', err);
      
      this.setData({
        total: 0,
        errors: []
      });
      
      wx.showToast({
        title: '获取错题失败',
        icon: 'none'
      });
    });
  },
  
  // 格式化日期
  formatDate: function(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    
    // 保存错题数据到全局，以便详情页使用
    if (app.globalData) {
      app.globalData.currentMistake = {
        _id: errorItem._id,
        audio_id: errorItem.audioId,
        exercise: {
          question: errorItem.question,
          options: errorItem.options,
          answer: errorItem.answer,
          explanation: errorItem.explanation,
          type: errorItem.difficulty === 'sprout' ? 'single' : 'multiple'
        },
        user_answer: errorItem.userAnswer,
        created_at: errorItem.timestamp,
        is_reviewed: errorItem.is_reviewed
      };
    }
    
    // 导航到错题详情页
    wx.navigateTo({
      url: './error-detail/error-detail',
      success: () => {
        setTimeout(() => {
          wx.hideLoading();
          this.setData({ isNavigating: false });
        }, 500);
      },
      fail: (err) => {
        console.error('导航到错题详情页失败', err);
        wx.hideLoading();
        this.setData({ isNavigating: false });
        
        wx.showToast({
          title: '导航失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 删除收藏的错题
  deleteError: function(e) {
    const index = e.currentTarget.dataset.index;
    const errorItem = this.data.errors[index];
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这道习题吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
            mask: true
          });
          
          // 调用云函数删除错题
          listeningAPI.deleteMistake(errorItem._id).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.code === 0) {
              // 更新本地数据
              const updatedErrors = this.data.errors.filter((_, i) => i !== index);
              
              this.setData({
                total: updatedErrors.length,
                errors: updatedErrors
              });
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('删除错题失败:', err);
            
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
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