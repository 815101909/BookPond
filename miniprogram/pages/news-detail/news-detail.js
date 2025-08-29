const languageManager = require('../../utils/language');
const { favoritesAPI, readAPI } = require('../../utils/cloud-api');
const cloudApi = require('../../utils/cloud-api');

Page({
  data: {
    newsId: '',
    newsDetail: null,
    fontSize: 34,
    isPlaying: false,
    isFavorite: false,
    showContent: true,
    showTranslation: false,
    audioContext: null,
    contentAudioContext: null,
    audioProgress: 0,
    isContentPlaying: false,
    currentLanguage: 'zh-CN',
    currentIndex: 0,
    selectedLanguages: [],
    printLanguage: 'zh',
    printStyles: {
      content: '',
      paragraph: ''
    },
    translations: [],
    languageMap: {
      'zh-CN': { code: 'zh-CN', name: '中文', shortName: '中文', flag: '🇨🇳' },
      'en': { code: 'en', name: '英语', shortName: '英语', flag: '🇺🇸' },
      'fr': { code: 'fr', name: '法语', shortName: '法语', flag: '🇫🇷' },
      'es': { code: 'es', name: '西班牙语', shortName: '西语', flag: '🇪🇸' },
      'it': { code: 'it', name: '意大利语', shortName: '意语', flag: '🇮🇹' },
      'ja': { code: 'ja', name: '日语', shortName: '日语', flag: '🇯🇵' },
      'ko': { code: 'ko', name: '韩语', shortName: '韩语', flag: '🇰🇷' }
    },
    languageOptions: [],
    showPrintArea: false,
    printMode: 'full',
    selectedPrintLanguages: {},
    printFontSize: 10.5,
    currentAudio: null,
    sourceAudioContext: null,
    translationAudioContext: null,
    printLanguageIndex: 0,
    printLanguageOptions: [],
    lastPlayPosition: 0, // 新增：记录上次播放的位置
    bgmContext: null,    // 新增：背景音乐上下文
    isBgmPlaying: false, // 新增：背景音乐播放状态
    // 会员相关状态
    isMember: false,     // 是否为会员
    showMemberLock: false, // 是否显示会员锁定提示
    membershipInfo: null,  // 会员信息
    contentPreviewLength: 200, // 非会员可预览的内容长度
    // 语速调节相关状态
    playbackRate: 1.0,   // 播放语速，默认1.0倍速
    playbackRates: [0.75, 0.8, 0.9, 1.0, 1.1, 1.25], // 可选语速
    showSpeedControl: false // 是否显示语速控制面板
  },

  onLoad: function(options) {
    // 获取news id
    const newsId = options.id || '';
    this.setData({
      newsId: newsId
    });

    // 初始化音频上下文
    this.initAudioContext();
    
    // 初始化背景音乐
    this.initBackgroundMusic();

    // 检查会员状态
    this.checkMemberStatus();

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
        selectedLanguages: fullSelectedLanguages,
        languageOptions: languageOptions,
        currentIndex: 0,
        currentLanguage: 'zh-CN'
      }, () => {
        console.log('设置后的语言选择:', this.data.selectedLanguages);
        console.log('准备获取新闻详情，ID:', options.id);
        if (options.id) {
          this.fetchNewsDetail(options.id);
        } else {
          console.error('onLoad: 缺少新闻ID参数');
          wx.showToast({
            title: '缺少新闻ID参数',
            icon: 'none'
          });
        }
      });
    }

    // 初始化打印语言选项
    this.initPrintLanguageOptions();
    
    // 查询文章收藏状态
    this.checkIfFavorited(newsId);
  },

  // 检查会员状态
  checkMemberStatus: async function() {
    try {
      const result = await cloudApi.callCloudFunction('jiuyu_pay', {
        action: 'checkMemberStatus'
      });
      
      console.log('会员状态检查结果:', result);
      
      if (result.result && result.result.success) {
        const { isMember, membershipInfo } = result.result;
        this.setData({
          isMember: isMember,
          membershipInfo: membershipInfo,
          showMemberLock: !isMember
        });
        console.log('会员状态更新:', { isMember, showMemberLock: !isMember });
      } else {
        // 默认为非会员
        this.setData({
          isMember: false,
          showMemberLock: true
        });
      }
    } catch (error) {
      console.error('检查会员状态失败:', error);
      // 默认为非会员
      this.setData({
        isMember: false,
        showMemberLock: true
      });
    }
  },

  // 处理内容预览（非会员只显示部分内容）
  processContentForMember: function(content, isMember) {
    if (isMember || !content) {
      return content;
    }
    
    // 非会员只显示前面部分内容
    const textContent = content.replace(/<[^>]*>/g, ''); // 移除HTML标签
    if (textContent.length <= this.data.contentPreviewLength) {
      return content;
    }
    
    // 截取预览内容
    const previewText = textContent.substring(0, this.data.contentPreviewLength);
    return previewText + '...';
  },

  // 导航到会员页面
  navigateToMembership: function() {
    wx.navigateTo({
      url: '/pages/membership/membership'
    });
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
        currentLanguage: 'zh-CN'
      }, () => {
        if (this.data.newsId) {
          this.fetchNewsDetail(this.data.newsId);
        }
      });
    }
    
    // 重新设置音频进度监听
    this.resetAudioProgressListener();
  },

  onHide: function() {
    console.log('页面隐藏，准备暂停音频播放');
    
    // 暂停所有音频播放
    try {
      // 暂停内容朗读
      if (this.data.contentAudioContext && this.data.isContentPlaying) {
        this.data.contentAudioContext.pause();
        this.setData({ isContentPlaying: false });
      }
      
      // 暂停背景音乐
      if (this.data.bgmContext && this.data.isBgmPlaying) {
        this.data.bgmContext.pause();
        this.setData({ isBgmPlaying: false });
      }
      
      // 暂停其他音频
      ['sourceAudioContext', 'translationAudioContext'].forEach(contextName => {
        const audioContext = this.data[contextName];
        if (audioContext) {
          try {
            audioContext.pause();
          } catch (e) {
            console.log(`暂停${contextName}失败:`, e);
          }
        }
      });
    } catch (error) {
      console.error('页面隐藏时暂停音频失败:', error);
    }
  },
  
  // 重置音频进度监听器
  resetAudioProgressListener: function() {
    const contentAudioContext = this.data.contentAudioContext;
    if (!contentAudioContext) {
      console.error('音频上下文不存在，无法设置进度监听器');
      return;
    }
    
    console.log('重新设置音频进度监听器');
    
    try {
      // 移除旧的监听器
      contentAudioContext.offTimeUpdate();
      
      // 添加新的监听器
      contentAudioContext.onTimeUpdate(() => {
        try {
          if (contentAudioContext.duration > 0) {
            const progress = (contentAudioContext.currentTime / contentAudioContext.duration) * 100;
            
            // 确保进度值有效
            if (!isNaN(progress) && progress >= 0 && progress <= 100) {
              this.setData({
                audioProgress: progress
              });
            }
          } else {
            console.log('音频总时长为0，无法计算进度');
          }
        } catch (error) {
          console.error('处理音频进度更新时出错:', error);
        }
      });
      
      // 监听音频加载完成
      contentAudioContext.onCanplay(() => {
        console.log('音频加载完成，可以播放，总时长:', contentAudioContext.duration);
        
        // 如果已经在播放，确保进度条显示
        if (this.data.isContentPlaying && contentAudioContext.duration > 0) {
          const progress = (contentAudioContext.currentTime / contentAudioContext.duration) * 100;
          console.log('音频已加载完成，当前进度:', progress.toFixed(1) + '%');
          this.setData({
            audioProgress: progress
          });
        }
      });
    } catch (error) {
      console.error('设置音频进度监听器时出错:', error);
    }
  },

  // 安全地销毁音频资源
  safeDestroyAudio: function(contextName) {
    try {
      const audioContext = this.data[contextName];
      if (audioContext) {
        // 先尝试停止播放
        if (typeof audioContext.stop === 'function') {
          try {
            audioContext.stop();
          } catch (e) {
            console.log(`停止${contextName}失败:`, e);
          }
        }
        
        // 确保暂停
        if (typeof audioContext.pause === 'function') {
          try {
            audioContext.pause();
          } catch (e) {
            console.log(`暂停${contextName}失败:`, e);
          }
        }
        
        // 移除所有事件监听器
        try {
          audioContext.offPlay();
          audioContext.offPause();
          audioContext.offStop();
          audioContext.offEnded();
          audioContext.offTimeUpdate();
          audioContext.offCanplay();
          audioContext.offError();
          console.log(`已移除${contextName}的所有事件监听器`);
        } catch (e) {
          console.log(`移除${contextName}事件监听器失败:`, e);
        }
        
        // 然后尝试销毁
        if (typeof audioContext.destroy === 'function') {
          try {
            audioContext.destroy();
            console.log(`成功销毁${contextName}`);
          } catch (e) {
            console.log(`销毁${contextName}失败:`, e);
          }
        }
        
        // 从data中移除引用
        const newData = {};
        newData[contextName] = null;
        this.setData(newData);
      }
    } catch (error) {
      console.error(`安全销毁${contextName}时出错:`, error);
    }
  },

  onUnload: function() {
    console.log('页面卸载，准备清理音频资源');
    // 安全地销毁音频资源
    this.safeDestroyAudio('audioContext');
    this.safeDestroyAudio('contentAudioContext');
    this.safeDestroyAudio('sourceAudioContext');
    this.safeDestroyAudio('translationAudioContext');
    
    // 特殊处理背景音乐，确保停止循环播放并销毁
    const bgmContext = this.data.bgmContext;
    if (bgmContext) {
      bgmContext.loop = false; // 先禁用循环播放
      bgmContext.volume = 0;   // 将音量设为0
      
      try {
        // 使用原生方法停止
        bgmContext.stop();
        console.log('背景音乐已停止');
        
        // 移除所有事件监听
        bgmContext.offPlay();
        bgmContext.offPause();
        bgmContext.offStop();
        bgmContext.offEnded();
        bgmContext.offError();
        
        // 销毁音频实例
        bgmContext.destroy();
        console.log('背景音乐实例已销毁');
      } catch (err) {
        console.error('销毁背景音乐失败:', err);
      } finally {
        // 确保置空引用
        this.setData({ bgmContext: null });
      }
    }
    
    console.log('页面卸载，音频资源已清理');
  },
  
  // 初始化背景音乐
  initBackgroundMusic: function() {
    // 如果已存在背景音乐实例，先销毁它
    if (this.data.bgmContext) {
      try {
        this.data.bgmContext.stop();
        this.data.bgmContext.destroy();
        console.log('销毁旧的背景音乐实例');
      } catch (error) {
        console.error('销毁旧的背景音乐实例失败:', error);
      }
    }
    
    // 创建背景音乐上下文
    const bgmContext = wx.createInnerAudioContext();
    
    // 设置音频源为云文件路径
    const bgmUrl = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/audio/bgm/宁静的樱花日落旋律_轻松的器乐灵感源于宁静的动漫樱花场景_钢_爱给网_aigei_com.mp3';
    
    // 设置音频属性（提前设置这些属性）
    bgmContext.loop = true;    // 循环播放
    bgmContext.volume = 0.1;   // 设置较低的音量
    bgmContext.obeyMuteSwitch = false; // 忽略静音开关
    bgmContext.autoplay = false; // 先不自动播放，等获取临时URL后再播放
    
    // 记录实例ID，用于调试
    bgmContext._instanceId = 'bgm_' + Date.now();
    console.log('创建新的背景音乐实例:', bgmContext._instanceId);
    
    // 更新引用但不立即播放
    this.setData({
      bgmContext: bgmContext,
      isBgmPlaying: false
    });
    
    // 添加事件监听器
    bgmContext.onError((res) => {
      console.error('背景音乐播放错误:', res);
      this.setData({ isBgmPlaying: false });
    });
    
    bgmContext.onStop(() => {
      console.log('背景音乐已停止');
      this.setData({ isBgmPlaying: false });
    });
    
    bgmContext.onPause(() => {
      console.log('背景音乐已暂停');
      this.setData({ isBgmPlaying: false });
    });
    
    bgmContext.onPlay(() => {
      console.log('背景音乐开始播放');
      this.setData({ isBgmPlaying: true });
    });
    
    // 使用统一的临时URL获取方法
    this.getTemporaryFileUrl(bgmUrl, '背景音乐').then(tempUrl => {
      if (tempUrl) {
        console.log('BGM临时URL获取成功:', tempUrl);
        
        // 设置音频源
        bgmContext.src = tempUrl;
        
        // 检查当前页面是否是活跃状态，只有在活跃状态才自动播放
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        
        if (currentPage && currentPage === this) {
          // 延迟一点播放，确保页面已经完全加载
          setTimeout(() => {
            try {
              // 再次检查音频实例是否仍然存在
              if (this.data.bgmContext && this.data.bgmContext === bgmContext) {
                bgmContext.play();
                console.log('背景音乐开始播放 (延迟播放)');
              }
            } catch (error) {
              console.error('播放背景音乐失败:', error);
            }
          }, 500);
        }
      } else {
        console.error('获取背景音乐临时URL失败');
      }
    }).catch(err => {
      console.error('获取背景音乐临时URL失败:', err);
    });
  },

  // 切换背景音乐播放状态
  toggleBgm: function() {
    const bgmContext = this.data.bgmContext;
    if (!bgmContext) {
      console.error('背景音乐上下文未初始化');
      return;
    }

    if (this.data.isBgmPlaying) {
      // 暂停背景音乐
      bgmContext.pause();
    } else {
      // 播放背景音乐
      bgmContext.play();
    }
  },
  
  // 初始化音频上下文
  initAudioContext: function() {
    // 初始化背景音乐
    const audioContext = wx.createInnerAudioContext();
    audioContext.src = '/audio/background.mp3';
    audioContext.loop = true;
    
    // 初始化内容朗读音频上下文
    const contentAudioContext = wx.createInnerAudioContext({
      useWebAudioImplement: true // 使用WebAudio实现，提高性能和稳定性
    });
    
    // 初始化源语言音频上下文
    const sourceAudioContext = wx.createInnerAudioContext();
    
    // 初始化翻译音频上下文
    const translationAudioContext = wx.createInnerAudioContext();
    
    // 监听音频加载状态
    contentAudioContext.onCanplay(() => {
      console.log('音频可以播放了，总时长:', contentAudioContext.duration);
    });
    
    // 监听播放进度变化
    contentAudioContext.onTimeUpdate(() => {
      if (contentAudioContext.duration > 0) {
        const progress = (contentAudioContext.currentTime / contentAudioContext.duration) * 100;
        console.log('初始化时设置的监听 - 音频进度更新:', progress.toFixed(1) + '%');
        this.setData({
          audioProgress: progress
        });
      }
    });
    
    // 监听播放开始
    contentAudioContext.onPlay(() => {
      console.log('音频开始播放');
      // 确保状态正确
      this.setData({
        isContentPlaying: true
      });
    });
    
    // 监听播放结束
    contentAudioContext.onEnded(() => {
      console.log('音频播放结束');
      this.setData({
        isContentPlaying: false,
        audioProgress: 0
      });
    });

    // 监听错误 - 只记录错误，不显示提示，避免重复提示
    contentAudioContext.onError((err) => {
      console.error('音频播放错误:', err);
      // 只重置状态，不显示提示，因为toggleContentAudio中会处理错误提示
      this.setData({
        isContentPlaying: false,
        audioProgress: 0
      });
    });
    
    // 监听源语言音频错误
    sourceAudioContext.onError((err) => {
      console.error('源语言音频播放错误:', err);
    });
    
    // 监听翻译音频错误
    translationAudioContext.onError((err) => {
      console.error('翻译音频播放错误:', err);
    });
    
    this.setData({ 
      audioContext,
      contentAudioContext,
      sourceAudioContext,
      translationAudioContext
    });
    
    console.log('音频上下文初始化完成');
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

  toggleMusic: function() {
    const audioContext = this.data.audioContext;
    if (!audioContext) {
      console.error('音频上下文未初始化');
      return;
    }

    try {
      if (this.data.isPlaying) {
        audioContext.pause();
      } else {
        audioContext.play();
      }
      this.setData({
        isPlaying: !this.data.isPlaying
      });
    } catch (error) {
      console.error('切换音乐状态失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 检查文章是否已经收藏
  checkIfFavorited: async function(newsId) {
    try {
      const result = await favoritesAPI.checkFavorite({ articleId: newsId });
      
      console.log('检查收藏状态API返回结果:', result);
      
      // 兼容两种返回格式：直接返回result或包装在result.result中
      const actualResult = result?.result || result;
      
      if (actualResult && actualResult.code === 0) {
        this.setData({
          isFavorite: actualResult.data.isFavorite
        });
      }
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      // 默认不收藏
      this.setData({
        isFavorite: false
      });
    }
  },

  // 切换收藏状态
  toggleFavorite: async function() {
    try {
      wx.showLoading({
        title: this.data.isFavorite ? '取消收藏中...' : '收藏中...',
        mask: true
      });
      
      // 获取当前文章信息
      const article = this.data.newsDetail || {};
      const articleId = article._id || this.data.newsId;
      
      if (!articleId) {
        wx.showToast({
          title: '文章信息不完整',
          icon: 'none'
        });
        return;
      }
      
      // 获取文章的看点简介
      let highlights = '';
      if (article.contents && Array.isArray(article.contents) && article.contents.length > 0) {
        // 优先使用中文简体内容的看点
        const zhContent = article.contents.find(item => item.language === 'zh-CN');
        if (zhContent && zhContent.highlights) {
          highlights = zhContent.highlights;
        } else if (article.contents[0].highlights) {
          // 如果没有中文看点，使用第一个语言的看点
          highlights = article.contents[0].highlights;
        }
      }
      
      // 准备文章数据
      const articleData = {
        articleId: articleId,
        title: article.title || '未知标题',
        coverUrl: article.originalCoverUrl || article.image || article.cover_url || '',
        type: 'news',  // 默认为news类型
        level: article.level || 'sprout',
        highlights: highlights  // 添加看点简介字段
      };
      
      console.log('保存收藏的文章数据:', articleData);
      
      // 根据当前状态调用不同的API
      const result = this.data.isFavorite ? 
        await favoritesAPI.removeFavorite(articleData) : 
        await favoritesAPI.addFavorite(articleData);
      
      wx.hideLoading();
      
      console.log('收藏API返回结果:', result);
      console.log('result类型:', typeof result);
      console.log('result.code:', result?.code);
      console.log('result.result:', result?.result);
      
      // 兼容两种返回格式：直接返回result或包装在result.result中
      const actualResult = result?.result || result;
      
      if (actualResult && actualResult.code === 0) {
        // 更新收藏状态
        const newFavoriteStatus = !this.data.isFavorite;
        
        this.setData({
          isFavorite: newFavoriteStatus
        });
        
        wx.showToast({
          title: newFavoriteStatus ? '收藏成功' : '已取消收藏',
          icon: 'success',
          duration: 1500
        });
      } else {
        console.error('收藏操作失败，actualResult:', actualResult);
        throw new Error(actualResult?.msg || '操作失败');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('收藏操作失败:', error);
      
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 临时链接处理函数
  // 通用临时链接处理函数
  getTemporaryUrl: async function(fileUrl, type, isImage = false) {
    if (!fileUrl) {
      console.log(`${type}链接为空`);
      return isImage ? `https://via.placeholder.com/800x600.png?text=${type}` : null;
    }
    
    try {
      // 如果是云存储链接，需要转换为临时链接
      if (fileUrl.startsWith('cloud://')) {
        console.log(`${type}为云存储链接，正在转换为临时链接:`, fileUrl);
        try {
          // 从URL中动态提取环境ID
          let resourceEnv = 'cloud1-1gsyt78b92c539ef'; // 默认环境
          const envMatch = fileUrl.match(/cloud:\/\/([^.]+)/);
          if (envMatch && envMatch[1]) {
            resourceEnv = envMatch[1];
          }
          
          // 创建跨环境调用的Cloud实例
          var c = new wx.cloud.Cloud({
            // 必填，表示是未登录模式
            identityless: true,
            // 资源方 AppID
            resourceAppid: 'wx85d92d28575a70f4',
            // 资源方环境 ID
            resourceEnv: resourceEnv,
          });
          await c.init();
          const result = await c.getTempFileURL({
            fileList: [fileUrl]
          });
          
          if (result.fileList && result.fileList[0] && result.fileList[0].tempFileURL) {
            const tempUrl = result.fileList[0].tempFileURL;
            console.log(`${type}临时链接转换成功:`, tempUrl);
            return tempUrl;
          } else {
            console.error(`${type}临时链接转换失败，未返回有效结果:`, result);
            return isImage ? `https://via.placeholder.com/800x600.png?text=Error_${type}` : null;
          }
        } catch (cloudError) {
          console.error(`${type}云存储临时链接获取失败:`, cloudError);
          return isImage ? `https://via.placeholder.com/800x600.png?text=Error_${type}` : null;
        }
      }
      
      // 如果是HTTP链接，直接返回
      if (fileUrl.startsWith('http')) {
        console.log(`${type}为HTTP链接:`, fileUrl);
        return fileUrl;
      }
      
      // 其他情况
      console.log(`${type}格式未知。原始链接:`, fileUrl);
      return isImage ? `https://via.placeholder.com/800x600.png?text=${type}` : null;
    } catch (error) {
      console.error(`处理${type}链接出错:`, error);
      return isImage ? `https://via.placeholder.com/800x600.png?text=Error_${type}` : null;
    }
  },

  // 图片临时链接处理函数（兼容性保留）
  getTemporaryImageUrl: async function(imageUrl, type) {
    return await this.getTemporaryUrl(imageUrl, type, true);
  },

  // 文件临时链接处理函数（兼容性保留）
  getTemporaryFileUrl: async function(fileUrl, type) {
    return await this.getTemporaryUrl(fileUrl, type, false);
  },

  processContentImages: async function(content) {
    if (!content) return content;
    
    // 匹配所有图片标签中的src属性
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    const imageUrls = [];
    
    // 收集所有图片链接
    while ((match = imgRegex.exec(content)) !== null) {
      const imageUrl = match[1];
      if (imageUrl && imageUrl.startsWith('cloud://')) {
        imageUrls.push(imageUrl);
      }
    }
    
    // 如果没有云存储图片，直接返回原内容
    if (imageUrls.length === 0) {
      return content;
    }
    
    // 批量处理图片链接
    let processedContent = content;
    for (const imageUrl of imageUrls) {
      try {
        const tempUrl = await this.getTemporaryImageUrl(imageUrl, '内容图片');
        // 替换内容中的图片链接
        processedContent = processedContent.replace(new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tempUrl);
      } catch (error) {
        console.error('处理内容图片失败:', error);
      }
    }
    
    return processedContent;
  },

  // 获取新闻详情
  fetchNewsDetail: async function(id) {
    try {
      // 验证id参数
      if (!id) {
        console.error('fetchNewsDetail: id参数为空');
        wx.showToast({
          title: '文章ID无效',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      const result = await readAPI.getArticleDetail({ id });
      
      console.log('获取文章详情API返回结果:', result);
      
      // 兼容两种返回格式：直接返回result或包装在result.result中
      const actualResult = result?.result || result;

      if (actualResult && actualResult.code === 0) {
        const newsDetail = actualResult.data;
        
        // 格式化日期
        if (newsDetail.create_time) {
          newsDetail.formatted_date = this.formatDateFriendly(newsDetail.create_time);
        }
        
        // 找到中文内容
        const zhContent = newsDetail.contents.find(item => item.language === 'zh-CN') || {};
        
        // 获取用户选择的语言代码
        const selectedLanguageCodes = wx.getStorageSync('selectedLanguages') || [];
        console.log('用户选择的语言代码:', selectedLanguageCodes);
        
        // 处理音频链接，将cloud://开头的链接转为临时链接
        if (newsDetail.contents && Array.isArray(newsDetail.contents)) {
          // 收集所有需要转换的音频链接
          const audioCloudLinks = [];
          
          // 遍历所有语言内容，收集cloud://开头的音频链接
          newsDetail.contents.forEach(content => {
            if (content.audio && content.audio.startsWith('cloud://')) {
              audioCloudLinks.push(content.audio);
            }
          });
          
          // 如果有云存储音频链接，逐个获取临时URL
          if (audioCloudLinks.length > 0) {
            try {
              console.log('正在转换音频临时链接:', audioCloudLinks);
              
              // 逐个处理音频链接
              for (const content of newsDetail.contents) {
                if (content.audio && content.audio.startsWith('cloud://')) {
                  const tempUrl = await this.getTemporaryFileUrl(content.audio, '内容音频');
                  if (tempUrl) {
                    console.log(`将音频链接 ${content.audio} 转换为临时链接 ${tempUrl}`);
                    content.audio = tempUrl;
                  } else {
                    console.warn(`未能获取到音频 ${content.audio} 的临时链接`);
                  }
                }
              }
              
              console.log('音频临时链接转换完成');
            } catch (error) {
              console.error('获取音频临时链接失败:', error);
            }
          }
        }
        
        // 处理句子翻译中的音频链接
        if (newsDetail.sentenceTranslations && Array.isArray(newsDetail.sentenceTranslations)) {
          newsDetail.sentenceTranslations = await this.processAudioLinks(newsDetail.sentenceTranslations);
        }
        
        // 只获取用户选择的语言内容
        const translations = [];
        if (selectedLanguageCodes.length > 0) {
          selectedLanguageCodes.forEach(langCode => {
            if (langCode !== 'zh-CN') { // 排除中文简体
              const content = newsDetail.contents.find(item => item.language === langCode);
              if (content) {
                translations.push({
                  code: langCode,
                  name: this.data.languageMap[langCode]?.name || langCode,
                  flag: this.data.languageMap[langCode]?.flag || '',
                  start: content.start || '',
                  body: content.body || '',
                  ending: content.ending || '',
                  highlights: content.highlights,
                  audio: content.audio || '' // 添加音频链接
                });
              }
            }
          });
        }
        
        console.log('筛选后的翻译内容:', translations);
        
        // 处理标题翻译
        const titleTranslations = [];
        
        // 如果有titles数组，处理标题翻译
        if (newsDetail.titles && Array.isArray(newsDetail.titles)) {
          console.log('文章标题数组:', newsDetail.titles);
          
          // 获取中文标题
          const zhTitle = newsDetail.titles.find(t => t.language === 'zh-CN');
          if (zhTitle) {
            newsDetail.title = zhTitle.title;
          }
          
          // 只获取用户选择的语言的标题翻译
          selectedLanguageCodes.forEach(langCode => {
            if (langCode !== 'zh-CN') { // 排除中文简体
              const translatedTitle = newsDetail.titles.find(t => t.language === langCode);
              if (translatedTitle) {
                titleTranslations.push({
                  language: translatedTitle.language,
                  text: translatedTitle.title,
                  flag: this.data.languageMap[translatedTitle.language]?.flag || ''
                });
              }
            }
          });
        }
        
        console.log('处理后的标题翻译:', titleTranslations);
        
        // 检查音频链接
        if (zhContent.audio) {
          console.log('中文音频链接:', zhContent.audio);
        } else {
          console.log('中文内容没有音频链接');
        }
        
        translations.forEach(trans => {
          if (trans.audio) {
            console.log(`${trans.code} 音频链接:`, trans.audio);
          } else {
            console.log(`${trans.code} 内容没有音频链接`);
          }
        });
        
        // 处理主图片链接
        let processedImage = newsDetail.image || '';
        if (processedImage && processedImage.startsWith('cloud://')) {
          try {
            processedImage = await this.getTemporaryImageUrl(processedImage, '主图片');
          } catch (error) {
            console.error('处理主图片链接失败:', error);
            processedImage = '';
          }
        }
        
        // 处理中文内容中的图片
        let processedZhStart = await this.processContentImages(zhContent.start || '');
        let processedZhBody = await this.processContentImages(zhContent.body || '');
        let processedZhEnding = await this.processContentImages(zhContent.ending || '');
        
        // 根据会员状态处理内容显示
        if (!this.data.isMember) {
          processedZhStart = this.processContentForMember(processedZhStart, this.data.isMember);
          processedZhBody = this.processContentForMember(processedZhBody, this.data.isMember);
          processedZhEnding = this.processContentForMember(processedZhEnding, this.data.isMember);
        }
        
        // 处理翻译内容中的图片
        const processedTranslations = [];
        for (const translation of translations) {
          let processedStart = await this.processContentImages(translation.start);
          let processedBody = await this.processContentImages(translation.body);
          let processedEnding = await this.processContentImages(translation.ending);
          
          // 根据会员状态处理翻译内容显示
          if (!this.data.isMember) {
            processedStart = this.processContentForMember(processedStart, this.data.isMember);
            processedBody = this.processContentForMember(processedBody, this.data.isMember);
            processedEnding = this.processContentForMember(processedEnding, this.data.isMember);
          }
          
          processedTranslations.push({
            ...translation,
            start: processedStart,
            body: processedBody,
            ending: processedEnding
          });
        }
        
        // 更新页面数据
        this.setData({
          newsDetail: {
            ...newsDetail,
            start: processedZhStart,
            body: processedZhBody,
            ending: processedZhEnding,
            image: processedImage, // 使用处理后的图片链接
            originalCoverUrl: newsDetail.cover_url_original || '', // 存储原始的cloudid链接
            highlights: zhContent.highlights,
            translations: processedTranslations,
            titleTranslations,
            audio: zhContent.audio || '' // 添加中文音频链接
          },
          selectedLanguages: processedTranslations,
          isSingleLanguage: titleTranslations.length === 0 // 添加单语言标志
        });

        // 更新页面标题
        wx.setNavigationBarTitle({
          title: newsDetail.title || '文章详情'
        });
        
        // 文章详情加载完成后，重新检查收藏状态
        this.checkIfFavorited(id);
      } else {
        throw new Error(result.result?.msg || result.errMsg || '获取文章详情失败');
      }

    } catch (error) {
      console.error('获取新闻详情失败:', error);
      wx.showToast({
        title: '获取文章失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 格式化日期为友好格式
  formatDateFriendly: function(timestamp) {
    if (!timestamp) return '未知日期';
    
    // 将时间戳转换为日期对象
    const date = new Date(timestamp);
    const now = new Date();
    
    // 获取年月日
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 当前年月日
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    // 如果是今天
    if (year === currentYear && month === currentMonth && day === currentDay) {
      return '今日发布';
    }
    
    // 如果是昨天
    const yesterday = new Date(now);
    yesterday.setDate(currentDay - 1);
    if (year === yesterday.getFullYear() && month === yesterday.getMonth() + 1 && day === yesterday.getDate()) {
      return '昨日发布';
    }
    
    // 如果是今年
    if (year === currentYear) {
      return `${month}月${day}日`;
    }
    
    // 其他情况
    return `${year}年${month}月${day}日`;
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
    const sentenceTranslations = this.data.newsDetail.sentenceTranslations;
    sentenceTranslations[index].isExpanded = !sentenceTranslations[index].isExpanded;
    this.setData({
      'newsDetail.sentenceTranslations': sentenceTranslations
    });
  },

  // 处理标签点击
  handleTabClick: function(e) {
    const { lang, index } = e.currentTarget.dataset;
    
    // 停止所有正在播放的音频
    this.stopAllAudioExceptBackground();
    
    this.setData({
      currentLanguage: lang,
      currentIndex: index,
      isContentPlaying: false,
      audioProgress: 0,
      lastPlayPosition: 0
    });

    // 如果切换到其他语言，更新看点内容
    if (lang !== 'zh-CN') {
      const translation = this.data.newsDetail.translations[index - 1];
      if (translation) {
        this.setData({
          'newsDetail.highlights': translation.highlights || ''
        });
      }
    } else {
      // 切换回中文
      const zhContent = this.data.newsDetail.contents.find(item => item.language === 'zh-CN') || {};
      this.setData({
        'newsDetail.highlights': zhContent.highlights || ''
      });
    }
  },



  // 获取特定语言的翻译
  fetchTranslation: function(languageCode) {
    // 这里应该是调用翻译API获取翻译
    // 现在使用模拟数据，但去掉语言标识前缀
    const mockTranslation = this.data.newsDetail.content.map(text => {
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
    const newsDetail = this.data.newsDetail;
    newsDetail.translations[languageCode] = mockTranslation;
    
    this.setData({
      newsDetail: newsDetail
    });
  },

  // 更新翻译数据（用于外部调用）
  updateTranslations: function(translatedData) {
    // 扩展功能，如果需要从外部更新翻译数据
    const newsDetail = this.data.newsDetail;
    
    Object.keys(translatedData).forEach(langCode => {
      newsDetail.translations[langCode] = translatedData[langCode];
    });
    
    this.setData({
      newsDetail: newsDetail
    });
  },

  // 切换正文朗读状态
  toggleContentAudio: function() {
    const contentAudioContext = this.data.contentAudioContext;
    if (!contentAudioContext) {
      console.error('音频上下文未初始化');
      return;
    }
    
    const currentLanguage = this.data.currentLanguage;
    
    if (this.data.isContentPlaying) {
      // 如果正在播放，则暂停
      contentAudioContext.pause();
      // 记录当前播放位置
      this.setData({
        isContentPlaying: false,
        lastPlayPosition: contentAudioContext.currentTime || 0
      });
      console.log('音频已暂停，当前位置:', this.data.lastPlayPosition);
    } else {
      try {
        // 先将状态设置为播放中，避免用户多次点击
        this.setData({
          isContentPlaying: true
        });
        
        // 检查是否有上次播放的位置
        const lastPosition = this.data.lastPlayPosition || 0;
        
        // 检查是否已经有音频源
        let audioUrl = '';
        
        if (currentLanguage !== 'zh-CN') {
          // 使用对应语言的音频链接，优先使用服务器返回的链接
          const translations = this.data.newsDetail?.translations || [];
          const translation = translations.find(t => t.code === currentLanguage);
          audioUrl = translation?.audio || `/audio/content-${currentLanguage}.mp3`;
        } else {
          // 中文的音频路径，优先使用服务器返回的链接
          audioUrl = this.data.newsDetail?.audio || '/audio/content-zh.mp3';
        }
        
        console.log('准备播放音频:', audioUrl);
        
        // 检查是否需要设置新的音频源
        const needNewSource = !contentAudioContext.src || 
                             contentAudioContext.paused === undefined || 
                             contentAudioContext._isNewAudio === true;
        
        // 如果是同一个音频源且有上次播放位置，则从上次位置继续播放
        if (!needNewSource && lastPosition > 0 && contentAudioContext.duration > 0) {
          console.log('从上次位置继续播放:', lastPosition);
          contentAudioContext.seek(lastPosition);
          try {
            contentAudioContext.play();
            console.log('恢复播放音频');
            contentAudioContext._isNewAudio = false;
          } catch (err) {
            console.error('恢复播放失败:', err);
            this.handleAudioPlayError();
          }
          return;
        }
        
        // 检查是否是云文件ID
        if (audioUrl && audioUrl.startsWith('cloud://')) {
          console.log('检测到云文件ID，正在转换为临时URL');
          
          // 停止所有正在播放的音频（除了背景音乐）
          this.stopAllAudioExceptBackground();
          
          // 重置播放进度
          this.setData({ audioProgress: 0, lastPlayPosition: 0 });
          
          // 使用统一的临时URL获取方法
          this.getTemporaryFileUrl(audioUrl, '内容音频').then(tempUrl => {
            if (tempUrl) {
              console.log('云文件转换成功，临时URL:', tempUrl);
              
              // 设置音频源
              contentAudioContext.src = tempUrl;
              contentAudioContext._isNewAudio = true;
              
              // 设置播放语速
              contentAudioContext.playbackRate = this.data.playbackRate;
              
              // 重新设置进度监听器
              this.resetAudioProgressListener();
              
              // 开始播放 - 不使用Promise
              try {
                contentAudioContext.play();
                console.log('音频开始播放，语速:', this.data.playbackRate + 'x');
              } catch (err) {
                console.error('播放失败:', err);
                this.handleAudioPlayError();
              }
            } else {
              console.error('获取临时URL失败');
              this.handleAudioPlayError();
            }
          }).catch(err => {
            console.error('获取临时URL失败:', err);
            this.handleAudioPlayError();
          });
        } else {
          // 不是云文件ID，直接播放
          console.log('使用本地或网络音频:', audioUrl);
          
          // 检查是否需要设置新的音频源
          if (contentAudioContext.src !== audioUrl) {
            // 停止所有正在播放的音频（除了背景音乐）
            this.stopAllAudioExceptBackground();
            
            // 重置播放进度
            this.setData({ audioProgress: 0, lastPlayPosition: 0 });
            
            // 设置音频源
            contentAudioContext.src = audioUrl;
            contentAudioContext._isNewAudio = true;
            
            // 设置播放语速
            contentAudioContext.playbackRate = this.data.playbackRate;
            
            // 重新设置进度监听器
            this.resetAudioProgressListener();
          } else {
            // 如果是同一个音频源，尝试从上次位置继续播放
            if (lastPosition > 0 && contentAudioContext.duration > 0) {
              console.log('从上次位置继续播放:', lastPosition);
              contentAudioContext.seek(lastPosition);
            }
          }
          
          // 开始播放 - 不使用Promise
          try {
            contentAudioContext.play();
            console.log('音频开始播放');
            contentAudioContext._isNewAudio = false;
          } catch (err) {
            console.error('播放失败:', err);
            this.handleAudioPlayError();
          }
        }
      } catch (error) {
        console.error('播放音频失败:', error);
        this.handleAudioPlayError();
      }
    }
  },
  
  // 处理音频播放错误
  handleAudioPlayError: function() {
    // 重置播放状态
    this.setData({
      isContentPlaying: false,
      audioProgress: 0,
      lastPlayPosition: 0
    });
    
    // 显示错误提示
    wx.showToast({
      title: '音频播放失败',
      icon: 'none'
    });
  },

  // 切换语速控制面板显示状态
  toggleSpeedControl: function() {
    this.setData({
      showSpeedControl: !this.data.showSpeedControl
    });
  },

  // 关闭语速控制面板
  closeSpeedControl: function() {
    this.setData({
      showSpeedControl: false
    });
  },

  // 设置播放语速
  setPlaybackRate: function(e) {
    const rate = parseFloat(e.currentTarget.dataset.rate);
    const contentAudioContext = this.data.contentAudioContext;
    
    this.setData({
      playbackRate: rate,
      showSpeedControl: false
    });
    
    // 如果音频上下文存在，设置播放速度
    if (contentAudioContext) {
      try {
        contentAudioContext.playbackRate = rate;
        console.log('语速已设置为:', rate + 'x');
        
        // 显示设置成功提示
        wx.showToast({
          title: `语速已设置为${rate}x`,
          icon: 'success',
          duration: 1000
        });
      } catch (error) {
        console.error('设置语速失败:', error);
        wx.showToast({
          title: '设置语速失败',
          icon: 'none'
        });
      }
    }
  },
  
  // 切换时事内容区域的显示状态
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

  // 初始化打印语言选项
  initPrintLanguageOptions: function() {
    const options = [
      { code: 'zh', name: '中文简体' }
    ];
    
    // 添加已选择的语言
    if (this.data.selectedLanguages) {
      this.data.selectedLanguages.forEach(lang => {
        options.push({
          code: lang.code,
          name: `${lang.flag} ${lang.name}`
        });
      });
    }
    
    this.setData({
      printLanguageOptions: options
    });
  },

  // 处理打印语言切换
  handlePrintLanguageChange: function(e) {
    const index = e.detail.value;
    const language = this.data.printLanguageOptions[index].code;
    
    this.setData({
      printLanguageIndex: index,
      printLanguage: language
    });
  },

  // 显示打印区域
  printContent: function() {
    // 准备打印文章数据
    const article = this.data.newsDetail;
    if (!article) {
      wx.showToast({
        title: '文章数据未加载完成',
        icon: 'none'
      });
      return;
    }
    
    // 获取a4图片数组
    const a4Images = {};
    
    // 检查文章内容中是否包含a4字段
    if (article.contents && Array.isArray(article.contents)) {
      // 遍历所有语言内容
      article.contents.forEach(content => {
        // 如果该语言内容包含a4字段，且a4字段是数组
        if (content.a4 && Array.isArray(content.a4)) {
          // 保存该语言的完整a4图片数组
          a4Images[content.language] = content.a4;
        }
      });
    }
    
    // 准备要传递给打印页面的数据
    const printArticle = {
      title: article.title,
      titleTranslations: this.data.selectedLanguages.map(lang => ({
        language: lang.code,
        languageName: lang.name,
        flag: lang.flag,
        text: article.translations.find(t => t.code === lang.code)?.title || ''
      })),
      printImages: a4Images
    };
    
    // 保存到本地存储，供打印页面使用
    wx.setStorageSync('printArticle', printArticle);
    
    // 跳转到打印页面
    wx.navigateTo({
      url: '/pages/print/print'
    });
  },

  // 关闭打印区域
  closePrintArea: function() {
    this.setData({
      showPrintArea: false
    });
  },

  // 处理打印
  handlePrint: function() {
    wx.showLoading({
      title: '准备打印...',
    });

    // 延迟执行以确保样式已应用
    setTimeout(() => {
      wx.hideLoading();
      wx.showModal({
        title: '打印提示',
        content: '请使用系统打印功能或截图保存',
        showCancel: false
      });
    }, 500);
  },
  
  // 切换打印模式
  switchPrintMode: function(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      printMode: mode
    });
  },
  
  // 播放翻译音频
  playTranslation: function(e) {
    try {
      // 获取数据
      const index = e.currentTarget.dataset.index;
      const transIndex = e.currentTarget.dataset.transIndex;
      
      console.log('点击播放翻译:', index, transIndex);
      
      // 确保newsDetail和sentenceTranslations存在
      const newsDetail = this.data.newsDetail || {};
      const sentenceTranslations = newsDetail.sentenceTranslations || [];
      
      if (!Array.isArray(sentenceTranslations) || sentenceTranslations.length === 0) {
        console.error('句子翻译数据不存在');
        return;
      }
      
      // 获取句子和翻译数据的深拷贝
      const sentence = JSON.parse(JSON.stringify(sentenceTranslations[index]));
      
      if (!sentence) {
        console.error('未找到句子:', index);
        return;
      }
      
      // 确保translations存在
      if (!Array.isArray(sentence.translations)) {
        console.error('句子没有翻译数组');
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
        
        // 记录当前播放位置
        const currentPosition = translationAudioContext.currentTime || 0;
        
        // 更新播放状态
        sentence.translations[transIndex].isPlaying = false;
        sentence.translations[transIndex].lastPosition = currentPosition;
        
        console.log('翻译音频已暂停，当前位置:', currentPosition);
        
        // 更新数据
        const updatedSentenceTranslations = [...sentenceTranslations];
        updatedSentenceTranslations[index] = sentence;
        
        this.setData({
          'newsDetail.sentenceTranslations': updatedSentenceTranslations
        });
        return;
      }
      
      // 先更新状态为播放中
      sentence.translations[transIndex].isPlaying = true;
      const updatedSentenceTranslations = [...sentenceTranslations];
      updatedSentenceTranslations[index] = sentence;
      this.setData({
        'newsDetail.sentenceTranslations': updatedSentenceTranslations
      });
      
      // 获取上次播放位置
      const lastPosition = sentence.translations[transIndex].lastPosition || 0;
      
      // 检查是否需要设置音频源
      const currentAudioId = translationAudioContext.currentAudioId;
      const audioId = `trans_${index}_${transIndex}`;
      const needSetSource = !currentAudioId || currentAudioId !== audioId;
      
      if (needSetSource) {
        // 停止所有正在播放的音频（除了背景音乐）
        this.stopAllAudioExceptBackground();
        
        // 设置音频源
        const audioUrl = translation.audio || '/audio/default-translation.mp3';
        console.log('设置音频源:', audioUrl);
        
        // 检查是否是云文件ID
        if (audioUrl && audioUrl.startsWith('cloud://')) {
          console.log('检测到云文件ID，正在转换为临时URL');
          
          // 使用统一的临时URL获取方法
          this.getTemporaryFileUrl(audioUrl, '翻译音频').then(tempUrl => {
            if (tempUrl) {
              console.log('云文件转换成功，临时URL:', tempUrl);
              
              // 设置音频源
              translationAudioContext.src = tempUrl;
              translationAudioContext.currentAudioId = audioId; // 记录当前音频ID
              
              // 重置进度
              sentence.translations[transIndex].progress = 0;
              sentence.translations[transIndex].lastPosition = 0;
              
              // 开始播放
              try {
                translationAudioContext.play();
                console.log('开始播放翻译音频');
              } catch (err) {
                console.error('播放翻译音频失败:', err);
                this.handleTranslationPlayError(index, transIndex);
              }
            } else {
              console.error('获取临时URL失败');
              this.handleTranslationPlayError(index, transIndex);
            }
          }).catch(err => {
            console.error('获取临时URL失败:', err);
            this.handleTranslationPlayError(index, transIndex);
          });
        } else {
          // 不是云文件ID，直接播放
          translationAudioContext.src = audioUrl;
          translationAudioContext.currentAudioId = audioId; // 记录当前音频ID
          
          // 重置进度
          sentence.translations[transIndex].progress = 0;
          sentence.translations[transIndex].lastPosition = 0;
          
          // 开始播放
          try {
            translationAudioContext.play();
            console.log('开始播放翻译音频');
          } catch (err) {
            console.error('播放翻译音频失败:', err);
            this.handleTranslationPlayError(index, transIndex);
          }
        }
      } else {
        console.log('恢复播放之前的音频');
        
        // 如果有上次播放位置，从上次位置继续播放
        if (lastPosition > 0 && translationAudioContext.duration > 0) {
          console.log('从上次位置继续播放:', lastPosition);
          translationAudioContext.seek(lastPosition);
        }
        
        // 开始播放
        try {
          translationAudioContext.play();
          console.log('恢复播放翻译音频');
        } catch (err) {
          console.error('恢复播放翻译音频失败:', err);
          this.handleTranslationPlayError(index, transIndex);
        }
      }
      
      // 监听播放进度
      translationAudioContext.onTimeUpdate(() => {
        if (translationAudioContext.duration > 0) {
          // 计算进度
          const progress = (translationAudioContext.currentTime / translationAudioContext.duration) * 100;
          
          // 获取最新的状态
          const currentNewsDetail = this.data.newsDetail || {};
          const currentSentenceTranslations = currentNewsDetail.sentenceTranslations || [];
          
          if (Array.isArray(currentSentenceTranslations) && 
              currentSentenceTranslations[index] && 
              currentSentenceTranslations[index].translations && 
              currentSentenceTranslations[index].translations[transIndex]) {
            currentSentenceTranslations[index].translations[transIndex].progress = progress;
            // 更新上次播放位置
            currentSentenceTranslations[index].translations[transIndex].lastPosition = translationAudioContext.currentTime;
            this.setData({
              'newsDetail.sentenceTranslations': currentSentenceTranslations
            });
          }
        }
      });
      
      // 监听播放结束
      translationAudioContext.onEnded(() => {
        console.log('音频播放结束');
        const currentNewsDetail = this.data.newsDetail || {};
        const currentSentenceTranslations = currentNewsDetail.sentenceTranslations || [];
        
        if (Array.isArray(currentSentenceTranslations) && 
            currentSentenceTranslations[index] && 
            currentSentenceTranslations[index].translations && 
            currentSentenceTranslations[index].translations[transIndex]) {
          currentSentenceTranslations[index].translations[transIndex].isPlaying = false;
          currentSentenceTranslations[index].translations[transIndex].progress = 0;
          currentSentenceTranslations[index].translations[transIndex].lastPosition = 0;
          this.setData({
            'newsDetail.sentenceTranslations': currentSentenceTranslations
          });
        }
      });
      
      // 监听错误
      translationAudioContext.onError((res) => {
        console.error('音频播放错误:', res);
        this.handleTranslationPlayError(index, transIndex);
      });
    } catch (error) {
      console.error('播放翻译音频出错:', error);
      wx.showToast({
        title: '播放失败',
        icon: 'none'
      });
    }
  },
  
  // 处理翻译音频播放错误
  handleTranslationPlayError: function(index, transIndex) {
    const currentNewsDetail = this.data.newsDetail || {};
    const currentSentenceTranslations = currentNewsDetail.sentenceTranslations || [];
    
    if (Array.isArray(currentSentenceTranslations) && 
        currentSentenceTranslations[index] && 
        currentSentenceTranslations[index].translations && 
        currentSentenceTranslations[index].translations[transIndex]) {
      currentSentenceTranslations[index].translations[transIndex].isPlaying = false;
      currentSentenceTranslations[index].translations[transIndex].progress = 0;
      this.setData({
        'newsDetail.sentenceTranslations': currentSentenceTranslations
      });
    }
    
    wx.showToast({
      title: '音频加载失败',
      icon: 'none'
    });
  },

  // 播放源语言音频
  playSourceAudio: function(e) {
    try {
      // 获取数据
      const sentenceIndex = e.currentTarget.dataset.sentenceIndex;
      console.log('点击播放源语言:', sentenceIndex);
      
      // 确保newsDetail和sentenceTranslations存在
      const newsDetail = this.data.newsDetail || {};
      const sentenceTranslations = newsDetail.sentenceTranslations || [];
      
      if (!Array.isArray(sentenceTranslations) || sentenceTranslations.length === 0) {
        console.error('句子翻译数据不存在');
        return;
      }
      
      // 获取句子数据的深拷贝
      const sentence = JSON.parse(JSON.stringify(sentenceTranslations[sentenceIndex]));
      
      if (!sentence) {
        console.error('未找到句子:', sentenceIndex);
        return;
      }
      
      // 获取音频上下文
      const sourceAudioContext = this.data.sourceAudioContext;
      if (!sourceAudioContext) {
        console.error('源语言音频上下文未初始化');
        return;
      }
      
      // 如果当前正在播放，则暂停
      if (sentence.isPlaying) {
        console.log('当前正在播放，暂停音频');
        sourceAudioContext.pause();
        
        // 记录当前播放位置
        const currentPosition = sourceAudioContext.currentTime || 0;
        
        // 更新播放状态
        sentence.isPlaying = false;
        sentence.lastPosition = currentPosition;
        
        console.log('源语言音频已暂停，当前位置:', currentPosition);
        
        // 更新数据
        const updatedSentenceTranslations = [...sentenceTranslations];
        updatedSentenceTranslations[sentenceIndex] = sentence;
        
        this.setData({
          'newsDetail.sentenceTranslations': updatedSentenceTranslations
        });
        return;
      }
      
      // 先更新状态为播放中
      sentence.isPlaying = true;
      const updatedSentenceTranslations = [...sentenceTranslations];
      updatedSentenceTranslations[sentenceIndex] = sentence;
      this.setData({
        'newsDetail.sentenceTranslations': updatedSentenceTranslations
      });
      
      // 获取上次播放位置
      const lastPosition = sentence.lastPosition || 0;
      
      // 检查是否需要设置音频源
      const currentAudioId = sourceAudioContext.currentAudioId;
      const audioId = `source_${sentenceIndex}`;
      const needSetSource = !currentAudioId || currentAudioId !== audioId;
      
      if (needSetSource) {
        // 停止所有正在播放的音频（除了背景音乐）
        this.stopAllAudioExceptBackground();
        
        // 设置音频源 - 优先使用服务器返回的音频链接
        const audioUrl = sentence.audio || '/audio/default-source.mp3';
        console.log('设置音频源:', audioUrl);
        
        // 检查是否是云文件ID
        if (audioUrl && audioUrl.startsWith('cloud://')) {
          console.log('检测到云文件ID，正在转换为临时URL');
          
          // 使用统一的临时URL获取方法
          this.getTemporaryFileUrl(audioUrl, '源语言音频').then(tempUrl => {
            if (tempUrl) {
              console.log('云文件转换成功，临时URL:', tempUrl);
              
              // 设置音频源
              sourceAudioContext.src = tempUrl;
              sourceAudioContext.currentAudioId = audioId; // 记录当前音频ID
              
              // 重置进度
              sentence.progress = 0;
              sentence.lastPosition = 0;
              
              // 开始播放
              try {
                sourceAudioContext.play();
                console.log('开始播放源语言音频');
              } catch (err) {
                console.error('播放源语言音频失败:', err);
                this.handleSourcePlayError(sentenceIndex);
              }
            } else {
              console.error('获取临时URL失败');
              this.handleSourcePlayError(sentenceIndex);
            }
          }).catch(err => {
            console.error('获取临时URL失败:', err);
            this.handleSourcePlayError(sentenceIndex);
          });
        } else {
          // 不是云文件ID，直接播放
          sourceAudioContext.src = audioUrl;
          sourceAudioContext.currentAudioId = audioId; // 记录当前音频ID
          
          // 重置进度
          sentence.progress = 0;
          sentence.lastPosition = 0;
          
          // 开始播放
          try {
            sourceAudioContext.play();
            console.log('开始播放源语言音频');
          } catch (err) {
            console.error('播放源语言音频失败:', err);
            this.handleSourcePlayError(sentenceIndex);
          }
        }
      } else {
        console.log('恢复播放之前的音频');
        
        // 如果有上次播放位置，从上次位置继续播放
        if (lastPosition > 0 && sourceAudioContext.duration > 0) {
          console.log('从上次位置继续播放:', lastPosition);
          sourceAudioContext.seek(lastPosition);
        }
        
        // 开始播放
        try {
          sourceAudioContext.play();
          console.log('恢复播放源语言音频');
        } catch (err) {
          console.error('恢复播放源语言音频失败:', err);
          this.handleSourcePlayError(sentenceIndex);
        }
      }
      
      // 监听播放进度
      sourceAudioContext.onTimeUpdate(() => {
        if (sourceAudioContext.duration > 0) {
          // 计算进度
          const progress = (sourceAudioContext.currentTime / sourceAudioContext.duration) * 100;
          
          // 获取最新的状态
          const currentNewsDetail = this.data.newsDetail || {};
          const currentSentenceTranslations = currentNewsDetail.sentenceTranslations || [];
          
          if (Array.isArray(currentSentenceTranslations) && currentSentenceTranslations[sentenceIndex]) {
            currentSentenceTranslations[sentenceIndex].progress = progress;
            // 更新上次播放位置
            currentSentenceTranslations[sentenceIndex].lastPosition = sourceAudioContext.currentTime;
            this.setData({
              'newsDetail.sentenceTranslations': currentSentenceTranslations
            });
          }
        }
      });
      
      // 监听播放结束
      sourceAudioContext.onEnded(() => {
        console.log('音频播放结束');
        const currentNewsDetail = this.data.newsDetail || {};
        const currentSentenceTranslations = currentNewsDetail.sentenceTranslations || [];
        
        if (Array.isArray(currentSentenceTranslations) && currentSentenceTranslations[sentenceIndex]) {
          currentSentenceTranslations[sentenceIndex].isPlaying = false;
          currentSentenceTranslations[sentenceIndex].progress = 0;
          currentSentenceTranslations[sentenceIndex].lastPosition = 0;
          this.setData({
            'newsDetail.sentenceTranslations': currentSentenceTranslations
          });
        }
      });
      
      // 监听错误
      sourceAudioContext.onError((res) => {
        console.error('音频播放错误:', res);
        this.handleSourcePlayError(sentenceIndex);
      });
    } catch (error) {
      console.error('播放源语言音频出错:', error);
      wx.showToast({
        title: '播放失败',
        icon: 'none'
      });
    }
  },
  
  // 处理源语言音频播放错误
  handleSourcePlayError: function(sentenceIndex) {
    const currentNewsDetail = this.data.newsDetail || {};
    const currentSentenceTranslations = currentNewsDetail.sentenceTranslations || [];
    
    if (Array.isArray(currentSentenceTranslations) && currentSentenceTranslations[sentenceIndex]) {
      currentSentenceTranslations[sentenceIndex].isPlaying = false;
      currentSentenceTranslations[sentenceIndex].progress = 0;
      this.setData({
        'newsDetail.sentenceTranslations': currentSentenceTranslations
      });
    }
    
    wx.showToast({
      title: '音频加载失败',
      icon: 'none'
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
    if (this.data.translationAudioContext) {
      this.data.translationAudioContext.stop();
    }
    
    // 获取数据的深拷贝，确保sentenceTranslations存在
    const newsDetail = this.data.newsDetail || {};
    const sentenceTranslations = newsDetail.sentenceTranslations || [];
    let needUpdate = false;
    
    // 重置所有播放状态
    if (Array.isArray(sentenceTranslations)) {
      sentenceTranslations.forEach((sentence, sentenceIndex) => {
        // 重置源语言播放状态
        if (sentence.isPlaying) {
          sentence.isPlaying = false;
          sentence.progress = 0;
          needUpdate = true;
        }
        
        // 重置翻译播放状态
        if (sentence.translations && Array.isArray(sentence.translations)) {
          sentence.translations.forEach((translation, translationIndex) => {
            if (translation.isPlaying) {
              translation.isPlaying = false;
              translation.progress = 0;
              needUpdate = true;
            }
          });
        }
      });
      
      // 只有在状态改变时才更新数据
      if (needUpdate && newsDetail.sentenceTranslations) {
        this.setData({
          'newsDetail.sentenceTranslations': sentenceTranslations
        });
      }
    }
    
    // 重置内容朗读状态
    if (this.data.isContentPlaying) {
      this.setData({
        isContentPlaying: false,
        audioProgress: 0
      });
    }
  },

  // 处理句子翻译中的云存储音频链接
  processAudioLinks: async function(sentenceTranslations) {
    if (!sentenceTranslations || !Array.isArray(sentenceTranslations)) {
      return sentenceTranslations;
    }
    
    try {
      // 收集所有需要转换的音频链接
      const audioCloudLinks = [];
      
      // 遍历所有句子和翻译，收集cloud://开头的音频链接
      sentenceTranslations.forEach(sentence => {
        // 检查句子本身的音频
        if (sentence.audioUrl && sentence.audioUrl.startsWith('cloud://')) {
          audioCloudLinks.push(sentence.audioUrl);
        }
        
        // 检查句子的翻译音频
        if (sentence.translations && Array.isArray(sentence.translations)) {
          sentence.translations.forEach(translation => {
            if (translation.audioUrl && translation.audioUrl.startsWith('cloud://')) {
              audioCloudLinks.push(translation.audioUrl);
            }
          });
        }
      });
      
      // 如果有云存储音频链接，逐个获取临时URL
      if (audioCloudLinks.length > 0) {
        console.log('正在转换句子翻译的音频临时链接:', audioCloudLinks);
        
        // 逐个处理句子和翻译中的音频链接
        for (const sentence of sentenceTranslations) {
          // 处理句子本身的音频
          if (sentence.audioUrl && sentence.audioUrl.startsWith('cloud://')) {
            const tempUrl = await this.getTemporaryFileUrl(sentence.audioUrl, '句子音频');
            sentence.audio = tempUrl || sentence.audioUrl;
          }
          
          // 处理句子的翻译音频
          if (sentence.translations && Array.isArray(sentence.translations)) {
            for (const translation of sentence.translations) {
              if (translation.audioUrl && translation.audioUrl.startsWith('cloud://')) {
                const tempUrl = await this.getTemporaryFileUrl(translation.audioUrl, '翻译音频');
                translation.audio = tempUrl || translation.audioUrl;
              }
            }
          }
        }
        
        console.log('句子翻译的音频临时链接转换完成');
      }
      
      return sentenceTranslations;
    } catch (error) {
      console.error('处理句子翻译的音频临时链接失败:', error);
      return sentenceTranslations;
    }
  },
});