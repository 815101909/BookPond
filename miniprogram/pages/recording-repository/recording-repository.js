// 录音仓库页面逻辑
Page({
  data: {
    total: 0,
    recordings: []
  },

  onLoad: function() {
    this.loadRecordingRepository();
  },
  
  onShow: function() {
    // 每次显示页面时重新加载数据，确保数据最新
    this.loadRecordingRepository();
  },
  
  // 加载录音仓库数据
  loadRecordingRepository: function() {
    try {
      // 从本地存储获取录音仓库数据
      const recordings = wx.getStorageSync('recordingRepository') || [];
      
      // 确保每个录音项目都有充分的字幕内容展示
      const processedRecordings = recordings.map(recording => {
        // 如果字幕内容太短或不存在，尝试用其他字段补充
        if (!recording.subtitle || recording.subtitle.length < 50) {
          // 尝试从其他字段获取更多内容
          const content = recording.content || '';
          const description = recording.description || '';
          
          // 组合字幕内容，优先使用现有字幕，然后是content，最后是description
          let fullSubtitle = recording.subtitle || '';
          
          if (content && fullSubtitle.length < 300) {
            fullSubtitle = fullSubtitle ? `${fullSubtitle}\n\n${content}` : content;
          }
          
          if (description && fullSubtitle.length < 300) {
            fullSubtitle = fullSubtitle ? `${fullSubtitle}\n\n${description}` : description;
          }
          
          // 如果还是没有足够内容，添加一个默认内容
          if (fullSubtitle.length < 50) {
            const defaultContent = recording.type === 'hotspot' 
              ? '这是一则热点主持录音，通过练习主持热点新闻内容，提升您的表达能力和语言组织能力。定期练习可以帮助您在公众场合更加自信地发言。'
              : '这是一则名著配音录音，通过朗读经典名著片段，提升您的阅读理解能力和语言表达技巧。经典名著中的语言精华可以帮助您积累优美的词句和表达方式。';
            
            fullSubtitle = fullSubtitle ? `${fullSubtitle}\n\n${defaultContent}` : defaultContent;
          }
          
          // 更新字幕内容
          recording.subtitle = fullSubtitle;
        }
        
        // 确保日期格式正确
        if (recording.recordTime) {
          try {
            const date = new Date(recording.recordTime);
            recording.formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          } catch (e) {
            recording.formattedDate = recording.recordTime.substring(0, 10);
          }
        } else {
          recording.formattedDate = '未知日期';
        }
        
        return recording;
      });
      
      this.setData({
        recordings: processedRecordings,
        total: processedRecordings.length
      });
      
      console.log('加载录音仓库数据成功:', processedRecordings);
    } catch (e) {
      console.error('加载录音仓库数据失败:', e);
      
      this.setData({
        recordings: [],
        total: 0
      });
    }
  },

  // 播放录音
  playRecording: function(e) {
    const recordingId = e.currentTarget.dataset.id;
    const recording = this.data.recordings.find(item => item.id === recordingId);
    
    if (!recording || !recording.audioPath) {
      wx.showToast({
        title: '录音文件不存在',
        icon: 'none'
      });
      return;
    }
    
    // 检查文件是否存在
    wx.getFileInfo({
      filePath: recording.audioPath,
      success: (res) => {
        console.log('播放录音文件信息:', res);
    
    // 播放录音
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = recording.audioPath;
    
        innerAudioContext.onPlay(() => {
          console.log('开始播放录音');
    wx.showToast({
      title: '正在播放录音...',
      icon: 'none',
      duration: 2000
          });
        });
        
        innerAudioContext.onError((err) => {
          console.error('播放录音错误:', err);
          wx.showToast({
            title: '播放录音失败',
            icon: 'none'
          });
        });
        
        innerAudioContext.play();
      },
      fail: (err) => {
        console.error('录音文件不存在:', err);
        wx.showToast({
          title: '录音文件已丢失',
          icon: 'none'
        });
      }
    });
  },

  // 分享录音
  shareRecording: function(e) {
    const recordingId = e.currentTarget.dataset.id;
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 删除录音
  deleteRecording: function(e) {
    const recordingId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条录音吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            // 从本地存储中删除
            const recordings = this.data.recordings.filter(item => item.id !== recordingId);
            wx.setStorageSync('recordingRepository', recordings);
            
            this.setData({
              recordings: recordings,
              total: recordings.length
            });
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
          } catch (e) {
            console.error('删除录音失败:', e);
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 返回个人主页
  backToProfile: function() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },
  
  // 设置录音为头像
  setAsAvatar: function(e) {
    const recordingId = e.currentTarget.dataset.id;
    wx.showToast({
      title: '已设为个人头像',
      icon: 'success',
      duration: 1500
    });
  },
  
  // 导航到说一说页面开始新录音
  navigateToSpeak: function() {
    wx.switchTab({
      url: '/pages/speak/speak'
    });
  }
}); 