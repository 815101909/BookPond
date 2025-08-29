// 读一读页面逻辑
const api = require('../../utils/api.js');
// 引入跨环境云函数调用工具
const { readAPI } = require('../../utils/cloud-api.js');

// 通用临时链接处理函数
async function getTemporaryFileUrl(fileUrl, type = 'file') {
  if (!fileUrl) {
    console.log(`${type}链接为空，使用占位内容`);
    return getPlaceholderUrl(type);
  }

  try {
    if (fileUrl.startsWith('cloud://')) {
      try {
        // 跨环境创建 Cloud 实例
        const cloudInstance = new wx.cloud.Cloud({
          identityless: true,
          resourceAppid: 'wx85d92d28575a70f4',
          resourceEnv: 'cloud1-1gsyt78b92c539ef',
        });
        await cloudInstance.init();

        const result = await cloudInstance.getTempFileURL({
          fileList: [fileUrl],
        });

        if (result.fileList?.[0]?.tempFileURL) {
          return result.fileList[0].tempFileURL;
        } else {
          console.error(`${type}云链接转换失败:`, result);
          return getPlaceholderUrl('error_' + type);
        }
      } catch (err) {
        console.error(`${type}云链接转换异常:`, err);
        return getPlaceholderUrl('error_' + type);
      }
    }

    if (fileUrl.startsWith('http')) {
      console.log(`${type}链接为HTTP地址:`, fileUrl);
      return fileUrl;
    }

    console.log(`${type}链接格式未知，使用占位内容。原始链接:`, fileUrl);
    return getPlaceholderUrl(type);
  } catch (error) {
    console.error(`处理${type}链接时出错:`, error);
    return getPlaceholderUrl('error_' + type);
  }
}

// 占位符链接生成函数
function getPlaceholderUrl(type) {
  if (type.includes('image')) {
    return `https://via.placeholder.com/800x600.png?text=${type}`;
  } else if (type.includes('audio')) {
    return `https://dummyimage.com/600x100/cccccc/000000&text=Audio+Placeholder`;
  } else if (type.includes('video')) {
    return `https://dummyimage.com/800x450/aaaaaa/000000&text=Video+Placeholder`;
  } else {
    return `https://dummyimage.com/600x100/999999/ffffff&text=File+${type}`;
  }
}

let readingStartTime = null;
let accumulatedReadingTime = 0;
let readingTimer = null;
let currentPage = null;

Page({
  data: {
    currentLevel: 'forest',
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
      'zh-CN': { code: 'zh-CN', name: '中文简体', flag: '🇨🇳' },
      'zh-TW': { code: 'zh-TW', name: '中文繁体', flag: '🇨🇳' },
      'en': { code: 'en', name: '英语', flag: '🇬🇧' },
      'ja': { code: 'ja', name: '日语', flag: '🇯🇵' },
      'fr': { code: 'fr', name: '法语', flag: '🇫🇷' },
      'pt-BR': { code: 'pt-BR', name: '葡萄牙语（巴西）', flag: '🇧🇷' },
      'pt-PT': { code: 'pt-PT', name: '葡萄牙语（葡萄牙）', flag: '🇵🇹' }
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
    tabs: ['daily', 'classics'],
    // 会员状态相关
    isMember: false,
    membershipInfo: null
  },

  onLoad: function(options) {
    try {
      // 检查登录状态
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        // 未登录，跳转到登录页面
        wx.redirectTo({
          url: '/pages/login/login'
        });
        return;
      }
      
      // 检查会员状态
      this.checkMemberStatus();
      
      // 初始化语言选项 - 过滤掉中文简体
      const allLanguageOptions = Object.values(this.data.languageMap);
      const languageOptions = allLanguageOptions.filter(lang => lang.code !== 'zh-CN');
      
      this.setData({ languageOptions });
      
      // 设置当前日期
      this.initCurrentDate();
      
      // 默认选中森林谷和「晓」见闻
      this.setData({
        currentLevel: 'forest',
        currentTab: 'daily'
      });
      
      // 加载内容
      this.loadContent();
      
      // 初始化阅读计时
      readingStartTime = new Date();
      accumulatedReadingTime = 0;
      currentPage = this;
      
      // 清除上次同步的分钟数记录，重新开始计算
      wx.removeStorageSync('lastSyncedReadMinutes');
      
      // 开始计时
      this.startReadingTimer();
    } catch (error) {
      console.error('页面加载失败:', error);
      // 确保基本UI结构仍然显示
      this.setData({
        languageOptions: Object.values(this.data.languageMap).filter(lang => lang.code !== 'zh-CN') || [],
        currentLevel: 'forest',
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

  // 格式化时间戳
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载内容
  async loadContent() {
    if (this.data.loading) return;
    
    try {
      this.setData({ loading: true });
      
      const { currentLevel, currentTab, page, pageSize } = this.data;
      
      // 获取选中的语言
      let languages = []; // 默认为空数组，表示显示所有文章
      if (this.data.selectedLanguage1) {
        languages.push(this.data.selectedLanguage1.code);
      }
      if (this.data.selectedLanguage2 && this.data.selectedLanguage1) {
        // 只有在已选择第一语言的情况下，才添加第二语言
        languages.push(this.data.selectedLanguage2.code);
      }
      
      console.log('准备调用云函数，参数:', { level: currentLevel, type: currentTab, page, pageSize, languages });
      
      // 调用云函数获取文章列表
      const result = await readAPI.getArticles({
        level: currentLevel,
        type: currentTab,
        page,
        pageSize,
        languages
      });
      
      console.log('云函数返回结果:', result.result);
      
      if (result.result.code === 0) {
        const { list, total, dailyNews } = result.result.data;
        
        console.log('获取到的文章列表:', list);
        
        // 格式化时间并处理标题
        const formattedList = list.map(item => {
          console.log(`处理文章 ${item._id}:`, item);
          
          // 处理标题
          let title = item.title || ''; // 默认使用旧的title字段
          let getTranslatedTitle = '';
          
          // 处理新的titles数组格式
          if (item.titles && Array.isArray(item.titles) && item.titles.length > 0) {
            console.log(`文章 ${item._id} 的titles数组:`, item.titles);
            
            // 查找中文标题
            const zhTitle = item.titles.find(t => t.language === 'zh-CN');
            if (zhTitle) {
              title = zhTitle.title;
              console.log(`找到中文标题: ${title}`);
            } else {
              title = item.titles[0].title;
              console.log(`未找到中文标题，使用第一个标题: ${title}`);
            }
            
            // 获取翻译标题 - 优先使用第一选择语言，然后是第二选择语言
            let translatedTitle = null;
            
            // 尝试获取第一语言的标题
            if (this.data.selectedLanguage1 && this.data.selectedLanguage1.code !== 'zh-CN') {
              translatedTitle = item.titles.find(t => t.language === this.data.selectedLanguage1.code);
              if (translatedTitle) {
                getTranslatedTitle = translatedTitle.title;
                console.log(`找到第一语言翻译标题(${this.data.selectedLanguage1.code}): ${getTranslatedTitle}`);
              }
            }
            
            // 如果没有找到第一语言的标题，尝试获取第二语言的标题
            if (!getTranslatedTitle && this.data.selectedLanguage2 && this.data.selectedLanguage2.code !== 'zh-CN') {
              translatedTitle = item.titles.find(t => t.language === this.data.selectedLanguage2.code);
              if (translatedTitle) {
                getTranslatedTitle = translatedTitle.title;
                console.log(`找到第二语言翻译标题(${this.data.selectedLanguage2.code}): ${getTranslatedTitle}`);
              }
            }
          } else {
            console.log(`文章 ${item._id} 没有titles数组，使用title字段: ${title}`);
          }
          
          return {
            ...item,
            title: title, // 确保title字段存在
            getTranslatedTitle: getTranslatedTitle,
            create_time: this.formatDate(item.create_time)
          };
        });
        
        console.log('处理后的文章列表:', formattedList);
        
        // 更新列表数据
        if (currentTab === 'daily') {
          this.setData({
            newsList: page === 1 ? formattedList : [...this.data.newsList, ...formattedList],
            newsNoMore: formattedList.length < pageSize,
            // 更新今日动态，只在有数据时更新
            ...(page === 1 && dailyNews ? {
              dailyNews: {
                ...dailyNews,
                date: this.formatDate(dailyNews.create_time)
              }
            } : {})
          }, () => {
            console.log('更新后的newsList:', this.data.newsList);
          });
        } else {
          this.setData({
            classicsList: page === 1 ? formattedList : [...this.data.classicsList, ...formattedList],
            classicsNoMore: formattedList.length < pageSize
          });
        }
        
        // 更新页码
        if (list.length === pageSize) {
          this.setData({
            page: page + 1
          });
        }
      } else {
        throw new Error(result.result.msg);
      }
      
    } catch (error) {
      console.error('加载内容失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 切换难度等级
  switchLevel(e) {
    const level = e.currentTarget.dataset.level;
    this.setData({
      currentLevel: level,
      page: 1,
      newsList: [],
      classicsList: []
    });
    this.loadContent();
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      page: 1,
      newsList: [],
      classicsList: []
    });
    this.loadContent();
  },

  // 第一语言选择处理
  onCompareChange1: function(e) {
    const index = e.detail.value;
    const selectedLanguage = this.data.languageOptions[index];
    
    this.setData({
      compareIndex1: index,
      selectedLanguage1: selectedLanguage,
      // 如果选择了新的第一语言，重置第二语言选择
      compareIndex2: null,
      selectedLanguage2: null,
      // 重置页码
      page: 1,
      newsList: [],
      classicsList: [],
      newsNoMore: false,
      classicsNoMore: false
    }, () => {
      // 重新加载内容
      this.loadContent();
    });
  },

  // 第二语言选择处理
  onCompareChange2: function(e) {
    // 如果没有选择第一语言，不允许选择第二语言
    if (!this.data.selectedLanguage1) {
      wx.showToast({
        title: '请先选择第一语言',
        icon: 'none'
      });
      return;
    }

    const index = e.detail.value;
    const selectedLanguage = this.data.languageOptions[index];
    
    // 检查是否选择了与第一语言相同的语言
    if (selectedLanguage.code === this.data.selectedLanguage1.code) {
      wx.showToast({
        title: '请选择不同的语言',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      compareIndex2: index,
      selectedLanguage2: selectedLanguage,
      // 重置页码
      page: 1,
      newsList: [],
      classicsList: [],
      newsNoMore: false,
      classicsNoMore: false
    }, () => {
      // 重新加载内容
      this.loadContent();
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
    
    console.log('读一读页面卸载，累计阅读时间:', accumulatedReadingTime, '秒，折合', totalMinutes, '分钟');
    
    // 更新学习统计数据
    if (totalMinutes > 0) {
      // 检查是否有未同步的时间
      const lastSyncedMinutes = wx.getStorageSync('lastSyncedReadMinutes') || 0;
      const unsyncedMinutes = totalMinutes - lastSyncedMinutes;
      
      console.log('上次同步的分钟数:', lastSyncedMinutes, '未同步的分钟数:', unsyncedMinutes);
      
      if (unsyncedMinutes > 0) {
        // 优先使用本地存储方式更新未同步的时间，确保数据可靠保存
        this.updateStudyStatsLocal('read', unsyncedMinutes, 0);
      }
      
      // 如果是第一次同步（没有实时同步过），则增加文章阅读数量
      if (lastSyncedMinutes === 0) {
        this.updateStudyStatsLocal('read', 0, 1);
      }
      
      // 同时尝试更新profile页面实例（如果存在）
      const pages = getCurrentPages();
      const profilePage = pages.find(page => page.route === 'pages/profile/profile');
      
      if (profilePage) {
        // 重新加载profile页面的统计数据
        profilePage.loadStudyStats();
        console.log('已通知profile页面重新加载学习统计数据');
      }
    }
    
    // 清除同步记录
    wx.removeStorageSync('lastSyncedReadMinutes');
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
        
        // 每分钟实时同步一次数据到本地存储
        const currentMinutes = Math.floor(accumulatedReadingTime / 60);
        if (currentMinutes > 0) {
          // 获取上次同步的分钟数
          const lastSyncedMinutes = wx.getStorageSync('lastSyncedReadMinutes') || 0;
          const newMinutes = currentMinutes - lastSyncedMinutes;
          
          if (newMinutes > 0) {
            this.updateStudyStatsLocal('read', newMinutes, 0);
            wx.setStorageSync('lastSyncedReadMinutes', currentMinutes);
            console.log('实时同步阅读时长:', newMinutes, '分钟');
          }
        }
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
    
    console.log('开始更新本地学习统计数据:', { type, duration, count, dateStr });
    
    // 从本地存储获取学习统计数据
    let studyStats = wx.getStorageSync('studyStats') || {};
    console.log('当前本地存储的学习统计数据:', studyStats);
    
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
    
    // 记录更新前的数据
    const beforeUpdate = studyStats[dateStr][type] || 0;
    
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
    
    console.log(`${type}学习统计数据已更新 (本地):`, {
      '更新前': beforeUpdate,
      '增加时长': duration,
      '更新后': studyStats[dateStr][type],
      '当日总数据': studyStats[dateStr]
    });
    
    // 验证数据是否正确保存
    const savedData = wx.getStorageSync('studyStats');
    console.log('验证保存后的数据:', savedData[dateStr]);
  },

  // 处理图片加载错误
  handleImageError(e) {
    const { type, index } = e.currentTarget.dataset;
    const defaultImage = getPlaceholderUrl('image');
    
    if (type === 'daily') {
      // 处理今日动态的图片
      this.setData({
        'dailyNews.cover_url': defaultImage
      });
    } else if (type === 'list') {
      // 处理列表中的图片
      this.setData({
        [`newsList[${index}].cover_url`]: defaultImage
      });
    }
  },

  // 检查会员状态
   async checkMemberStatus() {
     try {
       const cloudApi = require('../../utils/cloud-api.js');
       const result = await cloudApi.callCloudFunction('jiuyu_pay', {
         action: 'checkMemberStatus'
       });
       
       console.log('会员状态检查结果:', result);
       
       if (result.result && result.result.success) {
         const { isMember, membershipInfo } = result.result;
         
         console.log('isMember:', isMember);
         console.log('membershipInfo:', membershipInfo);

         // 更新页面数据中的会员状态
         this.setData({
           isMember: isMember,
           membershipInfo: membershipInfo
         });
         
         // 检查会员是否过期（云函数已经处理了过期逻辑，这里只是额外的提示）
         if (!isMember && membershipInfo && membershipInfo.endDate) {
           const now = new Date().getTime();
           const endDate = membershipInfo.endDate;
           
           console.log('当前时间 (now):', now);
           console.log('会员结束日期 (endDate):', endDate);
           console.log('now > endDate:', now > endDate);

           // 如果有过期时间且当前时间超过了过期时间，说明是刚过期的会员
           // 只有在本地存储中没有hasShownExpiredModal标志时才显示弹窗
           if (endDate && now > endDate && !wx.getStorageSync('hasShownExpiredModal')) {
             wx.showModal({
               title: '会员已过期',
               content: '您的会员已过期，部分内容可能无法访问。是否前往续费？',
               confirmText: '去续费',
               cancelText: '稍后再说',
               success: (res) => {
                 if (res.confirm) {
                   wx.navigateTo({
                     url: '/pages/membership/membership'
                   });
                 } else if (res.cancel) {
                   // 用户点击“稍后再说”，设置标志，避免重复显示
                   wx.setStorageSync('hasShownExpiredModal', true);
                 }
               }
             });
           }
         }
       } else {
         // 默认为非会员
         this.setData({
           isMember: false,
           membershipInfo: { isMember: false, startDate: null, endDate: null }
         });
       }
     } catch (error) {
       console.error('检查会员状态失败:', error);
       // 默认为非会员
       this.setData({
         isMember: false,
         membershipInfo: { isMember: false, startDate: null, endDate: null }
       });
     }
   }
});