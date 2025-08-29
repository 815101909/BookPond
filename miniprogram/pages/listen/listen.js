// 默认封面图片路径
const DEFAULT_COVER_IMAGE = '../../images/default_article_1.png';

// 引入跨环境云函数调用工具
const { listeningAPI, pointsAPI, readAPI } = require('../../utils/cloud-api');

// 通用临时链接处理函数
// 通用临时链接处理函数
async function getTemporaryUrl(fileUrl, type, isImage = false) {
  if (!fileUrl) {
    console.log(`${type}链接为空`);
    return isImage ? `https://via.placeholder.com/800x600.png?text=${type}` : null;
  }
  
  try {
    // 如果是云存储链接，转换为临时HTTP链接
    if (fileUrl.startsWith('cloud://')) {
      
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
        })
        await c.init();
        const result = await c.getTempFileURL({
          fileList: [fileUrl]
        });
        
        if (result.fileList && result.fileList[0] && result.fileList[0].tempFileURL) {
          return result.fileList[0].tempFileURL;
        } else {
          console.error(`${type}云存储链接转换结果异常:`, result);
          return isImage ? `https://via.placeholder.com/800x600.png?text=Error_${type}` : null;
        }
      } catch (err) {
        console.error(`${type}云存储链接转换失败:`, err);
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
}

// 图片临时链接处理函数（兼容性保留）
async function getTemporaryImageUrl(imageUrl, type) {
  return await getTemporaryUrl(imageUrl, type, true);
}

// 文件临时链接处理函数（兼容性保留）
async function getTemporaryFileUrl(fileUrl, type) {
  return await getTemporaryUrl(fileUrl, type, false);
}

// 处理内容中的图片链接
async function processContentImages(content) {
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
      const tempUrl = await getTemporaryImageUrl(imageUrl, '内容图片');
      // 替换内容中的图片链接
      processedContent = processedContent.replace(new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tempUrl);
    } catch (error) {
      console.error('处理内容图片失败:', error);
    }
  }
  
  return processedContent;
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

// 听力计时相关变量
let listeningStartTime = null;
let accumulatedListeningTime = 0;
let listeningTimer = null;
let currentPage = null;

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
    selectedDate: '', // 将在initData中设置为当前日期
    currentDifficulty: 'sprout',
    // currentAudioType: 'podcast', // 不再需要音频类型，根据日期获取所有类型文章
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
    
    // 当前音频信息
    currentAudio: {
      title: '',
      coverUrl: '',
      audioUrl: ''
    },
    
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
    customToastType: 'none',
    hasArticleData: false,  // 标记有文章数据
    showNoArticlesTip: false,  // 隐藏暂无文章提示
    currentExerciseIndex: 0,   // 初始化题目索引为0
    noContentForLanguage: false // 标记当前语言是否没有习题内容
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

  onLoad: function(options) {
    console.log('页面加载');
    
    // 初始化听力计时
    listeningStartTime = null;
    accumulatedListeningTime = 0;
    listeningTimer = null;
    currentPage = this;
    
    // 清除上次同步的分钟数记录
    wx.removeStorageSync('lastSyncedListenMinutes');
    
    // 初始化数据
    this.initData();
    
    // 初始化音频事件监听器
    this.initAudioListeners();
    
    // 直接加载最新文章
    this.directLoadArticle();
    
    // 开始计时
    this.startListeningTimer();
  },
  
  // 初始化音频事件监听器
  initAudioListeners: function() {
    const backgroundAudioManager = wx.getBackgroundAudioManager();
    
    // 监听播放事件
    backgroundAudioManager.onPlay(() => {
      console.log('音频开始播放');
      this.setData({
        isPlaying: true
      });
    });
    
    // 监听暂停事件
    backgroundAudioManager.onPause(() => {
      console.log('音频暂停播放');
      this.setData({
        isPlaying: false
      });
    });
    
    // 监听停止事件
    backgroundAudioManager.onStop(() => {
      console.log('音频停止播放');
      this.setData({
        isPlaying: false
      });
    });
    
    // 监听播放结束事件
    backgroundAudioManager.onEnded(() => {
      console.log('音频播放结束');
      this.setData({
        isPlaying: false
      });
    });
    
    // 监听错误事件
    backgroundAudioManager.onError((err) => {
      console.error('音频播放错误:', err);
      // 输出详细错误信息，便于调试
      console.error('错误代码:', err.errCode);
      console.error('错误信息:', err.errMsg);
      
      this.setData({
        isPlaying: false
      });
      
      // 根据错误类型显示不同提示
      let errorMsg = '音频资源不可用';
      if (err.errCode === 10001) {
        errorMsg = '系统错误';
      } else if (err.errCode === 10002) {
        errorMsg = '网络错误';
      } else if (err.errCode === 10003) {
        errorMsg = '文件错误';
      } else if (err.errCode === 10004) {
        errorMsg = '格式错误';
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none'
      });
    });
  },
  
  // 初始化数据
  initData: function() {
    console.log('初始化数据');
    
    // 设置默认数据
    this.setData({
      selectedDate: this.getCurrentDate(), // 设置默认日期为当前日期
      hasArticleData: false,
      showNoArticlesTip: false,  // 初始不显示暂无文章提示
      currentExerciseIndex: 0    // 初始化题目索引为0
    });
    
    // 加载已完成的习题列表
    this.loadCompletedExercises();
    
    // 加载用户积分数据
    this.loadUserPoints();
  },
  
  // 直接加载指定文章
  directLoadArticle: function(forceLanguageCode = null) {
    return new Promise((resolve, reject) => {
      console.log('加载最新文章');
      
      // 获取当前语言代码和日期
      const languageCode = forceLanguageCode || this.getLanguageCode();
      const currentDate = this.data.selectedDate || this.getCurrentDate();
      console.log('当前语言代码:', languageCode);
      console.log('查询日期:', currentDate);
      
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
      
      // 使用跨域云函数获取指定日期的文章
      listeningAPI.getAudioList({
        level: this.data.currentDifficulty,
        date: currentDate, // 使用当天日期查询
        page: 1,
        pageSize: 10,
        languageCode: languageCode
      }).then(async res => {
        console.log('获取文章结果:', res);
        wx.hideLoading();
        
        if (res.result && res.result.code === 0 && res.result.data && res.result.data.list) {
          const audioList = res.result.data.list;
          
          if (audioList && audioList.length > 0) {
            // 有当天数据，处理第一篇文章
            const firstAudio = audioList[0];
            console.log('找到当天文章:', firstAudio);
            
            // 处理文章数据
            const audioData = firstAudio;
            const title = audioData.title || '';
            const coverUrl = audioData.cover_url || '';
            const articleData = audioData.article_data;
            
            let audioUrl = audioData.audio_url || '';
            let transcript = audioData.transcript || '';
            
            // 确保exercises是一个数组
            let exercises = [];
            if (audioData.exercises && Array.isArray(audioData.exercises)) {
              exercises = audioData.exercises;
            } else if (audioData.exercises) {
              try {
                const exercisesObj = audioData.exercises;
                exercises = Object.keys(exercisesObj).map(key => exercisesObj[key]);
              } catch (e) {
                console.error('转换exercises失败:', e);
              }
            }
            
            console.log('获取到的习题数量:', exercises.length);
            if (exercises.length > 0) {
              console.log('第一道习题:', JSON.stringify(exercises[0]));
              if (exercises.length > 1) {
                console.log('第二道习题:', JSON.stringify(exercises[1]));
              }
            }
            
            // 更新音频信息
            this.setData({
              currentAudio: {
                title: title,
                coverUrl: coverUrl,
                audioUrl: audioUrl
              },
              currentArticleId: audioData._id,
              hasArticleData: true,
              showNoArticlesTip: false, // 有数据时隐藏提示
              currentExerciseIndex: 0
            });
            
            console.log('更新后的音频信息:', this.data.currentAudio);
            
            // 缓存文章数据，供后续使用
            if (articleData) {
              this.setData({
                cachedArticleData: {
                  [audioData._id]: {
                    title: title,
                    cover_url: coverUrl,
                    audio_url: audioUrl,
                    transcript: transcript,
                    exercises: exercises,
                    article_data: articleData
                  }
                }
              });
            }
            
            // 生成习题数据
            const exerciseData = {
              audioTitle: title,
              audioUrl: audioUrl,
              transcript: transcript,
              exercises: exercises
            };
            
            // 生成习题
            await this.generateExerciseFromListening(exerciseData);
            
            console.log('加载当天文章成功');
            resolve();
          } else {
            // 当天没有数据，显示提示
            console.log('当天暂无更新');
            this.setData({
              hasArticleData: false,
              showNoArticlesTip: true,
              currentAudio: {
                title: '今天暂未更新',
                coverUrl: '',
                audioUrl: ''
              }
            });
            
            wx.showToast({
              title: '今天暂未更新',
              icon: 'none',
              duration: 2000
            });
            
            resolve();
          }
        } else {
          console.log('未找到文章数据或接口返回错误');
          
          // 显示当天暂无更新
          this.setData({
            hasArticleData: false,
            showNoArticlesTip: true,
            currentAudio: {
              title: '今天暂未更新',
              coverUrl: '',
              audioUrl: ''
            }
          });
          
          wx.showToast({
            title: '今天暂未更新',
            icon: 'none',
            duration: 2000
          });
          
          resolve();
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('加载文章失败:', err);
        
        // 网络错误时的处理
        this.setData({
          hasArticleData: false,
          showNoArticlesTip: true,
          currentAudio: {
            title: '加载失败',
            coverUrl: '',
            audioUrl: ''
          }
        });
        
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
        
        reject(err);
      });
    });
  },
  
  // 预加载音频
  preloadAudio: function(audioUrl) {
    if (!audioUrl) {
      console.log('音频URL为空，无法预加载');
      return;
    }
    
    console.log('预加载音频:', audioUrl);
    
    // 创建音频上下文
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = audioUrl;
    
    // 监听加载完成事件
    innerAudioContext.onCanplay(() => {
      console.log('音频预加载完成');
      innerAudioContext.destroy();  // 销毁音频上下文
    });
    
    // 监听加载失败事件
    innerAudioContext.onError((err) => {
      console.error('音频预加载失败:', err);
      innerAudioContext.destroy();  // 销毁音频上下文
    });
  },
  
  // 初始化播放器
  initPlayer: function() {
    console.log('初始化播放器');
    
    if (!this.data.currentAudio || !this.data.currentAudio.audioUrl) {
      console.log('音频URL为空，无法初始化播放器');
      wx.showToast({
        title: '音频资源不可用',
        icon: 'none'
      });
      return;
    }
    
    const backgroundAudioManager = wx.getBackgroundAudioManager();
    backgroundAudioManager.title = this.data.currentAudio.title || '听力练习';
    backgroundAudioManager.epname = this.data.currentAudio.title || '听力练习';
    backgroundAudioManager.coverImgUrl = this.data.currentAudio.coverUrl || '';
    backgroundAudioManager.src = this.data.currentAudio.audioUrl;
    
    // 设置播放速度
    backgroundAudioManager.playbackRate = this.data.playbackSpeed;
    console.log('设置播放速度:', this.data.playbackSpeed);
    
    // 监听播放事件
    backgroundAudioManager.onPlay(() => {
      console.log('音频开始播放');
      this.setData({
        isPlaying: true
      });
    });
    
    // 监听暂停事件
    backgroundAudioManager.onPause(() => {
      console.log('音频暂停播放');
      this.setData({
        isPlaying: false
      });
    });
    
    // 监听停止事件
    backgroundAudioManager.onStop(() => {
      console.log('音频停止播放');
      this.setData({
        isPlaying: false
      });
    });
    
    // 监听播放结束事件
    backgroundAudioManager.onEnded(() => {
      console.log('音频播放结束');
      this.setData({
        isPlaying: false
      });
    });
    
    // 监听错误事件
    backgroundAudioManager.onError((err) => {
      console.error('音频播放错误:', err);
      this.setData({
        isPlaying: false
      });
      
      wx.showToast({
        title: '音频资源不可用',
        icon: 'none'
      });
    });
  },
  
  // 加载默认文章
  loadDefaultArticle: function() {
    console.log('加载默认文章');
    
    // 获取当前语言代码
    const languageCode = this.getLanguageCode();
    console.log('当前语言代码:', languageCode);
    
    // 使用云函数获取最新文章，不指定难度，获取任意难度的最新文章
    listeningAPI.getAudioList({
      languageCode: languageCode
    }).then(async res => {
      console.log('获取默认文章结果:', res);
      
      if (res.result && res.result.code === 0 && res.result.data) {
        const audioData = res.result.data;
        console.log('成功获取默认文章数据:', audioData);
        
        // 处理数据
        const title = audioData.title || '听力练习';
        const coverUrl = audioData.cover_url || '';
        const audioUrl = audioData.audio_url || '';
        const transcript = audioData.transcript || '';
        const exercises = audioData.exercises || [];
        const articleData = audioData.article_data;
        
        // 更新音频信息
        this.setData({
          currentAudio: {
            title: title,
            coverUrl: coverUrl,
            audioUrl: audioUrl
          },
          currentArticleId: audioData._id
        });
        
        // 缓存文章数据，供后续使用
        if (articleData) {
          this.setData({
            cachedArticleData: {
              [audioData._id]: {
                title: title,
                cover_url: coverUrl,
                audio_url: audioUrl,
                transcript: transcript,
                exercises: exercises,
                article_data: articleData
              }
            }
          });
        }
        
        // 生成习题数据
        const exerciseData = {
          audioTitle: title,
          audioUrl: audioUrl,
          transcript: transcript,
          exercises: exercises
        };
        
        // 生成习题
        await this.generateExerciseFromListening(exerciseData);
        
        console.log('加载默认文章成功');
      } else {
        console.log('未找到默认文章数据，使用模拟数据');
        
        // 使用模拟数据
        this.useSimulatedData();
      }
    }).catch(err => {
      console.error('加载默认文章失败:', err);
      
      // 使用模拟数据
      this.useSimulatedData();
    });
  },
  
  // 使用模拟数据
  useSimulatedData: function() {
    console.log('使用模拟数据');
    
    // 模拟数据
    const mockData = {
      title: '听力练习',
      coverUrl: 'https://636c-cloud1-2gqwon1jeb42e2eb-1308759454.tcb.qcloud.la/covers/universe.jpg',
      audioUrl: ''
    };
    
    // 更新音频信息
    this.setData({
      currentAudio: mockData
    });
    
    // 生成默认习题
      const defaultExercise = this.generateExercise();
      this.setData({
        currentExercise: defaultExercise
      });
      
    console.log('使用模拟数据成功');
  },
  
  // 测试glid关联查询
  testGlidQuery: function() {
    console.log('开始测试glid关联查询');
    
    // 直接使用云函数测试
    this.testWithCloudFunction();
  },
  
  // 使用云函数测试
  testWithCloudFunction: function() {
    console.log('开始使用云函数测试');
    
    // 使用云函数获取最新文章
    listeningAPI.getAudioList({
    }).then(res => {
      console.log('云函数返回结果:', res);
      
      if (res.result && res.result.code === 0 && res.result.data) {
        const articleData = res.result.data;
        console.log('成功获取文章数据:', articleData);
        
        // 使用云函数获取关联音频
        listeningAPI.getAudioDetail({
          glid: articleData._id
        }).then(audioRes => {
          console.log('获取关联音频结果:', audioRes);
          
          if (audioRes.result && audioRes.result.code === 0 && audioRes.result.data) {
            const audioData = audioRes.result.data;
            console.log('成功获取关联音频数据:', audioData);
            
            // 显示文章和音频数据
            this.displayTestData(articleData, audioData);
          } else {
            console.log('未找到关联音频数据');
            
            // 仍然显示文章数据
            this.displayTestData(articleData, null);
          }
        }).catch(err => {
          console.error('获取关联音频失败:', err);
          
          // 仍然显示文章数据
          this.displayTestData(articleData, null);
        });
      } else {
        console.log('未找到文章数据');
        
          wx.showToast({
          title: '未找到文章数据',
            icon: 'none',
            duration: 2000
          });
        }
    }).catch(err => {
      console.error('获取文章数据失败:', err);
      
      wx.showToast({
        title: '获取文章失败: ' + err.errMsg,
        icon: 'none',
        duration: 2000
      });
    });
  },
  
  // 尝试修复glid问题
  attemptToFixGlidIssue: function() {
    console.log('尝试修复glid问题');
    
    // 使用跨环境API获取音频数据
    listeningAPI.getAudioList({})
      .then(res => {
        if (res.result && res.result.data && res.result.data.length > 0) {
          console.log('修复: 获取到音频数据:', res.result.data.length, '条');
          
          // 2. 遍历检查glid字段
          let needsFixing = [];
          res.result.data.forEach(audio => {
            if (audio.glid) {
              console.log('修复: 音频ID:', audio._id, 'glid:', audio.glid, '类型:', typeof audio.glid);
              
              // 如果glid不是字符串，需要修复
              if (typeof audio.glid !== 'string') {
                needsFixing.push({
                  id: audio._id,
                  glid: audio.glid.toString() // 转换为字符串
                });
              }
            } else {
              console.log('修复: 音频ID:', audio._id, '没有glid字段');
            }
          });
          
          console.log('修复: 需要修复的记录数:', needsFixing.length);
          
          // 3. 修复需要修复的记录
          if (needsFixing.length > 0) {
            // 使用跨环境API批量更新
            listeningAPI.fixGlidType({
              records: needsFixing
            }).then(fixRes => {
              console.log('修复: 修复结果:', fixRes);
      
              wx.showToast({
                title: '修复了' + needsFixing.length + '条记录',
                icon: 'success',
                duration: 2000
              });
            }).catch(fixErr => {
              console.error('修复: 修复失败:', fixErr);
            });
          }
        } else {
          console.log('修复: 未找到音频数据');
        }
      })
      .catch(err => {
        console.error('修复: 获取音频数据失败:', err);
      });
  },
  
  // 使用硬编码的ID进行测试
  testWithHardcodedIds: function() {
    console.log('开始测试最新文章');
    
    // 1. 使用跨环境API查询最新文章
    console.log('测试: 查询最新文章');
    readAPI.getArticles({ limit: 1, orderBy: 'updatedAt', order: 'desc' })
      .then(articleRes => {
        console.log('测试: 查询最新文章结果:', articleRes);
        
        if (articleRes.result && articleRes.result.data && articleRes.result.data.length > 0) {
          const articleData = articleRes.result.data[0];
          console.log('测试: 成功获取最新文章数据:', articleData);
          
          // 2. 使用跨环境API查询关联音频内容
          listeningAPI.getAudioDetail({ glid: articleData._id })
            .then(audioRes => {
              console.log('测试: 查询关联音频结果:', audioRes);
              
              if (audioRes.result && audioRes.result.data && audioRes.result.data.length > 0) {
                console.log('测试: 找到关联音频数据:', audioRes.result.data);
                
                // 3. 显示成功消息
                wx.showToast({
                  title: '找到关联音频: ' + audioRes.result.data.length + '条',
                  icon: 'success',
                  duration: 2000
                });
                
                // 4. 尝试显示文章和音频数据
                this.displayTestData(articleData, audioRes.result.data[0]);
              } else {
                console.log('测试: 未找到关联音频数据');
                
                // 显示错误消息
                wx.showToast({
                  title: '未找到关联音频数据',
                  icon: 'none',
                  duration: 2000
                });
                
                // 仍然显示文章数据
                this.displayTestData(articleData, null);
              }
            })
            .catch(err => {
              console.error('测试: 查询关联音频失败:', err);
              
              // 显示错误消息
              wx.showToast({
                title: '查询关联音频失败',
                icon: 'none',
                duration: 2000
              });
              
              // 仍然显示文章数据
              this.displayTestData(articleData, null);
            });
        } else {
          console.log('测试: 未找到文章数据');
          
          // 显示错误消息
          wx.showToast({
            title: '未找到文章数据',
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(err => {
        console.error('测试: 查询最新文章失败:', err);
        
        // 显示错误消息
        wx.showToast({
          title: '查询最新文章失败: ' + (err.errMsg || err.message),
          icon: 'none',
          duration: 2000
        });
      });
  },
  
  // 显示测试数据
  displayTestData: function(articleData, audioData) {
    console.log('显示测试数据');
    
    // 处理文章数据
    let title = articleData.title || '听力练习';
    let coverUrl = articleData.cover_url || '';
    let audioUrl = '';
    let transcript = '';
    
    // 获取标题
    if (articleData.titles && articleData.titles.length > 0) {
      const zhTitle = articleData.titles.find(t => t.language === 'zh-CN');
      if (zhTitle) {
        title = zhTitle.title;
      }
    }
    
    // 获取音频URL
    if (articleData.audio && articleData.audio.url) {
      audioUrl = articleData.audio.url;
    }
    
    // 获取文本内容
    if (articleData.contents && articleData.contents.length > 0) {
      const zhContent = articleData.contents.find(c => c.language === 'zh-CN');
      if (zhContent && zhContent.content) {
        // 移除HTML标签
        transcript = zhContent.content.replace(/<[^>]+>/g, '');
      }
    }
    
    // 更新音频信息
    this.setData({
      currentAudio: {
        title: title,
        coverUrl: coverUrl,
        audioUrl: audioUrl
      }
    });
    
    // 生成习题数据
    const exerciseData = {
      audioTitle: title,
      audioUrl: audioUrl,
      transcript: transcript,
      exercises: audioData && audioData.exercises ? audioData.exercises : []
    };
    
    // 生成习题
    this.generateExerciseFromListening(exerciseData);
    
    wx.hideLoading();
    
    // 显示成功消息
    wx.showToast({
      title: '测试数据加载成功',
      icon: 'success',
      duration: 2000
    });
  },

  // 页面隐藏时触发
  onHide: function() {
    console.log('页面隐藏，停止音频播放');
    
    // 如果正在播放，停止播放
    if (this.data.isPlaying) {
      const backgroundAudioManager = wx.getBackgroundAudioManager();
      backgroundAudioManager.stop();
      
      this.setData({
        isPlaying: false
      });
    }
  },
  
  // 处理从收藏页面跳转过来的数据
  onShow: function() {
    // 从两个来源检查是否有待处理的数据
    this.checkAndLoadPendingExercise();
    
    // 检查是否有从错题本跳转过来的练习
    const app = getApp();
    if (app.globalData && app.globalData.pendingPractice) {
      const pendingPractice = app.globalData.pendingPractice;
      console.log('处理错题练习数据:', pendingPractice);
      
      // 设置当前难度
      this.setData({
        currentDifficulty: pendingPractice.difficulty || 'sprout'
      });
      
      // 加载指定的音频内容
      if (pendingPractice.audioId) {
        this.loadAudioDetail(pendingPractice.audioId);
      }
      
      // 清除待处理数据，避免重复加载
      app.globalData.pendingPractice = null;
      
      // 显示提示
      wx.showToast({
        title: '正在加载练习',
        icon: 'loading',
        duration: 1000
      });
    }
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
        // currentAudioType: pendingAudio.audioType, // 不再需要音频类型
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
        title: '热点「舟」播客已就绪',
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
    // 获取当前日期，用于判断是否为今日积分
    const today = new Date().toDateString();
    const lastPointsDate = wx.getStorageSync('lastPointsDate') || '';
    
    // 如果是新的一天，重置今日积分
    if (lastPointsDate !== today) {
      wx.setStorageSync('todayListenPoints', 0);
      wx.setStorageSync('lastPointsDate', today);
    }
    
    // 从本地获取今日积分
    const todayPoints = wx.getStorageSync('todayListenPoints') || 0;
    
    pointsAPI.getUserPoints().then(res => {
      console.log('获取用户积分结果:', res);
      if (res.result && res.result.code === 0 && res.result.data) {
        const userData = res.result.data;
        this.setData({
          todayPoints: todayPoints, // 今日积分从本地获取
          totalPoints: userData.listen_points || 0 // 总积分从云端获取
        });
      } else {
        console.error('获取用户积分失败', res);
        this.setData({
          todayPoints: todayPoints,
          totalPoints: 0
        });
        wx.showToast({
          title: '获取积分失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('获取用户积分出错', err);
      this.setData({
        todayPoints: todayPoints,
        totalPoints: 0
      });
      wx.showToast({
        title: '获取积分失败',
        icon: 'none'
      });
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
  
  // 更新用户积分
  updateUserPoints(type, delta) {
    pointsAPI.updateUserPoints({
      type: type, // 'listen_points' 或 'listen_flowers'
      delta: delta // 要增加的数值，可以是正数或负数
    }).then(res => {
      console.log('更新用户积分结果:', res);
      if (res.result && res.result.code === 0) {
        // 更新本地数据
        if (type === 'listen_points') {
          // 更新总积分
          this.setData({
            totalPoints: this.data.totalPoints + delta
          });
          
          // 同时更新今日积分（存储在本地）
          const todayPoints = this.data.todayPoints + delta;
          this.setData({ todayPoints });
          wx.setStorageSync('todayListenPoints', todayPoints);
        } else if (type === 'listen_flowers') {
          // 更新花朵（仅在云端记录，本地不显示）
        }
        
        // 显示提示
        wx.showToast({
          title: `获得${delta}积分`,
          icon: 'success'
        });
      } else {
        console.error('更新用户积分失败', res);
      }
    }).catch(err => {
      console.error('更新用户积分出错', err);
    });
  },

  // 获取当前日期字符串
  getCurrentDate: function() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 设置今天日期
  setToday: function() {
    this.setData({
      selectedDate: this.getCurrentDate()
    });
  },
  
  // 日期选择改变处理函数
  onDateChange(e) {
    const date = e.detail.value;
    
    // 清除旧日期的缓存
    const oldDate = this.data.selectedDate || this.getCurrentDate();
    if (oldDate !== date) {
      // 清除所有难度的旧日期缓存
      ['sprout', 'forest'].forEach(difficulty => {
        const oldCacheKey = `cached_${difficulty}_${oldDate}_articles`;
        wx.removeStorageSync(oldCacheKey);
      });
    }
    
    this.setData({
      selectedDate: date
    });
    // 根据选择的日期加载对应的内容
    this.loadContentByDate(date);
  },

  // 根据日期加载内容
  loadContentByDate(date) {
    console.log('加载日期：', date, '的内容');
    
    // 更新选择的日期
    this.setData({
      selectedDate: date
    });
    
    // 根据当前日期重新加载文章
    // 不再限制音频类型，获取所有类型的文章
    this.loadArticlesByType();
  },

  // 语言选择改变处理函数
  async onLanguageChange(e) {
    const index = e.detail.value;
    const selectedLanguage = this.data.languages[index];
    const previousLanguage = this.data.currentLanguage;
    
    console.log('语言切换:', previousLanguage, '->', selectedLanguage);
    
    this.setData({
      currentLanguage: selectedLanguage
    });
    
    // 获取语言代码
    const languageCode = this.getLanguageCode();
    console.log('语言代码:', languageCode);
    
    // 如果已经有文章数据，尝试切换音频
    if (this.data.currentArticleId) {
      this.switchAudioLanguage(languageCode);
      
      // 如果有习题数据，尝试切换到对应语言的习题
      if (this.data.listeningExercise && this.data.listeningExercise.exercises && this.data.listeningExercise.exercises.length > 0) {
        // 尝试找到与当前语言匹配的习题
        const currentLangExercises = this.data.listeningExercise.exercises.filter(ex => ex.language === languageCode);
        
        if (currentLangExercises.length > 0) {
          console.log(`找到${currentLangExercises.length}个${languageCode}语言的习题，切换到第一个`);
          
          // 找到第一个当前语言的习题在原始数组中的索引
          const firstLangExerciseIndex = this.data.listeningExercise.exercises.findIndex(ex => ex.language === languageCode);
          
          if (firstLangExerciseIndex !== -1) {
            // 获取当前语言的习题
            const langExercise = this.data.listeningExercise.exercises[firstLangExerciseIndex];
            
            // 检查习题是否有对应语言的音频
            if (langExercise && langExercise.audio) {
              console.log('当前习题有音频:', langExercise.audio);
              
              // 如果音频是对象形式，可能包含多种语言
              if (typeof langExercise.audio === 'object') {
                // 尝试获取当前语言的音频
                if (langExercise.audio[languageCode]) {
                  this.data.listeningExercise.audioUrl = await getTemporaryFileUrl(langExercise.audio[languageCode], '习题音频');
                  console.log(`找到习题中 ${languageCode} 语言的音频:`, this.data.listeningExercise.audioUrl);
                } else if (langExercise.audio['zh-CN']) {
                  this.data.listeningExercise.audioUrl = await getTemporaryFileUrl(langExercise.audio['zh-CN'], '习题音频');
                  console.log('未找到当前语言音频，使用中文音频:', this.data.listeningExercise.audioUrl);
                } else {
                  const firstLang = Object.keys(langExercise.audio)[0];
                  if (firstLang) {
                    this.data.listeningExercise.audioUrl = await getTemporaryFileUrl(langExercise.audio[firstLang], '习题音频');
                    console.log(`未找到中文音频，使用 ${firstLang} 语言音频:`, this.data.listeningExercise.audioUrl);
                  }
                }
              } else if (typeof langExercise.audio === 'string') {
                this.data.listeningExercise.audioUrl = await getTemporaryFileUrl(langExercise.audio, '习题音频');
                console.log('习题音频是字符串形式:', this.data.listeningExercise.audioUrl);
              }
            }
            
            // 更新索引
            this.setData({
              currentExerciseIndex: firstLangExerciseIndex
            });
            
            // 使用现有的听力练习数据加载习题
            await this.generateExerciseFromListening(this.data.listeningExercise);
            
            // 显示提示
            wx.showToast({
              title: '已切换到当前语言习题',
              icon: 'success',
              duration: 1500
            });
            
            return; // 已经切换了习题，不需要重新加载文章
          }
                  } else {
          console.log(`当前缓存中未找到${languageCode}语言的习题，尝试重新加载文章数据`);
          
          // 先清除noContentForLanguage标志，给重新加载一个机会
          this.setData({
            noContentForLanguage: false,
            currentExerciseIndex: 0
          });
          
          // 不要立即设置无内容标志，而是尝试重新加载文章
          // 这样可以获取可能存在的其他语言内容
        }
      }
      
      // 重新加载内容，确保切换后的数据完全更新
      if (previousLanguage !== selectedLanguage) {
        wx.showLoading({
          title: '切换语言...',
          mask: true
        });
        
        // 检查是否有选择的日期，如果有则按日期加载，否则加载最新文章
        const hasSelectedDate = this.data.selectedDate && this.data.selectedDate !== this.getCurrentDate();
        
        // 添加重试机制
        const retryLoadArticle = (retryCount = 0) => {
          let loadPromise;
          
          if (hasSelectedDate) {
            // 如果用户选择了特定日期，保持日期筛选
            console.log('保持用户选择的日期:', this.data.selectedDate);
            loadPromise = new Promise((resolve, reject) => {
              this.loadArticlesByType('date');
              // 给loadArticlesByType一些时间完成
              setTimeout(() => {
                if (this.data.hasArticleData) {
                  resolve();
                } else {
                  reject(new Error('按日期加载失败'));
                }
              }, 2000);
            });
          } else {
            // 没有特定日期选择，加载最新文章
            loadPromise = this.directLoadArticle(languageCode);
          }
          
          loadPromise.then(() => {
            // 加载成功
            console.log('语言切换成功');
            wx.hideLoading();
          }).catch((err) => {
            console.error('语言切换失败:', err);
            
            if (retryCount < 2) {
              console.log(`第${retryCount + 1}次重试加载文章`);
              setTimeout(() => {
                retryLoadArticle(retryCount + 1);
              }, 1000);
            } else {
              wx.hideLoading();
              wx.showModal({
                title: '加载失败',
                content: `切换到${selectedLanguage}时遇到网络问题，是否重试？`,
                confirmText: '重试',
                cancelText: '取消',
                success: (res) => {
                  if (res.confirm) {
                    wx.showLoading({
                      title: '重新加载...',
                      mask: true
                    });
                    retryLoadArticle(0);
                  } else {
                    // 用户取消，恢复到之前的语言
                    const prevIndex = this.data.languages.indexOf(previousLanguage);
                    if (prevIndex !== -1) {
                      this.setData({
                        currentLanguage: previousLanguage,
                        languageIndex: prevIndex
                      });
                    }
                  }
                }
              });
            }
          });
        };
        
        // 开始加载
        retryLoadArticle();
      }
    } else {
      // 如果没有文章数据，直接加载新语言的文章
      this.directLoadArticle(languageCode);
    }
  },
  
  // 切换音频语言
  switchAudioLanguage: function(languageCode) {
    console.log('切换音频语言:', languageCode);
    
    // 如果有缓存的文章数据
    if (this.data.cachedArticleData && this.data.cachedArticleData[this.data.currentArticleId]) {
      const articleData = this.data.cachedArticleData[this.data.currentArticleId].article_data;
      if (articleData) {
        this.updateAudioByLanguage(articleData, languageCode);
      }
    } else {
      // 没有缓存，使用云函数获取文章数据
      listeningAPI.getAudioDetail({
        glid: this.data.currentArticleId
      }).then(res => {
        if (res.result && res.result.code === 0 && res.result.data) {
          const articleData = res.result.data;
          this.updateAudioByLanguage(articleData, languageCode);
        }
      }).catch(err => {
        console.error('获取文章数据失败:', err);
      });
    }
  },
  
  // 根据语言更新音频
  updateAudioByLanguage: async function(articleData, languageCode) {
    console.log('根据语言更新音频:', languageCode);
    
    // 当前音频信息
    const currentAudio = { ...this.data.currentAudio };
    
    // 获取对应语言的标题
    if (articleData.titles && articleData.titles.length > 0) {
      const langTitle = articleData.titles.find(t => t.language === languageCode);
      if (langTitle) {
        currentAudio.title = langTitle.title;
      }
    }
    
    // 首先尝试从当前习题中获取对应语言的音频
    let foundAudioInExercise = false;
    if (this.data.listeningExercise && 
        this.data.listeningExercise.exercises && 
        this.data.listeningExercise.exercises.length > 0) {
      
      const currentExerciseIndex = this.data.currentExerciseIndex || 0;
      if (currentExerciseIndex < this.data.listeningExercise.exercises.length) {
        const currentExercise = this.data.listeningExercise.exercises[currentExerciseIndex];
        
        if (currentExercise && currentExercise.audio) {
          console.log('当前习题有音频:', currentExercise.audio);
          
          // 如果音频是对象形式，可能包含多种语言
          if (typeof currentExercise.audio === 'object') {
            // 尝试获取当前语言的音频
            if (currentExercise.audio[languageCode]) {
              currentAudio.audioUrl = await getTemporaryFileUrl(currentExercise.audio[languageCode], '习题音频');
              console.log(`找到习题中 ${languageCode} 语言的音频:`, currentAudio.audioUrl);
              foundAudioInExercise = true;
            }
            // 如果没有当前语言的音频，尝试获取中文音频
            else if (currentExercise.audio['zh-CN']) {
              currentAudio.audioUrl = await getTemporaryFileUrl(currentExercise.audio['zh-CN'], '习题音频');
              console.log('未找到当前语言音频，使用中文音频:', currentAudio.audioUrl);
              foundAudioInExercise = true;
            }
            // 如果没有中文音频，使用第一个可用的音频
            else {
              const firstLang = Object.keys(currentExercise.audio)[0];
              if (firstLang) {
                currentAudio.audioUrl = await getTemporaryFileUrl(currentExercise.audio[firstLang], '习题音频');
                console.log(`未找到中文音频，使用 ${firstLang} 语言音频:`, currentAudio.audioUrl);
                foundAudioInExercise = true;
              }
            }
          }
          // 如果音频是字符串形式，直接使用
          else if (typeof currentExercise.audio === 'string') {
            currentAudio.audioUrl = await getTemporaryFileUrl(currentExercise.audio, '习题音频');
            console.log('习题音频是字符串形式:', currentAudio.audioUrl);
            foundAudioInExercise = true;
      }
    }
      }
    }
    
    // 如果没有在习题中找到音频，则不再从文章中获取
    
    // 更新音频信息
    this.setData({ currentAudio });
    
    // 如果正在播放，切换音频源
    if (this.data.isPlaying) {
      const backgroundAudioManager = wx.getBackgroundAudioManager();
      backgroundAudioManager.title = currentAudio.title;
      backgroundAudioManager.epname = currentAudio.title;
      backgroundAudioManager.src = currentAudio.audioUrl;
    }
  },

  // 选择难度
  selectDifficulty(e) {
    const newDifficulty = e.currentTarget.dataset.difficulty;
    const oldDifficulty = this.data.currentDifficulty;
    
    // 如果选择的是同一个难度，不做任何操作
    if (newDifficulty === oldDifficulty) {
      return;
    }
    
    console.log(`从 ${oldDifficulty} 切换到 ${newDifficulty} 难度`);
    
    // 保存当前音频状态
    const wasPlaying = this.data.isPlaying;
    const currentAudio = { ...this.data.currentAudio };
    const playbackSpeed = this.data.playbackSpeed;
    
    // 如果正在播放，先暂停
    if (wasPlaying) {
      const backgroundAudioManager = wx.getBackgroundAudioManager();
      backgroundAudioManager.pause();
    }
    
    // 立即更新UI，提高响应速度
    this.setData({
      currentDifficulty: newDifficulty,
      // 重置题目状态
      selectedSingleOption: null,
      selectedOptions: {},
      fillAnswer: '',
      // 重置题目索引，确保从第一题开始
      currentExerciseIndex: 0,
      // 记录我们要恢复播放
      shouldResumeAudio: wasPlaying,
      // 显示加载状态
      isLoadingListening: true
    });
    
    // 显示加载提示，但使用更短的延迟
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 检查缓存中是否有该难度和日期的文章
    const selectedDate = this.data.selectedDate || this.getCurrentDate();
    const cacheKey = `cached_${newDifficulty}_${selectedDate}_articles`;
    const cachedArticles = wx.getStorageSync(cacheKey);
    
    if (cachedArticles && cachedArticles.length > 0 && cachedArticles[0]._id) {
      console.log('使用缓存的文章数据:', cachedArticles[0]._id);
      
      // 使用缓存数据
      wx.hideLoading();
      this.selectArticle(cachedArticles[0]._id, () => {
        // 回调：在加载完成后恢复音频状态
        if (this.data.shouldResumeAudio) {
          setTimeout(() => {
            // 恢复播放
            this.togglePlay();
            // 恢复播放速度
            this.setData({ playbackSpeed });
            const backgroundAudioManager = wx.getBackgroundAudioManager();
            backgroundAudioManager.playbackRate = playbackSpeed;
          }, 500); // 减少延迟时间
        }
      });
      
      // 在后台刷新缓存
      this.refreshArticleCache(newDifficulty);
      return;
    }
    
    // 加载新难度的文章
    const queryDate = this.data.selectedDate || this.getCurrentDate();
    
    listeningAPI.getAudioList({
      level: newDifficulty, // 云函数期望的参数名是level，不是difficulty
      date: queryDate, // 使用用户选择的日期
      page: 1,
      pageSize: 10
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const audioList = res.result.data.list;
        
        if (audioList && audioList.length > 0) {
          // 缓存结果
          wx.setStorageSync(cacheKey, audioList);
          
          // 找到了新难度的文章，选择第一篇
          this.selectArticle(audioList[0]._id, () => {
            // 回调：在加载完成后恢复音频状态
            if (this.data.shouldResumeAudio) {
              setTimeout(() => {
                // 恢复播放
                this.togglePlay();
                // 恢复播放速度
                this.setData({ playbackSpeed });
                const backgroundAudioManager = wx.getBackgroundAudioManager();
                backgroundAudioManager.playbackRate = playbackSpeed;
              }, 500); // 减少延迟时间
            }
          });
          
          // 预加载另一个难度的文章
          this.preloadOtherDifficulty(newDifficulty);
        } else {
          // 如果API返回没有找到，尝试使用我们的新云函数
          console.log(`API未返回${newDifficulty === 'sprout' ? '萌芽岛' : '森林谷'}难度的文章，尝试使用新云函数`);
          
          // 使用我们新添加的云函数查询
          this.tryFindArticlesByDifficulty(newDifficulty);
        }
      } else {
        // API调用失败，尝试使用新云函数
        console.error('加载新难度文章失败:', res);
        this.tryFindArticlesByDifficulty(newDifficulty);
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('切换难度失败:', err);
      
      // 错误发生时，尝试使用我们的新云函数
      console.log('云函数调用失败，尝试使用新云函数');
      this.tryFindArticlesByDifficulty(newDifficulty);
    });
  },
  
  // 预加载另一个难度的文章
  preloadOtherDifficulty(currentDifficulty) {
    // 确定要预加载的难度
    const difficultyToPreload = currentDifficulty === 'sprout' ? 'forest' : 'sprout';
    console.log('预加载', difficultyToPreload, '难度的文章');
    
    // 检查是否已有缓存
    const selectedDate = this.data.selectedDate || this.getCurrentDate();
    const cacheKey = `cached_${difficultyToPreload}_${selectedDate}_articles`;
    const cachedArticles = wx.getStorageSync(cacheKey);
    
    if (cachedArticles && cachedArticles.length > 0) {
      console.log('已有缓存，跳过预加载');
      return;
    }
    
    // 在后台加载另一个难度的文章
    listeningAPI.getAudioList({
      level: difficultyToPreload, // 云函数期望的参数名是level，不是difficulty
      date: this.data.selectedDate || this.getCurrentDate(), // 使用用户选择的日期
      page: 1,
      pageSize: 5
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const audioList = res.result.data.list;
        
        if (audioList && audioList.length > 0) {
          // 缓存结果
          wx.setStorageSync(cacheKey, audioList);
          console.log('预加载完成，缓存了', audioList.length, '篇文章');
        }
      }
    }).catch(err => {
      console.error('预加载失败:', err);
    });
  },
  
  // 在后台刷新文章缓存
  refreshArticleCache(difficulty) {
    console.log('在后台刷新', difficulty, '难度的文章缓存');
    
    listeningAPI.getAudioList({
      level: difficulty, // 云函数期望的参数名是level，不是difficulty
      date: this.data.selectedDate || this.getCurrentDate(), // 使用用户选择的日期
      page: 1,
      pageSize: 10
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const audioList = res.result.data.list;
        
        if (audioList && audioList.length > 0) {
          // 更新缓存
          const selectedDate = this.data.selectedDate || this.getCurrentDate();
          const cacheKey = `cached_${difficulty}_${selectedDate}_articles`;
          wx.setStorageSync(cacheKey, audioList);
          console.log('缓存刷新完成，更新了', audioList.length, '篇文章');
        }
      }
    }).catch(err => {
      console.error('缓存刷新失败:', err);
    });
  },
  
  // 尝试通过云函数查找指定难度的文章
  async tryFindArticlesByDifficulty(difficulty) {
    console.log('尝试通过云函数查找难度为', difficulty, '的文章');
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 获取当前语言代码
    const languageCode = this.getLanguageCode();
    
    // 调用云函数获取指定难度的文章
    listeningAPI.getAudioList({
      difficulty: difficulty,
      languageCode: languageCode
    }).then(async res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0 && res.result.data && res.result.data.articles.length > 0) {
        const articles = res.result.data.articles;
        console.log('成功获取指定难度的文章:', articles);
        
        // 选择第一篇文章
        const firstArticle = articles[0];
        
        // 调试输出，检查文章数据结构
        console.log('选中的文章数据:', JSON.stringify(firstArticle));
        
        // 检查文章是否包含contents字段
        if (firstArticle.contents && firstArticle.contents.length > 0) {
          const zhContent = firstArticle.contents.find(c => c.language === 'zh-CN');
          if (zhContent && zhContent.audio) {
            console.log('从contents找到中文音频:', zhContent.audio);
            // 修正文章的音频URL
            firstArticle.audio_url = zhContent.audio;
          }
        }
        
        if (firstArticle.audio_id) {
          // 如果有关联的音频ID，使用它加载文章
          console.log('使用关联音频ID加载文章:', firstArticle.audio_id);
          this.selectArticle(firstArticle.audio_id);
        } else {
          // 否则直接使用文章数据生成练习
          console.log('直接使用文章数据生成练习');
          await this.generateExerciseFromArticle(firstArticle);
        }
      } else {
        console.log('云函数未返回指定难度的文章，使用默认练习');
        this.generateDefaultExercise();
        
        wx.showToast({
          title: `未找到${difficulty === 'sprout' ? '萌芽岛' : '森林谷'}难度的文章，已切换到默认练习`,
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('调用云函数失败:', err);
      this.generateDefaultExercise();
      
      wx.showToast({
        title: '加载失败，已切换到默认练习',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 从文章数据直接生成练习
  async generateExerciseFromArticle(article) {
    console.log('从文章数据直接生成练习:', article);
    
    // 处理音频URL
    let audioUrl = article.audio_url || '';
    if (audioUrl) {
      console.log('原始音频URL:', audioUrl);
      
      // 检查音频URL格式
      if (!audioUrl.startsWith('http') && !audioUrl.startsWith('cloud://')) {
        console.log('音频URL格式不完整，尝试修复');
        
        // 如果是相对路径，尝试添加云存储前缀
        if (!audioUrl.startsWith('/')) {
          audioUrl = 'cloud://' + audioUrl;
          console.log('修复后的音频URL:', audioUrl);
        }
      }
      
      // 预加载音频，提高后续播放速度
      if (audioUrl.startsWith('cloud://')) {
        console.log('预加载云存储音频:', audioUrl);
        getTemporaryFileUrl(audioUrl, '音频文件').then(tempUrl => {
           console.log('音频预加载结果:', tempUrl);
           
           // 检查临时URL是否有效
           if (tempUrl) {
             // 保存临时路径，以便后续使用
             this.setData({
               'tempAudioPath': tempUrl
             });
             console.log('音频预加载成功:', tempUrl);
           } else {
             console.warn('音频预加载获取到空URL');
           }
         }).catch(err => {
           console.error('音频预加载失败:', err);
         });
      }
    } else {
      console.log('未提供音频URL');
    }
    
    // 处理封面URL - 寻找并设置默认封面
    let coverUrl = '';
    
    // 1. 检查article.cover_url
    if (article.cover_url) {
      coverUrl = article.cover_url;
      console.log('使用article.cover_url作为封面:', coverUrl);
    } 
    // 2. 检查contents中的封面
    else if (article.contents && article.contents.length > 0) {
      const zhContent = article.contents.find(c => c.language === 'zh-CN');
      if (zhContent && zhContent.cover) {
        coverUrl = zhContent.cover;
        console.log('使用contents中的cover作为封面:', coverUrl);
      }
    }
    
    // 3. 如果仍未找到封面，使用默认图片
    if (!coverUrl) {
      coverUrl = this.DEFAULT_COVER_IMAGE;
      console.log('未找到封面，使用默认图片:', coverUrl);
    }
    
    // 构建音频数据
    const audioData = {
      title: article.title || '听力练习',
      cover_url: coverUrl,
      audio_url: audioUrl,
      transcript: article.transcript || '',
      exercises: article.exercises || []
    };
    
    // 处理云存储封面URL
    coverUrl = await getTemporaryFileUrl(coverUrl, 'image');
    
    // 更新音频信息
    this.setData({
      currentAudio: {
        title: audioData.title,
        coverUrl: coverUrl,
        audioUrl: audioUrl
      },
      isLoadingListening: false,
      hasArticleData: true
    });
    
    // 生成习题
    const exerciseData = {
      audioTitle: audioData.title,
      audioUrl: audioUrl,
      coverUrl: coverUrl,
      transcript: audioData.transcript,
      exercises: audioData.exercises,
      contents: article.contents
    };
    
    await this.generateExerciseFromListening(exerciseData);
    wx.hideLoading();
  },

  // 生成默认练习，在加载失败时使用
  generateDefaultExercise() {
    console.log('生成默认练习题');
    
    // 根据当前难度生成不同的默认题目
    let defaultExercise;
    
    if (this.data.currentDifficulty === 'forest') {
      // 森林谷难度默认题目
      defaultExercise = {
        question: '以下哪些是正确的语言学习方法？',
        type: 'multiple',
        options: [
          '每天坚持听说读写',
          '多接触目标语言的原生材料',
          '只学语法不练习口语',
          '死记硬背单词列表'
        ],
        answer: [0, 1],
        explanation: '语言学习需要每天坚持练习，包括听说读写全方面发展，同时多接触原生材料可以提高语感和实际应用能力。'
      };
    } else {
      // 萌芽岛难度默认题目
      defaultExercise = {
        question: '学习一门语言最重要的是什么？',
        type: 'single',
        options: [
          '坚持不懈的努力',
          '天赋和语言能力',
          '昂贵的学习资料',
          '出国留学经历'
        ],
        answer: 0,
        explanation: '语言学习最重要的是坚持不懈的努力，持之以恒地练习才能取得进步。'
      };
    }
    
    // 设置当前练习
    this.setData({
      currentExercise: defaultExercise,
      hasArticleData: true,
      isLoadingListening: false,
      currentAudio: {
        title: '默认练习',
        coverUrl: '/images/default_article_1.png',
        audioUrl: ''
      }
    });
    
    return defaultExercise;
  },

  // 选择音频类型
  selectAudioType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      // currentAudioType: type, // 不再需要音频类型
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
    const difficulty = this.data.currentDifficulty;
    const date = this.data.selectedDate || this.getCurrentDate(); // 如果没有选择日期，使用当前日期
    
    wx.showLoading({
      title: '加载文章...',
      mask: true
    });
    
    console.log('加载文章参数:', { difficulty, date });
    
    // 调用跨域云函数获取音频列表
    listeningAPI.getAudioList({
      level: difficulty, // 云函数期望的参数名是level，不是difficulty
      date: date,
      page: 1,
      pageSize: 10
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const audioList = res.result.data.list;
        console.log('加载文章成功:', audioList);
        console.log('查询条件:', res.result.data.query);
        
        if (audioList && audioList.length > 0) {
          // 默认选择第一篇文章
          const firstAudio = audioList[0];
          console.log('选择第一篇音频:', firstAudio);
          console.log('音频数据详情:', JSON.stringify(firstAudio));
          
          // 如果有glid字段，使用云函数获取文章数据
          if (firstAudio.glid) {
            console.log('发现glid字段，值为:', firstAudio.glid);
            
            // 调用跨域云函数获取文章数据
            listeningAPI.getAudioDetail({
              type: 'getArticleByGlid',
              glid: firstAudio.glid
            }).then(articleRes => {
              console.log('getArticleByGlid云函数返回结果:', articleRes);
              
              if (articleRes.result && articleRes.result.code === 0) {
                const article = articleRes.result.data;
                console.log('成功获取关联文章:', article);
                
                // 合并音频和文章数据
                const combinedData = {
                  _id: firstAudio._id,
                  title: article.titles && article.titles.length > 0 ? 
                    (article.titles.find(t => t.language === 'zh-CN')?.title || article.title) : 
                    (article.title || '听力练习'),
                  cover_url: article.cover_url || '',
                  audio_url: article.audio?.url || '',
                  exercises: firstAudio.exercises || [],
                  transcript: article.contents && article.contents.length > 0 ?
                    (article.contents.find(c => c.language === 'zh-CN')?.content || '').replace(/<[^>]+>/g, '') :
                    ''
                };
                
                console.log('合并后的数据:', combinedData);
                
                // 缓存文章数据，供后续使用
                this.setData({
                  cachedArticleData: {
                    [firstAudio._id]: combinedData
                  }
                });
                
                // 使用音频ID选择文章
                this.selectArticle(firstAudio._id);
              } else {
                console.error('获取关联文章失败:', articleRes.result);
                
                // 仍然使用音频数据
                this.selectArticle(firstAudio._id);
              }
            }).catch(articleErr => {
              console.error('调用获取文章云函数失败:', articleErr);
              // 仍然使用音频数据
              this.selectArticle(firstAudio._id);
            });
          } else {
            console.log('音频数据没有glid字段，直接使用音频数据');
            // 没有glid字段，直接使用音频数据
            this.selectArticle(firstAudio._id);
          }
        } else {
          wx.showToast({
            title: '暂无文章',
            icon: 'none'
          });
        }
      } else {
        console.error('加载文章失败:', res);
        wx.showToast({
          title: '加载文章失败',
          icon: 'none'
        });
      }
    }).catch(error => {
        wx.hideLoading();
        console.error('加载文章失败:', error);
        wx.showToast({
          title: '加载文章失败',
          icon: 'none'
        });
      });
  },
  
  // 选择特定文章并加载其听力练习
  selectArticle(articleId, callback) {
    if (!articleId) return;
    
    this.setData({
      currentArticleId: articleId,
      isLoadingListening: true
    });
    
    console.log('选择文章:', articleId);
    
    // 检查是否有缓存的文章数据
    if (this.data.cachedArticleData && this.data.cachedArticleData[articleId]) {
      console.log('使用缓存的文章数据');
      const cachedData = this.data.cachedArticleData[articleId];
      
      // 更新音频信息
      this.setData({
        currentAudio: {
          title: cachedData.title || '听力练习',
          coverUrl: cachedData.cover_url || '',
          audioUrl: cachedData.audio_url || ''
        }
      });
      
      // 生成习题
      const exerciseData = {
        audioTitle: cachedData.title,
        audioUrl: cachedData.audio_url,
        transcript: cachedData.transcript,
        exercises: cachedData.exercises || []
      };
      
      // 生成习题
      this.generateExerciseFromListening(exerciseData);
      
      // 加载翻译
      const languageCode = this.getLanguageCode();
      if (languageCode !== 'zh-CN') {
        this.loadListeningTranslations(articleId, languageCode);
      }
      
      this.setData({
        isLoadingListening: false
      });
      
      wx.hideLoading();
      
      // 执行回调
      if (typeof callback === 'function') {
        callback();
      }
    } else {
      // 没有缓存数据，加载文章的听力练习
      const languageCode = this.getLanguageCode();
      this.loadListeningExercise(articleId, languageCode, callback);
    }
  },
  
  // 加载听力练习
  loadListeningExercise(articleId, callback) {
    const languageCode = this.getLanguageCode();
    
    wx.showLoading({
      title: '加载听力练习...',
      mask: true
    });
    
    // 保存当前文章ID
    this.setData({
      currentArticleId: articleId,
      isLoadingListening: true
    });
    
    console.log('正在加载音频ID:', articleId);
    
    // 先尝试获取音频详情
    listeningAPI.getAudioDetail({
      audioId: articleId
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const audioData = res.result.data;
        console.log('获取音频详情成功:', audioData);
        
        // 更新音频信息
        const coverUrl = audioData.cover_url || '';
        console.log('获取到封面URL:', coverUrl);
        
        // 如果是云存储路径，获取临时URL
        if (coverUrl && coverUrl.startsWith('cloud://')) {
          console.log('检测到云存储封面URL，获取临时URL');
          getTemporaryFileUrl(coverUrl, 'image').then(tempUrl => {
            if (tempUrl) {
              console.log('获取临时URL成功:', tempUrl);
              
              // 只更新封面URL，不更新其他属性
              this.setData({
                'currentAudio.coverUrl': tempUrl
              });
            }
          }).catch(err => {
            console.error('获取临时URL失败:', err);
          });
        }
        
        // 设置初始音频信息
        this.setData({
          currentAudio: {
            title: audioData.title || '听力练习',
            coverUrl: coverUrl,
            audioUrl: audioData.audio_url || ''
          }
        });
        
        // 如果有关联的文章数据，优先使用文章数据
        if (audioData.article_data) {
          console.log('使用关联的文章数据:', audioData.article_data);
        }
        
        // 如果有glid字段，尝试直接从文章集合获取数据
        if (audioData.glid) {
          console.log('发现glid字段，尝试直接获取文章数据:', audioData.glid);
          this.loadArticleDirectly(audioData.glid, languageCode, callback);
      } else {
          // 继续加载习题
        this.loadExercisesAfterDetail(articleId, languageCode, callback);
        }
      } else {
        console.error('获取音频详情失败:', res);
        
        // 尝试直接从音频集合获取glid
        const db = wx.cloud.database();
        db.collection('jiuyu_audio_content').doc(articleId).get().then(audioRes => {
          if (audioRes.data && audioRes.data.glid) {
            console.log('直接从数据库获取到glid:', audioRes.data.glid);
            this.loadArticleDirectly(audioRes.data.glid, languageCode, callback);
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
            
            // 执行回调
            if (typeof callback === 'function') {
              callback();
            }
          }
        }).catch(dbErr => {
          console.error('直接获取音频数据失败:', dbErr);
          wx.hideLoading();
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
          
          // 执行回调
          if (typeof callback === 'function') {
            callback();
          }
        });
      }
    }).catch(error => {
      console.error('获取音频详情失败:', error);
      
      // 尝试直接从音频集合获取glid
      const db = wx.cloud.database();
      db.collection('jiuyu_audio_content').doc(articleId).get().then(audioRes => {
        if (audioRes.data && audioRes.data.glid) {
          console.log('直接从数据库获取到glid:', audioRes.data.glid);
          this.loadArticleDirectly(audioRes.data.glid, languageCode, callback);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
          
          // 执行回调
          if (typeof callback === 'function') {
            callback();
          }
        }
      }).catch(dbErr => {
        console.error('直接获取音频数据失败:', dbErr);
        wx.hideLoading();
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        
        // 执行回调
        if (typeof callback === 'function') {
          callback();
        }
      });
    });
  },
  
  // 直接从文章集合获取数据
  loadArticleDirectly(articleId, languageCode, callback) {
    console.log('开始通过云函数获取文章数据, articleId:', articleId);
    
    // 使用云函数获取文章数据
    listeningAPI.getAudioDetail({
      glid: articleId
    }).then(async res => {
      console.log('云函数返回结果:', res);
      
      if (res.result && res.result.code === 0 && res.result.data) {
        const articleData = res.result.data;
        console.log('成功获取文章数据:', articleData);
        console.log('文章字段列表:', Object.keys(articleData));
        console.log('cover_url字段:', articleData.cover_url);
        console.log('image字段:', articleData.image);
        
        // 检查contents中是否有封面
        if (articleData.contents && articleData.contents.length > 0) {
          console.log('contents字段长度:', articleData.contents.length);
          const zhContent = articleData.contents.find(c => c.language === 'zh-CN');
          if (zhContent) {
            console.log('中文内容字段列表:', Object.keys(zhContent));
            console.log('中文内容cover字段:', zhContent.cover);
          }
        }
        
        // 处理文章数据
        let title = articleData.title || '听力练习';
        let coverUrl = articleData.cover_url || '';
        let audioUrl = '';
        let transcript = '';
        
        // 获取标题
        if (articleData.titles && articleData.titles.length > 0) {
          const zhTitle = articleData.titles.find(t => t.language === 'zh-CN');
          if (zhTitle) {
            title = zhTitle.title;
          }
        }
        
        // 获取文本内容
        if (articleData.contents && articleData.contents.length > 0) {
          const currentLang = languageCode || 'zh-CN';
          // 优先查找当前语言的内容
          const langContent = articleData.contents.find(c => c.language === currentLang);
          
          if (langContent) {
            console.log(`找到 ${currentLang} 语言的内容:`, langContent);
            
            // 获取正文内容
            if (langContent.body) {
              transcript = langContent.body;
              console.log(`找到 ${currentLang} 语言的正文`);
            } else if (langContent.content) {
              // 移除HTML标签
              transcript = langContent.content.replace(/<[^>]+>/g, '');
            }
          } else {
            // 如果没有找到当前语言的内容，尝试找zh-CN的内容
            const zhContent = articleData.contents.find(c => c.language === 'zh-CN');
            if (zhContent) {
              console.log('未找到当前语言内容，使用中文内容');
              
              // 获取正文内容
              if (zhContent.body) {
                transcript = zhContent.body;
                console.log('使用中文正文');
              } else if (zhContent.content) {
                // 移除HTML标签
                transcript = zhContent.content.replace(/<[^>]+>/g, '');
              }
            }
          }
        }
        
        // 不再从文章中获取音频URL
        
        // 确保音频URL格式正确
        if (audioUrl) {
          console.log('原始音频URL:', audioUrl);
          
          // 检查音频URL格式
          if (!audioUrl.startsWith('http') && !audioUrl.startsWith('cloud://')) {
            console.log('音频URL格式不完整，尝试修复');
            
            // 如果是相对路径，尝试添加云存储前缀
            if (!audioUrl.startsWith('/')) {
              audioUrl = 'cloud://' + audioUrl;
              console.log('修复后的音频URL:', audioUrl);
            }
          }
        } else {
          console.log('未找到音频URL');
        }
        
        // 处理封面URL
        console.log('原始封面URL:', coverUrl);
        const processedCoverUrl = await getTemporaryFileUrl(coverUrl, 'image');
        console.log('处理后封面URL:', processedCoverUrl);
        
        // 更新音频信息
        this.setData({
          currentAudio: {
            title: title,
            coverUrl: processedCoverUrl,
            audioUrl: audioUrl
          }
        });
        
        // 生成习题数据
        const exerciseData = {
          audioTitle: title,
          audioUrl: audioUrl,
          transcript: transcript,
          exercises: []
        };
        
        // 获取音频内容中的习题数据
        if (this.data.currentArticleId) {
          console.log('尝试获取音频习题数据, ID:', this.data.currentArticleId);
          
          // 使用跨域API获取音频数据
          listeningAPI.getAudioDetail({
            audioId: this.data.currentArticleId
          }).then(async audioRes => {
            console.log('获取音频内容结果:', audioRes);
            
            if (audioRes.result && audioRes.result.code === 0 && audioRes.result.data) {
              const audioData = audioRes.result.data;
              console.log('找到音频数据:', audioData);
              
              if (audioData.exercises) {
                console.log('找到习题数据:', audioData.exercises);
                exerciseData.exercises = audioData.exercises;
              } else {
                console.log('未找到习题数据，使用空数组');
              }
            } else {
              console.log('未找到音频数据');
            }
            
            // 生成习题
            await this.generateExerciseFromListening(exerciseData);
            
            wx.hideLoading();
          }).catch(async err => {
            console.error('获取音频习题数据失败:', err);
            
            // 仍然生成习题
            await this.generateExerciseFromListening(exerciseData);
            
            wx.hideLoading();
          });
        } else {
          console.log('没有当前文章ID，无法获取习题数据');
          // 生成习题
          await this.generateExerciseFromListening(exerciseData);
          
          wx.hideLoading();
        }
        
        // 加载翻译
        if (languageCode !== 'zh-CN') {
          this.loadArticleTranslationDirectly(articleId, languageCode);
        }
        
        // 执行回调
        if (typeof callback === 'function') {
          callback();
        }
      } else {
        console.log('未找到文章数据');
        
        // 继续尝试原来的方法
        this.loadExercisesAfterDetail(this.data.currentArticleId, languageCode, callback);
      }
    }).catch(err => {
      console.error('获取文章数据失败:', err);
      
      // 继续尝试原来的方法
      this.loadExercisesAfterDetail(this.data.currentArticleId, languageCode, callback);
    });
  },
  
  // 直接从文章集合获取翻译数据
  loadArticleTranslationDirectly(articleId, language) {
    console.log('开始直接从文章集合获取翻译, articleId:', articleId, '语言:', language);
    
    const db = wx.cloud.database();
    
    db.collection('jiuyu_articles').doc(articleId).get().then(res => {
      if (res.data) {
        const articleData = res.data;
        
        // 从文章内容中查找对应语言的翻译
        if (articleData.contents && articleData.contents.length > 0) {
          const langContent = articleData.contents.find(c => c.language === language);
          
          if (langContent) {
            console.log('找到对应语言的内容:', language);
            
            // 构建翻译对象
            const translation = {
              language: language,
              title: langContent.title || '',
              transcript: langContent.content ? langContent.content.replace(/<[^>]+>/g, '') : '',
              audio_url: articleData.audio && articleData.audio.translations && articleData.audio.translations[language] 
                ? articleData.audio.translations[language] : ''
            };
            
            // 更新翻译数据
            const translations = { ...this.data.listeningTranslations };
            translations[language] = translation;
            
            this.setData({
              listeningTranslations: translations
            });
            
            console.log('直接获取翻译成功');
          } else {
            console.log('未找到对应语言的内容:', language);
          }
        }
      }
    }).catch(err => {
      console.error('直接获取文章翻译失败:', err);
    });
  },
  
  // 在获取详情后加载练习题
  loadExercisesAfterDetail(articleId, languageCode, callback) {
    // 调用跨域API获取练习题
    listeningAPI.getExercises({
      audioId: articleId,
      difficulty: this.data.currentDifficulty,
      languageCode: languageCode
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const exerciseData = res.result.data;
        console.log('加载听力练习成功:', exerciseData);
        
        // 更新练习数据，但保留之前设置的封面URL
        this.setData({
          listeningExercise: exerciseData,
          isLoadingListening: false,
          currentAudio: {
            ...this.data.currentAudio,
            title: exerciseData.audioTitle || this.data.currentAudio.title,
            audioUrl: exerciseData.audioUrl || this.data.currentAudio.audioUrl
            // 不更新coverUrl，保留之前设置的封面
          }
        });
        
        // 根据难度生成对应的习题
        this.generateExerciseFromListening(exerciseData);
        
        // 加载翻译（如果不是中文）
        if (languageCode !== 'zh-CN') {
          this.loadListeningTranslations(articleId, languageCode);
        }
        
        // 执行回调
        if (typeof callback === 'function') {
          callback();
        }
      } else {
        console.error('加载听力练习失败:', res);
        this.setData({
          isLoadingListening: false
        });
        
        // 尝试从音频内容中获取glid，然后从文章集合获取数据
        const db = wx.cloud.database();
        db.collection('jiuyu_audio_content').doc(articleId).get().then(audioRes => {
          if (audioRes.data && audioRes.data.glid) {
            console.log('从音频内容中获取glid:', audioRes.data.glid);
            this.loadArticleDirectly(audioRes.data.glid, languageCode, callback);
          } else {
        // 使用音频数据生成习题
        const audioData = this.data.currentAudio;
        if (audioData && audioData.title) {
          const exerciseData = {
            audioTitle: audioData.title,
            audioUrl: audioData.audioUrl,
            transcript: '',
                exercises: audioRes.data?.exercises || []
          };
          
          // 尝试生成习题
          this.generateExerciseFromListening(exerciseData);
        } else {
          // 加载失败时使用模拟数据
          const mockExercise = this.generateExercise();
          this.setData({
            currentExercise: mockExercise
          });
          
          wx.showToast({
            title: '使用模拟习题',
            icon: 'none'
          });
        }
          }
        }).catch(err => {
          console.error('获取音频内容失败:', err);
          // 使用模拟数据
          const mockExercise = this.generateExercise();
          this.setData({
            currentExercise: mockExercise
          });
          
          wx.showToast({
            title: '使用模拟习题',
            icon: 'none'
          });
        });
      }
    }).catch(error => {
        wx.hideLoading();
        console.error('加载听力练习失败:', error);
        this.setData({
          isLoadingListening: false
        });
        
      // 尝试从音频内容中获取glid，然后从文章集合获取数据
      const db = wx.cloud.database();
      db.collection('jiuyu_audio_content').doc(articleId).get().then(audioRes => {
        if (audioRes.data && audioRes.data.glid) {
          console.log('从音频内容中获取glid:', audioRes.data.glid);
          this.loadArticleDirectly(audioRes.data.glid, languageCode, callback);
        } else {
        // 加载失败时使用模拟数据
        const mockExercise = this.generateExercise();
        this.setData({
          currentExercise: mockExercise
        });
        
        wx.showToast({
          title: '使用模拟习题',
          icon: 'none'
          });
        }
      }).catch(err => {
        console.error('获取音频内容失败:', err);
        // 使用模拟数据
        const mockExercise = this.generateExercise();
        this.setData({
          currentExercise: mockExercise
        });
        
        wx.showToast({
          title: '使用模拟习题',
          icon: 'none'
        });
        });
      });
  },
  
  // 直接加载音频详情
  loadAudioDetail(articleId) {
    // 获取当前语言代码
    const languageCode = this.getLanguageCode();
    
    listeningAPI.getAudioDetail({
      audioId: articleId,
      languageCode: languageCode
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const audioData = res.result.data;
        console.log('加载音频详情成功:', audioData);
        
        // 更新音频信息
        this.setData({
          currentAudio: {
            title: audioData.title,
            audioUrl: audioData.audio_url
          },
          // 重置题目索引
          currentExerciseIndex: 0
        });
        
        // 确保exercises是一个数组
        let exercises = [];
        if (audioData.exercises && Array.isArray(audioData.exercises)) {
          exercises = audioData.exercises;
        } else if (audioData.exercises) {
          // 如果exercises存在但不是数组，可能是对象形式
          try {
            const exercisesObj = audioData.exercises;
            exercises = Object.keys(exercisesObj).map(key => exercisesObj[key]);
          } catch (e) {
            console.error('转换exercises失败:', e);
          }
        }
        
        console.log('获取到的习题数量:', exercises.length);
        if (exercises.length > 0) {
          console.log('第一道习题:', JSON.stringify(exercises[0]));
          if (exercises.length > 1) {
            console.log('第二道习题:', JSON.stringify(exercises[1]));
          }
        }
        
        // 使用音频数据生成习题
        const exerciseData = {
          audioTitle: audioData.title,
          audioUrl: audioData.audio_url,
          transcript: audioData.transcript,
          exercises: exercises
        };
        
        this.generateExerciseFromListening(exerciseData);
      } else {
        console.error('加载音频详情失败:', res);
        // 加载失败时使用模拟数据
        const mockExercise = this.generateExercise();
        this.setData({
          currentExercise: mockExercise
        });
        
        wx.showToast({
          title: '使用模拟习题',
          icon: 'none'
        });
      }
    }).catch(error => {
      console.error('加载音频详情失败:', error);
      // 加载失败时使用模拟数据
      const mockExercise = this.generateExercise();
        this.setData({
        currentExercise: mockExercise
      });
      
      wx.showToast({
        title: '使用模拟习题',
        icon: 'none'
      });
    });
  },
  
  // 加载多语言听力翻译
  loadListeningTranslations(articleId, language) {
    // 调用云函数获取翻译
    listeningAPI.getTranslation({
      audioId: articleId,
      language: language
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const translationData = res.result.data.translation;
        console.log('加载听力翻译成功:', translationData);
        
        // 更新翻译数据
        const translations = {};
        translations[language] = {
          title: translationData.title,
          transcript: translationData.transcript,
          audio_url: translationData.audio_url
        };
        
        this.setData({
          listeningTranslations: translations
        });
      } else {
        console.error('加载听力翻译失败:', res);
        wx.showToast({
          title: '加载翻译失败',
          icon: 'none'
        });
      }
    }).catch(error => {
        console.error('加载听力翻译失败:', error);
        wx.showToast({
          title: '加载翻译失败',
          icon: 'none'
        });
      });
  },
  
  // 从听力数据生成习题
  async generateExerciseFromListening(listeningData) {
    if (!listeningData) return;
    
    console.log('生成习题，数据:', listeningData);
    
    // 获取当前选择的语言代码
    const currentLanguageCode = this.getLanguageCode();
    console.log('当前语言代码:', currentLanguageCode);
    
    // 获取当前习题索引
    const exerciseIndex = this.data.currentExerciseIndex || 0;
    
    // 获取当前习题
    const exercisesList = listeningData.exercises || [];
    if (exercisesList.length > 0 && exerciseIndex < exercisesList.length) {
      const currentExercise = exercisesList[exerciseIndex];
      
      // 检查当前习题是否有音频，且是否有对应语言的音频
      if (currentExercise && currentExercise.audio) {
        console.log('当前习题有音频:', currentExercise.audio);
        
        // 如果音频是对象形式，可能包含多种语言
        if (typeof currentExercise.audio === 'object') {
          // 尝试获取当前语言的音频
          if (currentExercise.audio[currentLanguageCode]) {
            listeningData.audioUrl = await getTemporaryFileUrl(currentExercise.audio[currentLanguageCode], '习题音频');
            console.log(`找到习题中 ${currentLanguageCode} 语言的音频:`, listeningData.audioUrl);
          }
          // 如果没有当前语言的音频，尝试获取中文音频
          else if (currentExercise.audio['zh-CN']) {
            listeningData.audioUrl = await getTemporaryFileUrl(currentExercise.audio['zh-CN'], '习题音频');
            console.log('未找到当前语言音频，使用中文音频:', listeningData.audioUrl);
          }
          // 如果没有中文音频，使用第一个可用的音频
          else {
            const firstLang = Object.keys(currentExercise.audio)[0];
            if (firstLang) {
              listeningData.audioUrl = await getTemporaryFileUrl(currentExercise.audio[firstLang], '习题音频');
              console.log(`未找到中文音频，使用 ${firstLang} 语言音频:`, listeningData.audioUrl);
            }
          }
        }
        // 如果音频是字符串形式，直接使用
        else if (typeof currentExercise.audio === 'string') {
          listeningData.audioUrl = await getTemporaryFileUrl(currentExercise.audio, '习题音频');
          console.log('习题音频是字符串形式:', listeningData.audioUrl);
      }
      } else {
        console.log('当前习题没有音频或习题不存在');
      }
    }
    
    // 处理音频URL
    if (listeningData.audioUrl) {
      console.log('听力练习音频URL:', listeningData.audioUrl);
      
      // 检查音频URL格式
      if (!listeningData.audioUrl.startsWith('http') && !listeningData.audioUrl.startsWith('cloud://')) {
        console.log('音频URL格式不完整，尝试修复');
        
        // 如果是相对路径，尝试添加云存储前缀
        if (!listeningData.audioUrl.startsWith('/')) {
          listeningData.audioUrl = 'cloud://' + listeningData.audioUrl;
          console.log('修复后的音频URL:', listeningData.audioUrl);
        }
      }
    } else {
      console.log('没有提供音频URL');
    }
    
    // 不处理封面URL，保留之前设置的封面
    
    // 获取当前语言代码
    const currentLangCode = this.getLanguageCode();
    console.log('当前语言代码:', currentLangCode);
    
    // 使用之前定义的exercisesList
    const allExercises = listeningData.exercises || [];
    
    // 先根据语言过滤习题，优先选择当前语言的习题
    let filteredExercises = [];
    if (allExercises && allExercises.length > 0) {
      // 先尝试找到与当前语言匹配的习题
      const currentLangExercises = allExercises.filter(ex => ex.language === currentLangCode);
      
      // 如果找到当前语言的习题，使用当前语言的习题
      if (currentLangExercises.length > 0) {
        console.log(`找到${currentLangExercises.length}个${currentLangCode}语言的习题`);
        filteredExercises = currentLangExercises;
        
        // 重置没有内容标志
    this.setData({
          noContentForLanguage: false
        });
        
        // 如果有当前语言的习题，并且当前索引不在这些习题中，则切换到第一个当前语言的习题
        const currentExerciseIndex = this.data.currentExerciseIndex || 0;
        const currentExercise = allExercises[currentExerciseIndex];
        
        if (currentExercise && currentExercise.language !== currentLangCode) {
          // 找到第一个当前语言的习题在原始数组中的索引
          const firstLangExerciseIndex = allExercises.findIndex(ex => ex.language === currentLangCode);
          if (firstLangExerciseIndex !== -1) {
            // 更新索引
            this.setData({
              currentExerciseIndex: firstLangExerciseIndex
            });
            console.log(`切换到第一个${currentLangCode}语言的习题，索引:`, firstLangExerciseIndex);
            
            // 获取新的当前习题
            const newCurrentExercise = allExercises[firstLangExerciseIndex];
            
            // 检查新的当前习题是否有对应语言的音频
            if (newCurrentExercise && newCurrentExercise.audio) {
              if (typeof newCurrentExercise.audio === 'object') {
                // 尝试获取当前语言的音频
                if (newCurrentExercise.audio[currentLangCode]) {
                  listeningData.audioUrl = newCurrentExercise.audio[currentLangCode];
                  console.log(`找到习题中 ${currentLangCode} 语言的音频:`, listeningData.audioUrl);
                } else if (newCurrentExercise.audio['zh-CN']) {
                  listeningData.audioUrl = newCurrentExercise.audio['zh-CN'];
                  console.log('未找到当前语言音频，使用中文音频:', listeningData.audioUrl);
                } else {
                  const firstLang = Object.keys(newCurrentExercise.audio)[0];
                  if (firstLang) {
                    listeningData.audioUrl = newCurrentExercise.audio[firstLang];
                    console.log(`未找到中文音频，使用 ${firstLang} 语言音频:`, listeningData.audioUrl);
                  }
                }
              } else if (typeof newCurrentExercise.audio === 'string') {
                listeningData.audioUrl = newCurrentExercise.audio;
                console.log('习题音频是字符串形式:', listeningData.audioUrl);
              }
            }
          }
        }
      } else {
        console.log(`未找到${currentLangCode}语言的预设习题，检查是否可以从文章内容生成`);
        
        // 不要立即设置无内容标志，先检查是否有文章内容可以生成习题
        if (listeningData.transcript && listeningData.transcript.trim().length > 0) {
          console.log('有文章内容，可以生成习题，暂不设置无内容标志');
          // 重置没有内容标志，因为我们有文章内容可以生成习题
          this.setData({
            noContentForLanguage: false
          });
        } else {
          console.log('没有文章内容，设置无内容标志');
          // 只有在没有任何内容时才设置无内容标志
          this.setData({
            noContentForLanguage: true
          });
          
          // 显示提示
          wx.showToast({
            title: `没有${this.data.currentLanguage}内容`,
            icon: 'none',
            duration: 2000
          });
        }
        
        // 清除音频URL
        listeningData.audioUrl = '';
      }
      
      // 分离单选题和多选题
      const singleChoiceExercises = filteredExercises.filter(ex => ex.type === 'single');
      const multiChoiceExercises = filteredExercises.filter(ex => ex.type === 'multiple');
      const otherExercises = filteredExercises.filter(ex => ex.type !== 'single' && ex.type !== 'multiple');
      
      console.log('单选题数量:', singleChoiceExercises.length);
      console.log('多选题数量:', multiChoiceExercises.length);
      console.log('其他题型数量:', otherExercises.length);
      
      // 重新组合习题数组，单选题在前，多选题在后
      const sortedExercises = [...singleChoiceExercises, ...multiChoiceExercises, ...otherExercises];
      
      // 更新listeningData中的习题数组
      listeningData.exercises = sortedExercises;
      
      console.log('重新排序后的习题数组长度:', sortedExercises.length);
    }
    
    // 更新当前音频信息 - 只更新标题和音频URL，不更新封面
    this.setData({
      'currentAudio.title': listeningData.audioTitle || this.data.currentAudio.title,
      'currentAudio.audioUrl': listeningData.audioUrl || this.data.currentAudio.audioUrl
    });
    
    // 保存听力练习数据
    this.setData({
      listeningExercise: listeningData
    });
    
    if (listeningData.exercises.length === 0) {
      // 如果没有预设的习题，根据文本自动生成
      console.log('没有预设习题，从文本生成');
      if (listeningData.transcript) {
        const generatedExercise = this.generateExerciseFromText(listeningData.transcript);
        this.setData({
          currentExercise: generatedExercise
        });
      } else {
        // 如果没有文本，使用默认习题
        this.generateExerciseByDifficulty();
      }
      return;
    }
    
    console.log('使用预设习题，总数:', listeningData.exercises.length);
    
    // 使用之前定义的exerciseIndex
    const currentIndex = this.data.currentExerciseIndex || 0;
    
    // 确保索引在有效范围内
    let validIndex = currentIndex;
    if (validIndex >= listeningData.exercises.length) {
      validIndex = 0;
    }
    
    console.log('当前习题索引:', validIndex);
    
    // 直接使用当前索引选择题目
    let selectedExercise = listeningData.exercises[validIndex];
    
    // 如果没有找到题目（可能是索引无效），使用第一个题目
    if (!selectedExercise && listeningData.exercises.length > 0) {
      selectedExercise = listeningData.exercises[0];
      console.log('索引无效，使用第一个题目');
    } else if (!selectedExercise) {
      // 如果没有任何题目，创建一个默认题目
      selectedExercise = {
        question: '没有可用的习题',
        options: ['选项A', '选项B', '选项C', '选项D'],
        answer: 0,
        type: 'single'
      };
      console.log('没有可用的习题，使用默认题目');
    } else {
      console.log('选择了索引为', validIndex, '的习题，类型:', selectedExercise.type);
    }
    
    // 转换为当前页面所需的习题格式
    let exercise = {
      question: selectedExercise.question || '根据听力内容，请回答问题',
      options: selectedExercise.options || [],
      explanation: selectedExercise.explanation || listeningData.transcript || '请仔细听音频内容',
      type: selectedExercise.type || 'single' // 保存题目类型
    };
    
    // 根据题目类型处理答案格式
    if (selectedExercise.type === 'single') {
      // 单选题，找到正确答案的索引
      if (Array.isArray(selectedExercise.answer)) {
        if (typeof selectedExercise.answer[0] === 'number') {
          exercise.answer = selectedExercise.answer[0];
        } else {
          // 如果答案是字符串数组，查找匹配的选项索引
          const answerStr = selectedExercise.answer[0];
          const optionIndex = selectedExercise.options.findIndex(opt => opt === answerStr);
          exercise.answer = optionIndex >= 0 ? optionIndex : 0;
        }
      } else if (typeof selectedExercise.answer === 'number') {
        exercise.answer = selectedExercise.answer;
      } else {
        exercise.answer = 0;
      }
    } else if (selectedExercise.type === 'multiple') {
      // 多选题，找到所有正确答案的索引
      if (Array.isArray(selectedExercise.answer)) {
        if (selectedExercise.answer.length > 0 && typeof selectedExercise.answer[0] === 'number') {
          exercise.answer = selectedExercise.answer;
        } else {
          // 如果答案是字符串数组，查找匹配的选项索引
          exercise.answer = selectedExercise.answer.map(answer => 
            selectedExercise.options.findIndex(opt => opt === answer)
          ).filter(index => index !== -1);
          
          if (exercise.answer.length === 0) {
            exercise.answer = [0, 1]; // 默认前两个选项为正确答案
          }
        }
      } else {
        exercise.answer = [0, 1]; // 默认前两个选项为正确答案
      }
    }
    
    // 更新当前习题和难度设置
    this.setData({
      currentExercise: exercise,
      selectedSingleOption: null,
      selectedOptions: {},
      fillAnswer: '',
      hasArticleData: true  // 添加这一行
    });
  },
  
  // 从文本生成习题
  generateExerciseFromText(text) {
    console.log('从文本生成习题，文本长度:', text.length);
    
    // 如果文本太短，返回默认习题
    if (!text || text.length < 20) {
      return this.generateExercise();
    }
    
    try {
      // 提取文本中的关键句子（取前3个句子）
      const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0).slice(0, 3);
      
      if (sentences.length === 0) {
        return this.generateExercise();
      }
      
      // 选择第一个句子作为问题基础
      const baseQuestion = sentences[0].trim();
      
      // 根据难度生成不同类型的习题
      if (this.data.currentDifficulty === 'sprout') {
        // 萌芽难度：单选题
        return {
          type: 'single',
          question: `根据听力内容，以下哪一项是正确的？`,
          options: [
            baseQuestion, // 正确答案
            this.generateWrongOption(baseQuestion, 1),
            this.generateWrongOption(baseQuestion, 2),
            this.generateWrongOption(baseQuestion, 3)
          ],
          answer: 0, // 第一个选项是正确答案
          explanation: `听力中提到："${baseQuestion}"`
        };
      } else {
        // 森林难度：多选题
        const correctOptions = [0, 2]; // 假设第一个和第三个是正确的
        
        return {
          type: 'multiple',
          question: '根据听力内容，以下哪些选项是正确的？（多选）',
          options: [
            sentences[0].trim(), // 正确答案
            this.generateWrongOption(sentences[0], 1),
            sentences.length > 1 ? sentences[1].trim() : this.generateWrongOption(sentences[0], 2), // 正确答案
            this.generateWrongOption(sentences[0], 3)
          ],
          answer: correctOptions,
          explanation: `听力中提到："${sentences[0]}"${sentences.length > 1 ? `和"${sentences[1]}"` : ''}`
        };
      }
    } catch (error) {
      console.error('生成习题失败:', error);
      return this.generateExercise();
    }
  },
  
  // 生成错误选项
  generateWrongOption(correctText, index) {
    // 简单替换一些词语生成错误选项
    const replaceWords = [
      { original: '是', replacement: '不是' },
      { original: '有', replacement: '没有' },
      { original: '可以', replacement: '不可以' },
      { original: '应该', replacement: '不应该' },
      { original: '会', replacement: '不会' },
      { original: '能', replacement: '不能' }
    ];
    
    // 如果文本中包含数字，修改数字
    if (/\d+/.test(correctText)) {
      const modifiedText = correctText.replace(/(\d+)/g, (match) => {
        const num = parseInt(match);
        return (num + index * 5).toString();
      });
      return modifiedText;
    }
    
    // 否则替换词语
    for (const pair of replaceWords) {
      if (correctText.includes(pair.original)) {
        return correctText.replace(pair.original, pair.replacement);
      }
    }
    
    // 如果以上方法都不适用，添加否定词
    return `与原文不符，${correctText}`;
  },
  
  // 获取当前语言的语言代码
  getLanguageCode: function() {
    // 根据当前选择的语言获取对应的语言代码
    console.log('当前语言:', this.data.currentLanguage);
    
    // 使用定义好的languageCodeMap来获取语言代码
    const code = this.data.languageCodeMap[this.data.currentLanguage];
    if (code) {
      return code;
    }
    
    // 如果没有匹配到，回退到原来的switch逻辑
    switch (this.data.currentLanguage) {
      case '中文（简体）':
        return 'zh-CN';
      case '中文（繁体）':
        return 'zh-TW';
      case '英语':
        return 'en';
      case '英文': // 兼容旧版本
        return 'en';
      case '法语':
        return 'fr';
      case '西班牙语':
        return 'es';
      case '德语':
        return 'de';
      case '意大利语':
        return 'it';
      case '日语':
        return 'ja';
      case '葡萄牙语（葡萄牙）':
        return 'pt-PT';
      case '葡萄牙语（巴西）':
        return 'pt-BR';
      case '俄语':
        return 'ru';
      case '韩语':
        return 'ko';
      default:
        return 'zh-CN'; // 默认使用简体中文
    }
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
    // const audioType = this.data.currentAudioType; // 不再需要音频类型
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
    
    console.log('多选题提交答案:', selectedIndices);
    console.log('正确答案:', correctAnswer);
    
    if (selectedIndices.length === 0) {
      wx.showToast({
        title: '请至少选择一个选项',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
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
  togglePlay: function() {
    console.log('切换播放/暂停');
    
    if (!this.data.hasArticleData || !this.data.currentAudio) {
      console.log('没有文章数据，无法播放');
      wx.showToast({
        title: '音频资源不可用',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.currentAudio.audioUrl) {
      console.log('没有对应语言的音频');
      wx.showToast({
        title: `没有${this.data.currentLanguage}音频`,
        icon: 'none'
      });
      return;
    }
    
    const backgroundAudioManager = wx.getBackgroundAudioManager();
    
    if (this.data.isPlaying) {
      // 暂停播放
      backgroundAudioManager.pause();
    
      this.setData({
        isPlaying: false
      });
    } else {
      // 开始播放
      let audioUrl = this.data.currentAudio.audioUrl;
      
      // 检查是否已经设置过音频源，如果已设置且是当前音频，则直接播放
      if (backgroundAudioManager.src && this.data.lastPlayedUrl === audioUrl) {
        console.log('继续播放当前音频');
        // 确保播放速度正确
        backgroundAudioManager.playbackRate = this.data.playbackSpeed;
        backgroundAudioManager.play();
        return;
      }
      
      console.log('准备播放音频:', audioUrl);
      
      // 处理云存储URL
      if (audioUrl.startsWith('cloud://')) {
        // 检查是否已经有预加载的临时文件
        if (this.data.tempAudioPath && this.data.lastAudioUrl === audioUrl) {
          console.log('使用预加载的临时文件:', this.data.tempAudioPath);
          
          // 使用临时文件路径播放
          backgroundAudioManager.title = this.data.currentAudio.title || '听力练习';
          backgroundAudioManager.epname = this.data.currentAudio.title || '听力练习';
          backgroundAudioManager.coverImgUrl = this.data.currentAudio.coverUrl || '';
          backgroundAudioManager.src = this.data.tempAudioPath;
          
          // 设置播放速度
          backgroundAudioManager.playbackRate = this.data.playbackSpeed;
          
          // 记录最后播放的URL
          this.setData({
            isPlaying: true,
            lastPlayedUrl: audioUrl
          });
        } else {
          console.log('检测到云存储URL，使用临时URL处理');
          
          // 显示加载提示
          wx.showLoading({
            title: '加载音频...',
            mask: true
          });
          
          // 使用getTemporaryFileUrl处理云存储URL
          getTemporaryFileUrl(audioUrl, '音频文件').then(tempUrl => {
             wx.hideLoading();
             console.log('获取临时URL结果:', tempUrl);
             
             // 检查临时URL是否有效
             if (!tempUrl) {
               console.error('获取到的临时URL为空');
               wx.showToast({
                 title: '音频资源无效',
                 icon: 'none'
               });
               return;
             }
             
             // 使用临时URL播放
             backgroundAudioManager.title = this.data.currentAudio.title || '听力练习';
             backgroundAudioManager.epname = this.data.currentAudio.title || '听力练习';
             backgroundAudioManager.coverImgUrl = this.data.currentAudio.coverUrl || '';
             backgroundAudioManager.src = tempUrl;
             
             // 设置播放速度
             backgroundAudioManager.playbackRate = this.data.playbackSpeed;
             console.log('设置播放速度:', this.data.playbackSpeed);
             
             console.log('设置音频源为临时URL:', tempUrl);
             
             // 保存状态
             this.setData({
               isPlaying: true,
               lastPlayedUrl: audioUrl,
               lastAudioUrl: audioUrl,
               tempAudioPath: tempUrl
             });
           }).catch(err => {
             wx.hideLoading();
             console.error('获取临时URL失败', err);
             wx.showToast({
               title: '音频资源加载失败',
               icon: 'none'
             });
           });
        }
      } else {
        // 直接使用URL
        backgroundAudioManager.title = this.data.currentAudio.title || '听力练习';
        backgroundAudioManager.epname = this.data.currentAudio.title || '听力练习';
        backgroundAudioManager.coverImgUrl = this.data.currentAudio.coverUrl || '';
        backgroundAudioManager.src = audioUrl;
        
        // 设置播放速度
        backgroundAudioManager.playbackRate = this.data.playbackSpeed;
        console.log('设置播放速度:', this.data.playbackSpeed);
        
        console.log('直接设置音频源:', audioUrl);
        
        // 记录最后播放的URL
        this.setData({
          isPlaying: true,
          lastPlayedUrl: audioUrl
        });
      }
    }
  },

  // 显示倍速选项
  showSpeedOptions() {
    wx.showActionSheet({
      itemList: ['0.5x', '0.8x', '1.0x', '1.2x', '1.5x', '2.0x'],
      success: (res) => {
        const speeds = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];
        const newSpeed = speeds[res.tapIndex];
        
        // 更新播放速度
        this.setData({
          playbackSpeed: newSpeed
        });
        
        // 如果正在播放，完全重置播放器
        if (this.data.isPlaying) {
          const backgroundAudioManager = wx.getBackgroundAudioManager();
          
          // 先停止当前播放
          backgroundAudioManager.stop();
          
          // 短暂延迟后重新设置音频源并播放
          setTimeout(() => {
            // 重新设置音频信息
            backgroundAudioManager.title = this.data.currentAudio.title || '听力练习';
            backgroundAudioManager.epname = this.data.currentAudio.title || '听力练习';
            backgroundAudioManager.coverImgUrl = this.data.currentAudio.coverUrl || '';
            backgroundAudioManager.src = this.data.currentAudio.audioUrl;
            
            // 设置新的播放速度
            backgroundAudioManager.playbackRate = newSpeed;
            
            // 开始播放
            backgroundAudioManager.play();
            
            console.log('重置播放器并应用新的播放速度:', newSpeed);
            
            // 提示用户
            wx.showToast({
              title: `已设置${newSpeed}x速度，重新播放`,
              icon: 'none',
              duration: 2000
            });
          }, 300);
        }
        
        wx.showToast({
          title: `播放速度: ${newSpeed}x`,
          icon: 'none'
        });
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
    // 移除音频类型检查，现在根据日期获取所有类型的文章
    
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
        content: `您正在进行${difficultyText}练习\n\n${typeText}\n\n答对可获得${pointsText}`,
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
    // 使用更精确的标识符，包括题目内容和选项
    // 因为同样的问题可能会有不同的选项
    const exerciseId = this.generateExerciseId(exercise);
    return this.data.completedExercises.some(
      compExercise => compExercise.id === exerciseId
    );
  },
  
  // 生成习题唯一ID
  generateExerciseId: function(exercise) {
    // 组合问题和选项创建唯一ID
    let idParts = [exercise.question];
    
    if (exercise.options && Array.isArray(exercise.options)) {
      idParts = idParts.concat(exercise.options);
    }
    
    // 添加文章ID作为额外标识
    if (this.data.currentArticleId) {
      idParts.push(this.data.currentArticleId);
    }
    
    // 创建一个简单的哈希
    return idParts.join('|');
  },
  
  // 将习题标记为已完成
  markExerciseCompleted: function(exercise) {
    if (!this.isExerciseCompleted(exercise)) {
      // 使用生成的唯一ID
      const exerciseId = this.generateExerciseId(exercise);
      const completedExercise = {
        id: exerciseId,
        question: exercise.question,
        articleId: this.data.currentArticleId,
        date: new Date().toISOString()
      };
      
      const completedExercises = [...this.data.completedExercises, completedExercise];
      
      wx.setStorageSync('completedExercises', completedExercises);
      this.setData({
        completedExercises: completedExercises
      });
      
      console.log('习题已标记为完成:', exerciseId);
      return true; // 首次完成
    }
    
    console.log('习题已经完成过，不重复加分');
    return false; // 已经完成过
  },
  
  // 处理正确答案
  handleCorrectAnswer: function(points) {
    const exercise = this.data.currentExercise;
    const isFirstAttempt = this.markExerciseCompleted(exercise);
    
    // 只有首次答对才加分
    if (isFirstAttempt) {
      // 更新云端积分数据和本地显示
      this.updateUserPoints('listen_points', points);
      
      // 如果完成了整个进度，再增加花朵奖励
      if (this.data.exerciseProgress + 10 >= 100) {
        this.updateUserPoints('listen_flowers', 1);
      }
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
    
    if (exercise.type === 'single') {
      // 单选题
      const answerIndex = exercise.answer;
      return this.data.optionLetters[answerIndex] + '. ' + exercise.options[answerIndex];
    } else if (exercise.type === 'multiple') {
      // 多选题
      return exercise.answer.map(index => 
        this.data.optionLetters[index] + '. ' + exercise.options[index]
      ).join('、');
    } else if (exercise.type === 'fill') {
      // 填空题
      return exercise.answer;
    } else {
      // 默认情况
      if (Array.isArray(exercise.answer)) {
        return exercise.answer.map(index => 
          this.data.optionLetters[index] + '. ' + exercise.options[index]
        ).join('、');
      } else {
        const answerIndex = exercise.answer || 0;
        return this.data.optionLetters[answerIndex] + '. ' + exercise.options[answerIndex];
      }
    }
  },
  
  // 关闭结果弹窗
  closeResultModal: function() {
    this.setData({
      showResultModal: false
    });
    
    // 加载下一题
    if (this.data.listeningExercise && this.data.listeningExercise.exercises && this.data.listeningExercise.exercises.length > 0) {
      // 获取当前语言代码
      const currentLangCode = this.getLanguageCode();
      console.log('当前语言代码:', currentLangCode);
      
      // 尝试找到与当前语言匹配的习题
      const currentLangExercises = this.data.listeningExercise.exercises.filter(ex => ex.language === currentLangCode);
      
      // 初始化nextIndex变量
      let nextIndex = 0;
      
      // 检查是否有当前语言的习题
      if (currentLangExercises.length > 0) {
        console.log(`找到${currentLangExercises.length}个${currentLangCode}语言的习题`);
        
        // 在当前索引基础上找到下一个对应语言的习题
        nextIndex = (this.data.currentExerciseIndex || 0) + 1;
        
        // 如果到达末尾，重新开始
        if (nextIndex >= this.data.listeningExercise.exercises.length) {
          nextIndex = 0;
        }
        
        // 找到下一个当前语言的习题在原始数组中的索引
        let foundNextLangExercise = false;
        for (let i = 0; i < this.data.listeningExercise.exercises.length; i++) {
          const checkIndex = (nextIndex + i) % this.data.listeningExercise.exercises.length;
          const exercise = this.data.listeningExercise.exercises[checkIndex];
          
          if (exercise && exercise.language === currentLangCode) {
            nextIndex = checkIndex;
            foundNextLangExercise = true;
            break;
          }
        }
        
        // 如果没有找到下一个当前语言的习题，回到第一个当前语言的习题
        if (!foundNextLangExercise) {
          nextIndex = this.data.listeningExercise.exercises.findIndex(ex => ex.language === currentLangCode);
          if (nextIndex === -1) nextIndex = 0; // 安全检查
        }
      } else {
        console.log(`未找到${currentLangCode}语言的习题，设置noContentForLanguage标志`);
        
        // 设置没有内容标志
        this.setData({
          noContentForLanguage: true
        });
        
        // 清除音频URL
        this.data.listeningExercise.audioUrl = '';
        
        // 显示提示
        wx.showToast({
          title: `没有${this.data.currentLanguage}习题`,
          icon: 'none',
          duration: 2000
        });
        
        // 在没有当前语言习题的情况下，设置为0或保持当前索引
        nextIndex = this.data.currentExerciseIndex || 0;
      }
      
      // 更新索引
      this.setData({
        currentExerciseIndex: nextIndex
      });
      
      console.log('加载下一题，索引:', nextIndex);
      
      // 获取当前选择的语言代码
      const currentLanguageCode = this.getLanguageCode();
      console.log('切换题目，当前语言代码:', currentLanguageCode);
      
      // 获取下一题的音频
      const nextExercise = this.data.listeningExercise.exercises[nextIndex];
      if (nextExercise && nextExercise.audio) {
        console.log('下一题有音频:', nextExercise.audio);
        
        // 如果音频是对象形式，可能包含多种语言
        if (typeof nextExercise.audio === 'object') {
          // 尝试获取当前语言的音频
          if (nextExercise.audio[currentLanguageCode]) {
            this.data.listeningExercise.audioUrl = nextExercise.audio[currentLanguageCode];
            console.log(`找到下一题 ${currentLanguageCode} 语言的音频:`, this.data.listeningExercise.audioUrl);
          }
          // 如果没有当前语言的音频，尝试获取中文音频
          else if (nextExercise.audio['zh-CN']) {
            this.data.listeningExercise.audioUrl = nextExercise.audio['zh-CN'];
            console.log('未找到当前语言音频，使用中文音频:', this.data.listeningExercise.audioUrl);
          }
          // 如果没有中文音频，使用第一个可用的音频
          else {
            const firstLang = Object.keys(nextExercise.audio)[0];
            if (firstLang) {
              this.data.listeningExercise.audioUrl = nextExercise.audio[firstLang];
              console.log(`未找到中文音频，使用 ${firstLang} 语言音频:`, this.data.listeningExercise.audioUrl);
            }
          }
        }
        // 如果音频是字符串形式，直接使用
        else if (typeof nextExercise.audio === 'string') {
          this.data.listeningExercise.audioUrl = nextExercise.audio;
          console.log('下一题音频是字符串形式:', this.data.listeningExercise.audioUrl);
        }
      }
      
      // 使用现有的听力练习数据加载下一题
      this.generateExerciseFromListening(this.data.listeningExercise);
    } else {
      console.log('没有更多题目可用');
      wx.showToast({
        title: '已完成所有题目',
        icon: 'none',
        duration: 2000
      });
    }
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
    const exercise = this.data.currentExercise;
    const audioId = this.data.currentArticleId;
    
    if (!exercise || !audioId) {
      wx.showToast({
        title: '无法收藏当前习题',
        icon: 'none'
      });
      return;
    }
    
    // 获取用户答案
    let userAnswer = null;
    if (this.data.currentDifficulty === 'sprout') {
      userAnswer = this.data.selectedSingleOption;
    } else if (this.data.currentDifficulty === 'forest') {
      // 将选中的选项转换为数组
      userAnswer = [];
      const selectedOptions = this.data.selectedOptions || {};
      for (const key in selectedOptions) {
        if (selectedOptions[key]) {
          userAnswer.push(parseInt(key));
        }
      }
    }
    
    // 准备要保存的习题数据
    const exerciseData = {
      question: exercise.question,
      options: exercise.options,
      answer: exercise.answer,
      explanation: exercise.explanation,
      type: this.data.currentDifficulty === 'sprout' ? 'single' : 'multiple'
    };
    
    console.log('保存错题，用户答案:', userAnswer);
    
    wx.showLoading({
      title: '正在收藏...',
      mask: true
    });
    
    // 调用云函数保存错题
    listeningAPI.saveMistake({
      audioId: audioId,
      exercise: exerciseData,
      userAnswer: userAnswer
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: '收藏成功',
          icon: 'success'
        });
        
        // 关闭结果弹窗
    this.closeResultModal();
      } else {
        console.error('收藏错题失败:', res);
        wx.showToast({
          title: res.result?.msg || '收藏失败',
          icon: 'none'
        });
      }
    }).catch(error => {
      wx.hideLoading();
      console.error('收藏错题失败:', error);
      wx.showToast({
        title: '收藏失败，请重试',
        icon: 'none'
      });
    });
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
  },
  
  // 更新默认图片路径 - 修正路径
  DEFAULT_COVER_IMAGE: '../../images/default_article_1.png',
  
  // 处理封面图片加载失败
  handleCoverError: function(e) {
    console.error('封面图片加载失败:', e);
    
    this.setData({
      'currentAudio.coverUrl': this.DEFAULT_COVER_IMAGE
    });
  },

  // 封面图片错误处理
  onCoverError(e) {
    console.error('封面图片加载失败:', e.detail);
    console.log('当前封面URL:', this.data.currentAudio.coverUrl);
    // 设置默认封面
    this.setData({
      'currentAudio.coverUrl': '../../images/default_article_1.png'
    });
  },

  // 封面图片加载成功
  onCoverLoad(e) {
    console.log('封面图片加载成功:', this.data.currentAudio.coverUrl);
  },

  onUnload: function() {
    // 结束听力计时
    this.stopListeningTimer();
    
    // 计算总听力时间（分钟）
    const totalMinutes = Math.floor(accumulatedListeningTime / 60);
    console.log('听一听页面卸载，累计听力时间:', accumulatedListeningTime, '秒，折合', totalMinutes, '分钟');
    
    // 更新学习统计数据
    if (totalMinutes > 0) {
      // 检查是否有未同步的时间
      const lastSyncedMinutes = wx.getStorageSync('lastSyncedListenMinutes') || 0;
      const unsyncedMinutes = totalMinutes - lastSyncedMinutes;
      
      console.log('上次同步的分钟数:', lastSyncedMinutes, '未同步的分钟数:', unsyncedMinutes);
      
      if (unsyncedMinutes > 0) {
        // 优先使用本地存储方式更新未同步的时间，确保数据可靠保存
        this.updateStudyStatsLocal('listen', unsyncedMinutes, 0);
      }
      
      // 如果是第一次同步（没有实时同步过），则增加音频听力数量
      if (lastSyncedMinutes === 0) {
        this.updateStudyStatsLocal('listen', 0, 1);
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
    wx.removeStorageSync('lastSyncedListenMinutes');
  },

  onHide: function() {
    // 暂停计时
    this.pauseListeningTimer();
  },

  onShow: function() {
    // 恢复计时
    this.resumeListeningTimer();
  },

  startListeningTimer: function() {
    listeningStartTime = new Date();
    
    // 每秒更新一次计时
    listeningTimer = setInterval(() => {
      const now = new Date();
      const seconds = Math.floor((now - listeningStartTime) / 1000);
      accumulatedListeningTime += 1;
      
      // 每分钟更新一次统计数据
      if (accumulatedListeningTime % 60 === 0) {
        console.log('听力时间累计:', Math.floor(accumulatedListeningTime / 60), '分钟');
        
        // 每分钟实时同步一次数据到本地存储
        const currentMinutes = Math.floor(accumulatedListeningTime / 60);
        if (currentMinutes > 0) {
          // 获取上次同步的分钟数
          const lastSyncedMinutes = wx.getStorageSync('lastSyncedListenMinutes') || 0;
          const newMinutes = currentMinutes - lastSyncedMinutes;
          
          if (newMinutes > 0) {
            this.updateStudyStatsLocal('listen', newMinutes, 0);
            wx.setStorageSync('lastSyncedListenMinutes', currentMinutes);
            console.log('实时同步听力时长:', newMinutes, '分钟');
          }
        }
      }
    }, 1000);
  },

  pauseListeningTimer: function() {
    if (listeningTimer) {
      clearInterval(listeningTimer);
      listeningTimer = null;
      
      // 计算已经听力的时间
      const now = new Date();
      const seconds = Math.floor((now - listeningStartTime) / 1000);
      accumulatedListeningTime += seconds;
    }
  },

  resumeListeningTimer: function() {
    if (!listeningTimer) {
      listeningStartTime = new Date();
      this.startListeningTimer();
    }
  },

  stopListeningTimer: function() {
    if (listeningTimer) {
      clearInterval(listeningTimer);
      listeningTimer = null;
      
      // 计算已经听力的时间
      const now = new Date();
      const seconds = Math.floor((now - listeningStartTime) / 1000);
      accumulatedListeningTime += seconds;
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
      const countKey = type + 'Audios';
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
})