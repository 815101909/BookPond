// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = _.aggregate

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('收到调用请求，参数：', event)
  const { action, data } = event

  // 根据action执行不同操作
  switch (action) {
    case 'getArticles':
      return await getArticles(data)
    case 'getArticleDetail':
      return await getArticleDetail(data)
    default:
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 获取文章详情
async function getArticleDetail({ id }) {
  try {
    console.log('获取文章详情，id:', id)
    
    // 获取文章数据
    const article = await db.collection('jiuyu_articles')
      .doc(id)
      .get()
    
    if (!article.data) {
      return {
        code: -1,
        msg: '文章不存在'
      }
    }

    // 处理文章数据
    const data = article.data
    
    // 处理封面图片
    if (data.cover_url && data.cover_url.startsWith('cloud://')) {
      try {
        const result = await cloud.getTempFileURL({
          fileList: [data.cover_url]
        })
        data.cover_url = result.fileList[0].tempFileURL
      } catch (error) {
        console.error('获取封面临时链接失败:', error)
      }
    }

    // 处理文章内容中的图片
    if (data.contents && Array.isArray(data.contents)) {
      for (let langContent of data.contents) {
        if (langContent.content) {
          try {
            // 提取内容中的所有云存储图片URL
            const imgRegex = /cloud:\/\/[^"'\s]*/g
            const imgUrls = langContent.content.match(imgRegex) || []
            
            if (imgUrls.length > 0) {
              const tempUrls = await cloud.getTempFileURL({
                fileList: imgUrls
              })
              
              // 替换内容中的图片链接
              let newContent = langContent.content
              tempUrls.fileList.forEach(file => {
                newContent = newContent.replace(file.fileID, file.tempFileURL)
              })
              
              langContent.content = newContent
            }
          } catch (error) {
            console.error('处理文章内容图片链接失败:', error)
          }
        }
        
        // 处理a4打印图片数组
        if (langContent.a4 && Array.isArray(langContent.a4)) {
          try {
            // 过滤出云存储图片URL
            const cloudImgUrls = langContent.a4.filter(url => url && url.startsWith('cloud://'));
            
            if (cloudImgUrls.length > 0) {
              const tempUrls = await cloud.getTempFileURL({
                fileList: cloudImgUrls
              });
              
              // 替换a4数组中的图片链接
              langContent.a4 = langContent.a4.map(url => {
                if (url && url.startsWith('cloud://')) {
                  const fileInfo = tempUrls.fileList.find(file => file.fileID === url);
                  return fileInfo ? fileInfo.tempFileURL : url;
                }
                return url;
              });
            }
          } catch (error) {
            console.error('处理a4打印图片链接失败:', error);
          }
        }
      }
    }

    // 如果没有词汇字段，从内容中提取关键词（可选）
    if (!data.vocabulary && data.contents) {
      const zhContent = data.contents.find(c => c.language === 'zh-CN');
      const enContent = data.contents.find(c => c.language === 'en');
      
      if (zhContent && zhContent.content && enContent && enContent.content) {
        // 从中文内容中提取关键词
        const text = zhContent.content.replace(/<[^>]+>/g, ''); // 移除HTML标签
        const words = text.match(/[\u4e00-\u9fa5]{2,6}/g) || []; // 提取2-6个字的中文词
        const uniqueWords = [...new Set(words)]; // 去重
        
        data.vocabulary = uniqueWords.slice(0, 10).map(word => ({
          text: word,
          translation: '' // 英文翻译，后续手动添加
        }));
      }
    }

    return {
      code: 0,
      msg: 'success',
      data
    }

  } catch (error) {
    console.error('获取文章详情失败：', error)
    return {
      code: -1,
      msg: error.message || '获取文章详情失败',
      error
    }
  }
}

// 获取文章列表
async function getArticles({ 
  level = 'sprout',  // 难度等级
  type = 'daily',    // 文章类型
  page = 1,          // 页码
  pageSize = 10,     // 每页条数
  languages = []     // 需要返回的语言内容，空数组表示不过滤语言
}) {
  try {
    console.log('开始获取文章列表，参数：', { level, type, page, pageSize, languages })
    
    // 构建查询条件
    const match = {
      level,
      type,
      status: true
    }

    // 如果指定了语言，添加语言过滤条件
    if (languages && languages.length > 0) {
      // 确保文章的contents数组中包含所有指定的语言
      match['contents'] = {
        $all: languages.map(lang => ({
          $elemMatch: {
            language: lang
          }
        }))
      }
    }
    
    console.log('查询条件：', match)

    // 使用聚合查询
    const result = await db.collection('jiuyu_articles')
      .aggregate()
      .match(match)
      .sort({
        create_time: -1
      })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .project({
        _id: 1,
        title: 1,
        titles: 1, // 添加titles字段
        cover_url: 1,
        level: 1,
        category: 1,
        type: 1,
        create_time: 1,
        contents: 1
      })
      .end()
    
    console.log('聚合查询结果：', result)

    // 获取总数
    const total = await db.collection('jiuyu_articles')
      .where(match)
      .count()
    
    console.log('总数查询结果：', total)

    // 处理封面图片链接
    const list = result.list || [];
    for (let item of list) {
      // 处理封面图片
      if (item.cover_url && item.cover_url.startsWith('cloud://')) {
        try {
          const result = await cloud.getTempFileURL({
            fileList: [item.cover_url]
          })
          item.cover_url = result.fileList[0].tempFileURL;
        } catch (error) {
          console.error('获取封面临时链接失败:', error)
          item.cover_url = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
        }
      }
    }

    // 如果是第一页，获取今日动态
    let dailyNews = null;
    if (page === 1) {
      // 不考虑难度和语言过滤，获取最新的一篇文章作为今日动态
      const latestArticle = await db.collection('jiuyu_articles')
        .where({
          type,
          status: true
          // 移除level条件，这样不管选择什么难度，都会显示最新的文章
        })
        .orderBy('create_time', 'desc')
        .limit(1)
        .get();
      
      if (latestArticle.data && latestArticle.data.length > 0) {
        const article = latestArticle.data[0];
        
        // 从titles数组中获取中文标题
        let title = article.title; // 默认使用旧的title字段
        
        if (article.titles && Array.isArray(article.titles) && article.titles.length > 0) {
          // 查找中文标题
          const zhTitle = article.titles.find(t => t.language === 'zh-CN');
          if (zhTitle) {
            title = zhTitle.title;
          }
        }
        
        dailyNews = {
          ...article,
          title: title, // 使用中文标题
          highlights: article.contents.find(c => c.language === 'zh-CN')?.highlights || ''
        };
        
        // 处理今日动态的封面图片
        if (dailyNews.cover_url && dailyNews.cover_url.startsWith('cloud://')) {
          try {
            const result = await cloud.getTempFileURL({
              fileList: [dailyNews.cover_url]
            });
            dailyNews.cover_url = result.fileList[0].tempFileURL;
          } catch (error) {
            console.error('获取今日动态封面临时链接失败:', error);
            dailyNews.cover_url = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
          }
        }
      }
    }

    return {
      code: 0,
      msg: 'success',
      data: {
        list,
        total: total.total,
        page,
        pageSize,
        dailyNews
      }
    }

  } catch (error) {
    console.error('获取文章列表失败：', error)
    return {
      code: -1,
      msg: error.message || '获取文章列表失败',
      error
    }
  }
}