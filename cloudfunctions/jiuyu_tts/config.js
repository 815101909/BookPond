// 云函数配置文件
module.exports = {
  // TTS服务配置
  tts: {
    // Edge-TTS API配置
    edge: {
      apiUrl: 'https://ksrgszk-edgetts-api-openai.hf.space/v1/audio/speech',
      apiKey: 'your_api_key_here', // 替换为您的实际API密钥
      model: 'tts-1',
      defaultFormat: 'mp3',
      defaultSpeed: 1.0
    }
  },
  
  // 音频配置
  audio: {
    // 音频文件过期时间(毫秒)
    expireTime: 7 * 24 * 60 * 60 * 1000, // 7天
    
    // 默认语音映射
    defaultVoices: {
      'zh-CN': 'zh-CN-XiaoxiaoNeural',
      'zh': 'zh-CN-XiaoxiaoNeural',
      'en': 'en-US-AvaNeural',
      'en-US': 'en-US-AvaNeural',
      'ja': 'ja-JP-NanamiNeural',
      'ja-JP': 'ja-JP-NanamiNeural',
      'fr': 'fr-FR-DeniseNeural',
      'fr-FR': 'fr-FR-DeniseNeural',
      'de': 'de-DE-KatjaNeural',
      'de-DE': 'de-DE-KatjaNeural',
      'es': 'es-ES-ElviraNeural',
      'es-ES': 'es-ES-ElviraNeural',
      'ru': 'ru-RU-SvetlanaNeural',
      'ru-RU': 'ru-RU-SvetlanaNeural',
      'ko': 'ko-KR-SunHiNeural',
      'ko-KR': 'ko-KR-SunHiNeural',
      'pt': 'pt-BR-FranciscaNeural',
      'pt-BR': 'pt-BR-FranciscaNeural'
    },
    
    // OpenAI风格语音映射
    openAIVoiceMap: {
      'alloy': 'en-US-AnaNeural',
      'echo': 'en-US-ChristopherNeural',
      'fable': 'en-US-JennyNeural',
      'onyx': 'en-US-GuyNeural',
      'nova': 'en-US-AriaNeural',
      'shimmer': 'en-US-SaraNeural',
      // 中文映射
      'zh-alloy': 'zh-CN-YunyangNeural',
      'zh-echo': 'zh-CN-YunjianNeural',
      'zh-fable': 'zh-CN-XiaochenNeural',
      'zh-onyx': 'zh-CN-YunyeNeural',
      'zh-nova': 'zh-CN-XiaoshuangNeural',
      'zh-shimmer': 'zh-CN-XiaohanNeural',
      // 葡萄牙语（巴西）映射
      'pt-alloy': 'pt-BR-AntonioNeural',
      'pt-echo': 'pt-BR-BrendaNeural',
      'pt-fable': 'pt-BR-FranciscaNeural',
      'pt-onyx': 'pt-BR-DonatoNeural',
      'pt-nova': 'pt-BR-ThalitaNeural',
      'pt-shimmer': 'pt-BR-YaraNeural'
    }
  }
}; 