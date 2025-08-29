# jiuyu_aeneas 云函数

这个云函数提供了使用 aeneas 工具进行音频和文本自动对齐生成字幕的功能。

## 功能说明

### 1. generateSubtitles - 生成字幕

自动对齐音频和文本，生成带时间戳的字幕数据。

**参数：**
```javascript
{
  audioUrl: "音频文件URL（支持云存储链接）",
  textContent: "要对齐的文本内容",
  language: "语言代码（可选，默认zh-CN）",
  glid: "文章ID（可选，用于保存字幕到数据库）"
}
```

**返回：**
```javascript
{
  code: 0,
  msg: "字幕生成成功",
  data: {
    segments: [
      {
        start_time: 0.0,
        end_time: 3.5,
        text: "这里是字幕文本",
        image_url: ""
      }
    ],
    duration: 120.5,
    totalSegments: 10
  }
}
```

### 2. alignAudioText - 音频文本对齐

简化版本的音频文本对齐功能，内部调用 generateSubtitles。

**参数：**
```javascript
{
  audioUrl: "音频文件URL",
  textContent: "文本内容",
  language: "语言代码（可选）"
}
```

### 3. saveSubtitles - 保存字幕

将字幕数据保存到数据库。

**参数：**
```javascript
{
  glid: "文章ID",
  segments: "字幕片段数组",
  language: "语言代码",
  duration: "总时长"
}
```

## 使用示例

### 在说一说页面中使用

```javascript
// 在 speak.js 中添加生成字幕的功能
generateSubtitlesForContent: function(type) {
  const contentKey = type === 'hotspot' ? 'currentHotspot' : 'currentClassic';
  const content = this.data[contentKey];
  
  if (!content || !content.audioUrl) {
    wx.showToast({
      title: '请先加载音频内容',
      icon: 'none'
    });
    return;
  }
  
  // 获取文本内容
  let textContent = '';
  if (content.content) {
    textContent = content.content;
  } else if (content.title) {
    textContent = content.title;
  }
  
  if (!textContent) {
    wx.showToast({
      title: '没有找到文本内容',
      icon: 'none'
    });
    return;
  }
  
  wx.showLoading({
    title: '正在生成字幕...'
  });
  
  // 调用aeneas云函数生成字幕
  wx.cloud.callFunction({
    name: 'jiuyu_aeneas',
    data: {
      action: 'generateSubtitles',
      data: {
        audioUrl: content.audioUrl,
        textContent: textContent,
        language: 'zh-CN',
        glid: content.glid
      }
    }
  }).then(res => {
    wx.hideLoading();
    
    if (res.result && res.result.code === 0) {
      // 字幕生成成功，更新内容
      const updateData = {};
      updateData[`${contentKey}.segments`] = res.result.data.segments;
      updateData[`${contentKey}.duration`] = res.result.data.duration;
      
      this.setData(updateData);
      
      wx.showToast({
        title: `字幕生成成功，共${res.result.data.totalSegments}个片段`,
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: res.result.msg || '字幕生成失败',
        icon: 'none'
      });
    }
  }).catch(err => {
    wx.hideLoading();
    console.error('生成字幕失败:', err);
    wx.showToast({
      title: '字幕生成失败',
      icon: 'none'
    });
  });
}
```

## 环境要求

**当前版本使用外部API实现，无需安装本地依赖**

- Node.js 运行环境（云函数自带）
- 微信小程序云开发环境
- axios 库（用于HTTP请求）
- 网络连接（访问外部API）

### API服务

使用 Hugging Face 提供的 aeneas VTT 生成服务：
- API地址：`https://ksrgszk-aeneas-vtt-gen.hf.space/api/generate`
- 支持音频文本对齐生成VTT字幕
- 需要提供可访问的音频URL和对应文本

### 云函数配置

1. **超时时间**：建议设置为 300 秒（5分钟）或更长，因为API处理可能需要较长时间
2. **内存配置**：建议设置为 256MB 或更高
3. **网络权限**：确保云函数可以访问外部API

## 支持的语言

- 中文（简体）：zh-CN → cmn
- 中文（繁体）：zh-TW → cmn
- 英语：en, en-US → en
- 法语：fr → fr
- 西班牙语：es → es
- 德语：de → de
- 意大利语：it → it
- 日语：ja → ja
- 韩语：ko → ko
- 俄语：ru → ru

## 注意事项

### 外部API实现

1. **真实对齐**：使用外部API进行真实的音频文本对齐
2. **VTT格式**：API返回标准VTT字幕格式，自动转换为内部格式
3. **准确性**：基于真实的aeneas算法，提供高质量的时间对齐
4. **网络依赖**：需要稳定的网络连接访问外部API

### 注意事项

1. **音频格式**：aeneas 支持多种音频格式，但建议使用 WAV 格式以获得最佳效果
2. **文本预处理**：函数会自动移除 HTML 标签并按句子分割文本
3. **临时文件**：处理过程中会创建临时文件，处理完成后会自动清理
4. **数据库存储**：如果提供了 glid 参数，生成的字幕会自动保存到 jiuyu_subtitles 集合
5. **错误处理**：包含完整的错误处理机制，确保临时文件被正确清理

## 故障排除

### 常见问题

1. **aeneas 命令未找到**
   - 确保 Python 和 aeneas 库已正确安装
   - 检查 PATH 环境变量

2. **音频下载失败**
   - 检查音频 URL 是否有效
   - 确保云存储权限配置正确

3. **对齐质量不佳**
   - 确保音频质量良好，无噪音
   - 检查文本内容是否与音频匹配
   - 考虑调整文本分割策略

4. **处理时间过长**
   - 增加云函数超时时间
   - 考虑分段处理长音频

## 性能优化建议

1. **音频预处理**：在上传前对音频进行预处理，确保格式和质量
2. **文本优化**：提供清晰、准确的文本内容
3. **缓存机制**：对于相同的音频文本组合，可以缓存结果
4. **异步处理**：对于长音频，考虑使用异步处理机制