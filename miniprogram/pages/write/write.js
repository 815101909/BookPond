// 写一写页面逻辑
const api = require('../../utils/api.js');
const { readAPI, writingAPI } = require('../../utils/cloud-api.js');

// 写作计时相关变量
let writingStartTime = null;
let accumulatedWritingTime = 0;
let writingTimer = null;
let currentPage = null;

Page({
  data: {
    selectedType: 'daily', // 默认选中热点信件
    selectedDate: '', // 当前选择的日期
    formattedDate: '', // 格式化后的日期显示
    sproutNews: [], // 萌芽岛新闻
    forestNews: [], // 森林谷新闻
    currentLevel: 'sprout', // 当前选中的难度等级
    currentLevelIndex: 0, // 当前显示的轮播页面索引
    levels: {
      sprout: { name: '萌芽岛', index: 0 },
      forest: { name: '森林谷', index: 1 }
    },
    compareIndex1: null, // 第一对照语言索引
    compareIndex2: null, // 第二对照语言索引
    selectedLanguage1: null, // 已选择的第一对照语言
    selectedLanguage2: null, // 已选择的第二对照语言
    languageMap: {
      'zh-CN': { code: 'zh-CN', name: '中文简体', shortName: '简体' },
      'zh-TW': { code: 'zh-TW', name: '中文繁体', shortName: '繁体' },
      'en': { code: 'en', name: '英语', shortName: '英语' },
      'fr': { code: 'fr', name: '法语', shortName: '法语' },
      'es': { code: 'es', name: '西班牙语', shortName: '西语' },
      'de': { code: 'de', name: '德语', shortName: '德语' },
      'it': { code: 'it', name: '意大利语', shortName: '意语' },
      'ja': { code: 'ja', name: '日语', shortName: '日语' },
      'pt-PT': { code: 'pt-PT', name: '葡萄牙语（葡萄牙）', shortName: '葡语' },
      'pt-BR': { code: 'pt-BR', name: '葡萄牙语（巴西）', shortName: '巴葡' },
      'ru': { code: 'ru', name: '俄语', shortName: '俄语' },
      'ko': { code: 'ko', name: '韩语', shortName: '韩语' }
    },
    languageOptions: [],
    writingContent: '', // 用户输入的写作内容
    textareaHeight: 180, // 文本区域高度
    isDebugMode: false, // 默认不显示调试模式
    apiBaseUrl: api.BASE_URL || '未配置',
    debugClickCount: 0,
    networkStatus: '',
    dataSource: '',
    showPromptPanel: false, // 控制提示词汇浮窗的显示状态
    currentTranslationIndex: -1,
    vocabularyList: [], // 更改为空数组，将通过API动态加载
    currentArticle: null, // 当前选择的文章
    isLoadingVocabulary: false, // 加载词汇数据状态

    // 时光宝盒相关数据
    showTimeCapsuleModal: false, // 显示时光宝盒模态框
    selectedTimeOption: 'month', // 默认选中一个月
    weekLaterDate: '', // 一周后的日期
    monthLaterDate: '', // 一个月后的日期
    halfYearLaterDate: '', // 半年后的日期
    customDate: '', // 自定义日期
    minDate: '', // 最小可选日期（明天）
    futureSelfMessage: '', // 给未来自己的留言
    currentWritingId: null, // 当前保存的写作ID
  },

  onLoad: function() {
    // 初始化写作计时
    writingStartTime = null;
    accumulatedWritingTime = 0;
    writingTimer = null;
    currentPage = this;
    
    // 清除上次同步的分钟数记录
    wx.removeStorageSync('lastSyncedWriteMinutes');
    
    // 初始化当前日期
    this.initCurrentDate();
    
    // 初始化语言选项
    this.initLanguageOptions();
    
    // 设置初始状态
    this.setData({
      currentArticle: null,
      vocabularyList: [],
      showPromptPanel: false,
      currentTranslationIndex: -1
    });
    
    // 获取文章数据
    this.getNewsData();
    
    // 初始化调试模式
    this.setData({
      isDebugMode: false,
      apiBaseUrl: api.BASE_URL || '未配置'
    });
    
    // 初始化时光宝盒相关日期
    this.initTimeCapsuleDates();
    
    // 开始计时
    this.startWritingTimer();
  },
  
  // 轮播内容切换时更新当前难度等级
  onLevelSwiperChange: function(e) {
    const index = e.detail.current;
    let level = 'sprout';
    
    if (index === 1) {
      level = 'forest';
    }
    
    this.setData({
      currentLevelIndex: index,
      currentLevel: level
    });
    
    // 可选：显示当前难度级别的提示
    wx.showToast({
      title: '当前难度：' + this.data.levels[level].name,
      icon: 'none',
      duration: 1000
    });
  },
  
  // 初始化当前日期
  initCurrentDate: function() {
    console.log('初始化日期...');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // 格式为 YYYY-MM-DD
    const dateString = `${year}-${month}-${day}`;
    
    // 格式化为显示格式
    const formattedDate = `${year}年${month}月${day}日`;
    
    console.log('设置初始日期:', {
      dateString: dateString,
      formattedDate: formattedDate
    });
    
    this.setData({
      selectedDate: dateString,
      formattedDate: formattedDate
    });
  },
  
  // 日期选择变更处理
  onDateChange: function(e) {
    const selectedDate = e.detail.value;
    console.log('用户选择了日期:', selectedDate);
    
    // 格式化显示日期
    let formattedDate = '今日';
    if (selectedDate) {
      const date = new Date(selectedDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      formattedDate = `${year}年${month}月${day}日`;
      console.log('格式化后的显示日期:', formattedDate);
    }
    
    this.setData({
      selectedDate,
      formattedDate
    }, () => {
      console.log('日期状态已更新:', {
        selectedDate: this.data.selectedDate,
        formattedDate: this.data.formattedDate
      });
      // 重新获取数据
      this.getNewsData();
    });
  },
  
  // 清除日期筛选
  clearDateFilter: function() {
    this.setData({
      selectedDate: '',
      formattedDate: '全部文章'
    }, () => {
      console.log('已清除日期筛选');
      // 重新获取数据
      this.getNewsData();
    });
  },
  
  // 选择信件类型
  selectLetterType: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedType: type,
      // 重置学习卡片数据
      wordCards: [],
      sentenceCards: []
    });
    
    // 根据类型加载不同的内容
    if (type === 'news') {
      // 加载热点新闻
      this.getNewsData();
    }
  },
  
  // 在WXML中使用的函数，修复函数不一致的问题
  switchLetterType: function(e) {
    // 调用已有的函数实现逻辑
    console.log('切换信件类型', e.currentTarget.dataset.type);
    this.selectLetterType(e);
  },
  
  // 获取各等级的新闻数据
  async getNewsData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    try {
      console.log('开始获取文章数据...');
      
      // 首先获取萌芽岛文章
      const sproutResult = await readAPI.getArticles({
        level: 'sprout', // 明确指定level为sprout
        page: 1,
        pageSize: 20,
        languages: []
      });
      
      // 然后获取森林谷文章
      const forestResult = await readAPI.getArticles({
        level: 'forest', // 明确指定level为forest
        page: 1,
        pageSize: 20,
        languages: []
      });

      // 处理萌芽岛文章
      let sproutNews = [];
      if (sproutResult.result.code === 0) {
        const { list } = sproutResult.result.data;
        console.log('萌芽岛原始文章数量:', list.length);
        
        // 处理文章标题和日期
        sproutNews = list.map(article => {
          // 处理标题
          if (article.titles && Array.isArray(article.titles) && article.titles.length > 0) {
            const zhTitle = article.titles.find(t => t.language === 'zh-CN');
            if (zhTitle && zhTitle.title) {
              article.title = zhTitle.title;
            }
          }
          
          // 格式化日期
          if (article.create_time) {
            const date = new Date(article.create_time);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            article.formattedDate = `${year}-${month}-${day}`;
          }
          
          return article;
        });
      }
      
      // 处理森林谷文章
      let forestNews = [];
      if (forestResult.result.code === 0) {
        const { list } = forestResult.result.data;
        console.log('森林谷原始文章数量:', list.length);
        
        // 处理文章标题和日期
        forestNews = list.map(article => {
          // 处理标题
          if (article.titles && Array.isArray(article.titles) && article.titles.length > 0) {
            const zhTitle = article.titles.find(t => t.language === 'zh-CN');
            if (zhTitle && zhTitle.title) {
              article.title = zhTitle.title;
            }
          }
          
          // 格式化日期
          if (article.create_time) {
            const date = new Date(article.create_time);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            article.formattedDate = `${year}-${month}-${day}`;
          }
          
          return article;
        });
      }
      
      console.log('处理后萌芽岛文章数量:', sproutNews.length);
      console.log('处理后森林谷文章数量:', forestNews.length);
      
      // 根据选择的日期筛选文章
      const selectedDate = this.data.selectedDate;
      console.log('当前选择的日期:', selectedDate);
      
      // 先保存原始文章列表的副本
      const allSproutNews = [...sproutNews];
      const allForestNews = [...forestNews];
      
      if (selectedDate) {
        // 筛选萌芽岛文章
        const filteredSproutNews = sproutNews.filter(article => {
          if (!article.formattedDate) return false;
          return article.formattedDate === selectedDate;
        });
        
        // 筛选森林谷文章
        const filteredForestNews = forestNews.filter(article => {
          if (!article.formattedDate) return false;
          return article.formattedDate === selectedDate;
        });
        
        console.log(`日期 ${selectedDate} 筛选后萌芽岛文章数量: ${filteredSproutNews.length}`);
        console.log(`日期 ${selectedDate} 筛选后森林谷文章数量: ${filteredForestNews.length}`);
        
        // 如果筛选后有文章，使用筛选后的文章
        if (filteredSproutNews.length > 0 || filteredForestNews.length > 0) {
          // 至少有一种类型的文章找到了，使用筛选结果
          sproutNews = filteredSproutNews;
          forestNews = filteredForestNews;
        } else {
          // 两种类型的文章都没找到，尝试获取昨天的数据
          console.log('所选日期无文章，尝试显示昨天的文章');
          
          // 计算昨天的日期
          const currentDate = new Date(selectedDate);
          const yesterday = new Date(currentDate);
          yesterday.setDate(currentDate.getDate() - 1);
          const year = yesterday.getFullYear();
          const month = String(yesterday.getMonth() + 1).padStart(2, '0');
          const day = String(yesterday.getDate()).padStart(2, '0');
          const yesterdayStr = `${year}-${month}-${day}`;
          
          // 筛选昨天的文章
          const yesterdaySproutNews = allSproutNews.filter(article => {
            if (!article.formattedDate) return false;
            return article.formattedDate === yesterdayStr;
          });
          
          const yesterdayForestNews = allForestNews.filter(article => {
            if (!article.formattedDate) return false;
            return article.formattedDate === yesterdayStr;
          });
          
          console.log(`昨天 ${yesterdayStr} 筛选后萌芽岛文章数量: ${yesterdaySproutNews.length}`);
          console.log(`昨天 ${yesterdayStr} 筛选后森林谷文章数量: ${yesterdayForestNews.length}`);
          
          // 如果昨天有文章，使用昨天的文章
          if (yesterdaySproutNews.length > 0 || yesterdayForestNews.length > 0) {
            sproutNews = yesterdaySproutNews;
            forestNews = yesterdayForestNews;
            
            // 显示提示
            wx.showToast({
              title: `所选日期无文章，显示昨天(${yesterdayStr})的文章`,
              icon: 'none',
              duration: 3000
            });
          } else {
            // 昨天也没有文章，显示空数据
            console.log('昨天也无文章，显示空数据');
            sproutNews = [];
            forestNews = [];
            
            // 显示提示
            wx.showToast({
              title: '近期无文章数据',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
      
      // 设置数据
      this.setData({
        sproutNews,
        forestNews
      });
      
      console.log('最终设置的文章数据:', {
        sproutNews: sproutNews.length,
        forestNews: forestNews.length
      });

      wx.hideLoading();
    } catch (error) {
      console.error('获取数据时发生错误:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },
  
  // 模拟获取名著经典数据 - 当API请求失败或没有存储数据时的后备方案
  getMockClassicsData: function(date) {
    console.log('使用模拟经典名著数据:', date);
    return {
      sprout: api.getMockClassicsData('sprout', date),
      forest: api.getMockClassicsData('forest', date)
    };
  },
  
  // 从"读一读"页面获取经典名著数据
  getClassicsFromReadPage: function(date) {
    // 尝试从存储中获取由"读一读"页面设置的数据
    const readPageData = wx.getStorageSync('readPageClassics') || {};
    
    // 检查是否有当前日期的数据
    if (readPageData[date]) {
      return readPageData[date];
    }
    
    // 如果没有存储数据，尝试从API获取
    return this.getMockClassicsData(date);
  },
  
  // 文章选择处理
  async onNewsSelect(e) {
    const { level, index } = e.currentTarget.dataset;
    let selectedArticle;

    // 根据难度等级和索引获取对应的文章
    if (level === 'sprout' && this.data.sproutNews.length > 0) {
      // 如果提供了索引，使用索引，否则使用第一篇文章
      const articleIndex = index !== undefined ? parseInt(index) : 0;
      selectedArticle = this.data.sproutNews[articleIndex];
      console.log(`选择了萌芽岛文章 #${articleIndex}:`, {
        id: selectedArticle._id,
        title: selectedArticle.title,
        date: selectedArticle.formattedDate
      });
    } else if (level === 'forest' && this.data.forestNews.length > 0) {
      // 如果提供了索引，使用索引，否则使用第一篇文章
      const articleIndex = index !== undefined ? parseInt(index) : 0;
      selectedArticle = this.data.forestNews[articleIndex];
      console.log(`选择了森林谷文章 #${articleIndex}:`, {
        id: selectedArticle._id,
        title: selectedArticle.title,
        date: selectedArticle.formattedDate
      });
    }

    if (selectedArticle) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      try {
        // 获取文章详情（包含词汇）
        const result = await readAPI.getArticleDetail({
          id: selectedArticle._id
        });

        if (result.result.code === 0) {
          const articleDetail = result.result.data;
          
          // 确保使用中文标题
          if (articleDetail.titles && Array.isArray(articleDetail.titles) && articleDetail.titles.length > 0) {
            const zhTitle = articleDetail.titles.find(t => t.language === 'zh-CN');
            if (zhTitle && zhTitle.title) {
              articleDetail.title = zhTitle.title;
              console.log(`文章详情使用中文标题: ${articleDetail.title}`);
            }
          }
          
          // 获取当前选择的语言代码
          const currentLangCode = this.data.selectedLanguage1 ? this.data.selectedLanguage1.code : 'zh-CN';
          
          // 从contents中找到对应语言的内容
          let vocabularyList = [];
          if (articleDetail.contents && Array.isArray(articleDetail.contents)) {
            // 优先查找当前选择的语言
            const currentLangContent = articleDetail.contents.find(c => c.language === currentLangCode);
            
            // 如果找到了当前语言的内容，使用其vocabulary
            if (currentLangContent && currentLangContent.vocabulary) {
              vocabularyList = currentLangContent.vocabulary;
              console.log(`找到${currentLangCode}语言的词汇列表，共${vocabularyList.length}个词汇`);
            } 
            // 如果没找到当前语言或当前语言没有词汇，尝试使用其他语言的词汇
            else {
              // 优先使用英语，其次是中文，最后是任何有词汇的语言
              const engContent = articleDetail.contents.find(c => c.language === 'en');
              const zhContent = articleDetail.contents.find(c => c.language === 'zh-CN');
              const anyContent = articleDetail.contents.find(c => c.vocabulary && c.vocabulary.length > 0);
              
              if (engContent && engContent.vocabulary && engContent.vocabulary.length > 0) {
                vocabularyList = engContent.vocabulary;
                console.log('使用英语词汇列表');
              } else if (zhContent && zhContent.vocabulary && zhContent.vocabulary.length > 0) {
                vocabularyList = zhContent.vocabulary;
                console.log('使用中文词汇列表');
              } else if (anyContent) {
                vocabularyList = anyContent.vocabulary;
                console.log(`使用${anyContent.language}语言词汇列表`);
              }
            }
          }
          
          this.setData({
            currentArticle: articleDetail,
            currentLevel: level,
            vocabularyList: vocabularyList,
            showPromptPanel: false // 关闭提示面板
          });

          wx.showToast({
            title: '已选择文章',
            icon: 'success'
          });
        } else {
          throw new Error(result.result.msg || '获取文章详情失败');
        }
      } catch (error) {
        console.error('获取文章详情失败:', error);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      } finally {
        wx.hideLoading();
      }
    }
  },

  // 加载文章相关词汇
  async loadVocabulary(articleId) {
    this.setData({ isLoadingVocabulary: true });

    try {
      // 调用云函数获取词汇
      const result = await readAPI.getArticleDetail({
        id: articleId
      });

      if (result.result.code === 0) {
        this.setData({
          vocabularyList: result.result.data || []
        });
      } else {
        throw new Error(result.result.msg);
      }
    } catch (error) {
      console.error('加载词汇失败:', error);
      wx.showToast({
        title: '加载词汇失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoadingVocabulary: false });
    }
  },
  
  // 当语言选择改变时，重新加载词汇数据（使用选择的语言）
  onCompareChange1: function(e) {
    const index = e.detail.value;
    if (index !== undefined && this.data.languageOptions[index]) {
      const selectedLanguage = this.data.languageOptions[index];
      this.setData({
        compareIndex1: index,
        selectedLanguage1: selectedLanguage
      });
      
      // 如果当前已选择文章，则更新该文章的词汇（使用新选择的语言）
      if (this.data.currentArticle) {
        this.updateVocabularyByLanguage(selectedLanguage.code);
      }
    }
  },
  
  // 根据选择的语言更新词汇列表
  updateVocabularyByLanguage: function(languageCode) {
    const articleDetail = this.data.currentArticle;
    if (!articleDetail || !articleDetail.contents || !Array.isArray(articleDetail.contents)) {
      return;
    }
    
    // 从contents中找到对应语言的内容
    let vocabularyList = [];
    
    // 优先查找当前选择的语言
    const currentLangContent = articleDetail.contents.find(c => c.language === languageCode);
    
    // 如果找到了当前语言的内容，使用其vocabulary
    if (currentLangContent && currentLangContent.vocabulary && currentLangContent.vocabulary.length > 0) {
      vocabularyList = currentLangContent.vocabulary;
      console.log(`找到${languageCode}语言的词汇列表，共${vocabularyList.length}个词汇`);
    } 
    // 如果没找到当前语言或当前语言没有词汇，尝试使用其他语言的词汇
    else {
      // 优先使用英语，其次是中文，最后是任何有词汇的语言
      const engContent = articleDetail.contents.find(c => c.language === 'en');
      const zhContent = articleDetail.contents.find(c => c.language === 'zh-CN');
      const anyContent = articleDetail.contents.find(c => c.vocabulary && c.vocabulary.length > 0);
      
      if (engContent && engContent.vocabulary && engContent.vocabulary.length > 0) {
        vocabularyList = engContent.vocabulary;
        console.log('使用英语词汇列表');
      } else if (zhContent && zhContent.vocabulary && zhContent.vocabulary.length > 0) {
        vocabularyList = zhContent.vocabulary;
        console.log('使用中文词汇列表');
      } else if (anyContent && anyContent.vocabulary) {
        vocabularyList = anyContent.vocabulary;
        console.log(`使用${anyContent.language}语言词汇列表`);
      }
    }
    
    // 更新词汇列表
    this.setData({
      vocabularyList: vocabularyList
    });
  },
  
  // 初始化语言选项
  initLanguageOptions: function() {
    const languageOptions = Object.values(this.data.languageMap);
    this.setData({ languageOptions });
  },
  
  // 切换难度等级
  switchLevel: function(e) {
    const level = e.currentTarget.dataset.level;
    this.setData({ currentLevel: level });
    
    // 可以根据难度级别调整显示的词汇和句子复杂度
    // 这里先简单实现，实际应用中可根据难度筛选不同的词汇和句子
  },
  
  // 第二语言选择器变化
  onCompareChange2: function(e) {
    const index = e.detail.value;
    const selectedLanguage = this.data.languageOptions[index];
    this.setData({
      compareIndex2: index,
      selectedLanguage2: selectedLanguage
    });
    
    // 保存语言选择到本地存储
    this.saveLanguageSelections();
  },
  
  // 切换提示词汇浮窗显示状态
  togglePromptPanel: function() {
    // 如果没有选择文章，显示提示然后返回
    if (!this.data.currentArticle && !this.data.showPromptPanel) {
      this.setData({
        showPromptPanel: true
      });
      
      // 记录提示事件（在实际应用中可以上传到后台统计）
      console.log('显示提示: 请先选择文章');
      return;
    }
    
    // 如果有文章，正常切换面板显示状态
    this.setData({
      showPromptPanel: !this.data.showPromptPanel,
      currentTranslationIndex: -1 // 重置翻译索引
    });
    
    // 记录面板切换事件（在实际应用中可以上传到后台统计）
    console.log('切换提示面板:', this.data.showPromptPanel ? '显示' : '隐藏');
  },
  
  // 保存语言选择到本地存储，以便与读一读页面同步
  saveLanguageSelections: function() {
    const selectedLanguages = [];
    
    if (this.data.selectedLanguage1) {
      selectedLanguages.push(this.data.selectedLanguage1.code);
    }
    
    if (this.data.selectedLanguage2) {
      selectedLanguages.push(this.data.selectedLanguage2.code);
    }
    
    console.log('写一写页面保存语言选择:', selectedLanguages);
    wx.setStorageSync('selectedLanguages', selectedLanguages);
  },
  
  // 处理用户写作输入
  onWritingInput: function(e) {
    this.setData({
      writingContent: e.detail.value,
      showPromptPanel: true // 确保在输入时保持面板显示
    });
  },
  
  // 提交写作内容 - 保存至我的主页
  async submitWriting() {
    if (!this.data.writingContent.trim()) {
      wx.showToast({
        title: '请输入写作内容',
        icon: 'none'
      });
      return;
    }

    if (!this.data.currentArticle) {
      wx.showToast({
        title: '请选择一篇文章',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      // 获取当前日期
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const formattedDate = `${year}年${month}月${day}日`;

      // 调用云函数保存到jiuyu_writings集合
      const result = await writingAPI.saveWriting({
         content: this.data.writingContent,
         articleId: this.data.currentArticle._id,
         type: this.data.selectedType,
         level: this.data.currentLevel,
         languages: this.data.selectedLanguage1 ? [this.data.selectedLanguage1.code] : [],
         cover_url: this.data.currentArticle.cover_url || '' // 添加封面URL
       });

      if (result.result.code !== 0) {
        throw new Error(result.result.msg || '保存失败');
      }

      // 获取保存的写作ID
      const writingId = result.result.data;
      this.setData({
        currentWritingId: writingId
      });

      // 构建要保存的写作内容数据
      const writingData = {
        id: 'msg_' + Date.now().toString(),
        content: this.data.writingContent,
        timestamp: now.getTime(),
        date: formattedDate,
        read: false,
        source: 'writing', // 使用writing作为来源标识
        type: this.data.selectedType === 'daily' ? '「舟」见闻' : '「舟」经典',
        level: this.data.currentLevel,
        fullData: {
          articleId: this.data.currentArticle._id,
          title: this.data.currentArticle.title
        },
        cover_url: this.data.currentArticle.cover_url || '', // 添加封面URL
        articleId: this.data.currentArticle._id,
        title: this.data.currentArticle.title || '我的写作'
      };

      // 获取已有的信使驿站消息列表
      const existingMessages = wx.getStorageSync('messengerStationMessages') || [];
      
      // 将新写作添加到列表开头
      existingMessages.unshift(writingData);
      
      // 保存更新后的列表
      wx.setStorageSync('messengerStationMessages', existingMessages);

      wx.hideLoading();
      wx.showToast({
        title: '已存至信使驿站',
        icon: 'success',
        duration: 2000
      });

      // 清空写作内容
      this.setData({
        writingContent: ''
      });

      // 可以选择跳转到信使驿站
      wx.showModal({
        title: '保存成功',
        content: '是否查看信使驿站？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '../messenger-station/messenger-station'
            });
          }
        }
      });
    } catch (error) {
      console.error('保存写作内容失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },
  
  // 分享写作内容
  shareWriting() {
    if (!this.data.writingContent.trim()) {
      wx.showToast({
        title: '请先输入写作内容',
        icon: 'none'
      });
      return;
    }

    // 先检查相册权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.writePhotosAlbum']) {
          // 如果没有权限，向用户发起授权请求
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => {
              // 用户同意授权，执行截屏保存
              this.saveScreenshot();
            },
            fail: () => {
              // 用户拒绝授权，引导用户去设置页面开启
              wx.showModal({
                title: '需要相册权限',
                content: '请允许访问相册以保存截屏',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        } else {
          // 已有权限，直接执行截屏保存
          this.saveScreenshot();
        }
      }
    });
  },

  // 执行截屏保存
  saveScreenshot() {
    wx.showModal({
      title: '截屏分享',
      content: '请截取当前页面进行分享',
      showCancel: false,
      success: () => {
        // 截屏后保存到相册
        wx.saveImageToPhotosAlbum({
          success: () => {
            wx.showToast({
              title: '已保存至相册',
              icon: 'success'
            });
          },
          fail: (err) => {
            console.error('保存失败', err);
            wx.showModal({
              title: '保存失败',
              content: '无法保存到相册，请检查权限设置',
              showCancel: false
            });
          }
        });
      }
    });
  },
  
  // 用于分享的小程序自定义事件处理器
  onShareAppMessage: function() {
    const title = this.data.currentArticle ? 
      `我基于"${this.data.currentArticle.title}"的写作` : 
      '我在小舟摇书池写的文章';
    
    return {
      title: title,
      path: '/pages/write/write',
      imageUrl: '/images/share-default.png' // 请确保有此图片，或者使用其他合适的图片
    };
  },
  
  // 用于分享到朋友圈的小程序自定义事件处理器
  onShareTimeline: function() {
    const title = this.data.currentArticle ? 
      `我基于"${this.data.currentArticle.title}"的写作` : 
      '我在小舟摇书池写的文章';
    
    return {
      title: title,
      query: '',
      imageUrl: '/images/share-timeline.png' // 请确保有此图片，或者使用其他合适的图片
    };
  },
  
  // 创建并保存图片到相册
  saveImageToAlbum: function() {
    wx.showLoading({
      title: '正在生成图片...',
      mask: true
    });
    
    try {
      const query = wx.createSelectorQuery();
      query.select('#contentCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            wx.hideLoading();
            wx.showToast({
              title: '画布创建失败',
              icon: 'none'
            });
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          try {
            // 设置画布尺寸（保持较小以避免性能问题）
            const width = 600;
            const height = 800;
            canvas.width = width;
            canvas.height = height;
            
            // 绘制背景
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            // 绘制标题
            ctx.fillStyle = '#1B5E20';
            ctx.font = 'bold 30px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('我的写作', width / 2, 60);
            
            // 绘制日期
            const date = new Date();
            const dateStr = this.formatDate(date);
            ctx.fillStyle = '#666666';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dateStr, width / 2, 100);
            
            // 绘制分隔线
            ctx.strokeStyle = '#E0E0E0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(40, 120);
            ctx.lineTo(width - 40, 120);
            ctx.stroke();
            
            // 绘制内容
            ctx.fillStyle = '#333333';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'left';
            
            // 处理文本换行
            const textLines = this.wrapText(ctx, this.data.writingContent, width - 80);
            let y = 160;
            const lineHeight = 36;
            
            textLines.forEach(line => {
              ctx.fillText(line, 40, y);
              y += lineHeight;
            });
            
            // 底部装饰
            ctx.fillStyle = '#E8F5E9';
            ctx.fillRect(0, height - 60, width, 60);
            
            ctx.fillStyle = '#4CAF50';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('小舟摇书池 · 写一写', width / 2, height - 25);
            
            // 将画布内容转为图片
            wx.canvasToTempFilePath({
              canvas: canvas,
              success: (res) => {
                wx.hideLoading();
                // 保存图片到相册
                wx.saveImageToPhotosAlbum({
                  filePath: res.tempFilePath,
                  success: () => {
                    wx.showToast({
                      title: '已保存至相册',
                      icon: 'success',
                      duration: 2000
                    });
                  },
                  fail: (err) => {
                    console.error('保存失败', err);
                    wx.showModal({
                      title: '保存失败',
                      content: '无法保存到相册，请检查权限设置',
                      showCancel: false
                    });
                  }
                });
              },
              fail: (err) => {
                console.error('生成图片失败', err);
                wx.showToast({
                  title: '生成图片失败',
                  icon: 'none'
                });
                wx.hideLoading();
              }
            });
          } catch (canvasError) {
            console.error('绘制画布出错', canvasError);
            wx.showToast({
              title: '绘制内容失败',
              icon: 'none'
            });
            wx.hideLoading();
          }
        });
    } catch (error) {
      console.error('保存图片过程出错', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
      wx.hideLoading();
    }
  },
  
  // 文本换行处理
  wrapText: function(ctx, text, maxWidth) {
    const lines = [];
    
    // 按照换行符分割文本
    const paragraphs = text.split('\n');
    
    paragraphs.forEach(paragraph => {
      if (!paragraph) {
        lines.push('');
        return;
      }
      
      let line = '';
      let testLine = '';
      const words = paragraph.split('');
      
      words.forEach(char => {
        testLine += char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          lines.push(line);
          line = char;
          testLine = char;
        } else {
          line = testLine;
        }
      });
      
      if (line) {
        lines.push(line);
      }
    });
    
    return lines;
  },
  
  // 默认选择第一个新闻项
  selectDefaultNewsItem: function() {
    // 根据当前难度等级选择对应的新闻列表
    let newsList = [];
    if (this.data.currentLevel === 'sprout') {
      newsList = this.data.sproutNews;
    } else if (this.data.currentLevel === 'forest') {
      newsList = this.data.forestNews;
    }
    
    // 如果当前难度等级没有新闻，尝试从其他难度级别选择
    if (newsList.length === 0) {
      if (this.data.sproutNews.length > 0) {
        this.setData({
          currentLevel: 'sprout',
          currentLevelIndex: 0,
          currentArticle: this.data.sproutNews[0]
        });
      } else if (this.data.forestNews.length > 0) {
        this.setData({
          currentLevel: 'forest',
          currentLevelIndex: 1,
          currentArticle: this.data.forestNews[0]
        });
      }
    } else if (newsList.length > 0) {
      // 选择当前难度等级的第一个新闻
      this.setData({
        currentArticle: newsList[0]
      });
    }
  },
  
  // 切换调试模式
  toggleDebugMode: function() {
    this.debugClickCount = (this.debugClickCount || 0) + 1;
    
    if (this.debugClickCount >= 5) {
      this.debugClickCount = 0;
      const newValue = !this.data.isDebugMode;
      
      this.setData({ isDebugMode: newValue });
      
      // 如果启用了调试模式，进一步获取更多信息
      if (newValue) {
        // 检查网络状态
        api.checkNetworkStatus().then(isConnected => {
          this.setData({
            networkStatus: isConnected ? '已连接' : '未连接',
            dataSource: api.DEV_CONFIG && api.DEV_CONFIG.USE_MOCK_DATA ? '模拟数据' : '实际API'
          });
        });
      }
      
      wx.showToast({
        title: newValue ? '调试模式已启用' : '调试模式已禁用',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 测试API连接
  testApiConnection: function() {
    wx.showLoading({
      title: '测试连接中...',
      mask: true
    });
    
    api.testConnection().then(result => {
      wx.hideLoading();
      
      // 更新状态
      this.setData({
        networkStatus: result.success ? '已连接' : '未连接',
        dataSource: result.success ? 'API可用' : 'API不可用'
      });
      
      // 显示结果
      wx.showModal({
        title: result.message,
        content: result.details,
        showCancel: false
      });
    });
  },

  // 切换模拟数据/实际API
  toggleMockData: function() {
    // 检查API模块是否正确导出了DEV_CONFIG
    if (!api.DEV_CONFIG) {
      wx.showModal({
        title: '配置错误',
        content: 'API模块未正确导出DEV_CONFIG',
        showCancel: false
      });
      return;
    }
    
    // 反转当前设置
    const newValue = !api.DEV_CONFIG.USE_MOCK_DATA;
    
    // 修改配置
    api.DEV_CONFIG.USE_MOCK_DATA = newValue;
    
    // 更新状态
    this.setData({
      dataSource: newValue ? '模拟数据' : '实际API'
    });
    
    // 重新加载数据
    this.getNewsData();
    
    // 提示用户
    wx.showToast({
      title: newValue ? '已切换到模拟数据' : '已切换到实际API',
      icon: 'none',
      duration: 2000
    });
  },

  // 格式化日期
  formatDate: function(date) {
    // 处理多种输入类型：Date对象、字符串、时间戳
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      console.error('formatDate: 无效的日期参数', date);
      return '无效日期';
    }
    
    // 检查日期是否有效
    if (isNaN(dateObj.getTime())) {
      console.error('formatDate: 无法解析的日期', date);
      return '无效日期';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;  
  },

  // 格式化日期显示
  formatDateForDisplay: function(date) {
    // 处理多种输入类型：Date对象、字符串、时间戳
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      console.error('formatDateForDisplay: 无效的日期参数', date);
      return '无效日期';
    }
    
    // 检查日期是否有效
    if (isNaN(dateObj.getTime())) {
      console.error('formatDateForDisplay: 无法解析的日期', date);
      return '无效日期';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;  // 统一使用YYYY-MM-DD格式
  },

  // 显示翻译
  showTranslation: function(e) {
    const index = e.currentTarget.dataset.index;
    
    // 如果点击的是当前显示的翻译，则关闭它
    if (this.data.currentTranslationIndex === index) {
      this.setData({
        currentTranslationIndex: -1
      });
    } else {
      // 否则显示新点击的翻译
      this.setData({
        currentTranslationIndex: index
      });
    }
  },

  // 阻止事件冒泡
  stopPropagation: function(e) {
    // 防止事件冒泡，避免关闭面板
    return;
  },

  // 页面点击事件处理
  onTapPage: function(e) {
    // 如果点击的不是面板按钮，则关闭提示面板
    if (!e.target.dataset.isPanelButton) {
      this.setData({
        showPromptPanel: false,
        currentTranslationIndex: -1
      });
    }
  },

  // 初始化时光宝盒相关日期
  initTimeCapsuleDates: function() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 计算一周后的日期
    const weekLater = new Date(today);
    weekLater.setDate(today.getDate() + 7);
    
    // 计算一个月后的日期
    const monthLater = new Date(today);
    monthLater.setMonth(today.getMonth() + 1);
    
    // 计算半年后的日期
    const halfYearLater = new Date(today);
    halfYearLater.setMonth(today.getMonth() + 6);
    
    this.setData({
      weekLaterDate: this.formatDateForDisplay(weekLater),
      monthLaterDate: this.formatDateForDisplay(monthLater),
      halfYearLaterDate: this.formatDateForDisplay(halfYearLater),
      minDate: this.formatDate(tomorrow) // 最小可选日期为明天
    });
  },
  
  // 显示时光宝盒模态框
  showTimeCapsuleModal: function() {
    if (!this.data.writingContent.trim()) {
      wx.showToast({
        title: '请先输入写作内容',
        icon: 'none'
      });
      return;
    }

    this.setData({
      showTimeCapsuleModal: true,
      futureSelfMessage: '' // 重置留言
    });
  },
  
  // 隐藏时光宝盒模态框
  hideTimeCapsuleModal: function() {
    this.setData({
      showTimeCapsuleModal: false
    });
  },
  
  // 选择时间选项
  selectTimeOption: function(e) {
    const option = e.currentTarget.dataset.option;
    let customDate = '';
    
    // 根据选项设置自定义日期
    if (option === 'week') {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      date.setHours(0, 0, 0, 0);  
      customDate = this.formatDate(date);
    } else if (option === 'month') {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      date.setHours(0, 0, 0, 0);  
      customDate = this.formatDate(date);
    } else if (option === 'halfYear') {
      const date = new Date();
      date.setMonth(date.getMonth() + 6);
      date.setHours(0, 0, 0, 0);  
      customDate = this.formatDate(date);
    }
    
    this.setData({
      selectedTimeOption: option,
      customDate: customDate
    });
  },
  
  // 自定义日期变化处理
  onCustomDateChange: function(e) {
    const date = e.detail.value;
    this.setData({
      customDate: `${date}`,
      selectedTimeOption: 'custom' // 切换到自定义选项
    });
  },
  
  // 处理给未来自己的留言输入
  onFutureMessageInput: function(e) {
    this.setData({
      futureSelfMessage: e.detail.value
    });
  },
  
  // 创建时光宝盒
  async createTimeCapsule() {
    if (!this.data.customDate) {
      wx.showToast({
        title: '请选择开启日期',
        icon: 'none'
      });
      return;
    }

    if (!this.data.writingContent.trim()) {
      wx.showToast({
        title: '请先输入写作内容',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      const result = await writingAPI.saveTimeCapsule({
        content: this.data.writingContent,
        message: this.data.futureSelfMessage,
        openDate: this.data.customDate,
        articleId: this.data.currentArticle ? this.data.currentArticle._id : null,
        language: this.data.selectedLanguage1 ? {
          code: this.data.selectedLanguage1.code,
          name: this.data.selectedLanguage1.name,
          flag: this.data.selectedLanguage1.flag
        } : null,
        vocabularyUsed: this.data.vocabularyList.map(item => item.text)
      });

      if (result.result.code === 0) {
        wx.showToast({
          title: '时光宝盒已创建',
          icon: 'success'
        });
        this.setData({
          showTimeCapsuleModal: false,
          futureSelfMessage: '',
          selectedTimeOption: 'month'
        });
        // 设置开启提醒
        this.scheduleTimeCapsuleReminder(result.result.data);
        // 显示成功动画
        this.showSuccessAnimation(result.result.data);
      } else {
        throw new Error(result.result.msg);
      }
    } catch (error) {
      console.error('保存时光宝盒失败:', error);
      wx.showModal({
        title: '保存失败',
        content: '无法创建时光宝盒，请稍后再试',
        showCancel: false
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 设置时光宝盒开启提醒
  scheduleTimeCapsuleReminder: function(capsuleData) {
    // 使用小程序订阅消息通知
    wx.requestSubscribeMessage({
      tmplIds: ['your-template-id-here'], // 替换为实际的消息模板ID
      success: (res) => {
        console.log('订阅消息结果:', res);
        // 可以在这里将订阅状态记录到服务器，以便到期时发送通知
      },
      fail: (err) => {
        console.error('订阅消息失败:', err);
      }
    });
    
    // 可以在这里调用云函数设置定时任务，在指定日期发送提醒
    console.log('已设置时光宝盒开启提醒，将在', new Date(capsuleData.openAt).toLocaleString(), '提醒用户');
  },
  
  // 显示时光宝盒创建成功动画
  showSuccessAnimation: function(capsuleData) {
    // 将开启日期格式化为 YYYY年MM月DD日
    const openDate = this.data.customDate;
    const [year, month, day] = openDate.split('-');
    const formattedDate = `${year}年${month}月${day}日`;
    
    wx.showModal({
      title: '时光宝盒已启程',
      content: `您的写作内容已被封存，将在 ${formattedDate} 重新开启，届时我们会提醒您查看。`,
      showCancel: false,
      confirmText: '知道了'
    });
  },
  
 // 检查到期的时光宝盒
async checkExpiredTimeCapsules() {
  try {
    const result = await writingAPI.checkExpiredTimeCapsules();

    if (result.result.code === 0 && result.result.data.expiredCapsules && result.result.data.expiredCapsules.length > 0) {
      const expiredCapsules = result.result.data.expiredCapsules;
      
      // 将时光宝盒内容保存到驿站
      this.saveTimeCapsulesToMessenger(expiredCapsules);
      
      // 构建提示信息（只显示留言）
      let messageContent = `你有 ${expiredCapsules.length} 个时光宝盒已经到期：\n\n`;
      expiredCapsules.forEach((capsule, index) => {
        messageContent += `${index + 1}. `;
        if (capsule.message) {
          messageContent += `留言：${capsule.message}\n`;
        } else {
          messageContent += `无留言\n`;
        }
        messageContent += `   创建时间：${this.formatDate(capsule.create_time)}\n\n`;
      });
      
      // 显示提示
      wx.showModal({
        title: '时光宝盒提醒',
        content: messageContent,
        success: (res) => {
          if (res.confirm) {
            // 跳转到信使驿站
            wx.navigateTo({
              url: '/pages/messenger-station/messenger-station'
            });
          }
        }
      });
    }
  } catch (error) {
    console.error('检查时光宝盒失败:', error);
  }
},
  // 将时光宝盒内容保存到驿站
  saveTimeCapsulesToMessenger: function(expiredCapsules) {
    try {
      // 获取现有的驿站消息 - 使用正确的存储键
      const existingMessages = wx.getStorageSync('messengerStationMessages') || [];
      
      // 将时光宝盒转换为驿站消息格式
      const timeCapsuleMessages = expiredCapsules.map((capsule, index) => ({
        id: `timeCapsule_${Date.now()}_${index}`,
        type: 'timeCapsule',
        title: `时光宝盒 #${index + 1}`,
        content: capsule.content,
        message: capsule.message || '',
        createTime: capsule.create_time,
        openDate: capsule.openDate,
        articleId: capsule.articleId,
        language: capsule.language,
        vocabularyUsed: capsule.vocabularyUsed || [],
        read: false, // 使用 read 而不是 isRead，与驿站格式保持一致
        source: '时光宝盒',
        timestamp: new Date(capsule.create_time).getTime(),
        date: this.formatDate(capsule.create_time)
      }));
      
      // 将新消息添加到现有消息列表的开头
      const updatedMessages = [...timeCapsuleMessages, ...existingMessages];
      
      // 保存到本地存储 - 使用正确的存储键
      wx.setStorageSync('messengerStationMessages', updatedMessages);
      
      console.log('时光宝盒内容已保存到驿站:', timeCapsuleMessages);
    } catch (error) {
      console.error('保存时光宝盒到驿站失败:', error);
    }
  },


  // 标记时光宝盒为已提醒
  markCapsulesAsNotified: function(expiredCapsules) {
    const allCapsules = wx.getStorageSync('timeCapsules') || [];
    
    // 更新已过期的胶囊状态
    expiredCapsules.forEach(expiredCapsule => {
      const index = allCapsules.findIndex(c => c.id === expiredCapsule.id);
      if (index !== -1) {
        allCapsules[index].notified = true;
      }
    });
    
    // 保存更新后的数据
    wx.setStorageSync('timeCapsules', allCapsules);
  },
  
  // 跳转到时光宝盒页面
  navigateToTimeCapsulePage: function() {
    // Get time capsules from storage
    const capsules = wx.getStorageSync('timeCapsules') || [];
    
    // Filter expired capsules
    const now = new Date();
    const expiredCapsules = capsules.filter(capsule => {
      const openDate = new Date(capsule.openAt);
      return openDate <= now && !capsule.opened;
    });

    if (expiredCapsules.length === 0) {
      wx.showToast({
        title: '没有可查看的时光宝盒',
        icon: 'none'
      });
      return;
    }

    // Open the first expired capsule
    this.openTimeCapsule(expiredCapsules[0]);
  },
  
  // 打开时光宝盒
  openTimeCapsule: function(capsule) {
    // 标记胶囊为已打开
    const allCapsules = wx.getStorageSync('timeCapsules') || [];
    const index = allCapsules.findIndex(c => c.id === capsule.id);
    
    if (index !== -1) {
      allCapsules[index].opened = true;
      wx.setStorageSync('timeCapsules', allCapsules);
    }
    
    // 计算时间差
    const createdDate = new Date(capsule.create_time);
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 直接显示胶囊内容，不再显示额外的提示弹窗
    capsule.diffDays = diffDays; // 添加天数差信息
    this.showCapsuleContent(capsule);
  },
  
  // 显示胶囊详细内容
  showCapsuleContent: function(capsule) {
    this.setData({
      showCapsuleContentModal: true,
      currentCapsule: capsule
    });
  },
  
  // 关闭胶囊内容弹窗
  closeCapsuleContent: function() {
    this.setData({
      showCapsuleContentModal: false,
      currentCapsule: null
    });
    
    // 检查是否有其他未打开的胶囊
    const capsules = wx.getStorageSync('timeCapsules') || [];
    const now = new Date();
    const expiredCapsules = capsules.filter(capsule => {
      const openDate = new Date(capsule.openAt);
      return openDate <= now && !capsule.opened;
    });

    if (expiredCapsules.length > 0) {
      // 延迟一下再显示下一个胶囊的提示
      setTimeout(() => {
        wx.showModal({
          title: '还有更多时光宝盒',
          content: `您还有 ${expiredCapsules.length} 个时光宝盒可以查看，是否继续？`,
          confirmText: '继续查看',
          cancelText: '稍后再说',
          success: (res) => {
            if (res.confirm) {
              this.openTimeCapsule(expiredCapsules[0]);
            }
          }
        });
      }, 300);
    }
  },



  // 页面显示时触发


  // 获取学习卡片数据，从API获取而不使用模拟数据
  getCardDataForArticle: function(articleId, level) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 确定文章类型
    const type = this.data.selectedType; // 'news' 或 'classics'
    
    // 从API获取学习卡片数据
    api.getCardData(articleId, type)
      .then(data => {
        this.setData({
          wordCards: data.words || [],
          sentenceCards: data.phrases || []
        });
        wx.hideLoading();
      })
      .catch(error => {
        console.error('获取学习卡片数据失败:', error);
        
        wx.hideLoading();
        wx.showModal({
          title: '卡片数据加载失败',
          content: '无法从服务器获取学习卡片数据，请检查网络连接并重试。',
          showCancel: true,
          cancelText: '取消',
          confirmText: '重试',
          success: (res) => {
            if (res.confirm) {
              // 用户点击重试，重新加载数据
              this.getCardDataForArticle(articleId, level);
            }
          }
        });
      });
  },

  onUnload: function() {
    // 结束写作计时
    this.stopWritingTimer();
    
    // 计算总写作时间（分钟）
    const totalMinutes = Math.floor(accumulatedWritingTime / 60);
    console.log('写一写页面卸载，累计写作时间:', accumulatedWritingTime, '秒，折合', totalMinutes, '分钟');
    
    // 更新学习统计数据
    if (totalMinutes > 0) {
      // 检查是否有未同步的时间
      const lastSyncedMinutes = wx.getStorageSync('lastSyncedWriteMinutes') || 0;
      const unsyncedMinutes = totalMinutes - lastSyncedMinutes;
      
      console.log('上次同步的分钟数:', lastSyncedMinutes, '未同步的分钟数:', unsyncedMinutes);
      
      if (unsyncedMinutes > 0) {
        // 优先使用本地存储方式更新未同步的时间，确保数据可靠保存
        this.updateStudyStatsLocal('write', unsyncedMinutes, 0);
      }
      
      // 如果是第一次同步（没有实时同步过），则增加文章写作数量
      if (lastSyncedMinutes === 0) {
        this.updateStudyStatsLocal('write', 0, 1);
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
    wx.removeStorageSync('lastSyncedWriteMinutes');
  },

  onHide: function() {
    // 暂停计时
    this.pauseWritingTimer();
  },

  onShow: function() {
    // 恢复计时
    this.resumeWritingTimer();
    
    // 检查是否有到期的时光宝盒
    this.checkExpiredTimeCapsules();
  },

  startWritingTimer: function() {
    writingStartTime = new Date();
    
    // 每秒更新一次计时
    writingTimer = setInterval(() => {
      const now = new Date();
      const seconds = Math.floor((now - writingStartTime) / 1000);
      accumulatedWritingTime += 1;
      
      // 每分钟更新一次统计数据
      if (accumulatedWritingTime % 60 === 0) {
        console.log('写作时间累计:', Math.floor(accumulatedWritingTime / 60), '分钟');
        
        // 每分钟实时同步一次数据到本地存储
        const currentMinutes = Math.floor(accumulatedWritingTime / 60);
        if (currentMinutes > 0) {
          // 获取上次同步的分钟数
          const lastSyncedMinutes = wx.getStorageSync('lastSyncedWriteMinutes') || 0;
          const newMinutes = currentMinutes - lastSyncedMinutes;
          
          if (newMinutes > 0) {
            this.updateStudyStatsLocal('write', newMinutes, 0);
            wx.setStorageSync('lastSyncedWriteMinutes', currentMinutes);
            console.log('实时同步写作时长:', newMinutes, '分钟');
          }
        }
      }
    }, 1000);
  },

  pauseWritingTimer: function() {
    if (writingTimer) {
      clearInterval(writingTimer);
      writingTimer = null;
      
      // 计算已经写作的时间
      const now = new Date();
      const seconds = Math.floor((now - writingStartTime) / 1000);
      accumulatedWritingTime += seconds;
    }
  },

  resumeWritingTimer: function() {
    if (!writingTimer) {
      writingStartTime = new Date();
      this.startWritingTimer();
    }
  },

  stopWritingTimer: function() {
    if (writingTimer) {
      clearInterval(writingTimer);
      writingTimer = null;
      
      // 计算已经写作的时间
      const now = new Date();
      const seconds = Math.floor((now - writingStartTime) / 1000);
      accumulatedWritingTime += seconds;
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
    
    // 更新当天数据
    if (duration > 0) {
      studyStats[dateStr][type] += duration;
      console.log(`更新${type}时长: +${duration}分钟，当前总计: ${studyStats[dateStr][type]}分钟`);
    }
    
    if (count > 0) {
      const countKey = type + 'Articles';
      studyStats[dateStr][countKey] += count;
      studyStats.total[countKey] += count;
      console.log(`更新${type}数量: +${count}，当天总计: ${studyStats[dateStr][countKey]}，总计: ${studyStats.total[countKey]}`);
    }
    
    // 保存到本地存储
    try {
      wx.setStorageSync('studyStats', studyStats);
      console.log('学习统计数据保存成功:', studyStats[dateStr]);
    } catch (error) {
      console.error('保存学习统计数据失败:', error);
    }
  }
});