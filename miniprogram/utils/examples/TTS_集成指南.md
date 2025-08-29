# 九域小程序TTS音频功能集成指南

## 文件结构

- `/utils/audio-api.js` - 音频URL获取API
- `/utils/tts-service.js` - TTS服务集成工具
- `/utils/examples/` - 集成示例代码

## 如何集成

### 1. 引入必要的模块

```javascript
const audioApi = require("../../utils/audio-api");
const ttsService = require("../../utils/tts-service");
```

### 2. 初始化音频上下文

在页面的`onLoad`函数中添加：

```javascript
// 初始化音频上下文
this.audioContext = wx.createInnerAudioContext();
```

### 3. 为文章内容添加音频URL

```javascript
// 获取文章内容后为句子添加音频URL
const enhancedSentences = ttsService.initializeTTSForArticle(
  newsDetail.content,
  newsDetail.translations
);

// 更新文章详情数据
this.setData({
  newsDetail: {
    ...newsDetail,
    enhancedSentences
  }
});
```

### 4. 播放音频的函数示例

```javascript
playSentenceAudio: function(e) {
  const index = e.currentTarget.dataset.index;
  const language = e.currentTarget.dataset.language || "zh";
  const sentences = this.data.newsDetail.enhancedSentences;
  
  if (!sentences || !sentences[index]) return;
  
  // 获取要播放的音频URL
  let audioUrl;
  if (language === "zh") {
    audioUrl = sentences[index].audioUrl;
  } else {
    // 在翻译中查找对应语言
    const translation = sentences[index].translations.find(t => t.language === language);
    if (translation) {
      audioUrl = translation.audioUrl;
    } else {
      audioUrl = sentences[index].audioUrl; // 默认回退到中文
    }
  }
  
  // 播放音频
  ttsService.toggleAudio(
    this.audioContext,
    audioUrl,
    () => {
      // 播放开始回调
      console.log("音频开始播放");
      // 更新当前播放状态
      const updatedSentences = [...sentences];
      updatedSentences[index].isPlaying = true;
      this.setData({
        "newsDetail.enhancedSentences": updatedSentences
      });
    },
    () => {
      // 播放结束回调
      console.log("音频播放结束");
      // 更新播放状态
      const updatedSentences = [...sentences];
      updatedSentences[index].isPlaying = false;
      this.setData({
        "newsDetail.enhancedSentences": updatedSentences
      });
    },
    (err) => {
      // 错误回调
      console.error("音频播放错误:", err);
      wx.showToast({
        title: "音频播放失败",
        icon: "none"
      });
    }
  );
}
```

### 5. 不要忘记在页面卸载时释放音频资源

```javascript
onUnload: function() {
  if (this.audioContext) {
    this.audioContext.stop();
    this.audioContext.destroy();
  }
}
```

## 支持的语言

目前支持的10种语言：
- 简体中文 (zh)
- 繁体中文 (zh-TW)
- 英语 (en)
- 法语 (fr)
- 西班牙语 (es)
- 德语 (de)
- 意大利语 (it)
- 日语 (ja)
- 葡萄牙语(巴西) (pt-BR)
- 韩语 (ko)

