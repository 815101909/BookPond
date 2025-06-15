// TTS使用示例
const ttsService = require("../../utils/tts-service");

Page({
  data: {
    audioUrl: "",
    isPlaying: false,
    currentText: "世界微尘里"
  },
  
  onLoad: function() {
    // 预加载中文音频
    this.setData({
      audioUrl: ttsService.getTTSAudioUrl(this.data.currentText, "zh")
    });
  },
  
  // 播放中文音频
  playChineseAudio: function() {
    const audioUrl = ttsService.getTTSAudioUrl(this.data.currentText, "zh");
    this.playAudio(audioUrl);
  },
  
  // 播放英文音频
  playEnglishAudio: function() {
    const audioUrl = ttsService.getTTSAudioUrl("According to the South Korean National Civil Service Law", "en");
    this.playAudio(audioUrl);
  },
  
  // 播放法语音频
  playFrenchAudio: function() {
    const audioUrl = ttsService.getTTSAudioUrl("En vertu de la loi sur la fonction publique nationale", "fr");
    this.playAudio(audioUrl);
  },
  
  // 播放德语音频
  playGermanAudio: function() {
    const audioUrl = ttsService.getTTSAudioUrl("Laut Yonhap News Agency", "de");
    this.playAudio(audioUrl);
  },
  
  // 通用播放音频功能
  playAudio: function(url) {
    if (this.audioContext) {
      this.audioContext.stop();
    }
    
    this.audioContext = wx.createInnerAudioContext();
    this.audioContext.src = url;
    this.audioContext.onPlay(() => {
      this.setData({ isPlaying: true });
      console.log("音频开始播放");
    });
    this.audioContext.onEnded(() => {
      this.setData({ isPlaying: false });
      console.log("音频播放结束");
    });
    this.audioContext.onError((res) => {
      console.error("音频播放错误:", res);
      this.setData({ isPlaying: false });
    });
    
    this.audioContext.play();
  },
  
  // 页面卸载时释放资源
  onUnload: function() {
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext.destroy();
    }
  }
});

