// TTS音频URL接口
const SERVER_URL = "http://localhost:5050";

/**
 * 获取TTS音频URL
 * @param {string} language - 语言代码
 * @returns {string} - 音频文件URL
 */
function getAudioUrl(language) {
  // 语言代码与音频文件映射
  const audioMap = {
    "zh": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 简体中文 
    "zh-TW": `${SERVER_URL}/uploads/audio/tts-1743991734352-e46a02f999a2bf1e.wav`,  // 繁体中文
    "en": `${SERVER_URL}/uploads/audio/tts-1743991712933-f004ec76a246d239.wav`,     // 英语
    "fr": `${SERVER_URL}/uploads/audio/tts-1744002369077-7af41564bc149718.wav`,     // 法语
    "es": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 西班牙语
    "de": `${SERVER_URL}/uploads/audio/tts-1744009042031-8fa942018362bd9e.wav`,     // 德语
    "it": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 意大利语
    "ar": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 阿拉伯语
    "ja": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 日语
    "pt-PT": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,  // 葡萄牙语(葡萄牙)
    "pt-BR": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,  // 葡萄牙语(巴西)
    "th": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 泰语
    "ru": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 俄语
    "ms": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`,     // 马来语
    "ko": `${SERVER_URL}/uploads/audio/tts-1743991684407-b0af994ae55c7922.wav`      // 韩语
  };
  
  // 获取指定语言的音频URL，如未找到则返回中文
  return audioMap[language] || audioMap["zh"];
}

/**
 * 获取TTS语音ID
 * @param {string} language - 语言代码
 * @returns {string} - 对应的语音ID
 */
function getVoiceId(language) {
  const voiceMap = {
    "zh": "zh-CN-XiaoxiaoNeural",
    "zh-TW": "zh-HK-WanLungNeural",
    "en": "en-GB-RyanNeural",
    "fr": "fr-FR-VivienneMultilingualNeural",
    "es": "es-ES-AlvaroNeural",
    "de": "de-DE-FlorianMultilingualNeural",
    "it": "it-IT-ElsaNeural",
    "ar": "ar-SA-HamedNeural",
    "ja": "ja-JP-KeitaNeural",
    "pt-PT": "pt-PT-RaquelNeural",
    "pt-BR": "pt-BR-AntonioNeural",
    "th": "th-TH-PremwadeeNeural",
    "ru": "ru-RU-DmitryNeural",
    "ms": "ms-MY-OsmanNeural",
    "ko": "ko-KR-SunHiNeural"
  };
  return voiceMap[language] || "zh-CN-XiaoxiaoNeural";
}

/**
 * 通过生成直接向后端请求的URL格式
 * @param {string} text - 文本内容
 * @param {string} language - 语言代码
 * @returns {string} - 请求URL
 */
function generateRequestUrl(text, language) {
  const voiceId = getVoiceId(language);
  return `${SERVER_URL}/api/tts/generate?text=${encodeURIComponent(text)}&voice=${voiceId}&format=wav`;
}

module.exports = {
  getAudioUrl,
  getVoiceId,
  generateRequestUrl,
  SERVER_URL
};
