// 云函数入口文件
const cloud = require('wx-server-sdk');
const axios = require('axios');
const config = require('./config');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'generateAudioFromText':
        return await generateAudioFromText(data);
      case 'generateAudio':
        // 检查是否直接传入了文本
        if (data && data.text) {
          return await generateAudioFromText(data);
        }
        // 如果没有传入文本，则尝试从文章获取
        return await generateAudio(data);
      case 'getTempUrl':
        // 获取云文件ID对应的临时URL
        return await getTempUrl(data);
      case 'listVoices':
        return await listVoices();
      case 'getAudioStatus':
        return await getAudioStatus(data);
      default:
        return {
          code: 1,
          msg: '未知的操作类型'
        };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return {
      code: 1,
      msg: '云函数执行错误: ' + error.message
    };
  }
};

/**
 * 直接从文本生成音频
 * @param {Object} data 包含文本、语言、声音类型等信息
 * @returns {Object} 结果对象
 */
async function generateAudioFromText(data) {
  const { text, language = 'zh', voiceType, speed, needTempUrl = false } = data;
  
  try {
    // 检查文本是否存在
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return { code: 1, msg: '文本内容为空' };
    }
    
    // 不限制文本长度
    console.log('处理文本:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
    
    // 调用Edge-TTS API
    const voice = getVoiceByLanguage(language, voiceType);
    console.log('使用语音模型:', voice);
    
    // 调用TTS API
    const audioBuffer = await callEdgeTTS(text, voice, config.tts.edge.defaultFormat, speed || config.tts.edge.defaultSpeed);
    console.log('音频生成完成, 大小:', audioBuffer.length);
    
    // 生成唯一的云存储路径
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const cloudPath = `audio/text/${language}/${timestamp}_${randomId}.mp3`;
    
    // 上传音频到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: audioBuffer,
    });
    
    // 获取fileID
    const fileID = uploadResult.fileID;
    console.log('上传完成, fileID:', fileID);
    
    // 根据需要获取临时URL
    let tempUrl = null;
    
    try {
      if (needTempUrl) {
        // 获取临时访问URL，但不影响主流程
        const tempUrlResult = await cloud.getTempFileURL({
          fileList: [fileID]
        });
        if (tempUrlResult && tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
          tempUrl = tempUrlResult.fileList[0].tempFileURL;
          console.log('获取临时URL成功:', tempUrl);
        }
      }
    } catch (urlError) {
      console.error('获取临时URL失败，但不影响主流程:', urlError);
    }
    
    // 返回文件ID和可能的临时URL
    return {
      code: 0,
      data: {
        cloudFileID: fileID, // 云文件ID
        tempUrl: tempUrl,    // 临时URL（如果请求了）
        language,
        voice,
        createTime: timestamp
      }
    };
    
  } catch (error) {
    console.error('从文本生成音频失败:', error);
    return {
      code: 1,
      msg: '从文本生成音频失败: ' + error.message
    };
  }
}

/**
 * 根据云文件ID获取临时URL
 */
async function getTempUrl(data) {
  try {
    const { fileID } = data;
    if (!fileID) {
      return { code: 1, msg: '缺少fileID参数' };
    }
    
    const result = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    if (result && result.fileList && result.fileList.length > 0) {
      return {
        code: 0,
        data: {
          tempUrl: result.fileList[0].tempFileURL,
          fileID: fileID
        }
      };
    } else {
      return { code: 1, msg: '获取临时URL失败' };
    }
  } catch (error) {
    console.error('获取临时URL失败:', error);
    return {
      code: 1,
      msg: '获取临时URL失败: ' + error.message
    };
  }
}

/**
 * 根据语言获取适当的语音
 */
function getVoiceByLanguage(language, voiceType = 'default') {
  // 使用配置文件中的语音映射
  const voiceMap = config.audio.defaultVoices;
  const openAIVoiceMap = config.audio.openAIVoiceMap;
  
  // 如果指定了OpenAI风格的语音类型
  if (voiceType && voiceType !== 'default') {
    const prefix = language.startsWith('zh') ? 'zh-' : '';
    const voiceKey = `${prefix}${voiceType}`;
    if (openAIVoiceMap[voiceKey]) {
      return openAIVoiceMap[voiceKey];
    }
    
    // 如果直接指定了Edge-TTS的语音名称
    if (voiceType.includes('Neural')) {
      return voiceType;
    }
  }
  
  // 默认返回语言映射的语音
  return voiceMap[language] || voiceMap['zh-CN'];
}

/**
 * 调用Edge-TTS API
 */
async function callEdgeTTS(text, voice, format = config.tts.edge.defaultFormat, speed = config.tts.edge.defaultSpeed) {
  try {
    console.log('调用Edge-TTS API, 参数:', { voice, format, speed });
    const response = await axios({
      method: 'post',
      url: config.tts.edge.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.tts.edge.apiKey}`
      },
      data: {
        "model": config.tts.edge.model,
        "input": text,
        "voice": voice,
        "response_format": format,
        "speed": speed
      },
      responseType: 'arraybuffer',
      timeout: 0 // 不设置超时时间，允许处理更长的文本
    });
    
    console.log('TTS API响应成功');
    return response.data;
  } catch (error) {
    console.error('Edge-TTS API调用失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
    }
    throw error;
  }
}

/**
 * 获取支持的语音列表
 */
async function listVoices() {
  try {
    // 返回简化的语音列表以减少处理时间
    const voices = [
      { id: 'zh-CN-XiaoxiaoNeural', name: '小晓 (女)', language: 'zh-CN' },
      { id: 'zh-CN-YunyangNeural', name: '云扬 (男)', language: 'zh-CN' },
      { id: 'en-US-JennyNeural', name: 'Jenny', language: 'en-US' }
    ];
    
    return {
      code: 0,
      data: {
        voices
      }
    };
  } catch (error) {
    console.error('获取语音列表失败:', error);
    return {
      code: 1,
      msg: '获取语音列表失败: ' + error.message
    };
  }
}

/**
 * 获取音频状态，简化版总是返回不存在
 */
async function getAudioStatus(data) {
  return {
    code: 0,
    data: {
      exists: false,
      isExpired: true
    }
  };
}

/**
 * 生成音频文件 - 对文章的完整版本（保留但不推荐使用，可能导致超时）
 */
async function generateAudio(data) {
  return {
    code: 1,
    msg: '为避免超时，请直接传入文本，不要使用文章ID生成'
  };
}