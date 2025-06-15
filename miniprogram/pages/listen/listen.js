Page({
  data: {
    todayPoints: 0,
    totalPoints: 0,
    showRules: false,
    currentLanguage: '中文（简体）',
    languages: ['中文（简体）', '中文（繁体）', '英语', '法语', '西班牙语', '德语', '意大利语', '日语', '葡萄牙语（葡萄牙）', '葡萄牙语（巴西）', '俄语', '韩语'],
    // 语言代码映射
    languageCodeMap: {
      '中文（简体）': 'zh-CN',
      '中文（繁体）': 'zh-TW',
      '英语': 'en',
      '法语': 'fr',
      '西班牙语': 'es',
      '德语': 'de',
      '意大利语': 'it',
      '日语': 'ja',
      '葡萄牙语（葡萄牙）': 'pt-PT',
      '葡萄牙语（巴西）': 'pt-BR',
      '俄语': 'ru',
      '韩语': 'ko'
    },
    selectedDate: '',
    currentDifficulty: 'sprout',
    currentAudioType: 'podcast', // 只保留 podcast 类型
    isPlaying: false,
    playbackSpeed: 1.0,
    showSpeedOptions: false,
    exerciseProgress: 33,
    
    // 当前习题
    currentExercise: {
      question: '',
      options: [],
      answer: null,
      explanation: '' // 添加解析字段
    },
    
    // 听力练习数据（从后台加载）
    listeningExercise: null,
    // 听力翻译数据（从后台加载）
    listeningTranslations: {},
    // 当前正在加载听力数据
    isLoadingListening: false,
    // 当前选择的文章ID
    currentArticleId: null,
    
    // 选项字母映射
    optionLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    
    // 单选题选中选项
    selectedSingleOption: null,
    
    // 多选题选中状态
    selectedOptions: {},
    
    // 填空题答案
    fillAnswer: '',
    
    // 结果弹窗
    showResultModal: false,
    resultData: {
      isCorrect: false,
      points: 0,
      feedback: '',
      correctAnswer: '',
      explanation: ''
    },
    
    // 收藏的习题
    favoritedExercises: [],
    
    // 已完成的习题
    completedExercises: [],
    
    // 自定义小字体消息
    customToastVisible: false,
    customToastText: '',
    customToastType: 'none'
  },

  // 计算属性
  // 根据当前难度获取题型描述
  get getExerciseDesc() {
    const typeMap = {
      'sprout': '单选题',
      'forest': '多选题'
    };
    return typeMap[this.data.currentDifficulty] || '练习题';
  },

  // 根据当前难度获取分值
  get getDifficultyPoints() {
    const pointsMap = {
      'sprout': '3分/题',
      'forest': '5分/题'
    };
    return pointsMap[this.data.currentDifficulty] || '';
  },

  onLoad: function() {
    try {
      // 加载用户积分数据
      this.loadUserPoints();
      // 设置默认日期为今天
      this.setToday();
      // 加载已收藏的习题
      this.loadFavoritedExercises();
      // 加载已完成的习题
      this.loadCompletedExercises();
      
      // 设置默认音频类型为"热点晓播客"
      this.setData({
        currentAudioType: 'podcast'
      });
      
      // 立即生成一个默认的练习题，确保有选项可以显示
      const defaultExercise = this.generateExercise();
      this.setData({
        currentExercise: defaultExercise
      });
      
      // 加载热点晓播客的内容
      setTimeout(() => {
        try {
          this.loadArticlesByType('podcast');
        } catch(err) {
          console.error('加载文章失败:', err);
          wx.showToast({
            title: '加载内容失败，使用模拟数据',
            icon: 'none',
            duration: 2000
          });
        }
      }, 300);
    } catch (error) {
      console.error('页面加载失败:', error);
      // 确保基础UI显示
      this.setData({
        currentAudioType: 'podcast',
        currentDifficulty: 'sprout',
        currentExercise: this.generateExercise()
      });
      
      wx.showToast({
        title: '页面加载失败，已使用默认数据',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 处理从收藏页面跳转过来的数据
  onShow: function() {
    // 从两个来源检查是否有待处理的数据
    this.checkAndLoadPendingExercise();
  },

  // 检查并加载待处理的练习
  checkAndLoadPendingExercise: function() {
    const app = getApp();
    let pendingAudio = app.globalData && app.globalData.pendingAudio;
    
    // 如果全局数据中没有，尝试从本地存储获取
    if (!pendingAudio) {
      try {
        const storedData = wx.getStorageSync('pending_audio_exercise');
        if (storedData) {
          console.log('从本地存储读取练习数据');
          pendingAudio = storedData;
          
          // 恢复到全局数据，以防其他地方需要
          if (app.globalData) {
            app.globalData.pendingAudio = pendingAudio;
          }
        }
      } catch (e) {
        console.error('读取本地存储失败', e);
      }
    }
    
    // 如果找到待处理数据，进行处理
    if (pendingAudio) {
      console.log('正在加载练习数据', pendingAudio.exerciseQuestion);
      
      // 设置相应的音频类型、难度和语言
      this.setData({
        currentAudioType: pendingAudio.audioType,
        currentDifficulty: pendingAudio.difficulty,
        currentLanguage: pendingAudio.language || '中文（简体）',
        // 保留原始习题日期，如果有的话
        selectedDate: pendingAudio.date && !pendingAudio.date.includes('T') 
          ? pendingAudio.date  // 如果是简单日期格式(YYYY-MM-DD)，直接使用
          : pendingAudio.date && pendingAudio.date.includes('T') 
            ? pendingAudio.date.split('T')[0]  // 如果是ISO格式，提取日期部分
            : this.data.selectedDate,  // 否则保持当前日期
        
        // 如果有完整的习题数据，直接使用
        currentExercise: pendingAudio.options ? {
          question: pendingAudio.exerciseQuestion,
          options: pendingAudio.options,
          answer: pendingAudio.answer,
          explanation: pendingAudio.explanation || "这里是听力原文内容"
        } : null
      });
      
      // 如果没有直接传递完整习题数据，则根据传递的问题生成习题
      if (!pendingAudio.options) {
        this.generateExerciseByDifficulty(pendingAudio.exerciseQuestion);
      }
      
      // 显示音频就绪提示
      wx.showToast({
        title: '热点「晓」播客已就绪',
        icon: 'success',
        duration: 1500
      });
      
      // 清除全局数据和本地存储，防止重复处理
      // 使用延迟确保当前处理完成
      setTimeout(() => {
        if (app.globalData) {
          app.globalData.pendingAudio = null;
        }
        wx.removeStorage({
          key: 'pending_audio_exercise',
          fail: (err) => {
            console.error('清除练习数据失败', err);
          }
        });
      }, 1000);
    }
  },

  // 加载用户积分
  loadUserPoints() {
    // TODO: 从服务器或本地存储加载用户积分
    this.setData({
      todayPoints: 0,
      totalPoints: 0
    });
  },

  // 显示积分规则
  showPointsRules() {
    this.setData({
      showRules: true
    });
  },
  
  // 关闭积分规则
  closePointsRules() {
    this.setData({
      showRules: false
    });
  },

  // 设置今天日期
  setToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.setData({
      selectedDate: `${year}-${month}-${day}`
    });
  },
  
  // 日期选择改变处理函数
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      selectedDate: date
    });
    // TODO: 根据选择的日期加载对应的内容
    this.loadContentByDate(date);
  },

  // 根据日期加载内容
  loadContentByDate(date) {
    // TODO: 这里添加根据日期加载内容的逻辑
    console.log('加载日期：', date, '的内容');
  },

  // 语言选择改变处理函数
  onLanguageChange(e) {
    const index = e.detail.value;
    const selectedLanguage = this.data.languages[index];
    
    this.setData({
      currentLanguage: selectedLanguage
    });
    
    // 如果已经选择了文章，则重新加载听力内容
    if (this.data.currentArticleId) {
      this.loadListeningExercise(this.data.currentArticleId);
    }
  },

  // 选择难度
  selectDifficulty(e) {
    const difficulty = e.currentTarget.dataset.difficulty;
    this.setData({
      currentDifficulty: difficulty,
      // 重置题目状态
      selectedSingleOption: null,
      selectedOptions: {},
      fillAnswer: ''
    });
    
    // 如果已经选择了音频类型，则自动生成对应习题
    if (this.data.currentAudioType) {
      this.generateExerciseByDifficulty();
    }
  },

  // 选择音频类型
  selectAudioType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      currentAudioType: type,
      // 重置题目状态
      selectedSingleOption: null,
      selectedOptions: {},
      fillAnswer: ''
    });
    
    // 加载对应的文章和听力练习
    this.loadArticlesByType(type);
  },
  
  // 根据类型加载文章列表
  loadArticlesByType(type) {
    // TODO: 从后台加载对应类型的文章列表
    const api = require('../../utils/api.js');
    const difficulty = this.data.currentDifficulty;
    const date = this.data.selectedDate;
    
    wx.showLoading({
      title: '加载文章...',
      mask: true
    });
    
    // 根据音频类型选择加载方法
    let loadPromise;
    if (type === 'podcast') {
      loadPromise = api.getNewsList(difficulty, date);
    } else {
      loadPromise = api.getClassicsList(difficulty, date);
    }
    
    loadPromise
      .then(articles => {
        console.log(`加载${type === 'podcast' ? '热点' : '名著'}文章成功:`, articles);
        
        if (articles && articles.length > 0) {
          // 默认选择第一篇文章
          this.selectArticle(articles[0].id);
        } else {
          wx.showToast({
            title: '暂无文章',
            icon: 'none'
          });
        }
        
        wx.hideLoading();
      })
      .catch(error => {
        console.error(`加载${type}文章失败:`, error);
        wx.hideLoading();
        wx.showToast({
          title: '加载文章失败',
          icon: 'none'
        });
      });
  },
  
  // 选择特定文章并加载其听力练习
  selectArticle(articleId) {
    if (!articleId) return;
    
    this.setData({
      currentArticleId: articleId,
      isLoadingListening: true
    });
    
    // 加载文章的听力练习
    this.loadListeningExercise(articleId);
  },
  
  // 加载听力练习
  loadListeningExercise(articleId) {
    const api = require('../../utils/api.js');
    const languageCode = this.getLanguageCode();
    
    wx.showLoading({
      title: '加载听力练习...',
      mask: true
    });
    
    api.getListeningExercise(articleId, languageCode)
      .then(exerciseData => {
        console.log('加载听力练习成功:', exerciseData);
        
        this.setData({
          listeningExercise: exerciseData,
          isLoadingListening: false
        });
        
        // 根据难度生成对应的习题
        this.generateExerciseFromListening(exerciseData);
        
        // 添加检查，确保生成的习题有选项
        setTimeout(() => {
          if (!this.data.currentExercise.options || this.data.currentExercise.options.length === 0) {
            console.log('习题选项为空，使用模拟数据');
            // 使用模拟数据作为后备
            const mockExercise = this.generateExercise();
            this.setData({
              currentExercise: mockExercise
            });
          }
        }, 300);
        
        wx.hideLoading();
      })
      .catch(error => {
        console.error('加载听力练习失败:', error);
        this.setData({
          isLoadingListening: false
        });
        
        // 加载失败时使用模拟数据
        const mockExercise = this.generateExercise();
        this.setData({
          currentExercise: mockExercise
        });
        
        wx.hideLoading();
        wx.showToast({
          title: '使用模拟习题',
          icon: 'none'
        });
      });
  },
  
  // 加载多语言听力翻译
  loadListeningTranslations(articleId, targetLanguages = []) {
    // 如果没有指定目标语言，则使用当前语言
    if (!targetLanguages || targetLanguages.length === 0) {
      const currentLangCode = this.getLanguageCode();
      if (currentLangCode !== 'zh-CN') {
        targetLanguages = [currentLangCode];
      } else {
        // 如果当前是中文，默认加载英文翻译
        targetLanguages = ['en'];
      }
    }
    
    const api = require('../../utils/api.js');
    
    api.getMultiLanguageListening(articleId, targetLanguages)
      .then(translationsData => {
        console.log('加载听力翻译成功:', translationsData);
        
        this.setData({
          listeningTranslations: translationsData.translations || {}
        });
      })
      .catch(error => {
        console.error('加载听力翻译失败:', error);
        wx.showToast({
          title: '加载翻译失败',
          icon: 'none'
        });
      });
  },
  
  // 根据听力数据生成习题
  generateExerciseFromListening(listeningData) {
    if (!listeningData) return;
    
    const difficulty = this.data.currentDifficulty;
    const questions = listeningData.questions || [];
    
    if (questions.length === 0) {
      // 如果没有预设的习题，根据难度自动生成
      this.generateExerciseByDifficulty(listeningData.transcriptText);
      return;
    }
    
    // 根据难度筛选合适类型的习题
    let filteredQuestions = questions;
    if (difficulty === 'sprout') {
      filteredQuestions = questions.filter(q => q.type === 'single');
    } else if (difficulty === 'forest') {
      filteredQuestions = questions.filter(q => q.type === 'multiple');
    } else if (difficulty === 'soar') {
      filteredQuestions = questions.filter(q => q.type === 'fill');
    }
    
    // 如果筛选后没有合适的习题，使用所有习题
    if (filteredQuestions.length === 0) {
      filteredQuestions = questions;
    }
    
    // 随机选择一道习题
    const randomIndex = Math.floor(Math.random() * filteredQuestions.length);
    const selectedQuestion = filteredQuestions[randomIndex];
    
    // 转换为当前页面所需的习题格式
    let exercise = {
      question: selectedQuestion.question,
      options: selectedQuestion.options || [],
      explanation: listeningData.transcriptText
    };
    
    // 根据题型设置正确答案
    if (selectedQuestion.type === 'single') {
      exercise.answer = selectedQuestion.correctAnswer;
    } else if (selectedQuestion.type === 'multiple') {
      exercise.answer = selectedQuestion.correctAnswers;
    } else if (selectedQuestion.type === 'fill') {
      exercise.answer = selectedQuestion.answer;
    }
    
    // 更新当前习题
    this.setData({
      currentExercise: exercise,
      selectedSingleOption: null,
      selectedOptions: {},
      fillAnswer: ''
    });
  },
  
  // 获取当前语言的语言代码
  getLanguageCode() {
    const currentLanguage = this.data.currentLanguage;
    return this.data.languageCodeMap[currentLanguage] || 'zh-CN';
  },

  // 根据难度和音频类型生成习题
  generateExerciseByDifficulty: function(specificQuestion = null) {
    const exercise = this.generateExercise(specificQuestion);
    this.setData({
      currentExercise: exercise
    });
  },

  // 生成练习题 (模拟数据)
  generateExercise: function(specificQuestion = null) {
    const audioType = this.data.currentAudioType;
    const difficulty = this.data.currentDifficulty;
    
    // 根据音频类型和难度生成对应的题目
    let exercise = {
      question: '',
      options: [],
      answer: null,
      explanation: ''
    };
    
    if (audioType === 'podcast') {
      // 热点播客的题目
      if (difficulty === 'sprout') {
        exercise.question = '根据音频内容，人工智能的主要应用领域是什么？';
        exercise.options = ['医疗健康', '金融服务', '自动驾驶', '工业制造'];
        exercise.answer = 2; // 索引为2的选项
        exercise.explanation = '音频中明确提到自动驾驶是当前人工智能最热门的应用领域之一，因为它结合了计算机视觉、深度学习和决策系统等多项AI技术。';
      } else if (difficulty === 'forest') {
        exercise.question = '根据音频内容，以下哪些是人工智能技术带来的好处？';
        exercise.options = ['提高生产效率', '促进经济发展', '降低人类工作压力', '消除就业岗位'];
        exercise.answer = [0, 1, 2]; // 多个正确答案
        exercise.explanation = '音频中讨论了AI的积极影响，包括提高生产效率、促进经济发展和减轻人类的重复性工作负担。音频中提到"消除就业岗位"是人们对AI的担忧，而非好处。';
      } else {
        exercise.question = '根据音频内容，填写人工智能在医疗领域的具体应用：人工智能可以帮助医生_____，提高诊断的准确率。';
        exercise.answer = '分析医学影像';
        exercise.explanation = '音频中特别强调了AI在医疗领域的应用，其中最突出的是通过深度学习算法分析医学影像（如X光片、CT、MRI扫描），帮助医生发现人眼可能忽略的病变细节。';
        }
      } else {
      // 名著的题目
      if (difficulty === 'sprout') {
        exercise.question = '《红楼梦》第一回中，贾宝玉的玉是由什么材质制成的？';
        exercise.options = ['翡翠玉', '通灵宝玉', '青田石', '和田玉'];
        exercise.answer = 1;
        exercise.explanation = '《红楼梦》第一回中明确提到贾宝玉口中含的是一块"通灵宝玉"，这是他出生时就含在口中的，是神瑛侍者的一块未经雕琢的顽石所化。';
      } else if (difficulty === 'forest') {
        exercise.question = '《红楼梦》第一回中，以下哪些人物出现了？';
        exercise.options = ['贾宝玉', '林黛玉', '薛宝钗', '贾母'];
        exercise.answer = [0, 1, 3];
        exercise.explanation = '《红楼梦》第一回中主要介绍了故事的由来和贾宝玉的前世今生，出现的人物有贾宝玉（神瑛侍者）、林黛玉（绛珠草）和贾母等，而薛宝钗在第一回中并未出现。';
      } else {
        exercise.question = '《红楼梦》第一回中，神瑛侍者将那株仙草带到_____去了。';
        exercise.answer = '警幻仙子处';
        exercise.explanation = '《红楼梦》第一回中描述神瑛侍者日以甘露灌溉绛珠草，后来将仙草带到警幻仙子处，请求警幻仙子将那株草生于世间，了还一段缘分。';
      }
    }
    
    return exercise;
  },
  
  // 单选题选择选项
  selectSingleOption: function(e) {
    const selectedIndex = e.currentTarget.dataset.index;
    this.setData({
      selectedSingleOption: selectedIndex
    });
  },
  
  // 提交单选题答案
  submitSingleChoice: function() {
    // 未选择答案
    if (this.data.selectedSingleOption === null) {
      wx.showToast({
        title: '请选择一个答案',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    const selectedIndex = this.data.selectedSingleOption;
    const isCorrect = selectedIndex === this.data.currentExercise.answer;
    
    if (isCorrect) {
      this.handleCorrectAnswer(3); // 3分
    } else {
      this.handleWrongAnswer();
    }
    
    // 重置选择
    this.setData({
      selectedSingleOption: null
    });
  },
  
  // 多选题选项切换
  toggleMultiOption: function(e) {
    const index = e.currentTarget.dataset.index;
    const selectedOptions = {...this.data.selectedOptions};
    
    if (selectedOptions[index]) {
      delete selectedOptions[index];
      } else {
      selectedOptions[index] = true;
    }
    
    this.setData({
      selectedOptions
    });
  },
  
  // 提交多选题答案
  submitMultiChoice: function() {
    const selectedIndices = Object.keys(this.data.selectedOptions).map(Number);
    const correctAnswer = this.data.currentExercise.answer;
    
    // 检查答案是否完全匹配
    const isCorrect = 
      selectedIndices.length === correctAnswer.length && 
      selectedIndices.every(index => correctAnswer.includes(index));
    
    if (isCorrect) {
      this.handleCorrectAnswer(5); // 5分
        } else {
      this.handleWrongAnswer();
    }
    
    // 重置选择
        this.setData({
      selectedOptions: {}
    });
  },
  
  // 填空题输入变化
  onFillInputChange: function(e) {
      this.setData({
      fillAnswer: e.detail.value
    });
  },
  
  // 提交填空题答案
  submitFillBlank: function() {
    const userAnswer = this.data.fillAnswer.trim();
    const correctAnswer = this.data.currentExercise.answer;
    
    const isCorrect = userAnswer === correctAnswer;
    
    if (isCorrect) {
      this.handleCorrectAnswer(7); // 7分
    } else {
      this.handleWrongAnswer();
    }
    
    // 重置填空
    this.setData({
      fillAnswer: ''
    });
  },
  
  // 切换播放状态
  togglePlay() {
    const isPlaying = !this.data.isPlaying;
    this.setData({ isPlaying });
    // TODO: 实际的音频播放控制
  },

  // 显示倍速选项
  showSpeedOptions() {
    wx.showActionSheet({
      itemList: ['0.5x', '0.8x', '1.0x', '1.2x', '1.5x', '2.0x'],
      success: (res) => {
        const speeds = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];
    this.setData({
          playbackSpeed: speeds[res.tapIndex]
        });
        // TODO: 设置实际的音频播放速度
      }
    });
  },
  
  // 获取今天日期的辅助函数
  getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 习题训练营相关功能 - 开始练习
  startExercise: function() {
    if (!this.data.currentAudioType) {
      wx.showToast({
        title: '请先选择音频类型',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 根据难度和音频类型生成题目描述
    const difficultyText = {
      'sprout': '萌芽岛 - 单选题',
      'forest': '破茧谷 - 多选题',
      'soar': '翱翔峰 - 填空题'
    }[this.data.currentDifficulty];
    
    const pointsText = {
      'sprout': '3分/题',
      'forest': '5分/题',
      'soar': '7分/题'
    }[this.data.currentDifficulty];
    
    const typeText = {
      'sprout': '请从选项中选择一个正确答案',
      'forest': '请选择所有正确答案，多选/漏选/错选均不得分',
      'soar': '请严格按照原文填写'
    }[this.data.currentDifficulty];
    
    const audioTypeText = this.data.currentAudioType === 'podcast' ? '热点「晓」播客' : '名著「晓」喇叭';
    
    // 显示加载提示
    wx.showLoading({
      title: '加载习题中...',
    });
    
    // 模拟加载过程
    setTimeout(() => {
      wx.hideLoading();
      
      // 显示开始练习的确认框
      wx.showModal({
        title: '开始练习',
        content: `您正在进行${audioTypeText}的${difficultyText}练习\n\n${typeText}\n\n答对可获得${pointsText}`,
        confirmText: '开始答题',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 根据不同难度和音频类型启动不同的题型
            this.launchExerciseByDifficulty();
          }
        }
      });
    }, 800);
  },
  
  // 根据难度启动对应练习
  launchExerciseByDifficulty: function() {
    // 创建模拟题目数据
    const exerciseData = this.generateExercise();
    
    // 根据难度显示不同的题型界面
    switch(this.data.currentDifficulty) {
      case 'sprout':
        this.showSingleChoiceExercise(exerciseData);
          break;
      case 'forest':
        this.showMultiChoiceExercise(exerciseData);
          break;
      case 'soar':
        this.showFillBlankExercise(exerciseData);
          break;
      default:
    wx.showToast({
          title: '未知难度类型',
        icon: 'none'
      });
    }
  },
  
  // 显示单选题界面
  showSingleChoiceExercise: function(exercise) {
    wx.showModal({
      title: exercise.audioTitle,
      content: exercise.question,
      showCancel: false,
      confirmText: '选择答案',
      success: () => {
        // 显示选项列表
        wx.showActionSheet({
          itemList: exercise.options,
      success: (res) => {
            // 检查答案
            const isCorrect = res.tapIndex === exercise.answer;
            if (isCorrect) {
              this.handleCorrectAnswer(3); // 3分
            } else {
              this.handleWrongAnswer();
            }
          }
        });
      }
    });
  },
  
  // 显示多选题界面 (在实际小程序中需要自定义UI组件)
  showMultiChoiceExercise: function(exercise) {
    // 这里是模拟实现，实际需要自定义多选UI组件
    wx.showModal({
      title: exercise.audioTitle,
      content: exercise.question + '\n\n注意：这是多选题，实际需要自定义UI组件实现',
      showCancel: false,
      confirmText: '知道了',
      success: () => {
        // 模拟随机答案
        const isCorrect = Math.random() > 0.5;
        if (isCorrect) {
          this.handleCorrectAnswer(5); // 5分
        } else {
          this.handleWrongAnswer();
        }
      }
    });
  },

  // 显示填空题界面 (在实际小程序中需要自定义UI组件)
  showFillBlankExercise: function(exercise) {
    // 这里是模拟实现，实际需要自定义填空UI组件
    wx.showModal({
      title: exercise.audioTitle,
      content: exercise.question + '\n\n注意：这是填空题，实际需要自定义UI组件实现',
      showCancel: false,
      confirmText: '知道了',
      success: () => {
        // 模拟随机答案
        const isCorrect = Math.random() > 0.5;
        if (isCorrect) {
          this.handleCorrectAnswer(7); // 7分
        } else {
          this.handleWrongAnswer();
        }
      }
    });
  },
  
  // 加载已完成的习题
  loadCompletedExercises: function() {
    const completedExercises = wx.getStorageSync('completedExercises') || [];
    this.setData({
      completedExercises: completedExercises
    });
  },
  
  // 检查习题是否已完成
  isExerciseCompleted: function(exercise) {
    return this.data.completedExercises.some(
      compExercise => compExercise.question === exercise.question
    );
  },
  
  // 将习题标记为已完成
  markExerciseCompleted: function(exercise) {
    if (!this.isExerciseCompleted(exercise)) {
      const completedExercise = {
        question: exercise.question,
        date: new Date().toISOString()
      };
      
      const completedExercises = [...this.data.completedExercises, completedExercise];
      
      wx.setStorageSync('completedExercises', completedExercises);
    this.setData({
        completedExercises: completedExercises
      });
      
      return true; // 首次完成
    }
    
    return false; // 已经完成过
  },
  
  // 处理正确答案
  handleCorrectAnswer: function(points) {
    const exercise = this.data.currentExercise;
    const isFirstAttempt = this.markExerciseCompleted(exercise);
    
    // 只有首次答对才加分
    if (isFirstAttempt) {
      this.setData({
        todayPoints: this.data.todayPoints + points,
        totalPoints: this.data.totalPoints + points
      });
    }
    
    this.setData({
      exerciseProgress: Math.min(100, this.data.exerciseProgress + 10),
      showResultModal: true,
      resultData: {
        isCorrect: true,
        points: isFirstAttempt ? points : 0,
        feedback: isFirstAttempt ? "恭喜你答对了！" : "恭喜你答对了！(重复作答不计分)",
        correctAnswer: this.formatCorrectAnswer(),
        explanation: this.data.currentExercise.explanation || "这里是听力原文内容"
      }
    });
  },
  
  // 处理错误答案
  handleWrongAnswer: function() {
    const exercise = this.data.currentExercise;
    this.markExerciseCompleted(exercise);
    
    this.setData({
      exerciseProgress: Math.min(100, this.data.exerciseProgress + 5),
      showResultModal: true,
      resultData: {
        isCorrect: false,
        points: 0,
        feedback: "很遗憾，答错了！再接再厉！",
        correctAnswer: this.formatCorrectAnswer(),
        explanation: this.data.currentExercise.explanation || "这里是听力原文内容"
      }
    });
  },

  // 格式化正确答案显示
  formatCorrectAnswer: function() {
    const exercise = this.data.currentExercise;
    
    if (this.data.currentDifficulty === 'sprout') {
      // 单选题
      const answerIndex = exercise.answer;
      return this.data.optionLetters[answerIndex] + '. ' + exercise.options[answerIndex];
    } else if (this.data.currentDifficulty === 'forest') {
      // 多选题
      return exercise.answer.map(index => 
        this.data.optionLetters[index] + '. ' + exercise.options[index]
      ).join('、');
    } else {
      // 填空题
      return exercise.answer;
    }
  },
  
  // 关闭结果弹窗
  closeResultModal: function() {
    this.setData({
      showResultModal: false
    });
  },
  
  // 加载收藏的习题
  loadFavoritedExercises: function() {
    const favoritedExercises = wx.getStorageSync('listening_mistakes') || [];
    this.setData({
      favoritedExercises: favoritedExercises
    });
  },

  // 检查习题是否已收藏
  isExerciseFavorited: function(exercise) {
    // 简单比较题目内容来确定是否重复
    return this.data.favoritedExercises.some(
      favExercise => favExercise.question === exercise.question
    );
  },

  // 收藏习题
  favoriteExercise: function() {
    // 获取当前习题
    const exercise = this.data.currentExercise;
    
    // 创建错题对象
    const errorExercise = {
      question: exercise.question,
      options: exercise.options,
      answer: exercise.answer,
      explanation: exercise.explanation,
      date: this.data.selectedDate, // 使用当前选择的日期作为习题日期，而不是收藏的时间
      audioType: this.data.currentAudioType,
      difficulty: this.data.currentDifficulty,
      language: this.data.currentLanguage,
      timestamp: Date.now() // 添加时间戳用于排序
    };
    
    // 检查是否已经收藏
    if (this.isExerciseFavorited(errorExercise)) {
      // 自定义提示，使用小号字体
      this.showSmallFontMessage('此前已收藏，请勿重复点击');
    } else {
      // 获取已有的错题数据
      const savedErrors = wx.getStorageSync('listening_mistakes') || [];
      
      // 添加新错题到数组中
      savedErrors.push(errorExercise);
      
      // 更新本地存储
      wx.setStorageSync('listening_mistakes', savedErrors);
      
      // 更新页面数据（保持与本地存储的同步）
      this.setData({
        favoritedExercises: savedErrors
      });
      
      // 使用小号字体显示成功消息
      this.showSmallFontMessage('已收藏至听力错题', 'success');
    }
    
    // 关闭弹窗
    this.closeResultModal();
  },
  
  // 显示小字体消息
  showSmallFontMessage: function(message, type = 'none') {
    // 创建自定义小字体的提示框
    const messageView = wx.createSelectorQuery().select('.custom-toast');
    
    // 先添加一个自定义toast元素到页面
      this.setData({
      customToastVisible: true,
      customToastText: message,
      customToastType: type
    });
    
    // 2秒后自动隐藏
    setTimeout(() => {
      this.setData({
        customToastVisible: false
      });
    }, 2000);
  }
})