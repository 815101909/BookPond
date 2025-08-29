// 错题详情页面
Page({
  data: {
    mistake: null,
    optionLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    isPlaying: false,
    playbackSpeed: 1.0,
    audioContext: null,
    audioUrl: '',
    audioLoaded: false
  },

  onLoad: function() {
    // 从全局获取当前错题数据
    const app = getApp();
    if (app.globalData && app.globalData.currentMistake) {
      this.setData({
        mistake: app.globalData.currentMistake
      });
      
      console.log('加载错题详情:', this.data.mistake);
      
      // 初始化音频上下文
      this.initAudioContext();
    } else {
      wx.showToast({
        title: '错题数据不存在',
        icon: 'none'
      });
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },
  
  onUnload: function() {
    // 页面卸载时停止音频播放
    if (this.data.audioContext) {
      this.data.audioContext.stop();
    }
  },
  
  // 初始化音频上下文
  initAudioContext: function() {
    const mistake = this.data.mistake;
    if (!mistake || !mistake.audio_id) return;
    
    wx.showLoading({
      title: '加载音频...',
      mask: true
    });
    
    // 获取音频详情
    wx.cloud.callFunction({
      name: 'jiuyu_listening',
      data: {
        type: 'getAudioDetail',
        audioId: mistake.audio_id
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const audioData = res.result.data;
        console.log('获取音频详情成功:', audioData);
        
        if (audioData.audio_url) {
          this.setData({
            audioUrl: audioData.audio_url,
            audioLoaded: true
          });
          
          // 创建音频上下文
          const audioContext = wx.createInnerAudioContext();
          audioContext.src = audioData.audio_url;
          
          // 监听播放结束
          audioContext.onEnded(() => {
            this.setData({ isPlaying: false });
          });
          
          // 监听播放错误
          audioContext.onError((err) => {
            console.error('音频播放错误:', err);
            this.setData({ isPlaying: false });
            wx.showToast({
              title: '音频播放失败',
              icon: 'none'
            });
          });
          
          this.setData({ audioContext });
        } else {
          console.error('音频URL不存在');
          wx.showToast({
            title: '音频资源不可用',
            icon: 'none'
          });
        }
      } else {
        console.error('获取音频详情失败:', res);
        wx.showToast({
          title: '获取音频失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获取音频详情失败:', err);
      wx.showToast({
        title: '获取音频失败',
        icon: 'none'
      });
    });
  },
  
  // 切换播放状态
  togglePlay: function() {
    const { audioContext, isPlaying, audioLoaded } = this.data;
    
    if (!audioLoaded) {
      wx.showToast({
        title: '音频资源不可用',
        icon: 'none'
      });
      return;
    }
    
    if (!audioContext) {
      wx.showToast({
        title: '音频初始化中...',
        icon: 'none'
      });
      
      // 尝试重新初始化音频
      this.initAudioContext();
      return;
    }
    
    if (isPlaying) {
      audioContext.pause();
      this.setData({ isPlaying: false });
    } else {
      audioContext.play();
      
      // 设置播放速度
      audioContext.playbackRate = this.data.playbackSpeed;
      
      this.setData({ isPlaying: true });
    }
  },
  
  // 设置播放速度
  setPlaybackSpeed: function(e) {
    const speed = parseFloat(e.currentTarget.dataset.speed);
    const { audioContext } = this.data;
    
    this.setData({ playbackSpeed: speed });
    
    if (audioContext) {
      audioContext.playbackRate = speed;
    }
    
    wx.showToast({
      title: `播放速度: ${speed}x`,
      icon: 'none'
    });
  },
  
  // 标记为已复习
  markAsReviewed: function() {
    const mistake = this.data.mistake;
    
    if (!mistake) return;
    
    wx.showLoading({
      title: '更新中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'jiuyu_listening',
      data: {
        type: 'updateMistake',
        mistakeId: mistake._id,
        isReviewed: true
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        // 更新本地数据
        const updatedMistake = { ...this.data.mistake, is_reviewed: true };
        this.setData({ mistake: updatedMistake });
        
        // 更新全局数据
        const app = getApp();
        if (app.globalData) {
          app.globalData.currentMistake = updatedMistake;
        }
        
        wx.showToast({
          title: '已标记为复习',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('更新错题状态失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    });
  },
  
  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  },
  
  // 开始练习
  startPractice: function() {
    const mistake = this.data.mistake;
    
    if (!mistake || !mistake.audio_id) {
      wx.showToast({
        title: '无法开始练习',
        icon: 'none'
      });
      return;
    }
    
    // 准备练习数据
    const practiceData = {
      audioId: mistake.audio_id,
      difficulty: mistake.exercise.type === 'single' ? 'sprout' : 'forest'
    };
    
    // 保存到全局
    const app = getApp();
    if (app.globalData) {
      app.globalData.pendingPractice = practiceData;
    }
    
    // 跳转到听力页面
    wx.switchTab({
      url: '/pages/listen/listen'
    });
  }
}); 