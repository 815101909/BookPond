const languageManager = require('../../utils/language');

Page({
  data: {
    newsId: '',
    classicsDetail: {
      title: '量子计算新突破：我国科学家实现"祖冲之号"升级',
      coverUrl: '/images/news/quantum.jpg',
      highlights: '我国科学家在量子计算领域取得重大突破，量子比特数量从56个提升到66个',
      titleTranslations: [], // 存储标题翻译
      content: [
        '近日，我国科学家在量子计算领域取得重大突破。研究团队成功实现了"祖冲之号"超导量子计算原型机的升级，量子比特数量从56个提升到66个，计算能力显著提升。这一成果标志着我国在量子计算领域的研究水平已跻身世界前列。',
        '专家表示，量子计算的发展将对人工智能、材料科学、药物研发等领域产生深远影响。未来，量子计算机有望在几分钟内解决传统计算机需要数百年才能完成的计算任务。这项技术的突破将为我国科技创新和产业发展带来新的机遇。',
        '研究团队负责人表示，下一步将继续优化量子计算原型机的性能，并探索更多实际应用场景。同时，团队也将加强与国际同行的交流合作，共同推动量子计算技术的发展，为人类科技进步贡献力量。'
      ],
      sentenceTranslations: []
    },
    translations: [],
    selectedLanguages: [], // 用户选择的语言列表
    fontSize: 25, // 默认字体大小改为25pt
    isPlaying: false, // 背景音乐播放状态
    isFavorite: false, // 收藏状态
    audioContext: null, // 音频上下文
    sourceAudioContext: null, // 添加源语言音频上下文
    contentAudioContext: null, // 正文朗读音频上下文
    isContentPlaying: false, // 正文朗读状态
    audioProgress: 0, // 音频播放进度
    isUploading: false,
    pendingTranslations: [], // 存储待处理的翻译
    isTranslating: false, // 翻译处理状态
    showContent: false, // 控制经典内容区域的显示状态，默认展开
    showTranslation: true, // 控制翻译区域的显示状态，默认折叠
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
    currentLanguage: 'zh', // 当前选中的语言
    currentIndex: 0, // 当前滑动页面的索引
    languageOptions: [], // 对照语言选项列表
    showPrintArea: false,  // 控制打印区域显示状态
    printMode: 'full',     // 打印模式：full-全文对照，sentence-逐句对照
    printLanguage: 'zh',   // 全文对照打印时选择的语言
    selectedPrintLanguages: {},  // 逐句对照打印时选择的语言，格式为 {languageCode: true/false}
    printFontSize: 10.5,    // 打印区域的字体大小，默认为10.5px
    difficultyOptions: [
      { value: '萌芽岛', label: '萌芽岛' },
      { value: '破茧谷', label: '破茧谷' },
      { value: '翱翔峰', label: '翱翔峰' }
    ],
  },

  onLoad: function(options) {
    if (options.id) {
      // 从URL参数中获取选中的语言
      let selectedLanguages = [];
      try {
        selectedLanguages = JSON.parse(options.languages || '[]');
      } catch (e) {
        console.error('解析语言参数失败:', e);
        // 如果解析失败，尝试从本地存储获取
        selectedLanguages = wx.getStorageSync('selectedLanguages') || [];
      }
      
      console.log('新闻详情页面加载时获取的语言选择:', selectedLanguages);
      
      // 转换语言代码为完整的语言信息
      const fullSelectedLanguages = selectedLanguages.map(code => ({
        code: code,
        name: this.data.languageMap[code]?.name || code,
        flag: this.data.languageMap[code]?.flag || ''
      }));
      
      // 生成语言选项列表
      const languageOptions = Object.keys(this.data.languageMap).map(code => ({
        code: code,
        name: this.data.languageMap[code].name,
        flag: this.data.languageMap[code].flag
      }));
      
      this.setData({
        newsId: options.id,
        selectedLanguages: fullSelectedLanguages,
        languageOptions: languageOptions,
        currentIndex: 0,
        currentLanguage: 'zh'
      }, () => {
        console.log('设置后的语言选择:', this.data.selectedLanguages);
        this.fetchNewsDetail(options.id);
      });
      
      this.initAudioContext();

      // 获取classics id
      const classicsId = options.id || '';
      this.setData({
        classicsId: classicsId
      });

      // 查询文章是否已经收藏
      this.checkIfFavorited(classicsId);
    }
  },

  onShow: function() {
    // 每次页面显示时重新获取语言选择
    const languages = wx.getStorageSync('selectedLanguages') || [];
    console.log('新闻详情页面显示时获取的语言选择:', languages);
    
    // 转换语言代码为完整的语言信息
    const fullSelectedLanguages = languages.map(code => ({
      code: code,
      name: this.data.languageMap[code]?.name || code,
      flag: this.data.languageMap[code]?.flag || ''
    }));
    
    if (JSON.stringify(fullSelectedLanguages) !== JSON.stringify(this.data.selectedLanguages)) {
      console.log('语言选择发生变化，更新翻译');
      this.setData({ 
        selectedLanguages: fullSelectedLanguages,
        currentIndex: 0,
        currentLanguage: 'zh'
      }, () => {
        if (this.data.newsId) {
          this.fetchNewsDetail(this.data.newsId);
        }
      });
    }
  },

  onUnload: function() {
    if (this.data.audioContext) {
      this.data.audioContext.stop();
    }
    if (this.data.contentAudioContext) {
      this.data.contentAudioContext.stop();
    }
    // 清理音频资源
    if (this.data.audioContext) {
      this.data.audioContext.destroy();
    }
    if (this.data.sourceAudioContext) {
      this.data.sourceAudioContext.destroy();
    }
  },

  initAudioContext: function() {
    const audioContext = wx.createInnerAudioContext();
    audioContext.src = '/soundinging/背景音乐.mp3';
    audioContext.loop = true;
    audioContext.volume = 0.15;
    audioContext.play(); // 自动播放背景音乐
    
    // 初始化内容朗读音频上下文
    const contentAudioContext = wx.createInnerAudioContext();
    // 这里预留接口，到时候直接使用后台传递的音频链接
    contentAudioContext.src = this.data.classicsDetail?.contentAudioUrl || '/audio/content-reading.mp3';
    
    // 监听播放进度变化
    contentAudioContext.onTimeUpdate(() => {
      if (contentAudioContext.duration > 0) {
        const progress = (contentAudioContext.currentTime / contentAudioContext.duration) * 100;
        this.setData({
          audioProgress: progress
        });
      }
    });
    
    // 监听播放结束
    contentAudioContext.onEnded(() => {
      this.setData({
        isContentPlaying: false,
        audioProgress: 0
      });
    });

    // 监听播放错误
    contentAudioContext.onError((res) => {
      console.error('音频播放错误:', res);
      wx.showToast({
        title: '音频加载失败',
        icon: 'none'
      });
      this.setData({
        isContentPlaying: false,
        audioProgress: 0
      });
    });
    
    this.setData({
      audioContext: audioContext,
      contentAudioContext: contentAudioContext,
      sourceAudioContext: wx.createInnerAudioContext(),
      isPlaying: true // 设置初始播放状态为true
    });
  },

  increaseFontSize: function() {
    const newSize = Math.min(this.data.fontSize + 2, 40);
    const newPrintSize = Math.min(this.data.printFontSize + 0.5, 16);
    this.setData({
      fontSize: newSize,
      printFontSize: newPrintSize
    });
    this.updatePrintFontSize();
  },

  decreaseFontSize: function() {
    const newSize = Math.max(this.data.fontSize - 2, 24);
    const newPrintSize = Math.max(this.data.printFontSize - 0.5, 8);
    this.setData({
      fontSize: newSize,
      printFontSize: newPrintSize
    });
    this.updatePrintFontSize();
  },

  toggleMusic: function() {
    const audioContext = this.data.audioContext;
    if (this.data.isPlaying) {
      audioContext.pause();
    } else {
      audioContext.play();
    }
    this.setData({
      isPlaying: !this.data.isPlaying
    });
  },

  toggleFavorite: function() {
    const isFavorite = !this.data.isFavorite;
    this.setData({
      isFavorite: isFavorite
    });
    
    // 获取当前文章信息
    const article = {
      id: this.data.classicsDetail.id || 'classics-' + Date.now(),
      title: this.data.classicsDetail.title,
      description: this.data.classicsDetail.highlights || this.data.classicsDetail.summary,
      image: this.data.classicsDetail.coverUrl,
      date: this.data.classicsDetail.date || new Date().toISOString().split('T')[0],
      category: this.data.classicsDetail.category || '萌芽岛',
      type: 'classics' // 标记为经典类型
    };
    
    // 获取已收藏的文章
    const favoriteArticles = wx.getStorageSync('favoriteArticles') || [];
    
    if (isFavorite) {
      // 添加到收藏
      const existingIndex = favoriteArticles.findIndex(item => item.id === article.id);
      if (existingIndex === -1) {
        favoriteArticles.push(article);
        wx.setStorageSync('favoriteArticles', favoriteArticles);
      }
      
      wx.showToast({
        title: '已加入收藏',
        icon: 'success',
        duration: 1500
      });
    } else {
      // 从收藏中移除
      const newFavorites = favoriteArticles.filter(item => item.id !== article.id);
      wx.setStorageSync('favoriteArticles', newFavorites);
      
      wx.showToast({
        title: '已取消收藏',
        icon: 'none',
        duration: 1500
      });
    }
  },

  fetchNewsDetail: function(newsId) {
    console.log('当前选中的语言:', this.data.selectedLanguages);

    // 模拟API返回的经典详情数据
    const mockData = {
      id: newsId,
      title: '傲慢与偏见',
      coverUrl: '/images/classics/pride.jpg',
      highlights: '简·奥斯汀的代表作，描写了19世纪英国乡绅阶层的爱情与婚姻',
      category: '文学',
      publishDate: '2024-03-20', // 使用文章上传时间
      difficulty: '翱翔峰', // 使用文章实际难度
      content: [
        '伊丽莎白·班纳特是班纳特家五个女儿中的第二个。她聪明、机智，对生活充满热情。在一个舞会上，她遇到了富有的达西先生，但两人之间产生了误解。',
        '达西先生最初对伊丽莎白表现出傲慢的态度，而伊丽莎白则对他抱有偏见。然而，随着故事的发展，两人逐渐了解了对方的真实性格。',
        '在经历了一系列的误会和考验后，达西先生向伊丽莎白表白，承认了自己的傲慢，并请求她的原谅。伊丽莎白也认识到自己的偏见，最终接受了达西先生的求婚。',
        '这部小说不仅讲述了一个浪漫的爱情故事，更深刻地反映了当时英国社会的婚姻观、阶级观念和女性地位。通过伊丽莎白和达西的故事，作者简·奥斯汀展现了爱情与婚姻中的成长与改变。'
      ],
      translations: {} // 用于存储不同语言的翻译
    };

    // 为所有选中的语言预加载翻译
    if (this.data.selectedLanguages && this.data.selectedLanguages.length > 0) {
      // 预加载翻译
      this.data.selectedLanguages.forEach(lang => {
        mockData.translations[lang.code] = mockData.content.map(text => {
          // 这里应该调用翻译API获取实际翻译
          // 暂时使用模拟数据，但去掉语言标识前缀
          // 简单模拟通过在原文前添加不同长度的空格来区分不同语言的翻译
          if (lang.code === 'en') {
            return text; // 英语翻译（示例）
          } else if (lang.code === 'fr') {
            return text; // 法语翻译（示例）
          } else if (lang.code === 'de') {
            return text; // 德语翻译（示例）
          } else {
            return text; // 其他语言翻译
          }
        });
      });
      
      // 预加载标题翻译 - 只取前两个语言
      const titleTranslations = [];
      for (let i = 0; i < Math.min(2, this.data.selectedLanguages.length); i++) {
        const lang = this.data.selectedLanguages[i];
        titleTranslations.push({
          language: lang.code,
          languageName: lang.name,
          flag: lang.flag,
          text: "" // 设置为空字符串，等待用户输入或后台上传
        });
      }
      mockData.titleTranslations = titleTranslations;
    }

    // 处理句子翻译数据 - 确保在晓翻译部分只展示选择的语言
    const sentenceTranslations = mockData.content.map(text => ({
      original: text,
      isExpanded: true,
      isPlaying: false,
      translations: this.data.selectedLanguages && this.data.selectedLanguages.length > 0 ? 
        this.data.selectedLanguages.map(lang => ({
          language: lang.code,
          languageName: lang.name,
          flag: lang.flag,
          text: text // 去掉语言标识前缀，直接显示翻译文本
        })) : []
    }));

    // 更新数据
    this.setData({
      classicsDetail: {
        ...mockData,
        sentenceTranslations: sentenceTranslations,
        type: 'news' // 确保显示翻译部分
      }
    }, () => {
      console.log('更新后的翻译数据:', this.data.classicsDetail.sentenceTranslations);
    });
  },

  getLanguageCode: function(language) {
    const languageCodeMap = {
      '英语': 'en',
      '德语': 'de',
      '法语': 'fr',
      '西班牙语': 'es'
    };
    return languageCodeMap[language] || language;
  },

  getLanguageName: function(code) {
    return this.data.languageMap[code]?.name || code;
  },

  toggleSentence: function(e) {
    const index = e.currentTarget.dataset.index;
    const sentenceTranslations = this.data.classicsDetail.sentenceTranslations;
    sentenceTranslations[index].isExpanded = !sentenceTranslations[index].isExpanded;
    this.setData({
      'classicsDetail.sentenceTranslations': sentenceTranslations
    });
  },

  // 处理标签切换
  handleTabClick: function(e) {
    const language = e.currentTarget.dataset.lang;
    const index = parseInt(e.currentTarget.dataset.index) || 0;
    
    // 如果正在播放音频，则停止
    if (this.data.isContentPlaying) {
      this.data.contentAudioContext.pause();
      this.setData({
        isContentPlaying: false,
        audioProgress: 0
      });
    }
    
    this.setData({
      currentLanguage: language,
      currentIndex: index
    });
  },

  // 处理滑动切换
  handleSwiperChange: function(e) {
    const index = e.detail.current;
    let language = 'zh';
    
    if (index > 0 && this.data.selectedLanguages.length >= index) {
      // 索引从1开始的是对照语言
      language = this.data.selectedLanguages[index - 1].code;
    }
    
    // 如果正在播放音频，则停止
    if (this.data.isContentPlaying) {
      this.data.contentAudioContext.pause();
      this.setData({
        isContentPlaying: false,
        audioProgress: 0
      });
    }
    
    this.setData({
      currentIndex: index,
      currentLanguage: language
    });
  },

  // 获取特定语言的翻译
  fetchTranslation: function(languageCode) {
    // 这里应该是调用翻译API获取翻译
    // 现在使用模拟数据，但去掉语言标识前缀
    const mockTranslation = this.data.classicsDetail.content.map(text => {
      // 简单模拟通过在原文前添加不同长度的空格来区分不同语言的翻译
      if (languageCode === 'en') {
        return text; // 英语翻译（示例）
      } else if (languageCode === 'fr') {
        return text; // 法语翻译（示例）
      } else if (languageCode === 'de') {
        return text; // 德语翻译（示例）
      } else {
        return text; // 其他语言翻译
      }
    });
    
    // 更新翻译数据
    const classicsDetail = this.data.classicsDetail;
    classicsDetail.translations[languageCode] = mockTranslation;
    
    this.setData({
      classicsDetail: classicsDetail
    });
  },

  // 更新翻译数据（用于外部调用）
  updateTranslations: function(translatedData) {
    // 扩展功能，如果需要从外部更新翻译数据
    const classicsDetail = this.data.classicsDetail;
    
    Object.keys(translatedData).forEach(langCode => {
      classicsDetail.translations[langCode] = translatedData[langCode];
    });
    
    this.setData({
      classicsDetail: classicsDetail
    });
  },

  // 切换正文朗读状态
  toggleContentAudio: function() {
    const contentAudioContext = this.data.contentAudioContext;
    const currentLanguage = this.data.currentLanguage;
    
    if (this.data.isContentPlaying) {
      contentAudioContext.pause();
    } else {
      // 如果是从暂停恢复，直接播放；如果是重新开始，先停止所有正在播放的音频
      this.stopAllAudioExceptBackground();
      
      // 根据当前选择的语言选择对应的音频
      if (currentLanguage !== 'zh') {
        // 使用对应语言的音频链接，优先使用服务器返回的链接
        const audioUrl = this.data.classicsDetail?.contentAudioUrls?.[currentLanguage] || `/audio/content-${currentLanguage}.mp3`;
        console.log('播放', currentLanguage, '语言的朗读:', audioUrl);
        contentAudioContext.src = audioUrl;
      } else {
        // 中文的音频路径，优先使用服务器返回的链接
        const audioUrl = this.data.classicsDetail?.contentAudioUrl || '/audio/content-zh.mp3';
        console.log('播放中文朗读:', audioUrl);
        contentAudioContext.src = audioUrl;
      }
      
      // 重置播放进度
      this.setData({ audioProgress: 0 });
      
      // 开始播放
      contentAudioContext.play();
    }
    
    this.setData({
      isContentPlaying: !this.data.isContentPlaying
    });
  },

  // 切换经典内容区域的显示状态
  toggleContent: function() {
    this.setData({
      showContent: !this.data.showContent
    });
  },
  
  // 切换翻译区域的显示状态
  toggleTranslation: function() {
    this.setData({
      showTranslation: !this.data.showTranslation
    });
  },

  // 打印内容
  printContent: function() {
    // 初始化打印语言设置
    const selectedPrintLanguages = {};
    
    // 只默认选中第一个对照语言
    if (this.data.selectedLanguages.length > 0) {
      selectedPrintLanguages[this.data.selectedLanguages[0].code] = true;
    }
    
    this.setData({
      showPrintArea: true,
      printMode: 'full',
      printLanguage: 'zh',
      selectedPrintLanguages: selectedPrintLanguages
    });
  },
  
  // 关闭打印区域
  closePrintArea: function() {
    this.setData({
      showPrintArea: false
    });
  },
  
  // 切换打印模式
  switchPrintMode: function(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      printMode: mode
    });
  },
  
  // 切换全文对照打印语言
  switchPrintLanguage: function(e) {
    const lang = e.currentTarget.dataset.lang;
    this.setData({
      printLanguage: lang
    });
  },
  
  // 切换逐句对照打印语言显示状态
  togglePrintLanguage: function(e) {
    const lang = e.currentTarget.dataset.lang;
    const selectedPrintLanguages = {};
    
    // Clear all selections first, then only enable the selected language
    this.data.selectedLanguages.forEach(language => {
      selectedPrintLanguages[language.code] = false;
    });
    selectedPrintLanguages[lang] = !this.data.selectedPrintLanguages[lang];
    
    this.setData({
      selectedPrintLanguages: selectedPrintLanguages
    });
  },

  // 更新打印区域的字体大小
  updatePrintFontSize: function() {
    // 更新打印区域中所有需要调整字体大小的元素
    const size = this.data.printFontSize;
    // 调整行高，使较大字体有更宽松的行间距
    const lineHeight = size > 12 ? 1.6 : 1.8;
    
    // 为了确保内容不会溢出A4区域，根据字体大小设置不同的缩放比例
    const contentScale = size > 12 ? 0.95 : 1; // 字体较大时稍微缩小整体内容
    
    this.setData({
      // 更新CSS变量或直接设置样式
      'printStyles.paragraph': `font-size: ${size}px; line-height: ${lineHeight};`,
      'printStyles.original': `font-size: ${size}px; line-height: ${lineHeight};`,
      'printStyles.translation': `font-size: ${size * 0.85}px; line-height: ${lineHeight};`, // 翻译文本稍小
      'printStyles.content': `transform: scale(${contentScale}); transform-origin: top left;` // 整体内容缩放
    });
    
    // 调整内容后，监听下一个渲染周期，检查是否需要进一步调整
    setTimeout(() => {
      this.checkContentOverflow();
    }, 50);
  },
  
  // 检查内容是否溢出A4区域
  checkContentOverflow: function() {
    const query = wx.createSelectorQuery();
    query.select('.print-content').boundingClientRect();
    query.select('.print-area').boundingClientRect();
    
    query.exec((res) => {
      if (res.length >= 2) {
        const contentRect = res[0];
        const areaRect = res[1];
        
        // 如果内容高度超过容器高度，进一步缩小内容
        if (contentRect && areaRect && contentRect.height > areaRect.height) {
          const scale = this.data.printFontSize > 12 ? 0.9 : 0.95; // 更强的缩放
          
          this.setData({
            'printStyles.content': `transform: scale(${scale}); transform-origin: top left;`
          });
        }
      }
    });
  },

  // 播放源语言音频
  playSourceAudio: function(e) {
    // 获取数据
    const sentenceIndex = e.currentTarget.dataset.sentenceIndex;
    console.log('点击播放源语言:', sentenceIndex);
    
    // 获取句子数据的深拷贝
    const sentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
    const sentence = sentenceTranslations[sentenceIndex];
    
    if (!sentence) {
      console.error('未找到句子:', sentenceIndex);
      return;
    }
    
    // 获取音频上下文
    const sourceAudioContext = this.data.sourceAudioContext;
    
    // 如果当前正在播放，则暂停
    if (sentence.isPlaying) {
      console.log('当前正在播放，暂停音频');
      sourceAudioContext.pause();
      
      // 更新播放状态
      sentence.isPlaying = false;
      this.setData({
        'classicsDetail.sentenceTranslations': sentenceTranslations
      });
      return;
    }
    
    // 停止所有正在播放的音频（除了背景音乐）
    this.stopAllAudioExceptBackground();
    
    // 设置音频源
    const audioUrl = sentence.audioUrl || '/audio/default-source.mp3';
    console.log('设置音频源:', audioUrl);
    sourceAudioContext.src = audioUrl;
    
    // 播放音频
    sourceAudioContext.play();
    console.log('开始播放音频');
    
    // 更新播放状态
    sentence.isPlaying = true;
    sentence.progress = 0;
    this.setData({
      'classicsDetail.sentenceTranslations': sentenceTranslations
    });
    
    // 监听播放进度
    sourceAudioContext.onTimeUpdate(() => {
      if (sourceAudioContext.duration > 0) {
        // 计算进度
        const progress = (sourceAudioContext.currentTime / sourceAudioContext.duration) * 100;
        
        // 获取最新的状态
        const currentSentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
        if (currentSentenceTranslations[sentenceIndex]) {
          currentSentenceTranslations[sentenceIndex].progress = progress;
          this.setData({
            'classicsDetail.sentenceTranslations': currentSentenceTranslations
          });
        }
      }
    });
    
    // 监听播放结束
    sourceAudioContext.onEnded(() => {
      console.log('音频播放结束');
      const currentSentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
      if (currentSentenceTranslations[sentenceIndex]) {
        currentSentenceTranslations[sentenceIndex].isPlaying = false;
        currentSentenceTranslations[sentenceIndex].progress = 0;
        this.setData({
          'classicsDetail.sentenceTranslations': currentSentenceTranslations
        });
      }
    });
    
    // 监听错误
    sourceAudioContext.onError((res) => {
      console.error('音频播放错误:', res);
      const currentSentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
      if (currentSentenceTranslations[sentenceIndex]) {
        currentSentenceTranslations[sentenceIndex].isPlaying = false;
        currentSentenceTranslations[sentenceIndex].progress = 0;
        this.setData({
          'classicsDetail.sentenceTranslations': currentSentenceTranslations
        });
      }
    });
  },

  // 播放翻译音频
  playTranslation: function(e) {
    // 获取数据
    const index = e.currentTarget.dataset.index;
    const transIndex = e.currentTarget.dataset.transIndex;
    
    console.log('点击播放翻译:', index, transIndex);
    
    // 获取句子和翻译数据的深拷贝
    const sentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
    const sentence = sentenceTranslations[index];
    
    if (!sentence) {
      console.error('未找到句子:', index);
      return;
    }
    
    // 获取翻译
    const translation = sentence.translations[transIndex];
    if (!translation) {
      console.error('未找到翻译:', transIndex);
      return;
    }
    
    // 如果translationAudioContext不存在，创建它
    if (!this.data.translationAudioContext) {
      const translationAudioContext = wx.createInnerAudioContext();
      this.setData({
        translationAudioContext: translationAudioContext
      });
    }
    
    // 获取翻译音频上下文
    const translationAudioContext = this.data.translationAudioContext;
    
    // 如果当前正在播放，则暂停
    if (translation.isPlaying) {
      console.log('当前正在播放，暂停音频');
      translationAudioContext.pause();
      
      // 更新播放状态
      sentence.translations[transIndex].isPlaying = false;
      this.setData({
        'classicsDetail.sentenceTranslations': sentenceTranslations
      });
      return;
    }
    
    // 停止所有正在播放的音频（除了背景音乐）
    this.stopAllAudioExceptBackground();
    
    // 设置音频源
    const audioUrl = translation.audioUrl || '/audio/default-translation.mp3';
    console.log('设置音频源:', audioUrl);
    translationAudioContext.src = audioUrl;
    
    // 播放音频
    translationAudioContext.play();
    console.log('开始播放音频');
    
    // 更新播放状态
    sentence.translations[transIndex].isPlaying = true;
    sentence.translations[transIndex].progress = 0;
    this.setData({
      'classicsDetail.sentenceTranslations': sentenceTranslations
    });
    
    // 监听播放进度
    translationAudioContext.onTimeUpdate(() => {
      if (translationAudioContext.duration > 0) {
        // 计算进度
        const progress = (translationAudioContext.currentTime / translationAudioContext.duration) * 100;
        
        // 获取最新的状态
        const currentSentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
        if (currentSentenceTranslations[index] && 
            currentSentenceTranslations[index].translations[transIndex]) {
          currentSentenceTranslations[index].translations[transIndex].progress = progress;
          this.setData({
            'classicsDetail.sentenceTranslations': currentSentenceTranslations
          });
        }
      }
    });
    
    // 监听播放结束
    translationAudioContext.onEnded(() => {
      console.log('音频播放结束');
      const currentSentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
      if (currentSentenceTranslations[index] && 
          currentSentenceTranslations[index].translations[transIndex]) {
        currentSentenceTranslations[index].translations[transIndex].isPlaying = false;
        currentSentenceTranslations[index].translations[transIndex].progress = 0;
        this.setData({
          'classicsDetail.sentenceTranslations': currentSentenceTranslations
        });
      }
    });
    
    // 监听错误
    translationAudioContext.onError((res) => {
      console.error('音频播放错误:', res);
      wx.showToast({
        title: '音频加载失败',
        icon: 'none'
      });
      const currentSentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
      if (currentSentenceTranslations[index] && 
          currentSentenceTranslations[index].translations[transIndex]) {
        currentSentenceTranslations[index].translations[transIndex].isPlaying = false;
        currentSentenceTranslations[index].translations[transIndex].progress = 0;
        this.setData({
          'classicsDetail.sentenceTranslations': currentSentenceTranslations
        });
      }
    });
  },

  // 停止所有正在播放的音频（除了背景音乐）
  stopAllAudioExceptBackground: function() {
    console.log('停止所有音频（除了背景音乐）');
    
    // 停止音频上下文（除了背景音乐）
    if (this.data.sourceAudioContext) {
      this.data.sourceAudioContext.stop();
    }
    if (this.data.contentAudioContext) {
      this.data.contentAudioContext.stop();
    }
    
    // 获取数据的深拷贝
    const sentenceTranslations = [...this.data.classicsDetail.sentenceTranslations];
    let needUpdate = false;
    
    // 重置所有播放状态
    sentenceTranslations.forEach((sentence, sentenceIndex) => {
      // 重置源语言播放状态
      if (sentence.isPlaying) {
        sentence.isPlaying = false;
        sentence.progress = 0;
        needUpdate = true;
      }
      
      // 重置翻译播放状态
      sentence.translations.forEach((translation, translationIndex) => {
        if (translation.isPlaying) {
          translation.isPlaying = false;
          translation.progress = 0;
          needUpdate = true;
        }
      });
    });
    
    // 只有在状态改变时才更新数据
    if (needUpdate) {
      this.setData({
        'classicsDetail.sentenceTranslations': sentenceTranslations
      });
    }
  },

  // 检查文章是否已经收藏
  checkIfFavorited: function(classicsId) {
    const favoriteArticles = wx.getStorageSync('favoriteArticles') || [];
    const isFavorite = favoriteArticles.some(article => 
      article.id === classicsId || article.id === this.data.classicsDetail.id
    );
    
    this.setData({
      isFavorite: isFavorite
    });
  },
}); 