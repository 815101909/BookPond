// 说一说页面逻辑
// 引入跨环境云函数调用工具
const { pointsAPI, listeningAPI, subtitlesAPI } = require('../../utils/cloud-api');

// 通用临时链接处理函数
async function getTemporaryFileUrl(fileUrl, type = 'file') {
  if (!fileUrl) {
    console.log(`${type}链接为空`);
    return null;
  }

  try {
    if (fileUrl.startsWith('cloud://')) {
      try {
        // 从URL中动态提取环境ID
        let resourceEnv = 'cloud1-1gsyt78b92c539ef'; // 默认环境
        const envMatch = fileUrl.match(/cloud:\/\/([^.]+)/);
        if (envMatch && envMatch[1]) {
          resourceEnv = envMatch[1];
        }
        
        // 跨环境创建 Cloud 实例
        const cloudInstance = new wx.cloud.Cloud({
          identityless: true,
          resourceAppid: 'wx85d92d28575a70f4',
          resourceEnv: resourceEnv,
        });
        await cloudInstance.init();

        const result = await cloudInstance.getTempFileURL({
          fileList: [fileUrl],
        });

        if (result.fileList?.[0]?.tempFileURL) {
          console.log(`${type}云存储URL转换成功:`, fileUrl, '->', result.fileList[0].tempFileURL);
          return result.fileList[0].tempFileURL;
        } else {
          console.error(`${type}云链接转换失败:`, result);
          return fileUrl; // 返回原URL
        }
      } catch (err) {
        console.error(`${type}云链接转换异常:`, err);
        return fileUrl; // 返回原URL
      }
    }

    if (fileUrl.startsWith('http')) {
      console.log(`${type}链接为HTTP地址:`, fileUrl);
      return fileUrl;
    }

    console.log(`${type}链接格式未知，返回原链接:`, fileUrl);
    return fileUrl;
  } catch (error) {
    console.error(`处理${type}链接时出错:`, error);
    return fileUrl;
  }
}

const audioManager = wx.getBackgroundAudioManager();
const recorderManager = wx.getRecorderManager();

let speakingStartTime = null;
let accumulatedSpeakingTime = 0;
let speakingTimer = null;
let currentPage = null;

Page({
  data: {
    // 说话计时相关变量
    speakingStartTime: null,
    accumulatedSpeakingTime: 0,
    speakingTimer: null,
    currentPage: 'speak',
    
    // 花园模式数据
    todayFlowers: 0,
    totalFlowers: 0,
    dailyGoal: 50, // 每日花朵目标
    hasReachedGoal: false,
    showGardenRulesPopup: false,
    recordingCounter: 0, // 录音次数计数器
    
    // 花园墙数据
    flowers: [], // 用户获得的花朵
    newFlowerAdded: false, // 标记是否新添加了花朵
    
    // 书签抽拉状态
    hotspotExpanded: false,
    classicExpanded: false, // 恢复森林主持展开状态
    
    // 语言选择
    languages: [
      { name: '中文（简体）', code: 'zh-CN' },
      { name: '中文（繁体）', code: 'zh-TW' },
      { name: '英语', code: 'en' },
      { name: '法语', code: 'fr' },
      { name: '西班牙语', code: 'es' },
      { name: '德语', code: 'de' },
      { name: '意大利语', code: 'it' },
      { name: '日语', code: 'ja' },
      { name: '葡萄牙语（葡萄牙）', code: 'pt-PT' },
      { name: '葡萄牙语（巴西）', code: 'pt-BR' },
      { name: '俄语', code: 'ru' },
      { name: '韩语', code: 'ko' }
    ],
    // 对照语言
    languageIndex: 0,
    selectedLanguage: { name: '中文（简体）', code: 'zh-CN' },
    // 字幕语言
    subtitleLanguageIndex: 0,
    selectedSubtitleLanguage: { name: '中文（简体）', code: 'zh-CN' },
    
    // 语言选择菜单
    showHotspotLanguageMenu: false,
    
    // 当前翻译语言
    hotspotTranslationLanguage: { name: '中文（简体）', code: 'zh-CN' },
    
    // 难度选项
    difficulties: [
      { id: 'sprout', name: '萌芽岛', icon: '🌱' },
      { id: 'forest', name: '森林谷', icon: '🌳' }
    ],
    
    // 热点主持数据
    hotspotSelectedDate: '',
    hotspotSelectedDifficulty: 'sprout',
    isHotspotPlaying: false,
    isHotspotTranslationPlaying: false, // 热点主持翻译音频播放状态
    isHotspotRecording: false,
    hotspotRecordingPath: '',
    isPlayingHotspotRecording: false,
    currentHotspot: null,
    
    validRecordingObtained: false,
    // 添加计时器状态
    timerActive: false,
    lastStatUpdate: 0,
    forestSelectedDate: '', // 新增森林主播学习日期
    emptyGardenFallback: true, // 默认显示嫩芽
    hotspotRecordStartTime: 0,
    hotspotRecordDuration: 0,
    classicRecordStartTime: 0,
    classicRecordDuration: 0,
    
    // 经典朗读数据
    currentClassic: {
      title: '',
      coverImage: '',
      audioUrl: '',
      segments: [],
      duration: 0,
      currentSubtitle: '',
      currentSubtitleImage: '',
      imageUrls: [], // 轮播图片数组
      currentImageIndex: 0, // 当前轮播图片索引
      glid: ''
    },
    isClassicPlaying: false,
    isClassicRecording: false,
    classicRecordingPath: '',
    isPlayingClassicRecording: false,
    
    // 当前音频类型（难度选择）
    currentAudioType: 'podcast', // 默认为萌芽主持
  },
  
  onLoad: function(options) {
    try {
      // 页面加载时执行
      this.loadFlowersData();
      
      // 设置当前日期
      const today = new Date();
      const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      this.setData({
        hotspotSelectedDate: formattedDate,
        forestSelectedDate: formattedDate // 初始化森林主播日期
      });
      
      // 加载热点主持内容
      try {
        this.loadHotspotContent();
      } catch (err) {
        console.error('加载热点内容失败:', err);
        this.useDefaultSpeakingContent('hotspot');
      }
      
      // 加载经典朗读内容
      try {
        this.loadClassicContent();
      } catch (err) {
        console.error('加载经典朗读内容失败:', err);
        this.useDefaultSpeakingContent('classic');
      }
      
      // 设置录音配置
      this.setupRecorder();
      
      // 加载录音计数器
      this.loadRecordingCounter();
      
      // 加载花园墙花朵
      this.loadGardenFlowers();
      
      // 初始化口语计时
      this.setData({
        speakingStartTime: null,
        accumulatedSpeakingTime: 0,
        speakingTimer: null
      });
      
      // 清除上次同步的分钟数记录
      wx.removeStorageSync('lastSyncedSpeakMinutes');
      
      // 开始计时
      this.startSpeakingTimer();
    } catch (error) {
      console.error('页面加载失败:', error);
      
      // 确保基本UI结构仍然显示
      const today = new Date();
      const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      this.setData({
        hotspotSelectedDate: formattedDate,
        forestSelectedDate: formattedDate, // 初始化森林主播日期
        totalFlowers: 0,
        todayFlowers: 0
      });
      
      // 使用默认内容
      this.useDefaultSpeakingContent('hotspot');
      this.useDefaultSpeakingContent('classic');
      
      // 显示错误提示
      wx.showToast({
        title: '页面加载失败，使用默认数据',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  onUnload: function() {
    // 页面卸载时清理资源
    console.log('页面卸载，清理音频资源');
    
    // 停止计时并更新统计数据
    this.stopSpeakingTimer();
    
    // 停止音频播放
    audioManager.stop();
    
    // 清除字幕定时器
    if (this.subtitleTimer) {
      clearInterval(this.subtitleTimer);
      this.subtitleTimer = null;
    }
    
    // 移除音频事件监听器
    audioManager.offTimeUpdate();
    audioManager.offEnded();
    audioManager.offPause();
    audioManager.offStop();
    audioManager.offError();
    
    // 清理录音资源
    recorderManager.stop();
  },
  
  /**
   * 加载花朵数据
   */
  loadFlowersData: function() {
    try {
      // 获取当前日期，用于判断是否为今日花朵
      const today = new Date().toDateString();
      const lastFlowersDate = wx.getStorageSync('lastSpeakFlowersDate') || '';
      
      // 如果是新的一天，重置今日花朵
      if (lastFlowersDate !== today) {
        wx.setStorageSync('todaySpeakFlowers', 0);
        wx.setStorageSync('lastSpeakFlowersDate', today);
      }
      
      // 从本地获取今日花朵
      const todayFlowers = wx.getStorageSync('todaySpeakFlowers') || 0;
      
      // 从跨环境云函数获取总花朵数据
      pointsAPI.getUserPoints().then(res => {
        console.log('获取用户积分结果:', res);
        if (res.result && res.result.code === 0 && res.result.data) {
          const userData = res.result.data;
          
          // 总花朵数从云端获取，今日花朵从本地获取
          const totalFlowers = userData.speak_points || 0;
          const hasReachedGoal = todayFlowers >= this.data.dailyGoal;
          
          this.setData({
            totalFlowers: totalFlowers,
            todayFlowers: todayFlowers,
            hasReachedGoal: hasReachedGoal
          });
          
          console.log('花朵数据加载成功:', { totalFlowers, todayFlowers });
        } else {
          // 出错时使用本地存储作为备份
          this.loadLocalFlowersData();
        }
      }).catch(err => {
        console.error('获取用户积分出错', err);
        // 出错时使用本地存储作为备份
        this.loadLocalFlowersData();
      });
    } catch (e) {
      console.error('加载花朵数据失败:', e);
      // 出错时使用本地存储作为备份
      this.loadLocalFlowersData();
    }
  },
  
  /**
   * 从本地存储加载花朵数据（作为备份方案）
   */
  loadLocalFlowersData: function() {
    // 获取当前日期，用于判断是否为今日花朵
    const today = new Date().toDateString();
    const lastFlowersDate = wx.getStorageSync('lastSpeakFlowersDate') || '';
    
    // 如果是新的一天，重置今日花朵
    if (lastFlowersDate !== today) {
      wx.setStorageSync('todaySpeakFlowers', 0);
      wx.setStorageSync('lastSpeakFlowersDate', today);
    }
    
    // 从本地获取花朵数据
    const todayFlowers = wx.getStorageSync('todaySpeakFlowers') || 0;
    const totalFlowers = wx.getStorageSync('totalSpeakFlowers') || 0;
    
    // 计算是否已达成目标
    const hasReachedGoal = todayFlowers >= this.data.dailyGoal;
    
    this.setData({
      totalFlowers: totalFlowers,
      todayFlowers: todayFlowers,
      hasReachedGoal: hasReachedGoal
    });
    
    console.log('从本地加载花朵数据:', { totalFlowers, todayFlowers });
  },
  
  /**
   * 更新用户积分
   */
  updateUserPoints: function(type, delta) {
    pointsAPI.updateUserPoints({
      type: type, // 'speak_points' 或 'speak_flowers'
      delta: delta // 要增加的数值，可以是正数或负数
    }).then(res => {
      console.log('更新用户积分结果:', res);
      if (res.result && res.result.code === 0) {
        // 更新本地数据
        if (type === 'speak_points') {
          // 更新总积分
          this.setData({
            totalFlowers: this.data.totalFlowers + delta
          });
          
          // 同时更新今日花朵（存储在本地）
          const todayFlowers = this.data.todayFlowers + delta;
          this.setData({ 
            todayFlowers: todayFlowers,
            hasReachedGoal: todayFlowers >= this.data.dailyGoal
          });
          wx.setStorageSync('todaySpeakFlowers', todayFlowers);
        } else if (type === 'speak_flowers') {
          // 更新花朵（仅在云端记录）
        }
        
        // 显示提示
        wx.showToast({
          title: `获得${delta}朵花朵`,
          icon: 'success'
        });
      } else {
        console.error('更新用户积分失败', res);
      }
    }).catch(err => {
      console.error('更新用户积分出错', err);
    });
  },
  
  /**
   * 加载热点主持内容（获取最新文章）
   */
  loadHotspotContent: function() {
    console.log('=== 加载热点主持内容调试 ===');
    const { selectedLanguage } = this.data;
    const languageCode = selectedLanguage ? selectedLanguage.code : 'zh-CN';
    
    console.log('热点主持难度: sprout');
    console.log('选择的语言对象:', selectedLanguage);
    console.log('使用的语言代码:', languageCode);
    
    const requestData = {
      type: 'getLatestArticle',
      level: 'sprout',
      languageCode: languageCode
    };
    console.log('云函数请求参数:', requestData);
    
    listeningAPI.getAudioList(requestData).then(res => {
      console.log('获取最新热点文章结果:', res);
      
      if (res.result && res.result.code === 0 && res.result.data) {
        let articleData = res.result.data;
        console.log('获取到的文章数据:', JSON.stringify(articleData, null, 2));
        
        // 根据选择的语言更新音频URL
        articleData = this.updateAudioByLanguage(articleData, languageCode);
        
        // 获取字幕数据
        this.loadSubtitleForArticle(articleData, 'hotspot');
      } else {
        console.log('未找到热点文章，使用默认内容');
        this.useDefaultSpeakingContent('hotspot');
      }
    }).catch(err => {
      console.error('获取热点文章失败:', err);
      this.useDefaultSpeakingContent('hotspot');
    });
    console.log('=== 加载热点主持内容调试结束 ===');
  },

  /**
   * 根据文章数据加载字幕
   */
  loadSubtitleForArticle: function(articleData, type) {
    console.log('为文章加载字幕:', articleData._id, 'type:', type);
    const { selectedSubtitleLanguage } = this.data;
    const languageCode = selectedSubtitleLanguage ? selectedSubtitleLanguage.code : 'zh-CN';
    
    console.log('使用字幕语言:', selectedSubtitleLanguage, '语言代码:', languageCode);
    
    // 先使用文章基础数据创建内容对象
    const contentData = {
      title: articleData.title || (type === 'hotspot' ? '热点主持内容' : '经典朗读内容'),
      coverImage: articleData.cover_url || (type === 'hotspot' ? '/images/default-hotspot.jpg' : '/images/default-classic.jpg'),
      audioUrl: articleData.audioUrl || articleData.audio_url || '',
      segments: [],
      duration: 0,
      currentSubtitle: '',
      currentSubtitleImage: articleData.cover_url || (type === 'hotspot' ? '/images/default-hotspot.jpg' : '/images/default-classic.jpg'),
      imageUrls: [], // 轮播图片数组
      currentImageIndex: 0, // 当前轮播图片索引
      glid: articleData._id
    };
    
    // 尝试获取字幕数据
    subtitlesAPI.getSubtitlesByGlid({
      glid: articleData._id,
      language: languageCode
    }).then(res => {
      console.log('=== 字幕云函数返回结果详细调试 ===');
      console.log('完整返回结果:', JSON.stringify(res, null, 2));
      console.log('result.code:', res.result ? res.result.code : 'undefined');
      console.log('result.msg:', res.result ? res.result.msg : 'undefined');
      console.log('result.data:', res.result ? res.result.data : 'undefined');
      
      if (res.result && res.result.code === 0 && res.result.data) {
        const subtitleData = res.result.data;
        console.log('字幕数据详细结构:', JSON.stringify(subtitleData, null, 2));
        
        // 合并字幕数据，但保持已经过语言处理的audioUrl
        contentData.segments = subtitleData.segments || [];
        contentData.duration = subtitleData.duration || 0;
        contentData.imageUrls = subtitleData.imageUrls || []; // 轮播图片数组
        contentData.currentImageIndex = subtitleData.currentImageIndex || 0; // 当前轮播图片索引
        
        // 只有在当前没有音频URL时才使用字幕数据中的audioUrl
        if (!contentData.audioUrl && subtitleData.audioUrl) {
          contentData.audioUrl = subtitleData.audioUrl;
          console.log('使用字幕数据中的音频URL:', subtitleData.audioUrl);
        } else {
          console.log('保持已处理的音频URL:', contentData.audioUrl);
        }
        
        console.log('字幕数据加载成功，segments数量:', contentData.segments.length);
        console.log('segments内容预览:', contentData.segments.slice(0, 2));
        console.log('轮播图片数量:', contentData.imageUrls.length);
        console.log('最终音频URL:', contentData.audioUrl);
        console.log('=== 字幕数据处理完成 ===');
      } else {
        console.log('未找到字幕数据，使用文章基础信息');
        console.log('失败原因 - code:', res.result ? res.result.code : 'result为空');
        console.log('失败原因 - msg:', res.result ? res.result.msg : 'result为空');
      }
      
      // 处理封面图片URL转换
      const processContentData = async () => {
        // 转换封面图片URL
        if (contentData.coverImage && contentData.coverImage.startsWith('cloud://')) {
          try {
            const tempCoverUrl = await getTemporaryFileUrl(contentData.coverImage, '封面图片');
            if (tempCoverUrl) {
              contentData.coverImage = tempCoverUrl;
              contentData.currentSubtitleImage = tempCoverUrl;
            }
          } catch (err) {
            console.error('获取封面图片临时URL失败:', err);
          }
        }
        
        // 转换轮播图片URLs
        if (contentData.imageUrls && contentData.imageUrls.length > 0) {
          const tempImageUrls = [];
          for (let i = 0; i < contentData.imageUrls.length; i++) {
            const imageUrl = contentData.imageUrls[i];
            if (imageUrl && imageUrl.startsWith('cloud://')) {
              try {
                const tempUrl = await getTemporaryFileUrl(imageUrl, `轮播图片${i+1}`);
                tempImageUrls.push(tempUrl || imageUrl);
              } catch (err) {
                console.error(`获取轮播图片${i+1}临时URL失败:`, err);
                tempImageUrls.push(imageUrl);
              }
            } else {
              tempImageUrls.push(imageUrl);
            }
          }
          contentData.imageUrls = tempImageUrls;
          console.log('轮播图片URL转换完成:', tempImageUrls.length, '张图片');
        }
        
        // 更新对应的数据
        if (type === 'hotspot') {
          this.setData({
            currentHotspot: contentData
          });
          console.log('热点主持内容设置完成:', contentData.title);
        } else if (type === 'classic') {
          this.setData({
            currentClassic: contentData
          });
          console.log('经典朗读内容设置完成:', contentData.title);
          console.log('=== 经典朗读内容详细调试 ===');
          console.log('设置的contentData:', JSON.stringify(contentData, null, 2));
          console.log('设置后的currentClassic:', JSON.stringify(this.data.currentClassic, null, 2));
          console.log('=== 经典朗读内容设置调试结束 ===');
        }
      };
      
      // 执行异步处理
      processContentData();
    }).catch(err => {
      console.error('获取字幕失败:', err);
      
      // 即使字幕获取失败，也使用文章基础数据，并处理图片URL转换
      const processContentDataOnError = async () => {
        // 转换封面图片URL
        if (contentData.coverImage && contentData.coverImage.startsWith('cloud://')) {
          try {
            const tempCoverUrl = await getTemporaryFileUrl(contentData.coverImage, '封面图片');
            if (tempCoverUrl) {
              contentData.coverImage = tempCoverUrl;
              contentData.currentSubtitleImage = tempCoverUrl;
            }
          } catch (err) {
            console.error('获取封面图片临时URL失败:', err);
          }
        }
        
        if (type === 'hotspot') {
          this.setData({
            currentHotspot: contentData
          });
        } else if (type === 'classic') {
          this.setData({
            currentClassic: contentData
          });
        }
      };
      
      processContentDataOnError();
    });
  },

  /**
   * 加载经典朗读内容（获取最新文章）
   */
  loadClassicContent: function() {
    console.log('=== 加载经典朗读内容调试 ===');
    const { selectedLanguage } = this.data;
    const languageCode = selectedLanguage ? selectedLanguage.code : 'zh-CN';
    
    console.log('经典朗读难度: forest');
    console.log('选择的语言对象:', selectedLanguage);
    console.log('使用的语言代码:', languageCode);
    
    const requestData = {
      type: 'getLatestArticle',
      difficulty: 'forest',
      languageCode: languageCode
    };
    console.log('云函数请求参数:', requestData);
    
    listeningAPI.getAudioList(requestData).then(res => {
      console.log('获取最新经典朗读文章结果:', res);
      
      if (res.result && res.result.code === 0 && res.result.data) {
        let articleData = res.result.data;
        console.log('获取到的文章数据:', JSON.stringify(articleData, null, 2));
        
        // 根据选择的语言更新音频URL
        articleData = this.updateAudioByLanguage(articleData, languageCode);
        
        // 获取字幕数据
        this.loadSubtitleForArticle(articleData, 'classic');
        
        // 添加调试：检查currentClassic数据
        setTimeout(() => {
          console.log('=== 检查currentClassic数据设置 ===');
          console.log('currentClassic.title:', this.data.currentClassic.title);
          console.log('currentClassic.coverImage:', this.data.currentClassic.coverImage);
          console.log('currentClassic.audioUrl:', this.data.currentClassic.audioUrl);
          console.log('currentClassic完整数据:', JSON.stringify(this.data.currentClassic, null, 2));
          console.log('=== currentClassic数据检查结束 ===');
        }, 1000);
      } else {
        console.log('未找到经典朗读文章，使用默认内容');
        this.useDefaultSpeakingContent('classic');
      }
    }).catch(err => {
      console.error('获取经典朗读文章失败:', err);
      this.useDefaultSpeakingContent('classic');
    });
    console.log('=== 加载经典朗读内容调试结束 ===');
  },

  /**
   * 使用默认说话内容
   */
  useDefaultSpeakingContent: function(type) {
    console.log('使用默认说话内容:', type);
    
    if (type === 'hotspot') {
      // 设置默认热点主持内容
      this.setData({
        currentHotspot: {
          title: '今日热点话题',
          coverImage: '/images/default-hotspot.jpg',
          content: '欢迎来到萌芽岛！今天我们来聊聊日常生活中的小美好。你可以分享一下今天让你感到开心的事情，或者谈谈你最喜欢的季节和原因。记住，每一次的表达都是成长的机会！',
          audioUrl: null, // 默认没有音频
          segments: [],
          duration: 0,
          currentSubtitle: '',
          currentSubtitleImage: '/images/default-hotspot.jpg',
          imageUrls: [], // 轮播图片数组
          currentImageIndex: 0, // 当前轮播图片索引
          glid: ''
        }
      });
    } else if (type === 'classic') {
      // 设置默认经典朗读内容
      this.setData({
        currentClassic: {
          title: '经典朗读',
          content: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。',
          audioUrl: null // 默认没有音频
        }
      });
    }
  },

  /**
   * 设置录音配置
   */
  setupRecorder: function() {
    try {
      // 设置录音格式
      const options = {
        duration: 600000, // 最长录音时间10分钟
        sampleRate: 44100, // 采样率
        numberOfChannels: 1, // 录音通道数
        encodeBitRate: 192000, // 编码码率
        format: 'mp3' // 音频格式
      };
      
      // 监听录音开始事件
      recorderManager.onStart(() => {
        console.log('录音开始');
      });
      
      // 监听录音结束事件
      recorderManager.onStop((res) => {
        console.log('录音结束', res);
      });
      
      // 监听录音错误事件
      recorderManager.onError((err) => {
        console.error('录音错误:', err);
        wx.showToast({
          title: '录音失败',
          icon: 'none'
        });
      });
      
      console.log('录音配置设置完成');
    } catch (error) {
      console.error('设置录音配置失败:', error);
    }
  },

  /**
   * 加载录音计数器
   */
  loadRecordingCounter: function() {
    try {
      const counter = wx.getStorageSync('recordingCounter') || 0;
      this.setData({
        recordingCounter: counter
      });
      console.log('录音计数器加载完成:', counter);
    } catch (error) {
      console.error('加载录音计数器失败:', error);
      this.setData({
        recordingCounter: 0
      });
    }
  },

  /**
   * 加载花园墙花朵
   */
  loadGardenFlowers: function() {
    try {
      let gardenFlowers = wx.getStorageSync('gardenFlowers') || [];
      
      // 如果没有花朵数据，初始化空数组
      if (gardenFlowers.length === 0) {
        gardenFlowers = [];
        wx.setStorageSync('gardenFlowers', gardenFlowers);
      }
      
      let emptyGardenFallback = true;
      if (gardenFlowers && gardenFlowers.length > 0) {
        emptyGardenFallback = false;
      }
      this.setData({
        flowers: gardenFlowers,
        gardenFlowers: gardenFlowers,
        emptyGardenFallback: emptyGardenFallback
      });
      
      // 如果没有默认图片，预加载
      if (gardenFlowers.length === 0) {
        // 预加载空花园图片
        wx.getImageInfo({
          src: '/images/empty-garden.png',
          success: () => {
            console.log('Empty garden image loaded');
            this.setData({ emptyGardenFallback: false });
          },
          fail: () => {
            console.warn('Empty garden image not found, using fallback');
            this.setData({ emptyGardenFallback: true });
          }
        });
      }
      
      console.log('花园墙花朵加载成功:', gardenFlowers);
    } catch (e) {
      console.error('加载花园墙花朵失败:', e);
    }
  },
  
  onEmptyGardenImageLoad: function() {
    this.setData({ emptyGardenFallback: false });
  },
  
  onEmptyGardenImageError: function() {
    this.setData({ emptyGardenFallback: true });
  },
  
  /**
   * 获取随机花朵
   */
  getRandomFlower: function() {
    return new Promise((resolve, reject) => {
      // 通过跨环境云函数获取花朵数据
      subtitlesAPI.getFlowers({
        limit: 50
      }).then(res => {
          if (res.result && res.result.code === 0 && res.result.data && res.result.data.length > 0) {
            // 随机选择一种花朵
            const flowers = res.result.data;
            const randomIndex = Math.floor(Math.random() * flowers.length);
            const flower = flowers[randomIndex];
            resolve({
              icon: flower.icon || '🏵️',
              name: flower.name || '未知花朵',
              meaning: flower.meaning || '暂无花语'
            });
          } else {
            // 如果云函数返回失败或没有数据，使用备用花朵
            console.log('云函数获取花朵数据失败或无数据，使用备用花朵');
            const fallbackFlower = {
              icon: '🏵️',
              name: '樱花',
              meaning: '生命短暂而美丽，象征着纯洁与高尚的情操'
            };
            resolve(fallbackFlower);
          }
        }).catch(err => {
          console.error('调用云函数获取花朵数据失败:', err);
          // 失败时使用备用花朵
          const fallbackFlower = {
            icon: '🏵️',
            name: '樱花',
            meaning: '生命短暂而美丽，象征着纯洁与高尚的情操'
          };
          resolve(fallbackFlower);
        });
    });
  },
  
  bindForestDateChange: function(e) {
    this.setData({
      forestSelectedDate: e.detail.value
    });
  },
  
  toggleHotspot: function() {
    console.log('=== 切换到萌芽主持调试 ===');
    this.setData({
      hotspotExpanded: !this.data.hotspotExpanded,
      classicExpanded: false,
      currentAudioType: 'podcast' // 切换到萌芽主持时更新音频类型
    });
    
    // 如果展开了萌芽主持，立即加载热点内容
    if (this.data.hotspotExpanded) {
      console.log('展开萌芽主持，加载热点内容');
      this.loadHotspotContent();
    }
    console.log('=== 切换到萌芽主持调试结束 ===');
  },
  
  toggleClassic: function() {
    console.log('=== 切换到森林朗读调试 ===');
    this.setData({
      classicExpanded: !this.data.classicExpanded,
      hotspotExpanded: false,
      currentAudioType: 'forest' // 切换到森林朗读时更新音频类型
    });
    
    // 如果展开了森林朗读，立即加载森林朗读内容
    if (this.data.classicExpanded) {
      console.log('展开森林朗读，加载经典内容');
      this.loadClassicContent();
    }
    console.log('=== 切换到森林朗读调试结束 ===');
  },
  
  showGardenRules: function() {
    this.setData({ showGardenRulesPopup: true });
  },
  
  hideGardenRules: function() {
    this.setData({ showGardenRulesPopup: false });
  },

  /**
   * 播放热点音频并同步字幕
   */
  playHotspotAudio: async function() {
    console.log('播放热点音频');
    
    const { currentHotspot, isHotspotPlaying } = this.data;
    
    if (!currentHotspot || !currentHotspot.audioUrl) {
      wx.showToast({
        title: '暂无音频内容',
        icon: 'none'
      });
      return;
    }
    
    if (isHotspotPlaying) {
      // 暂停播放
      audioManager.pause();
      this.setData({
        isHotspotPlaying: false
      });
    } else {
      try {
        // 获取临时URL
        const tempAudioUrl = await getTemporaryFileUrl(currentHotspot.audioUrl, '热点音频');
        
        if (!tempAudioUrl) {
          wx.showToast({
            title: '音频链接获取失败',
            icon: 'none'
          });
          return;
        }
        
        // 检查是否已经设置了音频源
        if (audioManager.src !== tempAudioUrl) {
          // 首次播放或切换音频
          audioManager.src = tempAudioUrl;
          audioManager.title = currentHotspot.title;
          
          // 启动字幕同步
          this.startSubtitleSync('hotspot');
        }
        
        // 开始或继续播放
        audioManager.play();
        this.setData({
          isHotspotPlaying: true
        });
      } catch (error) {
        console.error('播放热点音频失败:', error);
        wx.showToast({
          title: '音频播放失败',
          icon: 'none'
        });
      }
    }
  },
  
  toggleHotspotRecording: function() {
    if (this.data.isHotspotRecording) {
    recorderManager.stop();
      this.setData({ isHotspotRecording: false });
      wx.showToast({ title: '录音已停止', icon: 'none' });
    } else {
      this.setData({ hotspotRecordStartTime: Date.now() });
      recorderManager.start({ format: 'mp3' });
      this.setData({ isHotspotRecording: true });
      wx.showToast({ title: '开始录音', icon: 'none' });
      recorderManager.onStop((res) => {
        const duration = Math.floor((Date.now() - this.data.hotspotRecordStartTime) / 1000);
        this.setData({ hotspotRecordingPath: res.tempFilePath, hotspotRecordDuration: duration });
        wx.showToast({ title: `录音时长：${duration}秒`, icon: 'none' });
      });
    }
  },

  playHotspotRecording: function() {
    if (!this.data.hotspotRecordingPath) {
      wx.showToast({ title: '请先录音', icon: 'none' });
      return;
    }
    audioManager.src = this.data.hotspotRecordingPath;
    audioManager.title = '我的录音';
    audioManager.play();
    this.setData({ isPlayingHotspotRecording: true });
    audioManager.onEnded(() => {
      this.setData({ isPlayingHotspotRecording: false });
    });
  },

  saveHotspotRecording: function() {
    if (!this.data.hotspotRecordingPath) {
      wx.showToast({ title: '请先录音', icon: 'none' });
      return;
    }
    if (this.data.hotspotRecordDuration < 45) {
      wx.showToast({ title: '录音需满45秒才可获得花朵奖励', icon: 'none' });
      return;
    }
    wx.getFileSystemManager().saveFile({
      tempFilePath: this.data.hotspotRecordingPath,
      success: (res) => {
        // 保存到录音仓库
        this.saveToRecordingRepository({
          type: 'hotspot',
          audioPath: res.savedFilePath,
          duration: this.data.hotspotRecordDuration,
          title: this.data.currentHotspot.title || '热点主持练习',
          subtitle: this.data.currentHotspot.currentSubtitle || this.getHotspotSubtitleText(),
          coverImage: this.data.currentHotspot.coverImage || '/images/default_article_1.png',
          recordTime: new Date().toISOString()
        });
        
        this.addFlowerToGarden('hotspot');
        wx.showToast({ title: '已存至仓库', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },
  
  /**
   * 播放经典音频并同步字幕
   */
  playClassicAudio: async function() {
    console.log('播放经典音频');
    
    const { currentClassic, isClassicPlaying } = this.data;
    
    if (!currentClassic || !currentClassic.audioUrl) {
      wx.showToast({
        title: '暂无音频内容',
        icon: 'none'
      });
      return;
    }
    
    if (isClassicPlaying) {
      // 暂停播放
      audioManager.pause();
      this.setData({
        isClassicPlaying: false
      });
    } else {
      try {
        // 获取临时URL
        const tempAudioUrl = await getTemporaryFileUrl(currentClassic.audioUrl, '经典音频');
        
        if (!tempAudioUrl) {
          wx.showToast({
            title: '音频链接获取失败',
            icon: 'none'
          });
          return;
        }
        
        // 检查是否已经设置了音频源
        if (audioManager.src !== tempAudioUrl) {
          // 首次播放或切换音频
          audioManager.src = tempAudioUrl;
          audioManager.title = currentClassic.title;
          
          // 启动字幕同步
          this.startSubtitleSync('classic');
        }
        
        // 开始或继续播放
        audioManager.play();
        this.setData({
          isClassicPlaying: true
        });
      } catch (error) {
        console.error('播放经典音频失败:', error);
        wx.showToast({
          title: '音频播放失败',
          icon: 'none'
        });
      }
    }
  },

  /**
   * 启动字幕同步
   */
  startSubtitleSync: function(type) {
    const contentKey = type === 'hotspot' ? 'currentHotspot' : 'currentClassic';
    const content = this.data[contentKey];
    
    if (!content || !content.segments || content.segments.length === 0) {
      console.log('无字幕数据，跳过字幕同步');
      return;
    }
    
    console.log('启动字幕同步，类型:', type, '字幕片段数:', content.segments.length);
    
    // 清除之前的定时器
    if (this.subtitleTimer) {
      clearInterval(this.subtitleTimer);
    }
    
    // 设置音频播放事件监听
    const that = this;
    
    // 监听音频播放时间更新
    audioManager.onTimeUpdate(() => {
      const currentTime = audioManager.currentTime || 0;
      
      // 查找当前时间对应的字幕片段
      const currentSegment = content.segments.find(segment => 
        currentTime >= segment.start_time && currentTime <= segment.end_time
      );
      
      if (currentSegment) {
        const updateData = {};
        updateData[`${contentKey}.currentSubtitle`] = currentSegment.text;
        
        // 处理字幕片段中的图片
        if (currentSegment.image_url) {
          // 使用getTemporaryFileUrl转换云存储URL
          getTemporaryFileUrl(currentSegment.image_url, '字幕图片').then(tempUrl => {
            if (tempUrl) {
              const imageUpdateData = {};
              imageUpdateData[`${contentKey}.currentSubtitleImage`] = tempUrl;
              that.setData(imageUpdateData);
            }
          }).catch(err => {
            console.error('获取字幕图片临时URL失败:', err);
          });
        } else if (content.imageUrls && content.imageUrls.length > 0) {
          // 如果没有字幕片段图片，根据音频时长平均分配图片显示时间
          const totalDuration = content.duration || 0;
          const imageCount = content.imageUrls.length;
          
          if (totalDuration > 0 && imageCount > 1) {
            // 计算每张图片应该显示的时间段
            const timePerImage = totalDuration / imageCount;
            const currentImageIndex = Math.floor(currentTime / timePerImage);
            
            // 确保索引不超出范围，最后一张图片显示到音频结束
            const safeImageIndex = Math.min(currentImageIndex, imageCount - 1);
            
            // 使用getTemporaryFileUrl转换云存储URL
            getTemporaryFileUrl(content.imageUrls[safeImageIndex], '轮播图片').then(tempUrl => {
              if (tempUrl) {
                const imageUpdateData = {};
                imageUpdateData[`${contentKey}.currentSubtitleImage`] = tempUrl;
                // 只在图片切换时更新索引
                if (safeImageIndex !== content.currentImageIndex) {
                  imageUpdateData[`${contentKey}.currentImageIndex`] = safeImageIndex;
                  console.log(`图片切换到第${safeImageIndex + 1}张，时间: ${currentTime.toFixed(1)}s，每张图片时长: ${timePerImage.toFixed(1)}s`);
                }
                that.setData(imageUpdateData);
              }
            }).catch(err => {
              console.error('获取轮播图片临时URL失败:', err);
            });
          } else {
            // 如果只有一张图片或没有音频时长信息，显示第一张图片
            getTemporaryFileUrl(content.imageUrls[0], '单张图片').then(tempUrl => {
              if (tempUrl) {
                const imageUpdateData = {};
                imageUpdateData[`${contentKey}.currentSubtitleImage`] = tempUrl;
                imageUpdateData[`${contentKey}.currentImageIndex`] = 0;
                that.setData(imageUpdateData);
              }
            }).catch(err => {
              console.error('获取单张图片临时URL失败:', err);
            });
          }
        }
        
        that.setData(updateData);
      } else {
        // 如果没有找到对应的字幕片段，清空当前字幕
        const updateData = {};
        updateData[`${contentKey}.currentSubtitle`] = '';
        that.setData(updateData);
      }
    });
    
    // 监听音频播放结束
    audioManager.onEnded(() => {
      console.log('音频播放结束，清理字幕');
      const stopData = {};
      stopData[type === 'hotspot' ? 'isHotspotPlaying' : 'isClassicPlaying'] = false;
      stopData[`${contentKey}.currentSubtitle`] = '';
      stopData[`${contentKey}.currentSubtitleImage`] = content.coverImage;
      
      that.setData(stopData);
    });
    
    // 监听音频暂停
    audioManager.onPause(() => {
      console.log('音频暂停');
      const pauseData = {};
      pauseData[type === 'hotspot' ? 'isHotspotPlaying' : 'isClassicPlaying'] = false;
      that.setData(pauseData);
    });
    
    // 监听音频停止
    audioManager.onStop(() => {
      console.log('音频停止，清理字幕');
      const stopData = {};
      stopData[type === 'hotspot' ? 'isHotspotPlaying' : 'isClassicPlaying'] = false;
      stopData[`${contentKey}.currentSubtitle`] = '';
      stopData[`${contentKey}.currentSubtitleImage`] = content.coverImage;
      
      that.setData(stopData);
    });
  },

  toggleClassicRecording: function() {
    if (this.data.isClassicRecording) {
      recorderManager.stop();
      this.setData({ isClassicRecording: false });
      wx.showToast({ title: '录音已停止', icon: 'none' });
    } else {
      this.setData({ classicRecordStartTime: Date.now() });
      recorderManager.start({ format: 'mp3' });
      this.setData({ isClassicRecording: true });
      wx.showToast({ title: '开始录音', icon: 'none' });
      recorderManager.onStop((res) => {
        const duration = Math.floor((Date.now() - this.data.classicRecordStartTime) / 1000);
        this.setData({ classicRecordingPath: res.tempFilePath, classicRecordDuration: duration });
        wx.showToast({ title: `录音时长：${duration}秒`, icon: 'none' });
      });
    }
  },

  playClassicRecording: function() {
    if (!this.data.classicRecordingPath) {
      wx.showToast({ title: '请先录音', icon: 'none' });
      return;
    }
    audioManager.src = this.data.classicRecordingPath;
    audioManager.title = '我的录音';
    audioManager.play();
    this.setData({ isPlayingClassicRecording: true });
    audioManager.onEnded(() => {
      this.setData({ isPlayingClassicRecording: false });
    });
  },

  saveClassicRecording: function() {
    if (!this.data.classicRecordingPath) {
      wx.showToast({ title: '请先录音', icon: 'none' });
      return;
    }
    if (this.data.classicRecordDuration < 45) {
      wx.showToast({ title: '录音需满45秒才可获得花朵奖励', icon: 'none' });
        return;
      }
    wx.getFileSystemManager().saveFile({
      tempFilePath: this.data.classicRecordingPath,
      success: (res) => {
        // 保存到录音仓库
        this.saveToRecordingRepository({
          type: 'classic',
          audioPath: res.savedFilePath,
          duration: this.data.classicRecordDuration,
          title: this.data.currentClassic.title || '经典朗读练习',
          subtitle: this.data.currentClassic.currentSubtitle || this.getClassicSubtitleText(),
          coverImage: this.data.currentClassic.coverImage || '/images/default_article_2.png',
          recordTime: new Date().toISOString()
        });
        
        this.addFlowerToGarden('classic');
        wx.showToast({ title: '已存至仓库，获得花朵！', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  // 保存录音到录音仓库
  saveToRecordingRepository: function(recordingData) {
    try {
      // 获取现有的录音仓库数据
      const recordings = wx.getStorageSync('recordingRepository') || [];
      
      // 根据录音类型确定难度信息
      let difficulty = '';
      let difficultyName = '';
      
      if (recordingData.type === 'hotspot') {
        difficulty = 'sprout';
        difficultyName = '萌芽岛';
      } else if (recordingData.type === 'classic') {
        difficulty = 'forest';
        difficultyName = '森林谷';
      }
      
      // 创建录音记录
      const recordingItem = {
        id: Date.now() + '_' + recordingData.type,
        type: recordingData.type,
        audioPath: recordingData.audioPath,
        duration: recordingData.duration,
        title: recordingData.title,
        subtitle: recordingData.subtitle,
        coverImage: recordingData.coverImage,
        recordTime: recordingData.recordTime,
        formattedDate: new Date().toLocaleDateString('zh-CN'),
        difficulty: difficulty,
        difficultyName: difficultyName
      };
      
      // 添加到录音列表开头（最新的在前面）
      recordings.unshift(recordingItem);
      
      // 保存到本地存储
      wx.setStorageSync('recordingRepository', recordings);
      
      console.log('录音已保存到仓库:', recordingItem);
    } catch (error) {
      console.error('保存录音到仓库失败:', error);
    }
  },
  
  // 获取热点主持字幕文本
  getHotspotSubtitleText: function() {
    const { currentHotspot } = this.data;
    if (!currentHotspot || !currentHotspot.segments) {
      return '热点主持练习内容';
    }
    
    // 提取前几个字幕片段作为预览
    const previewSegments = currentHotspot.segments.slice(0, 3);
    return previewSegments.map(segment => segment.text).join(' ');
  },
  
  // 获取经典朗读字幕文本
  getClassicSubtitleText: function() {
    const { currentClassic } = this.data;
    if (!currentClassic || !currentClassic.segments) {
      return '经典朗读练习内容';
    }
    
    // 提取前几个字幕片段作为预览
    const previewSegments = currentClassic.segments.slice(0, 3);
    return previewSegments.map(segment => segment.text).join(' ');
  },

  addFlowerToGarden: function(type) {
    // type: 'hotspot' or 'classic'
    let flowers = this.data.flowers || [];
    
    // 使用Promise处理异步获取花朵
    this.getRandomFlower().then(flower => {
      // 获取完整的花朵信息，包括花语
      const flowerInfo = {
        id: Date.now() + '_' + type,
        icon: flower.icon,
        name: flower.name,
        meaning: flower.meaning // 添加花语
      };
      
      // 将新花朵添加到数组开头，以便在轮播图中首先显示
      flowers.unshift(flowerInfo);
      
      // 更新本地显示数据，并设置 newFlowerAdded 标记为 true
      this.setData({
        flowers: flowers,
        newFlowerAdded: true // 标记新添加了花朵
      });
      
      // 保存花园数据到本地存储
      wx.setStorageSync('gardenFlowers', flowers);
      
      // 更新云端积分数据和本地今日花朵
      this.updateUserPoints('speak_points', 1); // 增加1积分，同时会更新今日花朵
      
      // 如果录音时长超过90秒，额外奖励1朵花（仅在云端记录，但本地不更新）
      const recordDuration = type === 'hotspot' ? this.data.hotspotRecordDuration : this.data.classicRecordDuration;
      if (recordDuration >= 90) {
        this.updateUserPoints('speak_flowers', 1); // 增加1朵花
      }
      
      // 3秒后清除新花朵标记
      setTimeout(() => {
        this.setData({
          newFlowerAdded: false
        });
      }, 3000);
    }).catch(err => {
      console.error('获取花朵失败:', err);
      wx.showToast({
        title: '获取花朵失败',
        icon: 'none'
      });
    });
  },
  
  /**
   * 花园墙轮播图切换事件处理函数
   */
  onFlowerSwiperChange: function(e) {
    // 获取当前显示的花朵索引
    const currentIndex = e.detail.current;
    
    // 如果需要，可以更新当前显示的花朵信息
    if (this.data.flowers && this.data.flowers.length > 0) {
      const currentFlower = this.data.flowers[currentIndex];
    }
  },

  // 选择音频类型（难度切换）
  selectAudioType(e) {
    const type = e.currentTarget.dataset.type;
    console.log('=== 选择音频类型调试 ===');
    console.log('选择的类型:', type);
    console.log('当前展开状态 - hotspotExpanded:', this.data.hotspotExpanded, 'classicExpanded:', this.data.classicExpanded);
    
    this.setData({
      currentAudioType: type
    });
    
    // 根据选择的类型重新加载对应难度的最新文章
    if (type === 'podcast') {
      // 萌芽主持 - sprout难度
      console.log('切换到萌芽主持，加载热点内容');
      this.loadHotspotContent();
    } else if (type === 'forest') {
      // 森林朗读 - forest难度
      console.log('切换到森林朗读，加载经典内容');
      this.loadClassicContent();
    }
    
    console.log('=== 选择音频类型调试结束 ===');
  },

  // 语言切换事件处理
  onLanguageChange: function(e) {
    console.log('=== 语言切换调试 ===');
    const selectedIndex = e.detail.value;
    const selectedLanguage = this.data.languages[selectedIndex];
    
    console.log('选择的索引:', selectedIndex);
    console.log('选择的语言:', selectedLanguage);
    console.log('当前音频类型:', this.data.currentAudioType);
    console.log('萌芽展开状态:', this.data.hotspotExpanded);
    console.log('森林展开状态:', this.data.classicExpanded);
    
    this.setData({
      languageIndex: selectedIndex,  // 更新语言索引
      selectedLanguage: selectedLanguage,
      selectedSubtitleLanguage: selectedLanguage  // 同时更新字幕语言
    });
    
    console.log('语言切换为:', selectedLanguage.name, '代码:', selectedLanguage.code);
    console.log('字幕语言同步更新为:', selectedLanguage.name, '代码:', selectedLanguage.code);
    
    // 根据当前展开的内容重新加载对应数据
    if (this.data.hotspotExpanded) {
      console.log('萌芽主持已展开，重新加载萌芽主持内容');
      this.loadHotspotContent();
    }
    if (this.data.classicExpanded) {
      console.log('森林朗读已展开，重新加载森林朗读内容');
      this.loadClassicContent();
    }
    
    // 如果两个都没有展开，按照原来的逻辑处理
    if (!this.data.hotspotExpanded && !this.data.classicExpanded) {
      if (this.data.currentAudioType === 'podcast') {
        console.log('默认重新加载萌芽主持内容');
        this.loadHotspotContent();
      } else if (this.data.currentAudioType === 'forest') {
        console.log('默认重新加载森林朗读内容');
        this.loadClassicContent();
      }
    }
    console.log('=== 语言切换调试结束 ===');
  },
  
  // 根据语言更新音频URL
  updateAudioByLanguage: function(audioData, languageCode) {
    console.log('=== 音频语言选择调试 ===');
    console.log('目标语言代码:', languageCode);
    console.log('原始音频数据:', JSON.stringify(audioData, null, 2));
    
    if (!audioData) {
      console.log('音频数据为空，返回原数据');
      return audioData;
    }
    
    // 创建音频数据副本
    const updatedAudioData = { ...audioData };
    let foundAudio = false;
    
    // 首先尝试从文章内容(contents)中获取对应语言的音频
    if (audioData.article_data && audioData.article_data.contents && Array.isArray(audioData.article_data.contents)) {
      console.log('检查文章内容中的音频');
      const contents = audioData.article_data.contents;
      console.log('文章内容数组:', contents.map(c => ({ language: c.language, hasAudio: !!c.audio })));
      
      // 优先查找当前语言的内容
      const langContent = contents.find(c => c.language === languageCode);
      if (langContent && langContent.audio) {
        console.log(`✅ 找到文章中 ${languageCode} 语言的音频:`, langContent.audio);
        updatedAudioData.audioUrl = langContent.audio;
        foundAudio = true;
      }
      // 如果没有当前语言的音频，尝试中文音频
      else {
        const zhContent = contents.find(c => c.language === 'zh-CN');
        if (zhContent && zhContent.audio) {
          console.log('⚠️ 未找到当前语言音频，使用文章中的中文音频:', zhContent.audio);
          updatedAudioData.audioUrl = zhContent.audio;
          foundAudio = true;
        }
        // 如果没有中文音频，使用第一个有音频的内容
        else {
          const firstAudioContent = contents.find(c => c.audio);
          if (firstAudioContent) {
            console.log(`⚠️ 未找到中文音频，使用文章中第一个可用音频 (${firstAudioContent.language}):`, firstAudioContent.audio);
            updatedAudioData.audioUrl = firstAudioContent.audio;
            foundAudio = true;
          }
        }
      }
    }
    
    // 如果在文章内容中没有找到音频，再尝试从习题中获取
    if (!foundAudio && audioData.exercises && Array.isArray(audioData.exercises) && audioData.exercises.length > 0) {
      console.log('文章内容中未找到音频，检查习题数据');
      console.log('找到exercises数据，数量:', audioData.exercises.length);
      const firstExercise = audioData.exercises[0];
      console.log('第一个习题数据:', JSON.stringify(firstExercise, null, 2));
      
      if (firstExercise && firstExercise.audio) {
        console.log('当前习题有音频:', firstExercise.audio);
        console.log('音频数据类型:', typeof firstExercise.audio);
        
        // 如果音频是对象形式，可能包含多种语言
        if (typeof firstExercise.audio === 'object') {
          console.log('音频是对象形式，可用语言:', Object.keys(firstExercise.audio));
          
          // 尝试获取当前语言的音频
          if (firstExercise.audio[languageCode]) {
            updatedAudioData.audioUrl = firstExercise.audio[languageCode];
            console.log(`✅ 找到习题中 ${languageCode} 语言的音频:`, updatedAudioData.audioUrl);
            foundAudio = true;
          }
          // 如果没有当前语言的音频，尝试获取中文音频
          else if (firstExercise.audio['zh-CN']) {
            updatedAudioData.audioUrl = firstExercise.audio['zh-CN'];
            console.log('⚠️ 未找到当前语言音频，使用习题中的中文音频:', updatedAudioData.audioUrl);
            foundAudio = true;
          }
          // 如果没有中文音频，使用第一个可用的音频
          else {
            const firstLang = Object.keys(firstExercise.audio)[0];
            if (firstLang) {
              updatedAudioData.audioUrl = firstExercise.audio[firstLang];
              console.log(`⚠️ 未找到中文音频，使用习题中 ${firstLang} 语言音频:`, updatedAudioData.audioUrl);
              foundAudio = true;
            }
          }
        }
        // 如果音频是字符串形式，直接使用
        else if (typeof firstExercise.audio === 'string') {
          updatedAudioData.audioUrl = firstExercise.audio;
          console.log('习题音频是字符串形式:', updatedAudioData.audioUrl);
          foundAudio = true;
        }
      } else {
        console.log('❌ 第一个习题没有音频数据');
      }
    } else if (!foundAudio) {
      console.log('❌ 没有找到exercises数据或exercises为空');
    }
    
    console.log('是否找到音频:', foundAudio);
    console.log('最终更新后的音频URL:', updatedAudioData.audioUrl);
    console.log('=== 音频语言选择调试结束 ===');
    
    return updatedAudioData;
  },

  // 页面生命周期函数
  onHide: function() {
    // 页面隐藏时暂停计时
    this.pauseSpeakingTimer();
  },

  onShow: function() {
    // 页面显示时恢复计时
    this.resumeSpeakingTimer();
  },

  // 计时相关方法
  startSpeakingTimer: function() {
    if (this.data.speakingTimer) {
      clearInterval(this.data.speakingTimer);
    }
    
    this.setData({
      speakingStartTime: Date.now(),
      speakingTimer: setInterval(() => {
        this.updateStudyStatsLocal();
      }, 60000) // 每分钟更新一次
    });
    
    console.log('说话计时开始');
  },

  pauseSpeakingTimer: function() {
    if (this.data.speakingStartTime) {
      const currentTime = Date.now();
      const sessionTime = currentTime - this.data.speakingStartTime;
      
      this.setData({
        accumulatedSpeakingTime: this.data.accumulatedSpeakingTime + sessionTime,
        speakingStartTime: null
      });
      
      console.log('说话计时暂停，累计时间:', this.data.accumulatedSpeakingTime);
    }
  },

  resumeSpeakingTimer: function() {
    if (!this.data.speakingStartTime) {
      this.setData({
        speakingStartTime: Date.now()
      });
      
      console.log('说话计时恢复');
    }
  },

  stopSpeakingTimer: function() {
    // 暂停计时以累计最后的时间
    this.pauseSpeakingTimer();
    
    // 清除定时器
    if (this.data.speakingTimer) {
      clearInterval(this.data.speakingTimer);
      this.setData({ speakingTimer: null });
    }
    
    // 最后更新一次统计数据
    this.updateStudyStatsLocal();
    
    console.log('说话计时停止，总时间:', this.data.accumulatedSpeakingTime);
  },

  updateStudyStatsLocal: function() {
    try {
      // 计算当前会话时间
      let currentSessionTime = 0;
      if (this.data.speakingStartTime) {
        currentSessionTime = Date.now() - this.data.speakingStartTime;
      }
      
      // 总学习时间（毫秒）
      const totalTimeMs = this.data.accumulatedSpeakingTime + currentSessionTime;
      const totalMinutes = Math.floor(totalTimeMs / 60000);
      
      // 检查是否有新的分钟数需要同步
      const lastSyncedMinutes = wx.getStorageSync('lastSyncedSpeakMinutes') || 0;
      const newMinutes = totalMinutes - lastSyncedMinutes;
      
      if (newMinutes > 0) {
        // 获取今天的日期字符串
        const today = new Date().toDateString();
        
        // 获取今天的学习统计数据
        let todayStats = wx.getStorageSync(`studyStats_${today}`) || {
          readTime: 0,
          writeTime: 0,
          listenTime: 0,
          speakTime: 0,
          totalTime: 0
        };
        
        // 更新说话时间
        todayStats.speakTime += newMinutes;
        todayStats.totalTime += newMinutes;
        
        // 保存更新后的统计数据
        wx.setStorageSync(`studyStats_${today}`, todayStats);
        
        // 更新已同步的分钟数
        wx.setStorageSync('lastSyncedSpeakMinutes', totalMinutes);
        
        console.log(`说话学习统计更新: +${newMinutes}分钟, 今日说话总时间: ${todayStats.speakTime}分钟`);
        
        // 通知profile页面重新加载统计数据
        const pages = getCurrentPages();
        const profilePage = pages.find(page => page.route === 'pages/profile/profile');
        if (profilePage && profilePage.loadStudyStats) {
          profilePage.loadStudyStats();
        }
      }
    } catch (error) {
      console.error('更新说话学习统计失败:', error);
    }
  }
});