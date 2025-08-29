const cloud = require('wx-server-sdk');
const axios = require('axios');
const FormData = require('form-data');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action, data } = event;

  switch (action) {
    case 'generateSubtitles':
      return await generateSubtitles(data);
    case 'alignAudioText':
      return await alignAudioText(data);
    default:
      return {
        code: 1,
        msg: '未知的操作类型'
      };
  }
};

/**
 * 生成VTT字幕文件
 * @param {Object} data - 包含audioUrl和textContent的数据对象
 * @param {string} data.audioUrl - 音频文件的URL地址
 * @param {string} data.textContent - 字幕文本内容
 * @returns {Object} 返回结果对象
 */
async function generateSubtitles(data) {
  try {
    const { audioUrl, textContent } = data;

    // 参数验证
    if (!audioUrl || !textContent) {
      return { 
        code: 1, 
        msg: '缺少必要参数：audioUrl 和 textContent' 
      };
    }

    console.log('开始生成VTT字幕文件...');
    console.log('音频URL:', audioUrl);
    console.log('文本内容长度:', textContent.length);

    // 检查audioUrl是否为cloudId格式，如果是则转换为临时链接
    let finalAudioUrl = audioUrl;
    if (audioUrl && !audioUrl.startsWith('http')) {
      // 假设这是一个cloudId，需要转换为临时链接
      console.log('检测到cloudId格式，正在转换为临时链接...');
      try {
        const db = cloud.database();
        const fileResult = await cloud.getTempFileURL({
          fileList: [audioUrl]
        });
        
        if (fileResult.fileList && fileResult.fileList.length > 0 && fileResult.fileList[0].tempFileURL) {
          finalAudioUrl = fileResult.fileList[0].tempFileURL;
          console.log('临时链接转换成功:', finalAudioUrl);
        } else {
          console.error('临时链接转换失败:', fileResult);
          return {
            code: 1,
            msg: '无法获取音频文件的临时链接',
            debug: fileResult
          };
        }
      } catch (error) {
        console.error('临时链接转换过程中发生错误:', error);
        return {
          code: 1,
          msg: '临时链接转换失败: ' + error.message,
          debug: error
        };
      }
    }

    // 下载音频文件
    console.log('正在下载音频文件...');
    const audioResponse = await axios.get(finalAudioUrl, { 
      responseType: 'arraybuffer',
      timeout: 60000 // 60秒超时
    });
    
    const audioBuffer = Buffer.from(audioResponse.data);
    console.log('音频文件下载完成，大小:', audioBuffer.length, 'bytes');

    // 创建form-data
    const formData = new FormData();
    
    // 添加音频文件 - 使用video参数名（根据API要求）
    formData.append('video', audioBuffer, {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    });
    
    // 添加字幕文本
    formData.append('script', textContent);

    console.log('正在调用VTT生成API...');
    
    // 调用API生成VTT文件
    const response = await axios.post(
      'https://ksrgszk-aeneas-vtt-gen.hf.space/api/generate-vtt',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'text/vtt, application/json'
        },
        timeout: 180000, // 3分钟超时
        responseType: 'text', // 期望返回文本格式的VTT文件
        maxContentLength: 50 * 1024 * 1024, // 50MB最大响应大小
        validateStatus: function (status) {
          // 接受200-299和一些特定的错误状态码
          return (status >= 200 && status < 300) || status === 400 || status === 500;
        }
      }
    );

    console.log('API响应状态:', response.status);
    console.log('API响应头:', response.headers['content-type']);

    // 检查响应状态
    if (response.status === 200) {
      // 检查响应内容类型
      const contentType = response.headers['content-type'] || '';
      
      if (contentType.includes('text/vtt') || response.data.includes('WEBVTT')) {
        // 成功返回VTT文件
        console.log('VTT文件生成成功');
        return {
          code: 0,
          msg: '字幕生成成功',
          vtt: response.data
        };
      } else if (contentType.includes('application/json')) {
        // 返回的是JSON错误信息
        let errorData;
        try {
          errorData = JSON.parse(response.data);
        } catch (e) {
          errorData = { error: response.data };
        }
        
        return {
          code: 1,
          msg: '服务器返回错误: ' + (errorData.error || errorData.detail || '未知错误'),
          debug: errorData
        };
      } else {
        // 未知的响应格式
        console.log('响应数据前100字符:', response.data.substring(0, 100));
        return {
          code: 1,
          msg: '服务器返回了未知格式的响应',
          debug: {
            contentType: contentType,
            dataPreview: response.data.substring(0, 200)
          }
        };
      }
    } else {
      // HTTP错误状态码
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(response.data);
        errorMsg += ': ' + (errorData.error || errorData.detail || errorData.message || '未知错误');
      } catch (e) {
        errorMsg += ': ' + response.data;
      }
      
      return {
        code: 1,
        msg: errorMsg,
        debug: {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        }
      };
    }

  } catch (error) {
    console.error('字幕生成过程中发生错误:', error);
    
    // 网络错误或其他异常
    if (error.response) {
      // 服务器返回了错误响应
      const status = error.response.status;
      const data = error.response.data;
      
      let errorMsg = `HTTP ${status}`;
      if (data) {
        try {
          const errorData = typeof data === 'string' ? JSON.parse(data) : data;
          errorMsg += ': ' + (errorData.error || errorData.detail || errorData.message || '服务器错误');
        } catch (e) {
          errorMsg += ': ' + (typeof data === 'string' ? data : '服务器错误');
        }
      }
      
      return {
        code: 1,
        msg: errorMsg,
        debug: {
          status: status,
          statusText: error.response.statusText,
          data: data
        }
      };
    } else if (error.request) {
      // 请求发送了但没有收到响应
      return {
        code: 1,
        msg: '网络请求超时或无法连接到服务器',
        debug: {
          error: 'NETWORK_ERROR',
          message: error.message
        }
      };
    } else {
      // 其他错误
      return {
        code: 1,
        msg: '请求配置错误: ' + error.message,
        debug: {
          error: 'CONFIG_ERROR',
          message: error.message
        }
      };
    }
  }
}

/**
 * 音频文本对齐功能（复用generateSubtitles）
 * @param {Object} data - 包含audioUrl和textContent的数据对象
 * @returns {Object} 返回结果对象
 */
async function alignAudioText(data) {
  return await generateSubtitles(data);
}
