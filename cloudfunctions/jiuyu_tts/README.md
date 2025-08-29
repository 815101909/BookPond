# 九语小程序 - TTS文本转语音云函数

这个云函数用于将文章内容转换为语音，使用Edge-TTS服务，支持多语言和不同的语音选项。

## 功能概述

1. 将文章内容转换为语音
2. 支持多语言内容（中文、英文、日语等）
3. 支持选择不同的语音（男声、女声等）
4. 支持按章节（start, body, ending）生成音频
5. 提供语音列表获取功能
6. 支持音频状态查询和缓存过期检查

## 接口说明

### 1. 生成音频 (generateAudio)

将文章内容转换为语音并保存到云存储。

**参数：**
```javascript
{
  articleId: "文章ID",
  language: "语言代码", // zh-CN, en, ja等
  section: "章节", // start, body, ending, all(默认)
  voiceType: "语音类型" // default, alloy, echo, fable等，或直接使用Neural声音名称
}
```

**返回：**
```javascript
{
  code: 0, // 0表示成功
  data: {
    audioUrl: "音频URL",
    fileID: "云存储文件ID",
    language: "语言代码",
    section: "章节",
    voice: "使用的语音"
  }
}
```

### 2. 获取语音列表 (listVoices)

获取支持的语音列表。

**参数：** 无

**返回：**
```javascript
{
  code: 0,
  data: {
    voices: [
      { id: "zh-CN-XiaoxiaoNeural", name: "小晓 (女)", language: "zh-CN" },
      // 更多语音...
    ]
  }
}
```

### 3. 获取音频状态 (getAudioStatus)

检查文章特定部分是否已生成音频。

**参数：**
```javascript
{
  articleId: "文章ID",
  language: "语言代码",
  section: "章节" // 默认为all
}
```

**返回：**
```javascript
{
  code: 0,
  data: {
    exists: true, // 或false
    audioUrl: "音频URL", // 如果exists为true
    createTime: 1626789012345, // 创建时间戳
    voice: "使用的语音",
    isExpired: false // 是否过期
  }
}
```

## 配置说明

配置参数在`config.js`文件中设置：

1. TTS服务配置
   - API地址
   - API密钥
   - 默认模型
   - 默认格式
   - 默认语速

2. 音频配置
   - 过期时间
   - 默认语音映射
   - OpenAI风格语音映射

## 部署说明

1. 在云开发控制台上传该云函数
2. 确保`config.js`中的API密钥已替换为您的实际密钥
3. 设置适当的云函数超时时间（建议设置为60秒以上）

## 注意事项

1. 请确保Edge-TTS服务可用
2. 长文本可能需要较长的处理时间
3. 生成的音频会临时存储在云存储中
4. 音频文件有过期时间，超过设定时间会被标记为过期 