// API 接口工具

// 开发模式配置
const DEV_CONFIG = {
  // 是否使用模拟数据（强制使用模拟数据而不调用API）
  USE_MOCK_DATA: true,
  // 是否在控制台显示详细日志
  VERBOSE_LOGGING: true,
  // 是否绕过API认证（开发模式使用）
  BYPASS_AUTH: true,
  // 开发模式下使用的固定令牌 - 使用有效的令牌
  DEV_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNjdmYjRkOGJhY2M1NDM4NzgzYWQ0ZjBmIiwicm9sZSI6InZpZXdlciJ9LCJpYXQiOjE3NDQ1MjI2MzUsImV4cCI6MTc0NDYwOTAzNX0.3GBTylKTnCvfMVZxQMmyNitnaE2BCvIDXJFe3bYTMF0'
};

// API 基础 URL - 后台管理系统地址
const BASE_URL = 'http://192.168.2.8:5050';  // 本地开发环境IP地址

// 其他可能的配置
// const BASE_URL = 'http://localhost:5050';  // 本地开发环境
// const BASE_URL = 'https://www.xiaoshijie.com.cn';  // 生产服务器域名

/**
 * 检查网络连接状态
 * @returns {Promise<boolean>} - 返回是否连接到网络
 */
function checkNetworkStatus() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: function(res) {
        const networkType = res.networkType;
        console.log('当前网络类型:', networkType);
        // networkType 取值为 wifi, 2g, 3g, 4g, 5g, unknown, none
        if (networkType === 'none') {
          wx.showToast({
            title: '网络连接已断开',
            icon: 'none',
            duration: 2000
          });
          resolve(false);
        } else {
          resolve(true);
        }
      },
      fail: function() {
        console.error('获取网络状态失败');
        resolve(false);
      }
    });
  });
}

/**
 * 通用请求函数
 * @param {string} url - API 端点
 * @param {string} method - 请求方法 (GET, POST, etc.)
 * @param {Object} data - 请求数据
 * @returns {Promise} - 返回请求结果的 Promise
 */
function request(url, method = 'GET', data = {}) {
  // 添加日志以便调试
  console.log(`准备发送请求到: ${BASE_URL}${url}`);
  
  return new Promise(async (resolve, reject) => {
    // 先检查网络连接状态
    const isConnected = await checkNetworkStatus();
    if (!isConnected) {
      console.warn('网络连接不可用，无法发送请求');
      
      // 显示网络错误提示
      wx.showToast({
        title: '网络连接不可用，请检查网络',
        icon: 'none',
        duration: 3000
      });
      
      reject(new Error('网络连接不可用'));
      return;
    }
    
    // 获取存储的令牌
    const token = wx.getStorageSync('token') || '';
    
    // 准备请求头，添加认证令牌
    const headers = {
      'content-type': 'application/json'
    };
    
    // 如果有令牌或者在开发模式下
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (DEV_CONFIG.BYPASS_AUTH) {
      // 在开发模式下使用固定的令牌
      headers['Authorization'] = `Bearer ${DEV_CONFIG.DEV_TOKEN}`;
      console.log('开发模式：使用固定令牌访问API');
    }
    
    wx.request({
      url: BASE_URL + url,
      method: method,
      data: data,
      header: headers,
      success: (res) => {
        console.log(`请求成功: ${url}`, res);
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // 未认证，可能是令牌过期，跳转到登录页面
          console.error('认证失败，需要重新登录');
          
          // 保存当前页面路径，登录后可以返回
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const currentPage = pages[pages.length - 1];
            wx.setStorageSync('redirectUrl', `/${currentPage.route}`);
          }
          
          wx.showToast({
            title: '请先登录',
            icon: 'none',
            duration: 2000,
            complete: () => {
              setTimeout(() => {
                wx.navigateTo({
                  url: '/pages/login/login'
                });
              }, 2000);
            }
          });
          
          reject(new Error('认证失败，需要重新登录'));
        } else {
          console.error(`请求失败: ${res.statusCode}`, res);
          
          // 获取更详细的错误信息
          let detailedError = '';
          if (res.data) {
            if (typeof res.data === 'string') {
              detailedError = res.data;
            } else if (res.data.message) {
              detailedError = res.data.message;
            } else if (res.data.error) {
              detailedError = res.data.error;
            } else if (res.data.msg) {
              detailedError = res.data.msg;
            } else {
              try {
                detailedError = JSON.stringify(res.data);
              } catch (e) {
                detailedError = '未知错误';
              }
            }
          }
          
          // 显示API错误提示
          wx.showToast({
            title: `API请求失败: ${res.statusCode} - ${url}`,
            icon: 'none',
            duration: 5000
          });
          
          // 显示详细调试信息
          console.error('API错误详情:', {
            url: BASE_URL + url,
            method,
            statusCode: res.statusCode,
            data: res.data,
            requestData: data
          });
          
          reject(new Error(`请求失败: ${res.statusCode} - ${detailedError}`));
        }
      },
      fail: (err) => {
        console.error(`请求错误: ${url}`, err);
        // 添加更详细的错误信息
        let errorMsg = '未知错误';
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMsg = '请求超时';
          } else if (err.errMsg.includes('fail')) {
            if (err.errMsg.includes('domain')) {
              errorMsg = '域名解析失败 - 请检查 BASE_URL 是否正确设置';
            } else {
              errorMsg = '请求失败 - ' + err.errMsg;
            }
          }
        }
        console.error(`详细错误: ${errorMsg}`);
        
        // 显示请求错误提示
        wx.showToast({
          title: `API请求错误: ${errorMsg} - ${url}`,
          icon: 'none',
          duration: 5000
        });
        
        // 显示详细调试信息
        console.error('网络错误详情:', {
          url: BASE_URL + url,
          method,
          errorMsg: err.errMsg,
          requestData: data
        });
        
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * 获取新闻列表
 * @param {string} level - 难度等级 (sprout, cocoon, soar)
 * @param {string} date - 日期 (YYYY-MM-DD)
 * @param {number} page - 页码
 * @param {Array} languages - 对照语言代码数组，如 ['en', 'fr']
 * @returns {Promise} - 返回新闻数据的 Promise
 */
function getNewsList(level, date, page = 1, languages = []) {
  // 如果启用了模拟数据模式，直接返回模拟数据
  if (DEV_CONFIG.USE_MOCK_DATA) {
    console.log('使用模拟新闻数据, 难度级别:', level);
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockData = getMockNewsData(level, date);
        resolve({
          articles: mockData,
          totalPages: 1,
          currentPage: 1,
          totalItems: mockData.length
        });
      }, 500); // 模拟网络延迟
    });
  }
  
  // 构建API路径
  let url = `/api/articles?level=${level}&date=${date}&page=${page}&limit=10`;
  
  // 如果指定了语言，添加到查询参数
  if (languages && languages.length > 0) {
    url += `&languages=${encodeURIComponent(JSON.stringify(languages))}`;
  }
  
  // 更新为使用新的API路径格式
  return request(url);
}

/**
 * 获取经典名著列表
 * @param {string} level - 难度等级 (sprout, cocoon, soar)
 * @param {string} date - 日期 (YYYY-MM-DD)
 * @param {number} page - 页码
 * @param {Array} languages - 对照语言代码数组，如 ['en', 'fr']
 * @returns {Promise} - 返回经典名著数据的 Promise
 */
function getClassicsList(level, date, page = 1, languages = []) {
  // 如果启用了模拟数据模式，直接返回模拟数据
  if (DEV_CONFIG.USE_MOCK_DATA) {
    console.log('使用模拟经典名著数据, 难度级别:', level);
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockData = getMockClassicsData(level, date);
        resolve({
          articles: mockData,
          totalPages: 1,
          currentPage: 1,
          totalItems: mockData.length
        });
      }, 500); // 模拟网络延迟
    });
  }
  
  // 构建API路径
  let url = `/api/articles?level=${level}&date=${date}&type=classics&page=${page}&limit=10`;
  
  // 如果指定了语言，添加到查询参数
  if (languages && languages.length > 0) {
    url += `&languages=${encodeURIComponent(JSON.stringify(languages))}`;
  }
  
  // 更新为使用新的API路径格式
  return request(url);
}

/**
 * 获取学习卡片数据
 * @param {string} articleId - 文章ID
 * @param {string} type - 文章类型 (news, classics)
 * @returns {Promise} - 返回学习卡片数据的 Promise
 * @deprecated 请使用 getVocabularyHints 代替
 */
function getCardData(articleId, type) {
  console.warn('getCardData方法已弃用，请使用getVocabularyHints代替');
  // 为了保持向后兼容，转发到词汇提示接口
  return getVocabularyHints(articleId);
}

/**
 * 测试API连接
 * @returns {Promise} - 返回测试结果的 Promise
 */
function testConnection() {
  return new Promise(async (resolve) => {
    try {
      // 检查网络连接
      const isConnected = await checkNetworkStatus();
      if (!isConnected) {
        resolve({
          success: false,
          message: '设备未连接到网络',
          details: '请检查您的网络连接'
        });
        return;
      }
      
      // 尝试探测API端点格式
      console.log('尝试探测API端点格式');
      const result = await probeApiEndpoints();
      
      if (result.success) {
        resolve({
          success: true,
          message: 'API连接成功',
          details: result.details,
          detectedPath: result.detectedPath
        });
      } else {
        resolve({
          success: false,
          message: '无法连接到API',
          details: result.details
        });
      }
    } catch (error) {
      resolve({
        success: false,
        message: '测试期间发生错误',
        details: error.message || '未知错误'
      });
    }
  });
}

/**
 * 探测API端点格式
 * @returns {Promise} - 返回探测结果
 */
async function probeApiEndpoints() {
  // 可能的API路径格式
  const possiblePaths = [
    {path: '/api/health', name: 'API健康检查'},
    {path: '/health', name: '健康检查'},
    {path: '/api/status', name: 'API状态'},
    {path: '/status', name: '状态检查'},
    {path: '/api/ping', name: 'API Ping'},
    {path: '/ping', name: 'Ping'},
    {path: '/api', name: 'API根路径'},
    {path: '/api/v1', name: 'API v1'},
    {path: '/api/v1/news', name: '新闻API'},
    {path: '/news', name: '新闻直接路径'},
    {path: '/api/news', name: '新闻API路径'},
    {path: '/classics', name: '经典直接路径'},
    {path: '/api/classics', name: '经典API路径'},
    {path: '/api/articles', name: '文章API路径'},
  ];
  
  let foundValidEndpoint = false;
  let detectedPath = '';
  let responseDetails = '';
  
  // 逐个测试可能的路径
  for (const endpoint of possiblePaths) {
    try {
      console.log(`测试API端点: ${BASE_URL}${endpoint.path}`);
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: BASE_URL + endpoint.path,
          method: 'GET',
          success: resolve,
          fail: reject
        });
      });
      
      console.log(`${endpoint.name} 响应:`, response.statusCode);
      
      if (response.statusCode === 200) {
        foundValidEndpoint = true;
        detectedPath = endpoint.path;
        
        // 尝试解析响应内容
        try {
          if (typeof response.data === 'object') {
            responseDetails = JSON.stringify(response.data);
          } else {
            responseDetails = String(response.data);
          }
        } catch (e) {
          responseDetails = '响应内容无法解析';
        }
        
        break; // 找到一个有效端点就停止
      }
    } catch (error) {
      console.error(`测试 ${endpoint.name} 失败:`, error);
    }
  }
  
  if (foundValidEndpoint) {
    return {
      success: true,
      detectedPath,
      details: `成功连接到 ${BASE_URL}${detectedPath} - ${responseDetails}`
    };
  } else {
    return {
      success: false,
      details: '未能检测到有效的API端点，请确认后端服务配置'
    };
  }
}

/**
 * 获取文章词汇提示数据
 * @param {string} articleId - 文章ID
 * @param {string} language - 请求的语言代码 (可选)
 * @param {Array} languages - 需要翻译的语言代码数组，如 ['en', 'fr'] (可选)
 * @returns {Promise} - 返回词汇提示数据的 Promise
 */
function getVocabularyHints(articleId, language = 'zh-CN', languages = []) {
  // 如果启用了模拟数据模式，直接返回模拟词汇数据
  if (DEV_CONFIG.USE_MOCK_DATA) {
    console.log('使用模拟词汇数据, 文章ID:', articleId);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          vocabularyItems: [
            {
              word: '创新',
              translations: {
                'en': 'innovation',
                'fr': 'innovation',
                'ja': 'イノベーション'
              },
              examples: ['这是一个创新的设计', 'This is an innovative design'],
              audioUrl: 'https://example.com/audio/innovation.mp3'
            },
            {
              word: '科技',
              translations: {
                'en': 'technology',
                'fr': 'technologie',
                'ja': 'テクノロジー'
              },
              examples: ['科技改变生活', 'Technology changes life'],
              audioUrl: 'https://example.com/audio/technology.mp3'
            },
            {
              word: '环保',
              translations: {
                'en': 'environmental protection',
                'fr': 'protection de l\'environnement',
                'ja': '環境保護'
              },
              examples: ['环保是全球关注的问题', 'Environmental protection is a global concern'],
              audioUrl: 'https://example.com/audio/environment.mp3'
            }
          ]
        });
      }, 300); // 模拟网络延迟
    });
  }
  
  // 构建API路径
  let url = `/api/articles/${articleId}/vocabulary?language=${language}`;
  
  // 如果提供了多语言参数，添加到查询参数
  if (languages && languages.length > 0) {
    url += `&languages=${encodeURIComponent(JSON.stringify(languages))}`;
  }
  
  // 更新为使用新的API路径格式
  return request(url);
}

/**
 * 获取多语言翻译的词汇提示数据
 * @param {string} articleId - 文章ID
 * @param {Array} languages - 需要翻译的语言代码数组，如 ['en', 'fr']
 * @returns {Promise} - 返回多语言词汇提示数据的 Promise
 */
function getMultiLanguageVocabulary(articleId, languages = []) {
  // 更新为使用新的API路径格式
  return request(`/api/articles/${articleId}/vocabulary/translations`, 'POST', { languages });
}

/**
 * 获取听力练习数据
 * @param {string} articleId - 文章ID
 * @param {string} language - 请求的语言代码 (可选)
 * @param {Array} languages - 需要翻译的语言代码数组，如 ['en', 'fr'] (可选)
 * @returns {Promise} - 返回听力练习数据的 Promise
 */
function getListeningExercise(articleId, language = 'zh-CN', languages = []) {
  console.log('获取听力练习内容:', articleId, language, languages);
  
  // 如果启用了模拟数据模式，直接返回模拟听力数据
  if (DEV_CONFIG.USE_MOCK_DATA) {
    console.log('使用模拟听力数据, 文章ID:', articleId);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          title: "听力练习: " + articleId,
          audioUrl: "https://example.com/audio/listening-sample.mp3",
          transcription: "这是一段听力文本，用于练习听力理解能力。This is a listening text for practicing comprehension skills.",
          questions: [
            {
              id: "q1",
              text: "这段文字主要讲了什么？",
              options: ["听力练习的目的", "学习方法", "语言的重要性", "教育体系的改革"],
              correctAnswer: 0
            },
            {
              id: "q2",
              text: "根据听力内容，以下哪项描述是正确的？",
              options: ["听力理解不重要", "练习可以提高听力能力", "文本内容很复杂", "听力不需要练习"],
              correctAnswer: 1
            }
          ]
        });
      }, 300); // 模拟网络延迟
    });
  }
  
  // 构建API路径
  let url = `/api/articles/${articleId}/listening?language=${language}`;
  
  // 如果提供了多语言参数，添加到查询参数
  if (languages && languages.length > 0) {
    url += `&languages=${encodeURIComponent(JSON.stringify(languages))}`;
  }
  
  // 更新为使用新的API路径格式
  return request(url);
}

/**
 * 获取多语言翻译的听力练习数据
 * @param {string} articleId - 文章ID
 * @param {Array} languages - 需要翻译的语言代码数组，如 ['en', 'fr']
 * @returns {Promise} - 返回多语言听力练习数据的 Promise
 */
function getMultiLanguageListening(articleId, languages = []) {
  // 更新为使用新的API路径格式
  return request(`/api/articles/${articleId}/listening/translations`, 'POST', { languages });
}

/**
 * 获取语言特定版本的听力练习
 * @param {string} languageCode - 语言代码
 * @param {string} articleId - 文章ID
 * @returns {Promise} - 返回特定语言的听力练习数据的 Promise
 */
function getLanguageSpecificListening(languageCode, articleId) {
  // 更新为使用新的API路径格式
  return request(`/api/languages/${languageCode}/articles/${articleId}/listening`);
}

/**
 * 获取口语练习数据
 * @param {string} articleId - 文章ID
 * @param {string} language - 请求的语言代码 (可选)
 * @param {Array} languages - 需要翻译的语言代码数组，如 ['en', 'fr'] (可选)
 * @returns {Promise} - 返回口语练习数据的 Promise
 */
function getSpeakingExercise(articleId, language = 'zh-CN', languages = []) {
  // 如果启用了模拟数据模式，直接返回模拟口语数据
  if (DEV_CONFIG.USE_MOCK_DATA) {
    console.log('使用模拟口语数据, 文章ID:', articleId);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          title: "口语练习: " + articleId,
          instructions: "请朗读以下句子，并录制您的声音。",
          sentences: [
            {
              id: "s1",
              text: "科技正在改变我们的生活方式。",
              translation: "Technology is changing our way of life.",
              audioUrl: "https://example.com/audio/sentence1.mp3"
            },
            {
              id: "s2",
              text: "环保是每个人的责任。",
              translation: "Environmental protection is everyone's responsibility.",
              audioUrl: "https://example.com/audio/sentence2.mp3"
            },
            {
              id: "s3",
              text: "教育对国家发展至关重要。",
              translation: "Education is vital to national development.",
              audioUrl: "https://example.com/audio/sentence3.mp3"
            }
          ]
        });
      }, 300); // 模拟网络延迟
    });
  }
  
  // 构建API路径
  let url = `/api/articles/${articleId}/speaking?language=${language}`;
  
  // 如果提供了多语言参数，添加到查询参数
  if (languages && languages.length > 0) {
    url += `&languages=${encodeURIComponent(JSON.stringify(languages))}`;
  }
  
  // 更新为使用新的API路径格式
  return request(url);
}

/**
 * 获取多语言翻译的口语练习数据
 * @param {string} articleId - 文章ID
 * @param {Array} languages - 需要翻译的语言代码数组，如 ['en', 'fr']
 * @returns {Promise} - 返回多语言口语练习数据的 Promise
 */
function getMultiLanguageSpeaking(articleId, languages = []) {
  console.log('获取多语言口语练习内容:', articleId, languages);
  // 更新为使用新的API路径格式
  return request(`/api/articles/${articleId}/speaking/translations`, 'POST', { languages });
}

/**
 * 获取语言特定版本的口语练习
 * @param {string} languageCode - 语言代码
 * @param {string} articleId - 文章ID
 * @returns {Promise} - 返回特定语言的口语练习数据的 Promise
 */
function getLanguageSpecificSpeaking(languageCode, articleId) {
  // 更新为使用新的API路径格式
  return request(`/api/languages/${languageCode}/articles/${articleId}/speaking`);
}

/**
 * 获取模拟新闻数据（备用方案，当API不可用时使用）
 * @param {string} level - 难度等级 (sprout, cocoon, soar)
 * @param {string} date - 日期 (YYYY-MM-DD)
 * @returns {Array} - 模拟新闻数据
 */
function getMockNewsData(level, date) {
  // 定义新闻分类
  const newsCategories = [
    '自然科学',
    '工程技术',
    '医学健康',
    '社会科学',
    '人文艺术',
    '农业食品',
    '体育运动',
    '交叉学科'
  ];

  // 复用现有的模拟数据逻辑
  const mockNewsByLevel = {
    sprout: [
      {
        id: 'sprout-1',
        title: '小学生发明环保机器人，获全国创新奖',
        cover: '/images/news/robot.jpg',
        highlights: '一名11岁的小学生设计了一个能收集垃圾的小型机器人，在全国青少年科技创新大赛中获得金奖。',
        category: newsCategories[0],
        date: date,
        level: '萌芽岛'
      },
      {
        id: 'sprout-2',
        title: '新型太阳能电池效率突破30%',
        cover: '/images/news/solar.jpg',
        highlights: '科学家研发出新型太阳能电池，能量转化效率首次突破30%，为清洁能源发展带来新希望。',
        category: newsCategories[1],
        date: date,
        level: '萌芽岛'
      },
      {
        id: 'sprout-3',
        title: '全球儿童阅读日：培养阅读习惯的重要性',
        cover: '/images/news/reading.jpg',
        highlights: '今天是全球儿童阅读日，专家指出培养良好阅读习惯对儿童发展至关重要。',
        category: newsCategories[4],
        date: date,
        level: '萌芽岛'
      }
    ],
    forest: [
      {
        id: 'forest-1',
        title: '人工智能的未来发展',
        cover: '/images/news/ai.jpg',
        highlights: '人工智能正在改变我们的生活，让我们看看它的发展方向。',
        category: newsCategories[1],
        date: date,
        level: '森林谷'
      },
      {
        id: 'forest-2',
        title: '全球气候变化',
        cover: '/images/news/climate.jpg',
        highlights: '气候变化正在影响着地球的每个角落，我们需要采取行动。',
        category: newsCategories[3],
        date: date,
        level: '森林谷'
      },
      {
        id: 'forest-3',
        title: '现代艺术的发展',
        cover: '/images/news/art.jpg',
        highlights: '艺术是人类文明的结晶，让我们探索现代艺术的魅力。',
        category: newsCategories[4],
        date: date,
        level: '森林谷'
      }
    ]
  };

  return mockNewsByLevel[level] || [];
}

/**
 * 获取模拟经典名著数据（备用方案，当API不可用时使用）
 * @param {string} level - 难度等级 (sprout, cocoon, soar)
 * @param {string} date - 日期 (YYYY-MM-DD)
 * @returns {Array} - 模拟经典名著数据
 */
function getMockClassicsData(level, date) {
  // 定义名著分类
  const classicsCategories = [
    '中国古典文学',
    '西方古典文学',
    '中国儿童文学',
    '西方儿童文学',
    '东方人物传记',
    '西方人物传记'
  ];

  const mockClassicsByLevel = {
    sprout: [
      {
        id: 'classic-sprout-1',
        title: '《狼王梦》：生命的勇气与坚持',
        cover: '/images/classics/langwangmeng.jpg',
        highlights: '这本书讲述了一只母狼带领幼崽生存的故事，充满了对生命的热爱和面对困难的勇气。',
        category: classicsCategories[2],
        level: '萌芽岛',
        date: date
      },
      {
        id: 'classic-sprout-2',
        title: '《小王子》：纯真与爱的寓言',
        cover: '/images/classics/prince.jpg',
        highlights: '一个来自外星球的小王子，通过他纯真的眼光，让我们重新思考成人世界的价值观和爱的真谛。',
        category: classicsCategories[3],
        level: '萌芽岛',
        date: date
      },
      {
        id: 'classic-sprout-3',
        title: '《木偶奇遇记》：成长与责任',
        cover: '/images/classics/pinocchio.jpg',
        highlights: '匹诺曹从一个会说谎的木偶变成真正的男孩，这个故事告诉我们诚实和责任的重要性。',
        category: classicsCategories[3],
        level: '萌芽岛',
        date: date
      },
      {
        id: 'classic-sprout-4',
        title: '《阿凡提的故事》：智慧与机智',
        cover: '/images/classics/afanti.jpg',
        highlights: '这是一系列关于智慧老人阿凡提的民间故事，展现了他如何用智慧和机智解决问题。',
        category: classicsCategories[0],
        level: '萌芽岛',
        date: date
      },
      {
        id: 'classic-sprout-5',
        title: '《爱丽丝梦游仙境》：想象力的奇妙旅程',
        cover: '/images/classics/alice.jpg',
        highlights: '爱丽丝在梦中探索奇妙世界的故事，充满了丰富的想象力和对常规思维的突破。',
        category: classicsCategories[3],
        level: '萌芽岛',
        date: date
      }
    ],
    cocoon: [
      {
        id: 'classic-cocoon-1',
        title: '《平凡的世界》：人生与命运的思考',
        cover: '/images/classics/pingfan.jpg',
        highlights: '路遥的这部小说描绘了中国农村青年艰难而执着的人生历程，探讨了命运、追求和人性的主题。',
        category: classicsCategories[0],
        level: '破茧谷',
        date: date
      },
      {
        id: 'classic-cocoon-2',
        title: '《傲慢与偏见》：爱情与婚姻的经典',
        cover: '/images/classics/pride.jpg',
        highlights: '简·奥斯汀的杰作，通过伊丽莎白和达西的爱情故事，揭示了社会阶层、个人价值和真爱的本质。',
        category: classicsCategories[1],
        level: '破茧谷',
        date: date
      },
      {
        id: 'classic-cocoon-3',
        title: '《朝花夕拾》：鲁迅的青春回忆录',
        cover: '/images/classics/zhaohua.jpg',
        highlights: '鲁迅回忆自己童年和青少年时期的经历，既是个人成长的记录，也是那个时代的社会写照。',
        category: classicsCategories[0],
        level: '破茧谷',
        date: date
      },
      {
        id: 'classic-cocoon-4',
        title: '《简爱》：独立与尊严的追求',
        cover: '/images/classics/jane-eyre.jpg',
        highlights: '夏洛蒂·勃朗特笔下的简爱虽出身卑微，但坚持自我价值和独立精神，成为文学中的经典女性形象。',
        category: classicsCategories[1],
        level: '破茧谷',
        date: date
      },
      {
        id: 'classic-cocoon-5',
        title: '《老人与海》：坚韧不拔的人类精神',
        cover: '/images/classics/old-man.jpg',
        highlights: '海明威的小说讲述了一个老渔夫与大海、巨鱼搏斗的故事，象征着人类面对自然和命运时的不屈精神。',
        category: classicsCategories[1],
        level: '破茧谷',
        date: date
      }
    ],
    soar: [
      {
        id: 'classic-soar-1',
        title: '《红楼梦》：人性的复杂与社会的矛盾',
        cover: '/images/classics/hongloumeng.jpg',
        highlights: '曹雪芹的传世巨著，通过贾府的兴衰，展现了封建社会末期的全景图，深刻剖析了人性和命运。',
        category: classicsCategories[0],
        level: '翱翔峰',
        date: date
      },
      {
        id: 'classic-soar-2',
        title: '《战争与和平》：人性的光辉与战争的残酷',
        cover: '/images/classics/war.jpg',
        highlights: '托尔斯泰的恢宏巨著，通过多条故事线交织，既是拿破仑战争的历史画卷，也是对人性和社会的深刻探讨。',
        category: classicsCategories[1],
        level: '翱翔峰',
        date: date
      },
      {
        id: 'classic-soar-3',
        title: '《百年孤独》：魔幻与现实的交融',
        cover: '/images/classics/hundred-years.jpg',
        highlights: '加西亚·马尔克斯讲述了布恩迪亚家族七代人的故事，通过魔幻现实主义手法，展现拉美历史与现实。',
        category: classicsCategories[1],
        level: '翱翔峰',
        date: date
      },
      {
        id: 'classic-soar-4',
        title: '《围城》：人生困境的隽永比喻',
        cover: '/images/classics/fortress.jpg',
        highlights: '钱钟书的讽刺小说，以"城里人想出去，城外人想进来"的围城比喻，展示了人生的矛盾与困境。',
        category: classicsCategories[0],
        level: '翱翔峰',
        date: date
      },
      {
        id: 'classic-soar-5',
        title: '《罪与罚》：道德与良知的挣扎',
        cover: '/images/classics/crime.jpg',
        highlights: '陀思妥耶夫斯基的心理小说，通过大学生拉斯柯尔尼科夫犯罪后的心理变化，探讨人性与救赎的主题。',
        category: classicsCategories[1],
        level: '翱翔峰',
        date: date
      }
    ]
  };

  return mockClassicsByLevel[level] || [];
}

/**
 * 获取文章词汇数据 (getVocabularyHints的别名)
 * @param {string} articleId - 文章ID
 * @param {string} language - 请求的语言代码 (可选)
 * @param {Array} languages - 需要翻译的语言代码数组，如 ['en', 'fr'] (可选)
 * @returns {Promise} - 返回词汇数据的 Promise
 */
function getArticleVocabulary(articleId, language = 'zh-CN', languages = []) {
  return getVocabularyHints(articleId, language, languages);
}

// 导出函数
module.exports = {
  getNewsList,
  getClassicsList,
  getCardData,
  checkNetworkStatus,
  DEV_CONFIG,
  testConnection,
  BASE_URL,
  getVocabularyHints,
  getMultiLanguageVocabulary,
  getListeningExercise,
  getMultiLanguageListening,
  getLanguageSpecificListening,
  getSpeakingExercise,
  getMultiLanguageSpeaking,
  getLanguageSpecificSpeaking,
  probeApiEndpoints,
  getMockNewsData,
  getMockClassicsData,
  getArticleVocabulary
}