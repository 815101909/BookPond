// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const subtitlesCollection = db.collection('jiuyu_subtitles');
const flowersCollection = db.collection('jiuyu_flowers');

exports.main = async (event, context) => {
  const { action, ...data } = event;
  
  console.log('云函数入口参数:', { action, data });
  
  switch (action) {
    case 'getSubtitlesByDate':
      return await getSubtitlesByDate(data);
    case 'getSubtitleContent':
      return await getSubtitleContent(data);
    case 'getSubtitlesByGlid':
      return await getSubtitlesByGlid(data);
    case 'getFlowers':
      return await getFlowers(data);
    default:
      return {
        code: 1,
        msg: '未知的操作类型'
      };
  }
};

/**
 * 解析WEBVTT格式字幕为segments数组
 */
function parseWebVTT(webvttText) {
  if (!webvttText || typeof webvttText !== 'string') {
    return [];
  }
  
  const segments = [];
  const lines = webvttText.split('\n');
  let currentSegment = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳过WEBVTT头部和空行
    if (line === 'WEBVTT' || line === '') {
      continue;
    }
    
    // 检查是否是时间戳行
    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})$/);
    if (timeMatch) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      
      const startTime = timeToSeconds(timeMatch[1]);
      const endTime = timeToSeconds(timeMatch[2]);
      
      currentSegment = {
        start_time: startTime, // 将start_time减少3秒，但不能小于0
        end_time: endTime, // 将end_time减少3秒，但不能小于0
        text: '',
        image_url: ''
      };
    } else if (currentSegment && line && !line.match(/^\d+$/)) {
      // 如果不是序号行且有内容，则为字幕文本
      if (currentSegment.text) {
        currentSegment.text += ' ';
      }
      currentSegment.text += line;
    }
  }
  
  // 添加最后一个片段
  if (currentSegment) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * 将时间字符串转换为秒数
 */
function timeToSeconds(timeStr) {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseFloat(parts[2]);
  
  return hours * 3600 + minutes * 60 + seconds;
}



/**
 * 根据日期和类型获取字幕内容
 */
async function getSubtitlesByDate(data) {
  try {
    const { date, type, difficulty, language = 'zh-CN' } = data;
    
    if (!date || !type) {
      return {
        code: 1,
        msg: '缺少必要参数：date 和 type'
      };
    }
    
    console.log('获取字幕数据，参数:', { date, type, difficulty, language });
    
    // 首先根据日期、类型、难度查询字幕集合
    const subtitleQuery = {
      type: type,
      language: language,
      date: date
    };
    
    if (difficulty) {
      subtitleQuery.difficulty = difficulty;
    }
    
    console.log('开始查询字幕数据，查询条件:', subtitleQuery);
    
    const subtitleResult = await subtitlesCollection
      .where(subtitleQuery)
      .orderBy('create_time', 'desc')
      .limit(1)
      .get();
    
    console.log('字幕查询结果:', {
      success: subtitleResult.success,
      dataLength: subtitleResult.data ? subtitleResult.data.length : 0
    });
    
    // 详细调试信息：显示查询到的字幕集合原始数据
    if (subtitleResult.data && subtitleResult.data.length > 0) {
      console.log('=== 字幕集合原始数据调试信息 (getSubtitlesByDate) ===');
      console.log('查询到的字幕数据数量:', subtitleResult.data.length);
      subtitleResult.data.forEach((item, index) => {
        console.log(`字幕数据[${index}]:`, {
          _id: item._id,
          glid: item.glid,
          glidType: typeof item.glid,
          type: item.type,
          language: item.language,
          date: item.date,
          difficulty: item.difficulty,
          subtitlesArrayLength: item.subtitles ? item.subtitles.length : 0,
          imageUrlsLength: item.image_url ? item.image_url.length : 0,
          hasSubtitles: !!item.subtitles,
          hasImageUrls: !!item.image_url
        });
        if (item.subtitles && Array.isArray(item.subtitles)) {
          console.log(`字幕数据[${index}]的subtitles数组:`, item.subtitles.map(sub => ({
            language: sub.language,
            hasSubtitle: !!sub.subtitle,
            hasUploadFile1: !!sub.uploadFile1,
            uploadFile1Length: sub.uploadFile1 ? sub.uploadFile1.length : 0
          })));
        }
      });
      console.log('=== 字幕集合原始数据调试信息结束 ===');
    }
    
    if (!subtitleResult.data || subtitleResult.data.length === 0) {
      return {
        code: 1,
        msg: '未找到字幕数据'
      };
    }
    
    const subtitleData = subtitleResult.data[0];
    console.log('选择的字幕数据，glid:', subtitleData.glid, 'glid类型:', typeof subtitleData.glid);
    
    // 使用字幕数据的glid作为文章集合的_id查询文章数据
    const articlesCollection = db.collection('jiuyu_articles');
    const articleResult = await articlesCollection.doc(subtitleData.glid).get();
    
    let articleData = null;
    if (articleResult.data) {
      articleData = articleResult.data;
    } else {
      console.log('未找到文章数据，将使用默认数据');
      // 创建默认的文章数据结构
      articleData = {
        _id: subtitleData.glid,
        title: '练习内容',
        cover_url: '',
        audio_url: '',
        type: type,
        language: language,
        level: difficulty || 'medium'
      };
    }
    
    // 处理字幕数据
    let segments = [];
    let imageUrls = [];
    let targetSubtitle = null;
    
    console.log('找到字幕数据，完整数据结构:', JSON.stringify(subtitleData, null, 2));
    
    // 从subtitles数组中找到对应语言的字幕
    if (subtitleData.subtitles && Array.isArray(subtitleData.subtitles)) {
      console.log('字幕数组内容:', JSON.stringify(subtitleData.subtitles, null, 2));
      console.log('查找语言:', language);
      console.log('可用的语言列表:', subtitleData.subtitles.map(sub => sub.language));
      
      targetSubtitle = subtitleData.subtitles.find(sub => sub.language === language);
      console.log('找到的目标字幕:', targetSubtitle ? '是' : '否');
      
      if (targetSubtitle) {
        console.log('目标字幕详情:', {
          language: targetSubtitle.language,
          hasSubtitle: !!targetSubtitle.subtitle,
          subtitleLength: targetSubtitle.subtitle ? targetSubtitle.subtitle.length : 0,
          hasUploadFile1: !!targetSubtitle.uploadFile1
        });
      }
      
      // 如果没找到对应语言，使用第一个可用的字幕
      if (!targetSubtitle && subtitleData.subtitles.length > 0) {
        targetSubtitle = subtitleData.subtitles[0];
        console.log('使用第一个可用字幕，语言:', targetSubtitle.language);
      }
    }
    
    // 解析WEBVTT格式字幕
    if (targetSubtitle && targetSubtitle.subtitle) {
      segments = parseWebVTT(targetSubtitle.subtitle);
      console.log('解析字幕segments数量:', segments.length);
    }
    
    // 获取轮播图片
    if (subtitleData.image_url && Array.isArray(subtitleData.image_url)) {
      imageUrls = subtitleData.image_url;
      console.log('轮播图片数量:', imageUrls.length);
    }
    
    // 获取音频URL：优先从字幕数据，其次从文章数据
    let finalAudioUrl = '';
    
    // 首先尝试从字幕数据中获取音频
    if (targetSubtitle && targetSubtitle.uploadFile1 && Array.isArray(targetSubtitle.uploadFile1) && targetSubtitle.uploadFile1.length > 0) {
      finalAudioUrl = targetSubtitle.uploadFile1[0];
      console.log('使用字幕数据中的音频URL:', finalAudioUrl);
    } else {
      // 如果字幕数据中没有音频，使用文章数据中的音频
      finalAudioUrl = articleData.audio_url || '';
      console.log('使用文章数据中的音频URL:', finalAudioUrl);
    }
    
    // 计算总时长
    let duration = 0;
    if (segments.length > 0) {
      duration = segments[segments.length - 1].end_time;
    }
    
    // 智能提取标题：优先使用文章标题，如果没有则从字幕内容中提取
    let finalTitle = articleData.title || '练习内容';
    if ((!articleData.title || articleData.title === '练习内容') && segments.length > 0) {
      // 从第一个字幕片段中提取标题（取前30个字符）
      const firstSegmentText = segments[0].text.trim();
      if (firstSegmentText.length > 0) {
        finalTitle = firstSegmentText.length > 30 ? firstSegmentText.substring(0, 30) + '...' : firstSegmentText;
      }
    }
    
    // 智能选择封面图片：优先使用文章封面，如果没有则使用第一张轮播图片
    let finalCoverImage = articleData.cover_url || '';
    if (!finalCoverImage && imageUrls.length > 0) {
      finalCoverImage = imageUrls[0];
    }
    
    // 合并数据（以文章数据为主，字幕数据为补充）
    const result = {
      glid: articleData._id || subtitleData.glid, // 确保glid始终有值，即使articleData.glid为undefined也使用传入的glid参数
      title: finalTitle,
      coverImage: finalCoverImage,
      audioUrl: finalAudioUrl,
      segments: segments,
      duration: duration,
      type: articleData.type,
      language: targetSubtitle ? targetSubtitle.language : articleData.language,
      difficulty: articleData.level, // 文章集合中使用 level 字段
      date: articleData.date,
      currentSubtitle: '', // 当前显示的字幕
      currentSubtitleImage: finalCoverImage,
      imageUrls: imageUrls, // 轮播图片数组
      currentImageIndex: 0, // 当前轮播图片索引
      // 字幕特有信息
      subtitleLanguage: targetSubtitle ? targetSubtitle.language : articleData.language
    };
    
    return {
      code: 0,
      data: result
    };
    
  } catch (error) {
    console.error('获取字幕数据失败:', error);
    return {
      code: 1,
      msg: '获取字幕数据失败: ' + error.message
    };
  }
}

/**
 * 根据 glid 获取字幕内容详情
 */
async function getSubtitleContent(data) {
  try {
    const { glid, language = 'zh-CN' } = data;
    
    if (!glid) {
      return {
        code: 1,
        msg: '缺少必要参数：glid'
      };
    }
    
    console.log('获取字幕内容详情，glid:', glid, 'language:', language);
    
    // 首先查询字幕数据获取glid
    console.log('开始查询字幕数据，glid:', glid, 'glid类型:', typeof glid);
    
    // 首先尝试原始glid查询字幕
    let subtitleResult = await subtitlesCollection
      .where({
        glid: glid
      })
      .limit(1)
      .get();
    
    // 如果没找到且glid是字符串，尝试转换为数字
    if ((!subtitleResult.data || subtitleResult.data.length === 0) && typeof glid === 'string' && !isNaN(glid)) {
      console.log('尝试将glid转换为数字查询:', parseInt(glid));
      subtitleResult = await subtitlesCollection
        .where({
          glid: parseInt(glid)
        })
        .limit(1)
        .get();
    }
    
    // 如果还没找到且glid是数字，尝试转换为字符串
    if ((!subtitleResult.data || subtitleResult.data.length === 0) && typeof glid === 'number') {
      console.log('尝试将glid转换为字符串查询:', glid.toString());
      subtitleResult = await subtitlesCollection
        .where({
          glid: glid.toString()
        })
        .limit(1)
        .get();
    }
    
    console.log('字幕查询结果:', {
      success: subtitleResult.success,
      dataLength: subtitleResult.data ? subtitleResult.data.length : 0
    });
    
    // 详细调试信息：显示查询到的字幕集合原始数据
    if (subtitleResult.data && subtitleResult.data.length > 0) {
      console.log('=== 字幕集合原始数据调试信息 ===');
      console.log('查询到的字幕数据数量:', subtitleResult.data.length);
      subtitleResult.data.forEach((item, index) => {
        console.log(`字幕数据[${index}]:`, {
          _id: item._id,
          glid: item.glid,
          glidType: typeof item.glid,
          type: item.type,
          language: item.language,
          date: item.date,
          difficulty: item.difficulty,
          subtitlesArrayLength: item.subtitles ? item.subtitles.length : 0,
          imageUrlsLength: item.image_url ? item.image_url.length : 0,
          hasSubtitles: !!item.subtitles,
          hasImageUrls: !!item.image_url
        });
        if (item.subtitles && Array.isArray(item.subtitles)) {
          console.log(`字幕数据[${index}]的subtitles数组:`, item.subtitles.map(sub => ({
            language: sub.language,
            hasSubtitle: !!sub.subtitle,
            hasUploadFile1: !!sub.uploadFile1,
            uploadFile1Length: sub.uploadFile1 ? sub.uploadFile1.length : 0
          })));
        }
      });
      console.log('=== 字幕集合原始数据调试信息结束 ===');
    }
    
    if (!subtitleResult.data || subtitleResult.data.length === 0) {
      return {
        code: 1,
        msg: '未找到字幕数据'
      };
    }
    
    const subtitleData = subtitleResult.data[0];
    console.log('选择的字幕数据完整结构:', JSON.stringify(subtitleData, null, 2));
    
    // 使用字幕数据的glid作为文章集合的_id查询文章数据
    const articlesCollection = db.collection('jiuyu_articles');
    const articleResult = await articlesCollection.doc(subtitleData.glid).get();
    
    let articleData = null;
    if (articleResult.data) {
      articleData = articleResult.data;
    } else {
      console.log('未找到文章数据，将尝试仅使用字幕数据');
      // 创建默认的文章数据结构
      articleData = {
        _id: glid,
        title: '练习内容',
        cover_url: '',
        audio_url: '',
        type: 'subtitle',
        language: language,
        level: 'medium'
      };
    }
    
    // 处理字幕数据
    let segments = [];
    let imageUrls = [];
    let targetSubtitle = null;
    
    // 从subtitles数组中找到对应语言的字幕
    if (subtitleData.subtitles && Array.isArray(subtitleData.subtitles)) {
      console.log('字幕数组内容:', JSON.stringify(subtitleData.subtitles, null, 2));
      console.log('查找语言:', language);
      
      targetSubtitle = subtitleData.subtitles.find(sub => sub.language === language);
      console.log('找到的目标字幕:', targetSubtitle ? '是' : '否');
      
      // 如果没找到对应语言，使用第一个可用的字幕
      if (!targetSubtitle && subtitleData.subtitles.length > 0) {
        targetSubtitle = subtitleData.subtitles[0];
        console.log('使用第一个可用字幕，语言:', targetSubtitle.language);
      }
    }
    
    // 解析WEBVTT格式字幕
    if (targetSubtitle && targetSubtitle.subtitle) {
      segments = parseWebVTT(targetSubtitle.subtitle);
      console.log('解析字幕segments数量:', segments.length);
    }
    
    // 获取轮播图片
    if (subtitleData.image_url && Array.isArray(subtitleData.image_url)) {
      imageUrls = subtitleData.image_url;
      console.log('轮播图片数量:', imageUrls.length);
    }
    
    // 获取音频URL：优先从字幕数据，其次从文章数据
    let finalAudioUrl = '';
    
    // 首先尝试从字幕数据中获取音频
    if (targetSubtitle && targetSubtitle.uploadFile1 && Array.isArray(targetSubtitle.uploadFile1) && targetSubtitle.uploadFile1.length > 0) {
      finalAudioUrl = targetSubtitle.uploadFile1[0];
      console.log('使用字幕数据中的音频URL:', finalAudioUrl);
    } else {
      // 如果字幕数据中没有音频，使用文章数据中的音频
      finalAudioUrl = articleData.audio_url || '';
      console.log('使用文章数据中的音频URL:', finalAudioUrl);
    }
    
    // 计算总时长
    let duration = 0;
    if (segments.length > 0) {
      duration = segments[segments.length - 1].end_time;
    }
    
    // 智能提取标题：优先使用文章标题，如果没有则从字幕内容中提取
    let finalTitle = articleData.title || '练习内容';
    if ((!articleData.title || articleData.title === '练习内容') && segments.length > 0) {
      // 从第一个字幕片段中提取标题（取前30个字符）
      const firstSegmentText = segments[0].text.trim();
      if (firstSegmentText.length > 0) {
        finalTitle = firstSegmentText.length > 30 ? firstSegmentText.substring(0, 30) + '...' : firstSegmentText;
      }
    }
    
    // 智能选择封面图片：优先使用文章封面，如果没有则使用第一张轮播图片
    let finalCoverImage = articleData.cover_url || '';
    if (!finalCoverImage && imageUrls.length > 0) {
      finalCoverImage = imageUrls[0];
    }
    
    // 合并返回数据（以字幕数据为主，文章数据为补充）
    const result = {
      glid: articleData._id || glid, // 确保glid始终有值，即使articleData.glid为undefined也使用传入的glid参数
      title: finalTitle,
      coverImage: finalCoverImage,
      audioUrl: finalAudioUrl,
      segments: segments,
      duration: duration,
      type: articleData.type,
      language: targetSubtitle ? targetSubtitle.language : articleData.language,
      difficulty: articleData.level,
      currentSubtitle: '',
      currentSubtitleImage: finalCoverImage,
      imageUrls: imageUrls, // 轮播图片数组
      currentImageIndex: 0, // 当前轮播图片索引
      // 字幕特有信息
      subtitleLanguage: targetSubtitle ? targetSubtitle.language : articleData.language
    };
    
    return {
      code: 0,
      data: result
    };
    
  } catch (error) {
    console.error('获取字幕内容详情失败:', error);
    return {
      code: 1,
      msg: '获取字幕内容详情失败: ' + error.message
    };
  }
}

/**
 * 根据 glid 和语言获取字幕数据（支持多语言）
 */
async function getSubtitlesByGlid(data) {
  try {
    const { glid, language = 'zh-CN', type } = data;
    
    if (!glid) {
      return {
        code: 1,
        msg: '缺少必要参数：glid'
      };
    }
    
    console.log('根据glid获取字幕数据:', { glid, language, type });
    
    // 首先查询字幕数据获取glid
    console.log('开始查询字幕数据，glid:', glid, 'glid类型:', typeof glid);
    
    // 首先尝试原始glid查询字幕
    let subtitleResult = await subtitlesCollection
      .where({
        glid: glid
      })
      .limit(1)
      .get();
    
    // 如果没找到且glid是字符串，尝试转换为数字
    if ((!subtitleResult.data || subtitleResult.data.length === 0) && typeof glid === 'string' && !isNaN(glid)) {
      console.log('尝试将glid转换为数字查询:', parseInt(glid));
      subtitleResult = await subtitlesCollection
        .where({
          glid: parseInt(glid)
        })
        .limit(1)
        .get();
    }
    
    // 如果还没找到且glid是数字，尝试转换为字符串
    if ((!subtitleResult.data || subtitleResult.data.length === 0) && typeof glid === 'number') {
      console.log('尝试将glid转换为字符串查询:', glid.toString());
      subtitleResult = await subtitlesCollection
        .where({
          glid: glid.toString()
        })
        .limit(1)
        .get();
    }
    
    console.log('字幕查询结果:', {
      success: subtitleResult.success,
      dataLength: subtitleResult.data ? subtitleResult.data.length : 0
    });
    
    if (!subtitleResult.data || subtitleResult.data.length === 0) {
      return {
        code: 1,
        msg: '未找到字幕数据'
      };
    }
    
    const subtitleData = subtitleResult.data[0];
    console.log('找到字幕数据:', subtitleData);
    
    // 查找匹配语言的字幕
    let targetSubtitle = null;
    if (subtitleData.subtitles && Array.isArray(subtitleData.subtitles)) {
      console.log('=== getSubtitlesByGlid 字幕查找调试 ===');
      console.log('查找语言:', language);
      console.log('可用的语言列表:', subtitleData.subtitles.map(sub => sub.language));
      console.log('字幕数组详情:', subtitleData.subtitles.map(sub => ({
        language: sub.language,
        hasSubtitle: !!sub.subtitle,
        subtitleLength: sub.subtitle ? sub.subtitle.length : 0
      })));
      
      targetSubtitle = subtitleData.subtitles.find(sub => sub.language === language);
      console.log('找到目标字幕:', targetSubtitle ? '是' : '否');
      console.log('=== getSubtitlesByGlid 字幕查找调试结束 ===');
    }
    
    if (!targetSubtitle) {
      console.log(`未找到${language}语言的字幕，返回错误`);
      return {
        code: 1,
        msg: `未找到${language}语言的字幕`
      };
    }
    
    console.log('找到目标字幕:', targetSubtitle);
    
    if (!targetSubtitle.subtitle) {
      return {
        code: 1,
        msg: '字幕内容为空'
      };
    }
    
    // 解析WebVTT格式字幕
    const parsedSubtitles = parseWebVTT(targetSubtitle.subtitle);
    
    return {
      code: 0,
      msg: '获取字幕成功',
      data: {
        segments: parsedSubtitles, // 前端期望的是segments字段
        subtitles: parsedSubtitles, // 保留原字段以兼容
        audioUrl: targetSubtitle.uploadFile1 && Array.isArray(targetSubtitle.uploadFile1) ? targetSubtitle.uploadFile1[0] : targetSubtitle.uploadFile1,
        duration: parsedSubtitles.length > 0 ? parsedSubtitles[parsedSubtitles.length - 1].end_time : 0,
        imageUrls: subtitleData.image_url || [], // 轮播图片数组
        currentImageIndex: 0, // 当前轮播图片索引
        glid: subtitleData.glid,
        type: subtitleData.type,
        language: language,
        date: subtitleData.date
      }
    };
    
  } catch (error) {
    console.error('根据glid获取字幕数据失败:', error);
    return {
      code: 1,
      msg: '根据glid获取字幕数据失败: ' + error.message
    };
  }
}

/**
 * 获取花朵数据
 */
async function getFlowers(data) {
  try {
    const { limit = 50 } = data;
    
    console.log('获取花朵数据，参数:', { limit });
    
    // 查询所有花朵数据
    const flowersResult = await flowersCollection
      .limit(limit)
      .get();
    
    console.log('花朵查询结果:', {
      success: flowersResult.success,
      dataLength: flowersResult.data ? flowersResult.data.length : 0
    });
    
    if (!flowersResult.data) {
      return {
        code: 1,
        msg: '获取花朵数据失败'
      };
    }
    
    // 格式化花朵数据，确保包含必要字段
    const flowers = flowersResult.data.map(flower => ({
      _id: flower._id,
      icon: flower.icon || '🌸', // 默认花朵图标
      name: flower.name || '未知花朵', // 默认花朵名称
      meaning: flower.meaning || '暂无花语' // 默认花语
    }));
    
    return {
      code: 0,
      msg: '获取花朵数据成功',
      data: flowers
    };
    
  } catch (error) {
    console.error('获取花朵数据失败:', error);
    return {
      code: 1,
      msg: '获取花朵数据失败: ' + error.message
    };
  }
}