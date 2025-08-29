// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const audioContent = db.collection('jiuyu_audio_content')
const articles = db.collection('jiuyu_articles')
const _ = db.command

// 处理云存储URL转换为临时访问URL
async function getTemporaryFileUrl(fileUrl) {
  if (!fileUrl) {
    return null;
  }
  
  try {
    if (fileUrl.startsWith('cloud://')) {
      const result = await cloud.getTempFileURL({
        fileList: [fileUrl]
      });
      
      if (result.fileList && result.fileList.length > 0 && result.fileList[0].tempFileURL) {
        console.log('云存储URL转换成功:', fileUrl, '->', result.fileList[0].tempFileURL);
        return result.fileList[0].tempFileURL;
      } else {
        console.error('云存储URL转换失败:', result);
        return fileUrl; // 返回原URL
      }
    }
    
    // 如果是HTTP URL，直接返回
    if (fileUrl.startsWith('http')) {
      return fileUrl;
    }
    
    // 其他格式，返回原URL
    return fileUrl;
  } catch (error) {
    console.error('处理云存储URL时出错:', error);
    return fileUrl; // 返回原URL
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
  const userOpenid = FROM_OPENID || OPENID
  const { type } = event

  switch (type) {
    case 'getAudioList':
      return getAudioList(event)
    case 'getAudioDetail':
      return getAudioDetail(event)
    case 'getExercises':
      return getExercises(event)
    case 'getTranslation':
      return getTranslation(event)
    case 'saveMistake':
      return saveMistake(event, userOpenid)
    case 'getMistakes':
      return getMistakes(userOpenid, event)
    case 'updateMistake':
      return updateMistake(event, userOpenid)
    case 'deleteMistake':
      return deleteMistake(event, userOpenid)
    case 'getArticleByGlid':
      return getArticleByGlid(event)
    case 'getAudioByGlid':
      return getAudioByGlid(event)
    case 'getLatestArticle':
      return getLatestArticle(event)
    case 'fixGlidType':
      return fixGlidType(event)
    case 'getArticlesByDifficulty':
      return getArticlesByDifficulty(event)
    default:
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 获取音频列表
async function getAudioList(event) {
  try {
    const { audioType, level, date, page = 1, pageSize = 10 } = event
    
    console.log('查询参数:', { audioType, level, date, page, pageSize });
    
    // 如果没有传入日期参数，默认使用当前日期
    const queryDate = date || new Date().toISOString().split('T')[0];
    console.log('使用日期:', queryDate);
    
    // 先从 jiuyu_articles 集合筛选当前日期的文章
    // 扩展查询范围，包含前一天16:00到当天16:00（考虑时区差异）
    const queryDateObj = new Date(queryDate);
    const startOfDay = new Date(queryDateObj.getTime() - 8 * 60 * 60 * 1000); // 前一天16:00 UTC
    const endOfDay = new Date(queryDateObj.getTime() + 16 * 60 * 60 * 1000); // 当天16:00 UTC
    
    // 转换为时间戳，因为数据库中 create_time 存储的是时间戳格式
    const startTimestamp = startOfDay.getTime();
    const endTimestamp = endOfDay.getTime();
    
    console.log('文章日期筛选范围:', {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString(),
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp
    });
    
    // 查询当前日期的文章，使用 create_time 字段（时间戳格式）
    const articleQuery = {
      create_time: _.and([
        _.gte(startTimestamp),
        _.lte(endTimestamp)
      ])
    };
    
    // 如果有level参数，添加到文章查询条件中
    if (level) {
      articleQuery.level = level;
      console.log('按文章难度级别筛选:', level);
    }
    
    const articlesResult = await articles.where(articleQuery).get();
    console.log('当前日期的文章数量:', articlesResult.data.length);
    
    if (articlesResult.data.length === 0) {
      return {
        code: 0,
        msg: '当前日期没有文章',
        data: {
          list: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
          query: articleQuery
        }
      }
    }
    
    // 提取文章的 _id 列表
    const articleIds = articlesResult.data.map(article => article._id);
    console.log('文章ID列表:', articleIds);
    
    // 构建音频查询条件
    const audioQuery = {
      glid: _.in(articleIds) // 只查询关联到当前日期文章的音频
    }
    
    if (audioType) {
      audioQuery.type = audioType;
      console.log('按音频类型筛选:', audioType);
    }
    
    // 移除了difficulty筛选，改为在文章集合中使用level筛选
    
    console.log('最终音频查询条件:', audioQuery);
    
    // 计算跳过的记录数
    const skip = (page - 1) * pageSize
    
    // 查询音频数据
    const countResult = await audioContent.where(audioQuery).count()
    const total = countResult.total
    
    console.log('符合条件的音频总记录数:', total);
    
    // 查询分页数据
    const result = await audioContent.where(audioQuery)
      .orderBy('publish_date', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    console.log('查询结果数量:', result.data.length);
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        list: result.data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        query: audioQuery, // 返回查询条件，方便调试
        articleQuery: articleQuery, // 返回文章查询条件
        articleCount: articlesResult.data.length // 返回文章数量
      }
    }
  } catch (error) {
    console.error('获取音频列表失败:', error)
    return {
      code: -1,
      msg: '获取音频列表失败',
      error: error.message
    }
  }
}

// 获取音频详情
async function getAudioDetail(event) {
  try {
    const { audioId, languageCode } = event
    
    console.log('getAudioDetail函数被调用，参数:', event);
    
    if (!audioId) {
      return {
        code: -1,
        msg: '缺少音频ID'
      }
    }
    
    // 获取当前语言代码
    const currentLang = languageCode || 'zh-CN';
    console.log('使用语言代码:', currentLang);
    
    // 查询音频详情
    const result = await audioContent.doc(audioId).get()
    
    if (!result.data) {
      return {
        code: -1,
        msg: '音频不存在'
      }
    }
    
    const audioData = result.data;
    
    // 确保audio_url字段存在，但初始化为空
    if (!audioData.audio_url) {
      audioData.audio_url = '';
    }
    
    // 处理exercises数据
    if (audioData.exercises && Array.isArray(audioData.exercises)) {
      console.log('处理exercises数据');
      
      // 如果有exercises，使用第一个习题的audio作为主音频URL
      if (audioData.exercises.length > 0 && audioData.exercises[0].audio) {
        audioData.audio_url = audioData.exercises[0].audio;
        console.log('使用第一个习题的audio作为主音频URL:', audioData.audio_url);
      }
    }
    
    // 如果有glid字段，尝试获取关联的文章数据
    if (audioData.glid) {
      try {
        const articleResult = await articles.doc(audioData.glid).get();
        if (articleResult.data) {
          // 合并文章数据
          audioData.article_data = articleResult.data;
          
          // 从文章获取标题
          if (articleResult.data.titles && articleResult.data.titles.length > 0) {
            const langTitle = articleResult.data.titles.find(t => t.language === currentLang);
            if (langTitle) {
              audioData.title = langTitle.title;
            } else if (articleResult.data.title) {
              audioData.title = articleResult.data.title;
            }
          }
          
          // 从文章获取封面
          if (articleResult.data.cover_url) {
            audioData.cover_url = await getTemporaryFileUrl(articleResult.data.cover_url);
          }
          
          // 不再从文章获取音频URL
          
          // 从文章获取文本内容
          if (articleResult.data.contents && articleResult.data.contents.length > 0) {
            const langContent = articleResult.data.contents.find(c => c.language === currentLang);
            if (langContent && langContent.content) {
              // 移除HTML标签
              audioData.transcript = langContent.content.replace(/<[^>]+>/g, '');
            } else {
              // 如果没有当前语言内容，尝试获取中文内容
            const zhContent = articleResult.data.contents.find(c => c.language === 'zh-CN');
            if (zhContent && zhContent.content) {
              // 移除HTML标签
              audioData.transcript = zhContent.content.replace(/<[^>]+>/g, '');
              }
            }
          }
        }
      } catch (articleError) {
        console.error('获取关联文章失败:', articleError);
        // 继续使用音频数据，不影响主流程
      }
    }
    
    // 处理封面URL（如果音频数据本身有cover_url但没有从文章获取到）
    if (audioData.cover_url && audioData.cover_url.startsWith('cloud://')) {
      audioData.cover_url = await getTemporaryFileUrl(audioData.cover_url);
    }
    
    return {
      code: 0,
      msg: '获取成功',
      data: audioData
    }
  } catch (error) {
    console.error('获取音频详情失败:', error)
    return {
      code: -1,
      msg: '获取音频详情失败',
      error: error.message
    }
  }
}

// 通过glid获取文章数据
async function getArticleByGlid(event) {
  try {
    const { glid } = event
    
    console.log('getArticleByGlid函数被调用，参数:', event);
    
    if (!glid) {
      console.log('缺少glid参数');
      return {
        code: -1,
        msg: '缺少文章ID(glid)'
      }
    }
    
    console.log('开始查询文章，glid:', glid);
    
    // 查询文章详情
    const result = await articles.doc(glid).get()
    
    console.log('查询结果:', result);
    
    if (!result.data) {
      console.log('未找到文章数据，glid:', glid);
      return {
        code: -1,
        msg: '文章不存在'
      }
    }
    
    // 详细记录文章数据结构
    const articleData = result.data;
    console.log('成功获取文章数据:', articleData);
    console.log('文章字段列表:', Object.keys(articleData));
    console.log('cover_url字段:', articleData.cover_url);
    console.log('image字段:', articleData.image);
    
    // 检查contents中是否有封面
    if (articleData.contents && articleData.contents.length > 0) {
      console.log('contents字段长度:', articleData.contents.length);
      const zhContent = articleData.contents.find(c => c.language === 'zh-CN');
      if (zhContent) {
        console.log('中文内容字段列表:', Object.keys(zhContent));
        console.log('中文内容cover字段:', zhContent.cover);
      }
    }
    
    // 处理封面URL
    if (articleData.cover_url) {
      articleData.cover_url = await getTemporaryFileUrl(articleData.cover_url);
    }
    
    return {
      code: 0,
      msg: '获取成功',
      data: articleData
    }
  } catch (error) {
    console.error('通过glid获取文章失败, glid:', event.glid, '错误:', error)
    return {
      code: -1,
      msg: '获取文章失败',
      error: error.message
    }
  }
}

// 通过glid获取关联音频
async function getAudioByGlid(event) {
  try {
    const { glid, languageCode } = event
    
    console.log('getAudioByGlid函数被调用，参数:', event);
    
    if (!glid) {
      console.log('缺少glid参数');
      return {
        code: -1,
        msg: '缺少文章ID(glid)'
      }
    }
    
    console.log('开始查询关联音频，glid:', glid);
    
    // 当前语言代码，如果没有提供则默认中文
    const currentLang = languageCode || 'zh-CN';
    console.log('使用语言代码:', currentLang);
    
    // 先获取文章数据
    let articleData = null;
    try {
      const articleResult = await articles.doc(glid).get();
      if (articleResult.data) {
        articleData = articleResult.data;
        console.log('成功获取文章数据:', articleData);
      }
    } catch (articleError) {
      console.error('获取文章数据失败:', articleError);
    }
    
    // 查询音频内容
    const result = await audioContent.where({
      glid: glid
    }).get()
    
    console.log('查询音频结果:', result);
    
    // 如果找到了音频数据
    if (result.data && result.data.length > 0) {
      console.log('成功获取关联音频数据:', result.data);
      
      const audioData = result.data[0];
      
      // 处理exercises数据
      if (audioData.exercises && Array.isArray(audioData.exercises)) {
        console.log('处理exercises数据');
        
        // 如果有exercises，使用第一个习题的audio作为主音频URL
        if (audioData.exercises.length > 0 && audioData.exercises[0].audio) {
          audioData.audio_url = audioData.exercises[0].audio;
          console.log('使用第一个习题的audio作为主音频URL:', audioData.audio_url);
        }
      }
      
      // 如果同时有文章数据，合并返回
      if (articleData) {
        // 从文章获取标题
        if (articleData.titles && articleData.titles.length > 0) {
          const langTitle = articleData.titles.find(t => t.language === currentLang);
          if (langTitle) {
            audioData.title = langTitle.title;
          } else if (articleData.title) {
            audioData.title = articleData.title;
          }
        }
        
        // 从文章获取封面
        if (articleData.cover_url) {
          audioData.cover_url = articleData.cover_url;
        }
        
        // 不再从文章获取音频URL
        
        // 从文章获取文本内容
        if (articleData.contents && articleData.contents.length > 0) {
          const zhContent = articleData.contents.find(c => c.language === 'zh-CN');
          if (zhContent && zhContent.content) {
            // 移除HTML标签
            audioData.transcript = zhContent.content.replace(/<[^>]+>/g, '');
          }
        }
        
        // 添加文章数据引用
        audioData.article_data = articleData;
      }
      
      return {
        code: 0,
        msg: '获取成功',
        data: audioData
      }
    } 
    // 如果没有找到音频数据，但有文章数据
    else if (articleData) {
      console.log('未找到关联音频数据，但找到了文章数据');
      
      // 创建一个新的音频数据对象
      const audioData = {
        glid: glid,
        exercises: [],
        title: '',
        cover_url: '',
        audio_url: '',
        transcript: '',
        article_data: articleData
      };
      
      // 从文章获取标题
      if (articleData.titles && articleData.titles.length > 0) {
        const langTitle = articleData.titles.find(t => t.language === currentLang);
        if (langTitle) {
          audioData.title = langTitle.title;
        } else if (articleData.title) {
          audioData.title = articleData.title;
        }
      }
      
      // 从文章获取封面
      if (articleData.cover_url) {
        audioData.cover_url = articleData.cover_url;
      }
      
      // 不再从文章获取音频URL
      
      // 从文章获取文本内容
      if (articleData.contents && articleData.contents.length > 0) {
        const zhContent = articleData.contents.find(c => c.language === 'zh-CN');
        if (zhContent && zhContent.content) {
          // 移除HTML标签
          audioData.transcript = zhContent.content.replace(/<[^>]+>/g, '');
        }
      }
      
      return {
        code: 0,
        msg: '仅获取到文章数据',
        data: audioData
      }
    }
    // 如果既没有找到音频数据，也没有文章数据
    else {
      console.log('未找到关联音频数据和文章数据，glid:', glid);
      return {
        code: -1,
        msg: '未找到关联音频和文章数据'
      }
    }
  } catch (error) {
    console.error('通过glid获取关联音频失败, glid:', event.glid, '错误:', error)
    return {
      code: -1,
      msg: '获取关联音频失败',
      error: error.message
    }
  }
}

// 获取练习题
async function getExercises(event) {
  try {
    const { audioId, difficulty, languageCode } = event
    
    console.log('getExercises函数被调用，参数:', event);
    
    if (!audioId) {
      return {
        code: -1,
        msg: '缺少音频ID'
      }
    }
    
    // 获取当前语言代码
    const currentLang = languageCode || 'zh-CN';
    console.log('使用语言代码:', currentLang);
    
    // 查询音频详情
    const result = await audioContent.doc(audioId).get()
    
    if (!result.data) {
      return {
        code: -1,
        msg: '音频不存在'
      }
    }
    
    const audioData = result.data;
    let audioTitle = audioData.title || '听力练习';
    let audioUrl = '';  // 初始化为空字符串，只从习题获取
    let transcript = audioData.transcript || '';
    
    // 如果有glid字段，尝试获取关联的文章数据
    if (audioData.glid) {
      try {
        const articleResult = await articles.doc(audioData.glid).get();
        if (articleResult.data) {
          const articleData = articleResult.data;
          
          // 从文章获取标题
          if (articleData.titles && articleData.titles.length > 0) {
            const langTitle = articleData.titles.find(t => t.language === currentLang);
            if (langTitle) {
              audioTitle = langTitle.title;
            } else if (articleData.title) {
              audioTitle = articleData.title;
            }
          }
          
          // 不再从文章获取音频URL
          
          // 从文章获取文本内容
          if (articleData.contents && articleData.contents.length > 0) {
            const langContent = articleData.contents.find(c => c.language === currentLang);
            if (langContent && langContent.content) {
              // 移除HTML标签
              transcript = langContent.content.replace(/<[^>]+>/g, '');
            } else {
              // 如果没有找到当前语言的内容，尝试找中文
            const zhContent = articleData.contents.find(c => c.language === 'zh-CN');
            if (zhContent && zhContent.content) {
              transcript = zhContent.content.replace(/<[^>]+>/g, '');
              }
            }
          }
        }
      } catch (articleError) {
        console.error('获取关联文章失败:', articleError);
        // 继续使用音频数据，不影响主流程
      }
    }
    
    // 获取练习题
    let exercises = audioData.exercises || []
    
    // 如果有exercises，使用第一个习题的audio作为主音频URL
    if (exercises.length > 0 && exercises[0].audio) {
      audioUrl = exercises[0].audio;
      console.log('使用第一个习题的audio作为主音频URL:', audioUrl);
    }
    
    // 如果指定了难度，筛选对应难度的题目
    if (difficulty && exercises.length > 0) {
      exercises = exercises.filter(exercise => {
        if (difficulty === 'sprout' && exercise.type === 'single') return true
        if (difficulty === 'forest' && exercise.type === 'multiple') return true
        return false
      })
    }
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        audioTitle,
        audioUrl,
        transcript,
        exercises
      }
    }
  } catch (error) {
    console.error('获取练习题失败:', error)
    return {
      code: -1,
      msg: '获取练习题失败',
      error: error.message
    }
  }
}

// 获取音频翻译
async function getTranslation(event) {
  try {
    const { audioId, language } = event
    
    if (!audioId) {
      return {
        code: -1,
        msg: '缺少音频ID'
      }
    }
    
    if (!language) {
      return {
        code: -1,
        msg: '缺少语言代码'
      }
    }
    
    // 查询音频详情
    const result = await audioContent.doc(audioId).get()
    
    if (!result.data) {
      return {
        code: -1,
        msg: '音频不存在'
      }
    }
    
    const audioData = result.data;
    let translation = null;
    
    // 先从音频内容中查找翻译
    if (audioData.translations) {
      translation = audioData.translations.find(t => t.language === language);
    }
    
    // 如果没有找到翻译，且有glid字段，尝试从文章获取
    if (!translation && audioData.glid) {
      try {
        const articleResult = await articles.doc(audioData.glid).get();
        if (articleResult.data && articleResult.data.contents) {
          const langContent = articleResult.data.contents.find(c => c.language === language);
          if (langContent) {
            // 构建翻译对象
            translation = {
              language: language,
              title: langContent.title || '',
              transcript: langContent.content ? langContent.content.replace(/<[^>]+>/g, '') : '',
              audio_url: articleResult.data.audio && 
                        articleResult.data.audio.translations && 
                        articleResult.data.audio.translations[language] ? 
                        articleResult.data.audio.translations[language] : ''
            };
          }
        }
      } catch (articleError) {
        console.error('获取文章翻译失败:', articleError);
      }
    }
    
    if (!translation) {
      return {
        code: -1,
        msg: '该语言的翻译不存在'
      }
    }
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        translation
      }
    }
  } catch (error) {
    console.error('获取翻译失败:', error)
    return {
      code: -1,
      msg: '获取翻译失败',
      error: error.message
    }
  }
} 

// 保存错题
async function saveMistake(event, openid) {
  try {
    const { audioId, exercise, userAnswer } = event
    
    if (!audioId || !exercise) {
      return {
        code: -1,
        msg: '参数不完整'
      }
    }
    
    // 创建错题集合的引用
    const mistakes = db.collection('jiuyu_listening_mistakes')
    
    // 检查是否已经收藏过该题
    const existingMistake = await mistakes.where({
      openid,
      audio_id: audioId,
      'exercise.question': exercise.question
    }).get()
    
    if (existingMistake.data.length > 0) {
      // 已经收藏过，更新收藏时间和用户答案
      await mistakes.doc(existingMistake.data[0]._id).update({
        data: {
          user_answer: userAnswer,
          created_at: Date.now(),
          is_reviewed: false
        }
      })
      
      return {
        code: 0,
        msg: '错题更新成功',
        data: {
          mistakeId: existingMistake.data[0]._id
        }
      }
    }
    
    // 没有收藏过，创建新记录
    const result = await mistakes.add({
      data: {
        openid,
        audio_id: audioId,
        exercise,
        user_answer: userAnswer,
        created_at: Date.now(),
        is_reviewed: false
      }
    })
    
    return {
      code: 0,
      msg: '错题收藏成功',
      data: {
        mistakeId: result._id
      }
    }
  } catch (error) {
    console.error('保存错题失败:', error)
    return {
      code: -1,
      msg: '保存错题失败',
      error: error.message
    }
  }
}

// 获取错题列表
async function getMistakes(openid, event) {
  try {
    const { page = 1, pageSize = 10 } = event
    
    // 创建错题集合的引用
    const mistakes = db.collection('jiuyu_listening_mistakes')
    
    // 计算跳过的记录数
    const skip = (page - 1) * pageSize
    
    // 查询总数
    const countResult = await mistakes.where({ openid }).count()
    const total = countResult.total
    
    // 查询分页数据
    const result = await mistakes.where({ openid })
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        list: result.data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  } catch (error) {
    console.error('获取错题列表失败:', error)
    return {
      code: -1,
      msg: '获取错题列表失败',
      error: error.message
    }
  }
}

// 更新错题状态
async function updateMistake(event, openid) {
  try {
    const { mistakeId, isReviewed } = event
    
    if (!mistakeId) {
      return {
        code: -1,
        msg: '参数不完整'
      }
    }
    
    // 创建错题集合的引用
    const mistakes = db.collection('jiuyu_listening_mistakes')
    
    // 检查记录是否存在且属于该用户
    const mistakeResult = await mistakes.doc(mistakeId).get()
    
    if (!mistakeResult.data || mistakeResult.data.openid !== openid) {
      return {
        code: -1,
        msg: '错题不存在或无权限'
      }
    }
    
    // 更新状态
    await mistakes.doc(mistakeId).update({
      data: {
        is_reviewed: isReviewed === undefined ? true : !!isReviewed
      }
    })
    
    return {
      code: 0,
      msg: '更新成功'
    }
  } catch (error) {
    console.error('更新错题状态失败:', error)
    return {
      code: -1,
      msg: '更新错题状态失败',
      error: error.message
    }
  }
} 

// 删除错题
async function deleteMistake(event, openid) {
  try {
    const { mistakeId } = event;
    
    if (!mistakeId) {
      return {
        code: -1,
        msg: '参数不完整'
      };
    }
    
    // 创建错题集合的引用
    const mistakes = db.collection('jiuyu_listening_mistakes')
    
    // 检查记录是否存在且属于该用户
    const mistakeResult = await mistakes.doc(mistakeId).get();
    
    if (!mistakeResult.data || mistakeResult.data.openid !== openid) {
      return {
        code: -1,
        msg: '错题不存在或无权限'
      };
    }
    
    // 删除记录
    await mistakes.doc(mistakeId).remove();
    
    return {
      code: 0,
      msg: '删除成功'
    };
  } catch (error) {
    console.error('删除错题失败:', error);
    return {
      code: -1,
      msg: '删除错题失败',
      error: error.message
    };
  }
} 

// 修复glid类型问题
async function fixGlidType(event) {
  try {
    const { records } = event
    
    console.log('修复glid类型，记录数:', records.length);
    
    if (!records || records.length === 0) {
      return {
        code: -1,
        msg: '没有需要修复的记录'
      }
    }
    
    // 批量更新记录
    const updatePromises = records.map(record => {
      console.log('修复记录:', record.id, '的glid为:', record.glid);
      
      return audioContent.doc(record.id).update({
        data: {
          glid: record.glid
        }
      });
    });
    
    // 等待所有更新完成
    const updateResults = await Promise.all(updatePromises);
    
    console.log('修复结果:', updateResults);
    
    return {
      code: 0,
      msg: '修复成功',
      data: {
        updated: updateResults.length
      }
    }
  } catch (error) {
    console.error('修复glid类型失败:', error)
    return {
      code: -1,
      msg: '修复glid类型失败',
      error: error.message
    }
  }
} 

// 获取最新文章
async function getLatestArticle(event) {
  try {
    const { difficulty, languageCode } = event
    
    console.log('getLatestArticle函数被调用，参数:', event);
    console.log('当前语言代码:', languageCode);
    
    // 构建查询条件
    const query = {
      status: true // 只获取状态为true的文章
    }
    if (difficulty) {
      query.level = difficulty
    }
    
    console.log('查询条件:', query);
    
    // 查询最新文章
    const result = await articles
      .where(query)
      .orderBy('create_time', 'desc') // 按创建时间降序排序
      .limit(1) // 只获取一条记录
      .get()
    
    console.log('查询结果:', result);
    console.log('查询到的文章数量:', result.data ? result.data.length : 0);
    
    if (!result.data || result.data.length === 0) {
      console.log('未找到文章数据，可能数据库中没有level为', difficulty, '的文章');
      return {
        code: -1,
        msg: '未找到文章数据'
      }
    }
    
    const articleData = result.data[0];
    console.log('成功获取最新文章:', articleData._id);
    console.log('文章详细信息:', {
      _id: articleData._id,
      title: articleData.title,
      level: articleData.level,
      category: articleData.category,
      create_time: articleData.create_time
    });
    
    // 查询关联的音频内容
    let audioData = null;
    try {
      const audioResult = await audioContent
        .where({
          glid: articleData._id
        })
        .get();
      
      if (audioResult.data && audioResult.data.length > 0) {
        audioData = audioResult.data[0];
        console.log('成功获取关联音频:', audioData._id);
      } else {
        console.log('未找到关联音频数据');
      }
    } catch (audioError) {
      console.error('获取关联音频失败:', audioError);
    }
    
    // 创建返回数据
    const returnData = {
      _id: articleData._id,
      title: '',
      cover_url: articleData.cover_url || '',
      audio_url: '',
      transcript: '',
      exercises: [],
      article_data: articleData // 包含完整的文章数据，包括所有语言的内容
    };
    
    // 根据语言代码获取对应的标题和音频
    const currentLang = languageCode || 'zh-CN';
    console.log('使用语言代码:', currentLang);
    
    // 从文章获取对应语言的标题
    if (articleData.titles && articleData.titles.length > 0) {
      console.log('可用的标题语言:', articleData.titles.map(t => t.language));
      const langTitle = articleData.titles.find(t => t.language === currentLang);
      if (langTitle) {
        returnData.title = langTitle.title;
        console.log('找到对应语言标题:', langTitle.title);
      } else {
        console.log('未找到对应语言标题，使用默认标题');
        if (articleData.title) {
          returnData.title = articleData.title;
        }
      }
    } else if (articleData.title) {
      returnData.title = articleData.title;
      console.log('使用默认标题:', articleData.title);
    }
    
    // 从文章获取对应语言的文本内容
    if (articleData.contents && articleData.contents.length > 0) {
      const langContent = articleData.contents.find(c => c.language === currentLang);
      if (langContent && langContent.content) {
        // 移除HTML标签
        returnData.transcript = langContent.content.replace(/<[^>]+>/g, '');
        console.log('找到对应语言文本内容');
      } else {
        console.log('未找到对应语言文本内容');
      }
    } else {
      console.log('文章没有contents数组');
    }
    
    // 处理exercises数据
    if (audioData && audioData.exercises && Array.isArray(audioData.exercises)) {
      console.log('处理exercises数据');
      
      // 直接使用exercises
      returnData.exercises = audioData.exercises;
      
      // 如果有exercises，使用第一个习题的audio作为主音频URL
      if (audioData.exercises.length > 0 && audioData.exercises[0].audio) {
        returnData.audio_url = audioData.exercises[0].audio;
        console.log('使用第一个习题的audio作为主音频URL:', returnData.audio_url);
      }
    } else if (audioData && audioData.exercises) {
      console.log('使用原始exercises数据');
      returnData.exercises = audioData.exercises;
    }
    
    // 不再从文章获取音频URL
    
    // 处理封面URL
    if (returnData.cover_url) {
      returnData.cover_url = await getTemporaryFileUrl(returnData.cover_url);
    }
    
    console.log('返回数据:', {
      code: 0,
      msg: '获取成功',
      data: {
        _id: returnData._id,
        title: returnData.title,
        has_audio: !!returnData.audio_url,
        has_exercises: returnData.exercises.length > 0
      }
    });
    
    return {
      code: 0,
      msg: '获取成功',
      data: returnData
    }
  } catch (error) {
    console.error('获取最新文章失败:', error)
    return {
      code: -1,
      msg: '获取最新文章失败',
      error: error.message
    }
  }
} 

// 根据难度获取文章
async function getArticlesByDifficulty(event) {
  try {
    const { difficulty, languageCode } = event
    
    console.log('getArticlesByDifficulty函数被调用，参数:', event);
    
    if (!difficulty) {
      return {
        code: -1,
        msg: '缺少难度参数'
      }
    }
    
    // 获取当前语言代码
    const currentLang = languageCode || 'zh-CN';
    console.log('使用语言代码:', currentLang);
    
    // 构建查询条件
    const query = {
      level: difficulty,
      status: true // 只获取状态为true的文章
    }
    
    console.log('查询条件:', query);
    
    // 查询符合条件的文章
    const result = await articles
      .where(query)
      .orderBy('create_time', 'desc') // 按创建时间降序排序
      .limit(5) // 获取最多5条记录
      .get()
    
    console.log('查询结果:', result);
    
    if (!result.data || result.data.length === 0) {
      console.log('未找到指定难度的文章');
      return {
        code: -1,
        msg: `未找到${difficulty}难度的文章`
      }
    }
    
    // 处理查询到的文章数据
    const articlesData = result.data;
    const processedArticles = [];
    
    // 处理每篇文章
    for (const article of articlesData) {
      // 创建基本文章数据
      const articleData = {
        _id: article._id,
        title: '',
        cover_url: article.cover_url || '',
        audio_url: '',  // 初始化为空字符串
        level: article.level,
        exercises: [],
        contents: article.contents || [] // 保留原始contents字段
      };
      
      // 从文章获取对应语言的标题
      if (article.titles && article.titles.length > 0) {
        const langTitle = article.titles.find(t => t.language === currentLang);
        if (langTitle) {
          articleData.title = langTitle.title;
        } else if (article.title) {
          articleData.title = article.title;
        }
      } else if (article.title) {
        articleData.title = article.title;
      }
      
      // 不再从文章获取音频URL
      
      // 查询关联的音频内容获取习题
      try {
        const audioResult = await audioContent
          .where({
            glid: article._id
          })
          .get();
        
        if (audioResult.data && audioResult.data.length > 0) {
          const audioData = audioResult.data[0];
          articleData.audio_id = audioData._id; // 保存关联音频ID
          
          // 处理exercises数据
          if (audioData.exercises && Array.isArray(audioData.exercises)) {
            console.log('处理exercises数据');
            
            // 直接使用exercises
            articleData.exercises = audioData.exercises;
            
            // 如果有exercises，使用第一个习题的audio作为主音频URL
            if (audioData.exercises.length > 0 && audioData.exercises[0].audio) {
              articleData.audio_url = audioData.exercises[0].audio;
              console.log('使用第一个习题的audio作为主音频URL:', articleData.audio_url);
            }
          } else {
          articleData.exercises = audioData.exercises || [];
          }
        }
      } catch (audioError) {
        console.error('获取关联音频失败:', audioError);
      }
      
      // 处理封面URL
      if (articleData.cover_url) {
        articleData.cover_url = await getTemporaryFileUrl(articleData.cover_url);
      }
      
      processedArticles.push(articleData);
    }
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        articles: processedArticles,
        total: processedArticles.length
      }
    }
  } catch (error) {
    console.error('根据难度获取文章失败:', error)
    return {
      code: -1,
      msg: '获取文章失败',
      error: error.message
    }
  }
}