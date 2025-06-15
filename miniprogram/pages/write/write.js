// 写一写页面逻辑
const api = require('../../utils/api.js');

Page({
  data: {
    selectedType: 'news', // 默认选中热点信件
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
      'zh-TW': { code: 'zh-TW', name: '中文（繁体）', shortName: '繁体', flag: '🇨🇳' },
      'en': { code: 'en', name: '英语', shortName: '英语', flag: '🇬🇧' },
      'fr': { code: 'fr', name: '法语', shortName: '法语', flag: '🇫🇷' },
      'es': { code: 'es', name: '西班牙语', shortName: '西语', flag: '🇪🇸' },
      'de': { code: 'de', name: '德语', shortName: '德语', flag: '🇩🇪' },
      'it': { code: 'it', name: '意大利语', shortName: '意语', flag: '🇮🇹' },
      'ja': { code: 'ja', name: '日语', shortName: '日语', flag: '🇯🇵' },
      'pt-PT': { code: 'pt-PT', name: '葡萄牙语（葡萄牙）', shortName: '葡语', flag: '🇵🇹' },
      'pt-BR': { code: 'pt-BR', name: '葡萄牙语（巴西）', shortName: '巴葡', flag: '🇧🇷' },
      'ru': { code: 'ru', name: '俄语', shortName: '俄语', flag: '🇷🇺' },
      'ko': { code: 'ko', name: '韩语', shortName: '韩语', flag: '🇰🇷' }
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
  },

  onLoad: function() {
    // 初始化当前日期
    this.initCurrentDate();
    
    // 初始化语言选项
    this.initLanguageOptions();
    
    // 获取各等级新闻数据
    this.getNewsData();
    
    // 初始化调试模式
    this.setData({
      isDebugMode: false, // 默认不显示调试模式
      apiBaseUrl: api.BASE_URL || '未配置'
    });
    
    // 检测是否要启用调试模式（连续点击标题5次可开启）
    this.debugClickCount = 0;

    // 初始化时光宝盒相关日期
    this.initTimeCapsuleDates();

    // 检查是否有到期的时光宝盒
    this.checkExpiredTimeCapsules();
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
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    const displayDate = `${year}.${month}.${day}`;
    
    this.setData({
      selectedDate: formattedDate,
      formattedDate: displayDate
    });
  },
  
  // 日期变化处理
  onDateChange: function(e) {
    const date = e.detail.value; // 格式为 YYYY-MM-DD
    
    // 提取年份、月份和日期
    const parts = date.split('-');
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    
    // 格式化为显示格式
    const formattedDate = `${year}.${month}.${day}`;
    
    this.setData({
      selectedDate: date,
      formattedDate: formattedDate
    });
    
    // 根据新日期重新加载新闻数据
    this.getNewsData();
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
  getNewsData: function() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    try {
      // 使用模拟数据
      const mockData = {
        sprout: {
          articles: [
            {
              id: 'sprout_1',
              title: '春天的第一朵花',
              cover: '/images/sprout_1.jpg',
              content: '春天来了，第一朵花绽放了...'
            },
            {
              id: 'sprout_2',
              title: '小树苗的成长',
              cover: '/images/sprout_2.jpg',
              content: '小树苗在阳光和雨水的滋润下茁壮成长...'
            }
          ]
        },
        forest: {
          articles: [
            {
              id: 'forest_1',
              title: '森林的早晨',
              cover: '/images/forest_1.jpg',
              content: '清晨的阳光透过树叶洒落下来...'
            },
            {
              id: 'forest_2',
              title: '森林音乐会',
              cover: '/images/forest_2.jpg',
              content: '鸟儿在枝头歌唱，小溪在欢快地流淌...'
            }
          ]
        }
      };

      // 设置数据
      this.setData({
        sproutNews: mockData.sprout.articles,
        forestNews: mockData.forest.articles
      });
      
      // 默认选择第一个新闻项
      this.selectDefaultNewsItem();
      
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
  
  // 点击选择文章
  onNewsSelect: function(e) {
    const articleId = e.currentTarget.dataset.id;
    const level = e.currentTarget.dataset.level;
    
    // 获取当前选中的新闻数据
    let selectedNews;
    if (level === 'sprout') {
      selectedNews = this.data.sproutNews.find(item => item.id === articleId);
    } else if (level === 'forest') {
      selectedNews = this.data.forestNews.find(item => item.id === articleId);
    }
    
    if (selectedNews) {
      // 设置当前选中的文章
      this.setData({
        currentArticle: selectedNews
      });
      
      // 加载文章相关的词汇
      this.loadArticleVocabulary(articleId);
      
      // 显示提示面板
      this.setData({
        showPromptPanel: true
      });
      
      wx.showToast({
        title: `已选择"${selectedNews.title}"`,
        icon: 'none',
        duration: 1500
      });
    }
  },
  
  // 加载文章相关词汇
  loadArticleVocabulary: function(articleId) {
    wx.showLoading({
      title: '加载词汇...',
      mask: true
    });
    
    // 添加超时处理，但不使用模拟数据
    let timeoutId = setTimeout(() => {
      console.log('词汇加载超时');
      
      wx.hideLoading();
      wx.showModal({
        title: '加载超时',
        content: '词汇数据加载超时，请检查网络连接并重试。',
        showCancel: true,
        cancelText: '取消',
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            // 用户点击重试，重新加载数据
            this.loadArticleVocabulary(articleId);
          }
        }
      });
      
      // 标记为已超时，防止后续回调重复执行
      timeoutId = null;
    }, 10000); // 延长超时时间到10秒
    
    // 获取选定的语言数组
    const selectedLanguages = [];
    if (this.data.selectedLanguage1 && this.data.selectedLanguage1.code) {
      selectedLanguages.push(this.data.selectedLanguage1.code);
    }
    if (this.data.selectedLanguage2 && this.data.selectedLanguage2.code) {
      selectedLanguages.push(this.data.selectedLanguage2.code);
    }
    
    console.log('加载词汇使用的语言:', selectedLanguages);
    
    // 尝试从本地存储或通过API加载文章词汇，同时传递语言参数
    api.getArticleVocabulary(articleId, 'zh-CN', selectedLanguages)
      .then(vocabulary => {
        // 如果还未超时，处理返回的数据
        if (timeoutId) {
          clearTimeout(timeoutId);
          
          this.setData({
            vocabularyList: vocabulary || [],
            showPromptPanel: true
          });
          
          wx.hideLoading();
        }
      })
      .catch(error => {
        // 如果还未超时，处理错误情况
        if (timeoutId) {
          clearTimeout(timeoutId);
          
          console.error('加载文章词汇失败:', error);
          
          wx.hideLoading();
          wx.showModal({
            title: '词汇加载失败',
            content: '无法从服务器获取词汇数据，请检查网络连接并重试。',
            showCancel: true,
            cancelText: '取消',
            confirmText: '重试',
            success: (res) => {
              if (res.confirm) {
                // 用户点击重试，重新加载数据
                this.loadArticleVocabulary(articleId);
              }
            }
          });
        }
      })
      .finally(() => {
        // 确保加载指示器被隐藏，即使Promise链中有未捕获的错误
        if (timeoutId) {
          clearTimeout(timeoutId);
          wx.hideLoading();
        }
      });
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
      
      // 如果当前已选择文章，则重新加载该文章的词汇（使用新选择的语言）
      if (this.data.currentArticle && this.data.currentArticle.id) {
        this.loadArticleVocabulary(this.data.currentArticle.id);
      }
    }
  },
  
  // 初始化语言选项
  initLanguageOptions: function() {
    const languageOptions = Object.values(this.data.languageMap);
    
    // 从本地存储获取读一读页面选择的语言
    const savedLanguages = wx.getStorageSync('selectedLanguages') || [];
    console.log('写一写页面获取到的语言选择:', savedLanguages);
    
    // 如果有保存的语言选择，使用它们
    let language1 = this.data.languageMap['zh-TW']; // 默认第一语言
    let language2 = this.data.languageMap['en'];    // 默认第二语言
    let index1 = 0;
    let index2 = 1;
    
    if (savedLanguages.length > 0) {
      // 找到第一个语言的索引
      const lang1Code = savedLanguages[0];
      language1 = this.data.languageMap[lang1Code] || language1;
      index1 = languageOptions.findIndex(item => item.code === lang1Code);
      if (index1 === -1) index1 = 0;
    }
    
    if (savedLanguages.length > 1) {
      // 找到第二个语言的索引
      const lang2Code = savedLanguages[1];
      language2 = this.data.languageMap[lang2Code] || language2;
      index2 = languageOptions.findIndex(item => item.code === lang2Code);
      if (index2 === -1) index2 = 1;
    }
    
    this.setData({ 
      languageOptions: languageOptions,
      selectedLanguage1: language1,
      selectedLanguage2: language2,
      compareIndex1: index1,
      compareIndex2: index2
    });
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
  submitWriting: function() {
    const content = this.data.writingContent;
    
    if (!content.trim()) {
      wx.showToast({
        title: '请先输入写作内容',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 显示加载中提示
    wx.showLoading({
      title: '正在保存...',
      mask: true
    });
    
    // 构建要保存的写作内容数据
    const writingData = {
      content: content,
      date: this.data.formattedDate, // 已格式化的日期 YYYY.MM.DD
      formattedDate: this.data.formattedDate, // 确保有专门的日期字段
      type: this.data.selectedType,
      title: this.data.currentArticle ? this.data.currentArticle.title : '我的写作',
      language: this.data.selectedLanguage1 ? this.data.selectedLanguage1.code : 'zh'
    };
    
    // 如果有关联文章，添加文章ID
    if (this.data.currentArticle && this.data.currentArticle.id) {
      writingData.articleId = this.data.currentArticle.id;
    }
    
    // 保存到本地存储
    try {
      // 获取已有的信使驿站消息列表
      const existingMessages = wx.getStorageSync('messengerStationMessages') || [];
      
      // 添加新的写作内容，并添加唯一ID和时间戳
      writingData.id = Date.now().toString();
      writingData.timestamp = new Date().getTime();
      writingData.read = false; // 新消息默认未读
      writingData.source = this.data.selectedType === 'news' ? '「晓」见闻' : '「晓」经典'; // 根据文章类型设置来源
      
      console.log('Saving writing data:', writingData); // 添加调试日志
      
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
    } catch (error) {
      console.error('保存写作内容失败:', error);
      wx.hideLoading();
      wx.showModal({
        title: '保存失败',
        content: '无法保存到信使驿站，请稍后再试',
        showCancel: false
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
      '我在九域写的文章';
    
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
      '我在九域写的文章';
    
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
            ctx.fillText('九域 · 写一写', width / 2, height - 25);
            
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
          currentLevelIndex: 0
        });
        this.onNewsSelect({
          currentTarget: {
            dataset: {
              id: this.data.sproutNews[0].id,
              level: 'sprout'
            }
          }
        });
        return;
      } else if (this.data.forestNews.length > 0) {
        this.setData({
          currentLevel: 'forest',
          currentLevelIndex: 1
        });
        this.onNewsSelect({
          currentTarget: {
            dataset: {
              id: this.data.forestNews[0].id,
              level: 'forest'
            }
          }
        });
        return;
      }
    } else if (newsList.length > 0) {
      // 选择当前难度等级的第一个新闻
      this.onNewsSelect({
        currentTarget: {
          dataset: {
            id: newsList[0].id,
            level: this.data.currentLevel
          }
        }
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
    const year = date.getFullYear().toString().slice(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  },

  // 显示词汇翻译
  showTranslation: function(e) {
    const index = e.currentTarget.dataset.index;
    
    // 如果点击的是当前已显示翻译的词汇，则隐藏翻译
    if (this.data.currentTranslationIndex === index) {
      this.setData({
        currentTranslationIndex: -1
      });
    } else {
      // 否则显示该词汇的翻译
      this.setData({
        currentTranslationIndex: index
      });
      
      // 获取用户选择的语言
      const selectedLanguage = this.data.selectedLanguage1;
      const selectedLangCode = selectedLanguage ? selectedLanguage.code : 'zh';
      const vocabulary = this.data.vocabularyList[index];
      
      // 记录用户点击词汇的行为（可用于后台统计或提高词汇推荐效果）
      console.log('用户点击词汇:', {
        word: vocabulary.text,
        selectedLanguage: selectedLangCode,
        availableTranslation: vocabulary.translations[selectedLangCode] ? true : false
      });
      
      // 如果选择的语言没有对应翻译，这里可以调用API获取翻译（在实际应用中）
      if (selectedLanguage && !vocabulary.translations[selectedLangCode] && selectedLangCode !== 'zh') {
        console.log('需要获取翻译：', vocabulary.text, '→', selectedLangCode);
        
        // 在实际应用中，可以在这里调用翻译API
        // api.getTranslation(vocabulary.text, selectedLangCode)
        //   .then(translation => {
        //     // 更新词汇翻译
        //     const updatedVocabulary = this.data.vocabularyList;
        //     updatedVocabulary[index].translations[selectedLangCode] = translation;
        //     this.setData({
        //       vocabularyList: updatedVocabulary
        //     });
        //   });
      }
    }
  },

  // 阻止事件冒泡
  stopPropagation: function(e) {
    // 防止事件冒泡，避免关闭面板
    return;
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
      customDate = this.formatDate(date);
    } else if (option === 'month') {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      customDate = this.formatDate(date);
    } else if (option === 'halfYear') {
      const date = new Date();
      date.setMonth(date.getMonth() + 6);
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
      customDate: date,
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
  createTimeCapsule: function() {
    if (!this.data.customDate) {
      wx.showToast({
        title: '请选择开启日期',
        icon: 'none'
      });
      return;
    }
    
    // 获取写作内容和相关信息
    const capsuleData = {
      id: 'tc_' + Date.now(),
      content: this.data.writingContent,
      message: this.data.futureSelfMessage || '记录当下，见证成长',
      createdAt: new Date().toISOString(),
      openAt: new Date(this.data.customDate).toISOString(),
      article: this.data.currentArticle ? {
        id: this.data.currentArticle.id,
        title: this.data.currentArticle.title,
        cover: this.data.currentArticle.cover
      } : null,
      language: this.data.selectedLanguage1 ? {
        code: this.data.selectedLanguage1.code,
        name: this.data.selectedLanguage1.name,
        flag: this.data.selectedLanguage1.flag
      } : null,
      vocabularyUsed: this.data.vocabularyList.map(item => item.text) // 记录写作中使用的词汇
    };
    
    try {
      // 从存储中获取已有的时光宝盒
      const existingCapsules = wx.getStorageSync('timeCapsules') || [];
      
      // 添加新的时光宝盒
      existingCapsules.push(capsuleData);
      
      // 保存到存储
      wx.setStorageSync('timeCapsules', existingCapsules);
      
      // 设置开启提醒
      this.scheduleTimeCapsuleReminder(capsuleData);
      
      // 保存成功提示
      wx.showToast({
        title: '时光宝盒已创建',
        icon: 'success',
        duration: 2000
      });
      
      // 关闭模态框
      this.hideTimeCapsuleModal();
      
      // 显示成功动画
      this.showSuccessAnimation(capsuleData);
    } catch (error) {
      console.error('保存时光宝盒失败:', error);
      wx.showModal({
        title: '保存失败',
        content: '无法创建时光宝盒，请稍后再试',
        showCancel: false
      });
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
    // 可以添加一个成功动画效果
    // 这里简单使用一个提示框展示胶囊信息
    const openDate = new Date(capsuleData.openAt);
    
    wx.showModal({
      title: '时光宝盒已启程',
      content: `您的写作内容已被封存，将在 ${this.formatDateForDisplay(openDate)} 重新开启，届时我们会提醒您查看。`,
      showCancel: false,
      confirmText: '知道了'
    });
  },
  
  // 检查是否有到期的时光宝盒
  checkExpiredTimeCapsules: function() {
    const capsules = wx.getStorageSync('timeCapsules') || [];
    const now = new Date();
    const expiredCapsules = capsules.filter(capsule => {
      const openDate = new Date(capsule.openAt);
      return openDate <= now && !capsule.opened;
    });
    
    if (expiredCapsules.length > 0) {
      // 显示有胶囊可以开启的提示
      wx.showModal({
        title: '时光宝盒提醒',
        content: `您有 ${expiredCapsules.length} 个时光宝盒已经可以开启！是否现在查看？`,
        confirmText: '立即查看',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            // 跳转到时光宝盒页面
            this.navigateToTimeCapsulePage();
          }
        }
      });
      
      // 标记时光宝盒为已提醒
      this.markCapsulesAsNotified(expiredCapsules);
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
    const createdDate = new Date(capsule.createdAt);
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

  // 格式化日期为显示格式 YYYY.MM.DD
  formatDateForDisplay: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  },

  // 页面显示时触发
  onShow: function() {
    // 检查是否有从信使驿站页面传递过来的文章信息
    const app = getApp();
    if (app.globalData && app.globalData.selectedArticleFromMessenger) {
      const articleInfo = app.globalData.selectedArticleFromMessenger;
      
      // 清除全局变量，防止重复加载
      app.globalData.selectedArticleFromMessenger = null;
      
      if (articleInfo.fromMessenger && articleInfo.id) {
        // 根据文章ID加载对应词汇
        this.loadArticleVocabulary(articleInfo.id);
        
        wx.showToast({
          title: '词汇已加载',
          icon: 'success',
          duration: 1500
        });
      }
    }
  },

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
}); 