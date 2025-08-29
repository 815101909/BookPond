// 跨环境云函数调用工具
// 统一管理所有云函数调用，支持跨小程序环境

// 云环境配置
const CLOUD_CONFIG = {
  // 资源方 AppID
  resourceAppid: 'wx85d92d28575a70f4',
  // 资源方环境 ID
  resourceEnv: 'cloud1-1gsyt78b92c539ef',
  // 是否使用跨环境模式
  identityless: true
};

// 云实例缓存
let cloudInstance = null;

/**
 * 初始化云环境实例
 * @returns {Promise<wx.cloud.Cloud>} 云实例
 */
async function initCloudInstance() {
  if (cloudInstance) {
    return cloudInstance;
  }

  try {
    // 创建跨环境云实例
    cloudInstance = new wx.cloud.Cloud(CLOUD_CONFIG);
    await cloudInstance.init();
    console.log('跨环境云实例初始化成功');
    return cloudInstance;
  } catch (error) {
    console.error('云实例初始化失败:', error);
    throw error;
  }
}

/**
 * 统一的云函数调用方法
 * @param {string} name - 云函数名称
 * @param {Object} data - 传递给云函数的数据
 * @returns {Promise<Object>} 云函数执行结果
 */
async function callCloudFunction(name, data = {}) {
  try {
    // 确保云实例已初始化
    const cloud = await initCloudInstance();
    
    console.log(`调用云函数: ${name}`, data);
    console.log(`callCloudFunction - data type: ${typeof data}, value:`, data);
    
    // 调用云函数
    const result = await cloud.callFunction({
      name: name,
      data: data
    });
    
    console.log(`云函数 ${name} 执行结果:`, result);
    return result;
  } catch (error) {
    console.error(`云函数 ${name} 调用失败:`, error);
    throw error;
  }
}

/**
 * 用户认证相关云函数调用
 */
const authAPI = {
  // 用户登录
  login: () => callCloudFunction('jiuyu_auth', { type: 'login' }),
  
  // 检查会话状态
  checkSession: () => callCloudFunction('jiuyu_auth', { type: 'checkSession' }),
  
  // 更新用户信息
  updateUserInfo: (field, value) => callCloudFunction('jiuyu_auth', { 
    type: 'updateUserInfo', 
    field,
    value 
  }),
  
  // 手机号登录
  phoneLogin: (code) => callCloudFunction('jiuyu_phoneLogin', { code })
};

/**
 * 用户积分相关云函数调用
 */
const pointsAPI = {
  // 获取用户积分
  getUserPoints: () => callCloudFunction('jiuyu_user_points', { 
    action: 'getUserPoints' 
  }),
  
  // 更新用户积分
  updateUserPoints: (data) => callCloudFunction('jiuyu_user_points', { 
    action: 'updateUserPoints', 
    data 
  })
};

/**
 * 打卡相关云函数调用
 */
const checkinAPI = {
  // 执行打卡
  checkIn: (study_time, type = 'manual') => callCloudFunction('jiuyu_checkin', {
    type: 'checkIn',
    study_time,
    checkin_type: type
  }),
  
  // 获取打卡记录
  getCheckinRecords: (year, month) => callCloudFunction('jiuyu_checkin', {
    type: 'getCheckinRecords',
    year,
    month
  }),
  
  // 获取打卡统计
  getCheckinStats: () => callCloudFunction('jiuyu_checkin', {
    type: 'getCheckinStats'
  }),
  
  // 检查并创建用户
  checkAndCreateUser: () => callCloudFunction('jiuyu_checkin', {
    type: 'checkAndCreateUser'
  })
};

/**
 * 写作相关云函数调用
 */
const writingAPI = {
  // 保存写作内容
  saveWriting: (data) => callCloudFunction('jiuyu_writing', {
    action: 'saveWriting',
    data
  }),
  
  // 获取写作历史
  getWritingHistory: (data) => callCloudFunction('jiuyu_writing', {
    action: 'getWritingHistory',
    data
  }),
  
  // 获取写作详情
  getWritingDetail: (data) => callCloudFunction('jiuyu_writing', {
    action: 'getWritingDetail',
    data
  }),
  
  // 保存时间胶囊
  saveTimeCapsule: (data) => callCloudFunction('jiuyu_writing', {
    action: 'saveTimeCapsule',
    data
  }),
  
  // 获取时间胶囊
  getTimeCapsules: (data) => callCloudFunction('jiuyu_writing', {
    action: 'getTimeCapsules',
    data
  }),
  
  // 检查过期的时间胶囊
  checkExpiredTimeCapsules: (data) => callCloudFunction('jiuyu_writing', {
    action: 'checkExpiredTimeCapsules',
    data
  })
};

/**
 * 听力相关云函数调用
 */
const listeningAPI = {
  // 获取音频列表
  getAudioList: (data) => callCloudFunction('jiuyu_listening', {
    type: 'getAudioList',
    ...data
  }),
  
  // 获取音频详情
  getAudioDetail: (data) => callCloudFunction('jiuyu_listening', {
    type: 'getAudioDetail',
    ...data
  }),
  
  // 获取练习题
  getExercises: (data) => callCloudFunction('jiuyu_listening', {
    type: 'getExercises',
    ...data
  }),
  
  // 保存错误记录
  saveMistake: (data) => callCloudFunction('jiuyu_listening', {
    type: 'saveMistake',
    ...data
  }),
  
  // 获取错误记录
  getMistakes: (data) => callCloudFunction('jiuyu_listening', {
    type: 'getMistakes',
    ...data
  }),
  
  // 更新错误记录
  updateMistake: (data) => callCloudFunction('jiuyu_listening', {
    type: 'updateMistake',
    ...data
  }),
  
  // 删除错误记录
  deleteMistake: (data) => callCloudFunction('jiuyu_listening', {
    type: 'deleteMistake',
    ...data
  }),
  
  // 修复glid类型问题
  fixGlidType: (data) => callCloudFunction('jiuyu_listening', {
    type: 'fixGlidType',
    ...data
  })
};

/**
 * 收藏相关云函数调用
 */
const favoritesAPI = {
  // 添加收藏
  addFavorite: (data) => callCloudFunction('jiuyu_favorites', {
    action: 'addFavorite',
    data
  }),
  
  // 移除收藏
  removeFavorite: (data) => callCloudFunction('jiuyu_favorites', {
    action: 'removeFavorite',
    data
  }),
  
  // 检查是否已收藏
  checkFavorite: (data) => callCloudFunction('jiuyu_favorites', {
    action: 'checkFavorite',
    data
  }),
  
  // 获取用户收藏列表
  getUserFavorites: (data) => callCloudFunction('jiuyu_favorites', {
    action: 'getUserFavorites',
    data
  })
};

/**
 * 消息相关云函数调用
 */
const messengerAPI = {
  // 获取消息列表
  getMessages: (data) => callCloudFunction('jiuyu_messenger', {
    action: 'getMessages',
    data
  }),
  
  // 删除消息
  deleteMessage: (data) => callCloudFunction('jiuyu_messenger', {
    action: 'deleteMessage',
    data
  }),
  
  // 标记消息为已读
  markAsRead: (data) => callCloudFunction('jiuyu_messenger', {
    action: 'markAsRead',
    data
  }),
  
  // 创建系统消息
  createSystemMessage: (data) => callCloudFunction('jiuyu_messenger', {
    action: 'createSystemMessage',
    data
  }),
  
  // 获取系统消息
  getSystemMessages: (data) => callCloudFunction('jiuyu_messenger', {
    action: 'getSystemMessages',
    data
  }),
  
  // 标记所有消息为已读
  markAllAsRead: () => callCloudFunction('jiuyu_messenger', {
    action: 'markAllAsRead'
  })
};

/**
 * 阅读相关云函数调用
 */
const readAPI = {
  // 获取文章列表
  getArticles: (data) => callCloudFunction('jiuyu_read', {
    action: 'getArticles',
    data
  }),
  
  // 获取文章详情
  getArticleDetail: (data) => callCloudFunction('jiuyu_read', {
    action: 'getArticleDetail',
    data
  })
};

/**
 * 句子相关云函数调用
 */
const sentencesAPI = {
  // 获取随机句子
  getRandomSentence: () => callCloudFunction('jiuyu_sentences', {
    action: 'getRandomSentence'
  }),
  
  // 获取所有句子
  getAllSentences: () => callCloudFunction('jiuyu_sentences', {
    action: 'getAllSentences'
  })
};

/**
 * 字幕相关云函数调用
 */
const subtitlesAPI = {
  // 根据日期获取字幕
  getSubtitlesByDate: (data) => callCloudFunction('jiuyu_subtitles', {
    action: 'getSubtitlesByDate',
    ...data
  }),
  
  // 获取字幕内容
  getSubtitleContent: (data) => callCloudFunction('jiuyu_subtitles', {
    action: 'getSubtitleContent',
    ...data
  }),
  
  // 根据GLID获取字幕
  getSubtitlesByGlid: (data) => callCloudFunction('jiuyu_subtitles', {
    action: 'getSubtitlesByGlid',
    ...data
  }),
  
  // 获取花朵数据
  getFlowers: (data) => callCloudFunction('jiuyu_subtitles', {
    action: 'getFlowers',
    ...data
  })
};

/**
 * TTS相关云函数调用
 */
const ttsAPI = {
  // 从文本生成音频
  generateAudioFromText: (data) => callCloudFunction('jiuyu_tts', {
    action: 'generateAudioFromText',
    data
  }),
  
  // 生成音频
  generateAudio: (data) => callCloudFunction('jiuyu_tts', {
    action: 'generateAudio',
    data
  }),
  
  // 获取临时URL
  getTempUrl: (data) => callCloudFunction('jiuyu_tts', {
    action: 'getTempUrl',
    data
  }),
  
  // 列出可用语音
  listVoices: () => callCloudFunction('jiuyu_tts', {
    action: 'listVoices'
  }),
  
  // 获取音频状态
  getAudioStatus: (data) => callCloudFunction('jiuyu_tts', {
    action: 'getAudioStatus',
    data
  })
};

module.exports = {
  // 基础方法
  callCloudFunction,
  initCloudInstance,
  
  // 各模块API
  authAPI,
  pointsAPI,
  checkinAPI,
  writingAPI,
  listeningAPI,
  favoritesAPI,
  messengerAPI,
  readAPI,
  sentencesAPI,
  subtitlesAPI,
  ttsAPI,
  
  // 配置
  CLOUD_CONFIG
};