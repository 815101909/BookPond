// 读一读页面逻辑
const api = require('../../utils/api.js');

let readingStartTime = null;
let accumulatedReadingTime = 0;
let readingTimer = null;
let currentPage = null;

Page({
  data: {
    currentLevel: 'sprout',
    currentTab: 'daily',
    newsList: [],
    classicsList: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    // 新闻分类
    newsCategories: [
      '语言文字',
      '文学诗歌',
      '节日民俗',
      '饮食文化',
      '生活礼仪',
      '建筑艺术',
      '戏剧表演',
      '音乐乐器',
      '服饰美妆',
      '时间历法',
      '哲思观念',
      '家庭教育',
      '思维表达',
      '跨文化趣谈',
      '国别'
    ],
    // 名著分类
    classicsCategories: [
      '中国古典文学',
      '西方古典文学',
      '中国儿童文学',
      '西方儿童文学',
      '东方人物传记',
      '西方人物传记'
    ],
    // 语言选项
    sourceLanguages: ['中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语'],
    targetLanguages: ['中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语'],
    selectedSourceLang: '中文',
    selectedTargetLang: '英语',
    // 其他数据保持不变
    showSettings: false,
    showCalendar: false,
    currentDate: '',
    selectedDate: '',
    calendarData: [],
    checkInDays: [],
    showFortune: false,
    fortuneText: '',
    showFortuneConfirm: false,
    showFortuneResult: false,
    fortuneResult: '',
    showFortuneDetail: false,
    fortuneDetail: '',
    showFortuneShare: false,
    showFortuneSave: false,
    showFortuneCalendar: false,
    fortuneCalendarData: [],
    fortuneHistory: [],
    showFortuneHistory: false,
    showFortuneSettings: false,
    fortuneSettings: {
      daily: true,
      weekly: true,
      monthly: true,
      yearly: true,
      special: true,
      notification: true,
      sound: true,
      vibration: true,
      theme: 'light',
      language: 'zh_CN',
      share: true,
      save: true,
      calendar: true,
      history: true,
      settings: true
    },
    compareIndex1: null,    // 第一对照语言索引
    compareIndex2: null,    // 第二对照语言索引
    selectedLanguage1: null, // 已选择的第一对照语言
    selectedLanguage2: null, // 已选择的第二对照语言
    // 分页加载相关
    newsPage: 1,           // 新闻当前页码
    classicsPage: 1,       // 名著当前页码
    newsNoMore: false,     // 新闻是否已加载全部
    classicsNoMore: false, // 名著是否已加载全部
    loadingNews: false,    // 是否正在加载新闻
    loadingClassics: false, // 是否正在加载名著
    // 语言选项，包含国旗和名称
    languageMap: {
      'zh-TW': { code: 'zh-TW', name: '中文（繁体）', flag: '🇨🇳' },
      'en': { code: 'en', name: '英语', flag: '🇬🇧' },
      'fr': { code: 'fr', name: '法语', flag: '🇫🇷' },
      'es': { code: 'es', name: '西班牙语', flag: '🇪🇸' },
      'de': { code: 'de', name: '德语', flag: '🇩🇪' },
      'it': { code: 'it', name: '意大利语', flag: '🇮🇹' },
      'ar': { code: 'ar', name: '阿拉伯语', flag: '🇸🇦' },
      'ja': { code: 'ja', name: '日语', flag: '🇯🇵' },
      'pt-PT': { code: 'pt-PT', name: '葡萄牙语（葡萄牙）', flag: '🇵🇹' },
      'pt-BR': { code: 'pt-BR', name: '葡萄牙语（巴西）', flag: '🇧🇷' },
      'th': { code: 'th', name: '泰语', flag: '🇹🇭' },
      'ru': { code: 'ru', name: '俄语', flag: '🇷🇺' },
      'ms': { code: 'ms', name: '马来语', flag: '🇲🇾' },
      'ko': { code: 'ko', name: '韩语', flag: '🇰🇷' }
    },
    languageOptions: [],
    levels: {
      sprout: {
        name: '萌芽岛',
        desc: '启蒙阅读'
      },
      forest: {
        name: '森林谷',
        desc: '进阶阅读'
      },
      soar: {
        name: '翱翔峰',
        desc: '高阶阅读'
      }
    },
    tabs: ['daily', 'classics']
  },

  onLoad: function(options) {
    try {
      // 初始化语言选项
      const languageOptions = Object.values(this.data.languageMap);
      this.setData({ languageOptions });
      
      // 设置当前日期
      this.initCurrentDate();
      
      // 确保默认选中萌芽岛和「晓」见闻
      this.setData({
        currentLevel: 'sprout',
        currentTab: 'daily'
      });
      
      // 加载内容
      this.loadContent();
      
      // 初始化阅读计时
      readingStartTime = new Date();
      accumulatedReadingTime = 0;
      currentPage = this;
      
      // 开始计时
      this.startReadingTimer();
    } catch (error) {
      console.error('页面加载失败:', error);
      // 确保基本UI结构仍然显示
      this.setData({
        languageOptions: Object.values(this.data.languageMap) || [],
        currentLevel: 'sprout',
        currentTab: 'daily',
        newsList: [],
        classicsList: [],
        loading: false
      });
      
      // 显示错误提示
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  // 初始化当前日期
  initCurrentDate: function() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    this.setData({
      currentDate: `${year}-${month}-${day}`
    });
  },

  // 切换难度等级
  switchLevel(e) {
    const level = e.currentTarget.dataset.level;
    this.setData({
      currentLevel: level,
      // 重置分页状态
      newsPage: 1,
      classicsPage: 1,
      newsNoMore: false,
      classicsNoMore: false,
      newsList: [],
      classicsList: []
    });
    this.loadContentByLevel(level);
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
    this.loadContent();
  },

  // 第一对照语言选择变化
  onCompareChange1: function(e) {
    const index = e.detail.value;
    const selectedLanguage = this.data.languageOptions[index];
    this.setData({
      compareIndex1: index,
      selectedLanguage1: selectedLanguage
    });
  },

  // 第二对照语言选择变化
  onCompareChange2: function(e) {
    const index = e.detail.value;
    const selectedLanguage = this.data.languageOptions[index];
    this.setData({
      compareIndex2: index,
      selectedLanguage2: selectedLanguage
    });
  },

  // 新闻点击事件
  onNewsTap: function(e) {
    const id = e.currentTarget.dataset.id;
    
    // 获取选中的语言代码
    const selectedLanguages = [];
    
    if (this.data.selectedLanguage1) {
      selectedLanguages.push(this.data.selectedLanguage1.code);
    }
    
    if (this.data.selectedLanguage2) {
      selectedLanguages.push(this.data.selectedLanguage2.code);
    }
    
    // 保存语言选择到本地存储
    wx.setStorageSync('selectedLanguages', selectedLanguages);
    
    wx.navigateTo({
      url: `/pages/news-detail/news-detail?id=${id}&languages=${JSON.stringify(selectedLanguages)}`
    });
  },

  // 点击名著项
  onClassicsTap: function(e) {
    const id = e.currentTarget.dataset.id;
    
    // 获取选中的语言代码
    const selectedLanguages = [];
    
    if (this.data.selectedLanguage1) {
      selectedLanguages.push(this.data.selectedLanguage1.code);
    }
    
    if (this.data.selectedLanguage2) {
      selectedLanguages.push(this.data.selectedLanguage2.code);
    }
    
    // 保存语言选择到本地存储
    wx.setStorageSync('selectedLanguages', selectedLanguages);
    
    wx.navigateTo({
      url: `/pages/classics-detail/classics-detail?id=${id}&languages=${JSON.stringify(selectedLanguages)}`
    });
  },

  // 加载内容
  loadContent() {
    this.loadContentByLevel(this.data.currentLevel);
  },

  // 根据难度等级加载内容
  loadContentByLevel(level) {
    // 重置分页状态
    this.setData({
      newsPage: 1,
      classicsPage: 1,
      newsNoMore: false,
      classicsNoMore: false,
      newsList: [],
      classicsList: []
    });
    
    if (this.data.currentTab === 'daily') {
      this.loadNewsListByLevel(level);
    } else {
      this.loadClassicsListByLevel(level);
    }
  },

  // 根据难度等级加载新闻列表
  loadNewsListByLevel: function(level) {
    // 如果正在加载或已到底，则不再加载
    if (this.data.loadingNews || this.data.newsNoMore) {
      return;
    }
    
    this.setData({ loadingNews: true });
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 获取选定的语言数组
    const selectedLanguages = [];
    if (this.data.selectedLanguage1 && this.data.selectedLanguage1.code) {
      selectedLanguages.push(this.data.selectedLanguage1.code);
    }
    if (this.data.selectedLanguage2 && this.data.selectedLanguage2.code) {
      selectedLanguages.push(this.data.selectedLanguage2.code);
    }
    
    // 使用API获取新闻数据，同时传递语言参数
    api.getNewsList(level, this.data.currentDate, this.data.newsPage, selectedLanguages)
      .then(response => {
        console.log('获取新闻数据成功:', response);
        
        // 处理API返回的数据结构
        let newsList = [];
        
        // 检查是否有articles字段（新格式）
        if (response && response.articles) {
          newsList = response.articles.map(article => ({
            id: article._id,
            title: article.title,
            cover: article.coverImage,
            highlights: article.introduction,
            category: article.category || '语言文字',
            country: article.country || '中国',
            date: article.publishDate ? new Date(article.publishDate).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\//g, '-') : '2024-03-20',
            level: article.difficulty,
            type: article.type
          }));
        } else if (Array.isArray(response)) {
          // 老格式，直接是数组
          newsList = response.map(item => ({
            ...item,
            category: item.category || '语言文字',
            country: item.country || '中国',
            date: item.date || '2024-03-20'
          }));
        }
        
        // 确保分类在新分类列表中
        newsList = newsList.map(item => {
          if (!this.data.newsCategories.includes(item.category)) {
            item.category = '语言文字';
          }
          return item;
        });
        
        // 按日期降序排序
        newsList = newsList.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 判断是否已到底
        const noMore = newsList.length < 10 || (response && response.totalPages === response.currentPage); 
        
        this.setData({ 
          newsList: [...this.data.newsList, ...newsList],
          newsPage: this.data.newsPage + 1,
          newsNoMore: noMore,
          loadingNews: false
        });
        
        wx.hideLoading();
      })
      .catch(error => {
        console.error('获取新闻数据失败:', error);
        
        this.setData({
          loadingNews: false
        });
        
        wx.hideLoading();
        wx.showModal({
          title: '数据加载失败',
          content: '无法从服务器获取新闻数据，请检查网络连接并重试。',
          showCancel: true,
          cancelText: '取消',
          confirmText: '重试',
          success: (res) => {
            if (res.confirm) {
              this.loadNewsListByLevel(level);
            }
          }
        });
      });
  },

  // 加载经典名著列表
  loadClassicsListByLevel: function(level) {
    // 如果正在加载或已到底，则不再加载
    if (this.data.loadingClassics || this.data.classicsNoMore) {
      return;
    }
    
    this.setData({ loadingClassics: true });
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 获取选定的语言数组
    const selectedLanguages = [];
    if (this.data.selectedLanguage1 && this.data.selectedLanguage1.code) {
      selectedLanguages.push(this.data.selectedLanguage1.code);
    }
    if (this.data.selectedLanguage2 && this.data.selectedLanguage2.code) {
      selectedLanguages.push(this.data.selectedLanguage2.code);
    }
    
    // 使用API获取经典名著数据，同时传递语言参数
    api.getClassicsList(level, this.data.currentDate, this.data.classicsPage, selectedLanguages)
      .then(response => {
        console.log('获取经典名著数据成功:', response);
        
        // 处理API返回的数据结构
        let classicsList = [];
        
        // 检查是否有articles字段（新格式）
        if (response && response.articles) {
          classicsList = response.articles.map(article => ({
            id: article._id,
            title: article.title,
            cover: article.coverImage,
            highlights: article.introduction,
            category: article.category,
            date: article.publishDate ? new Date(article.publishDate).toLocaleDateString() : '未知日期',
            level: article.difficulty,
            type: article.type
          }));
        } else if (Array.isArray(response)) {
          // 老格式，直接是数组
          classicsList = response;
        }
        
        // 判断是否已到底
        const noMore = classicsList.length < 10 || (response && response.totalPages === response.currentPage);
        
        this.setData({ 
          classicsList: [...this.data.classicsList, ...classicsList],
          classicsPage: this.data.classicsPage + 1,
          classicsNoMore: noMore,
          loadingClassics: false
        });
        
        // 存储经典名著数据到本地存储，以便写一写页面可以获取
        this.storeClassicsDataForWritePage(level, this.data.classicsList);
        
        wx.hideLoading();
      })
      .catch(error => {
        console.error('获取经典名著数据失败:', error);
        
        // 不再使用模拟数据，而是显示错误提示
        this.setData({
          loadingClassics: false
        });
        
        wx.hideLoading();
        wx.showModal({
          title: '数据加载失败',
          content: '无法从服务器获取经典名著数据，请检查网络连接并重试。',
          showCancel: true,
          cancelText: '取消',
          confirmText: '重试',
          success: (res) => {
            if (res.confirm) {
              // 用户点击重试，重新加载数据
              this.loadClassicsListByLevel(level);
            }
          }
        });
      });
  },
  
  // 加载更多新闻
  loadMoreNews: function() {
    console.log('加载更多新闻');
    this.loadNewsListByLevel(this.data.currentLevel);
  },
  
  // 加载更多名著
  loadMoreClassics: function() {
    console.log('加载更多名著');
    this.loadClassicsListByLevel(this.data.currentLevel);
  },

  // 格式化日期显示
  formatDateForDisplay: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 存储经典名著数据到本地存储，以便写一写页面可以获取
  storeClassicsDataForWritePage: function(level, classicsList) {
    // 从存储中获取已有的数据
    let readPageClassics = wx.getStorageSync('readPageClassics') || {};
    
    // 获取当前日期作为键
    const today = this.formatDateForDisplay(new Date());
    
    // 如果当前日期的数据不存在，初始化它
    if (!readPageClassics[today]) {
      readPageClassics[today] = {
        sprout: [],
        forest: [],
        soar: []
      };
    }
    
    // 更新对应难度级别的数据
    readPageClassics[today][level] = classicsList;
    
    // 保存回存储
    wx.setStorageSync('readPageClassics', readPageClassics);
    console.log('经典名著数据已存储，可供写一写页面使用', readPageClassics);
  },

  // 加载新闻数据
  loadNewsData: function() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    // 模拟从服务器获取数据
    setTimeout(() => {
      const newData = Array(5).fill(0).map((_, index) => ({
        id: this.data.newsList.length + index,
        title: `新闻标题 ${this.data.newsList.length + index + 1}`,
        cover: '/images/news-cover.png',
        category: this.data.newsCategories[Math.floor(Math.random() * this.data.newsCategories.length)],
        date: '2024-03-20'
      }));

      this.setData({
        newsList: [...this.data.newsList, ...newData],
        loading: false,
        hasMore: this.data.newsList.length < 50 // 模拟最多加载50条数据
      });
    }, 1000);
  },

  // 加载名著数据
  loadClassicsData: function() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    // 模拟从服务器获取数据
    setTimeout(() => {
      const newData = Array(5).fill(0).map((_, index) => ({
        id: this.data.classicsList.length + index,
        title: `名著标题 ${this.data.classicsList.length + index + 1}`,
        cover: '/images/classics-cover.png',
        category: this.data.classicsCategories[Math.floor(Math.random() * this.data.classicsCategories.length)],
        date: '2024-03-20'
      }));

      this.setData({
        classicsList: [...this.data.classicsList, ...newData],
        loading: false,
        hasMore: this.data.classicsList.length < 50 // 模拟最多加载50条数据
      });
    }, 1000);
  },

  onUnload: function() {
    // 结束阅读计时
    this.stopReadingTimer();
    
    // 计算总阅读时间（分钟）
    const totalMinutes = Math.ceil(accumulatedReadingTime / 60);
    
    // 更新学习统计数据
    if (totalMinutes > 0) {
      // 获取profile页面实例
      const pages = getCurrentPages();
      const profilePage = pages.find(page => page.route === 'pages/profile/profile');
      
      if (profilePage) {
        // 直接调用profile页面的方法
        profilePage.updateStudyStats('read', totalMinutes, 1);
      } else {
        // 如果找不到profile页面实例，则通过本地存储来更新
        this.updateStudyStatsLocal('read', totalMinutes, 1);
      }
    }
  },

  onHide: function() {
    // 暂停计时
    this.pauseReadingTimer();
  },

  onShow: function() {
    // 恢复计时
    this.resumeReadingTimer();
  },

  startReadingTimer: function() {
    readingStartTime = new Date();
    
    // 每秒更新一次计时
    readingTimer = setInterval(() => {
      const now = new Date();
      const seconds = Math.floor((now - readingStartTime) / 1000);
      accumulatedReadingTime += 1;
      
      // 每分钟更新一次统计数据
      if (accumulatedReadingTime % 60 === 0) {
        console.log('阅读时间累计:', Math.floor(accumulatedReadingTime / 60), '分钟');
      }
    }, 1000);
  },

  pauseReadingTimer: function() {
    if (readingTimer) {
      clearInterval(readingTimer);
      readingTimer = null;
      
      // 计算已经阅读的时间
      const now = new Date();
      const seconds = Math.floor((now - readingStartTime) / 1000);
      accumulatedReadingTime += seconds;
    }
  },

  resumeReadingTimer: function() {
    if (!readingTimer) {
      readingStartTime = new Date();
      this.startReadingTimer();
    }
  },

  stopReadingTimer: function() {
    if (readingTimer) {
      clearInterval(readingTimer);
      readingTimer = null;
      
      // 计算已经阅读的时间
      const now = new Date();
      const seconds = Math.floor((now - readingStartTime) / 1000);
      accumulatedReadingTime += seconds;
    }
  },

  updateStudyStatsLocal: function(type, duration, count = 0) {
    // 获取当前日期
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 从本地存储获取学习统计数据
    let studyStats = wx.getStorageSync('studyStats') || {};
    
    // 确保当天数据和总数据存在
    if (!studyStats[dateStr]) {
      studyStats[dateStr] = {
        read: 0,
        write: 0,
        listen: 0,
        speak: 0,
        readArticles: 0,
        writeArticles: 0,
        listenAudios: 0,
        speakExercises: 0
      };
    }
    
    if (!studyStats.total) {
      studyStats.total = {
        readArticles: 0,
        writeArticles: 0,
        listenAudios: 0,
        speakExercises: 0
      };
    }
    
    // 更新学习时长
    studyStats[dateStr][type] = (studyStats[dateStr][type] || 0) + duration;
    
    // 更新学习项目数量
    if (count) {
      const countType = `${type}${type === 'read' ? 'Articles' : type === 'write' ? 'Articles' : type === 'listen' ? 'Audios' : 'Exercises'}`;
      studyStats[dateStr][countType] = (studyStats[dateStr][countType] || 0) + count;
      studyStats.total[countType] = (studyStats.total[countType] || 0) + count;
    }
    
    // 保存到本地存储
    wx.setStorageSync('studyStats', studyStats);
    
    console.log(`${type}学习统计数据已更新 (本地)`, studyStats[dateStr]);
  }
}); 