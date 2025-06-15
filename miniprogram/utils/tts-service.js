// TTS音频集成接口
const audioApi = require("./audio-api");

/**
 * TTS音频初始化
 * 为句子添加音频URL
 * @param {Array} sentences - 句子数组
 * @param {Array} translations - 翻译数组
 * @returns {Array} - 带音频URL的句子数组
 */
function initializeTTSForArticle(sentences, translations) {
  if (!sentences || !Array.isArray(sentences)) {
    return [];
  }
  
  // 处理原文句子
  const result = sentences.map((sentence, index) => {
    // 基本句子对象
    const sentenceObj = {
      id: `sentence-${index}`,
      text: sentence,
      audioUrl: audioApi.getAudioUrl("zh"),
      isPlaying: false
    };
    
    // 如果有翻译，添加翻译数组
    if (translations && Object.keys(translations).length > 0) {
      sentenceObj.translations = [];
      
      // 为每种语言添加翻译和音频URL
      Object.keys(translations).forEach(langCode => {
        if (translations[langCode] && translations[langCode][index]) {
          sentenceObj.translations.push({
            language: langCode,
            text: translations[langCode][index],
            audioUrl: audioApi.getAudioUrl(langCode)
          });
        }
      });
    }
    
    return sentenceObj;
  });
  
  return result;
}

/**
 * 切换音频播放状态
 * @param {Object} audioContext - 音频上下文
 * @param {string} url - 音频URL
 * @param {Function} onPlay - 播放回调
 * @param {Function} onEnd - 结束回调
 * @param {Function} onError - 错误回调
 */
function toggleAudio(audioContext, url, onPlay, onEnd, onError) {
  if (!audioContext) return;
  
  // 如果正在播放，停止播放
  if (!audioContext.paused) {
    audioContext.stop();
    if (onEnd) onEnd();
    return;
  }
  
  // 设置音频源
  audioContext.src = url;
  
  // 设置事件监听
  audioContext.onPlay(() => {
    if (onPlay) onPlay();
  });
  
  audioContext.onEnded(() => {
    if (onEnd) onEnd();
  });
  
  audioContext.onError((err) => {
    console.error("音频播放错误:", err);
    if (onError) onError(err);
  });
  
  // 开始播放
  audioContext.play();
}

module.exports = {
  initializeTTSForArticle,
  toggleAudio
};
