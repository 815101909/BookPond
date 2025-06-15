// 说一说页面逻辑
const audioManager = wx.getBackgroundAudioManager();
const recorderManager = wx.getRecorderManager();

let speakingStartTime = null;
let accumulatedSpeakingTime = 0;
let speakingTimer = null;
let currentPage = null;

Page({
  data: {
    // 花园模式数据
    todayFlowers: 0,
    totalFlowers: 0,
    dailyGoal: 50, // 每日花朵目标
    hasReachedGoal: false,
    showGardenRulesPopup: false,
    recordingCounter: 0, // 录音次数计数器
    
    // 花园墙数据
    flowers: [], // 用户获得的花朵
    
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
      
      // 设置录音配置
      this.setupRecorder();
      
      // 加载录音计数器
      this.loadRecordingCounter();
      
      // 加载花园墙花朵
      this.loadGardenFlowers();
      
      // 初始化口语计时
      speakingStartTime = null;
      accumulatedSpeakingTime = 0;
      speakingTimer = null;
      currentPage = this;
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
      
      // 显示错误提示
      wx.showToast({
        title: '页面加载失败，使用默认数据',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  /**
   * 加载花朵数据
   */
  loadFlowersData: function() {
    try {
      // 从本地存储加载花朵数据
      const flowersData = wx.getStorageSync('flowersData') || { totalFlowers: 0, todayFlowers: 0 };
      
      // 检查是否是新的一天，如果是则重置今日花朵
      const today = new Date().toDateString();
      const lastLoginDate = wx.getStorageSync('lastGardenLoginDate');
      
      if (lastLoginDate !== today) {
        flowersData.todayFlowers = 0;
        wx.setStorageSync('lastGardenLoginDate', today);
      }
      
      // 计算是否已达成目标
      const hasReachedGoal = flowersData.todayFlowers >= this.data.dailyGoal;
      
      this.setData({
        totalFlowers: flowersData.totalFlowers,
        todayFlowers: flowersData.todayFlowers,
        hasReachedGoal: hasReachedGoal
      });
      
      console.log('花朵数据加载成功:', flowersData);
    } catch (e) {
      console.error('加载花朵数据失败:', e);
    }
  },
  
  /**
   * 加载花园墙花朵
   */
  loadGardenFlowers: function() {
    try {
      // 从本地存储加载花园墙花朵数据
      const gardenFlowers = wx.getStorageSync('gardenFlowers') || [];
      let emptyGardenFallback = true;
      if (gardenFlowers && gardenFlowers.length > 0) {
        emptyGardenFallback = false;
      }
      this.setData({
        flowers: gardenFlowers,
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
    // 花朵类型及其花语
    const flowerTypes = [
      { icon: '🌸', name: '樱花', meaning: '生命短暂而美丽，象征着纯洁与高尚的情操' },
      { icon: '🌹', name: '玫瑰', meaning: '爱与美，热情与浪漫的象征' },
      { icon: '🌺', name: '芙蓉', meaning: '纤细之美，代表着精致与柔美' },
      { icon: '🌻', name: '向日葵', meaning: '忠诚与长寿，象征着温暖与活力' },
      { icon: '🌼', name: '雏菊', meaning: '纯真与天真，象征着希望与新生' },
      { icon: '🌷', name: '郁金香', meaning: '完美的爱，象征着永恒的幸福' },
      { icon: '✿', name: '满天星', meaning: '纯洁的心灵，象征着无尽的爱与思念' },
      { icon: '🪷', name: '莲花', meaning: '超脱与纯净，代表着心灵的宁静' },
      { icon: '💐', name: '花束', meaning: '感谢与祝福，传递着美好的心意' },
      { icon: '🌱', name: '新芽', meaning: '希望与成长，象征着新的开始' },
      { icon: '🌿', name: '绿草', meaning: '生命力与希望，代表着自然的活力' },
      { icon: '🍀', name: '四叶草', meaning: '幸运与希望，象征着美好的祝愿' },
      { icon: '🪴', name: '盆栽', meaning: '耐心培育，象征着精心呵护的爱' },
      { icon: '🌵', name: '仙人掌', meaning: '坚韧与保护，代表着坚强和毅力' },
      { icon: '🌾', name: '麦穗', meaning: '丰收与成功，象征着付出的回报' },
      { icon: '🍃', name: '飘叶', meaning: '轻盈与自由，代表着无拘无束的灵魂' },
      { icon: '🎋', name: '竹', meaning: '坚韧与谦虚，象征着不屈的精神' },
      { icon: '🌳', name: '橡树', meaning: '力量与持久，象征着坚定的信念与稳固的基础' },
      { icon: '🌴', name: '棕榈', meaning: '荣誉与胜利，象征着丰收与喜悦' },
      { icon: '🌲', name: '常青树', meaning: '长青与希望，象征着永不放弃的精神' },
      { icon: '🌞', name: '金盏花', meaning: '持久的美丽，象征着永恒的爱与忠诚' },
      { icon: '🌟', name: '木槿花', meaning: '坚韧不拔，代表着持久的美与坚毅的品格' }
    ];
    
    // 随机选择一种花朵
    const randomIndex = Math.floor(Math.random() * flowerTypes.length);
    return flowerTypes[randomIndex];
  },
  
  bindForestDateChange: function(e) {
    this.setData({
      forestSelectedDate: e.detail.value
    });
  },
  
  toggleHotspot: function() {
    this.setData({
      hotspotExpanded: !this.data.hotspotExpanded,
      classicExpanded: false
    });
  },
  
  toggleClassic: function() {
    this.setData({
      classicExpanded: !this.data.classicExpanded,
      hotspotExpanded: false
    });
  },
  
  showGardenRules: function() {
    this.setData({ showGardenRulesPopup: true });
  },
  
  hideGardenRules: function() {
    this.setData({ showGardenRulesPopup: false });
  },

  playHotspotAudio: function() {
    // 假设 currentHotspot.audioUrl 有音频链接
    if (!this.data.currentHotspot || !this.data.currentHotspot.audioUrl) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
          return;
        }
    audioManager.src = this.data.currentHotspot.audioUrl;
    audioManager.title = this.data.currentHotspot.title || '萌芽主持';
    audioManager.play();
    this.setData({ isHotspotPlaying: true });
    audioManager.onEnded(() => {
      this.setData({ isHotspotPlaying: false });
      });
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
    wx.saveFile({
      tempFilePath: this.data.hotspotRecordingPath,
      success: (res) => {
        this.addFlowerToGarden('hotspot');
        wx.showToast({ title: '已存至仓库，获得花朵！', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },
  
  // 森林朗读
  playClassicAudio: function() {
    if (!this.data.currentClassic || !this.data.currentClassic.audioUrl) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
      return;
    }
    audioManager.src = this.data.currentClassic.audioUrl;
    audioManager.title = this.data.currentClassic.title || '森林朗读';
    audioManager.play();
    this.setData({ isClassicPlaying: true });
    audioManager.onEnded(() => {
      this.setData({ isClassicPlaying: false });
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
    wx.saveFile({
      tempFilePath: this.data.classicRecordingPath,
      success: (res) => {
        this.addFlowerToGarden('classic');
        wx.showToast({ title: '已存至仓库，获得花朵！', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  addFlowerToGarden: function(type) {
    // type: 'hotspot' or 'classic'
    let flowers = this.data.flowers || [];
    let flower = this.getRandomFlower();
    flowers.push({
      id: Date.now() + '_' + type,
      icon: flower.icon,
      name: flower.name
    });
      this.setData({
      flowers: flowers,
      todayFlowers: this.data.todayFlowers + 1,
      totalFlowers: this.data.totalFlowers + 1
    });
    wx.setStorageSync('gardenFlowers', flowers);
    wx.setStorageSync('flowersData', {
      todayFlowers: this.data.todayFlowers,
      totalFlowers: this.data.totalFlowers
    });
  },
}); 