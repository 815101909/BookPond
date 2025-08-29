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
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
  const userOpenid = FROM_OPENID || OPENID

  // 根据action执行不同操作
  switch (action) {
    case 'saveWriting':
      return await saveWriting({ ...data, openid: userOpenid })
    case 'getWritingHistory':
      return await getWritingHistory({ ...data, openid: userOpenid })
    case 'getWritingDetail':
      return await getWritingDetail(data)
    case 'saveTimeCapsule':
      return await saveTimeCapsule({ ...data, openid: userOpenid })
    case 'getTimeCapsules':
      return await getTimeCapsules({ ...data, openid: userOpenid })
    case 'checkExpiredTimeCapsules':
      return await checkExpiredTimeCapsules({ ...data, openid: userOpenid })
    default:
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 保存写作内容
async function saveWriting({ 
  openid, 
  content, 
  articleId, 
  type, 
  level,
  languages = [],
  cover_url = ''
}) {
  try {
    const now = new Date().toISOString()
    const result = await db.collection('jiuyu_writings').add({
      data: {
        openid,
        content,
        articleId,
        type,
        level,
        languages,
        cover_url,
        create_time: now,
        update_time: now,
        status: true
      }
    })

    return {
      code: 0,
      msg: 'success',
      data: result._id
    }
  } catch (error) {
    console.error('保存写作内容失败：', error)
    return {
      code: -1,
      msg: error.message || '保存写作内容失败'
    }
  }
}

// 获取写作历史
async function getWritingHistory({ 
  openid, 
  page = 1, 
  pageSize = 10,
  type,
  level
}) {
  try {
    const match = {
      openid,
      status: true
    }

    if (type) match.type = type
    if (level) match.level = level

    const list = await db.collection('jiuyu_writings')
      .where(match)
      .orderBy('create_time', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const total = await db.collection('jiuyu_writings')
      .where(match)
      .count()

    return {
      code: 0,
      msg: 'success',
      data: {
        list: list.data,
        total: total.total,
        page,
        pageSize
      }
    }
  } catch (error) {
    console.error('获取写作历史失败：', error)
    return {
      code: -1,
      msg: error.message || '获取写作历史失败'
    }
  }
}

// 获取写作详情
async function getWritingDetail({ id }) {
  try {
    const writing = await db.collection('jiuyu_writings')
      .doc(id)
      .get()

    if (!writing.data) {
      return {
        code: -1,
        msg: '写作内容不存在'
      }
    }

    return {
      code: 0,
      msg: 'success',
      data: writing.data
    }
  } catch (error) {
    console.error('获取写作详情失败：', error)
    return {
      code: -1,
      msg: error.message || '获取写作详情失败'
    }
  }
}

// 保存时光宝盒
async function saveTimeCapsule({ 
  openid, 
  content,
  message,
  openDate,
  articleId,
  language,
  vocabularyUsed
}) {
  try {
    const now = new Date().toISOString()
    
    // 处理时区问题：将openDate调整为UTC时间
    const localOpenDate = new Date(openDate);
    const utcOpenDate = new Date(localOpenDate.getTime() - 8 * 60 * 60 * 1000); // 减去8小时

    const result = await db.collection('jiuyu_time_capsules').add({
      data: {
        openid,
        content,
        message,
        openDate: utcOpenDate,
        articleId,
        language,
        vocabularyUsed,
        create_time: now,
        status: 'pending',
        isRead: false
      }
    })

    return {
      code: 0,
      msg: 'success',
      data: {
        _id: result._id,
        openAt: openDate
      }
    }
  } catch (error) {
    console.error('保存时光宝盒失败：', error)
    return {
      code: -1,
      msg: error.message || '保存时光宝盒失败'
    }
  }
}

// 获取时光宝盒列表
async function getTimeCapsules({ 
  openid, 
  status = 'pending',
  page = 1,
  pageSize = 10 
}) {
  try {
    const match = {
      openid,
      status
    }

    const list = await db.collection('jiuyu_time_capsules')
      .where(match)
      .orderBy('openDate', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const total = await db.collection('jiuyu_time_capsules')
      .where(match)
      .count()

    return {
      code: 0,
      msg: 'success',
      data: {
        list: list.data,
        total: total.total,
        page,
        pageSize
      }
    }
  } catch (error) {
    console.error('获取时光宝盒列表失败：', error)
    return {
      code: -1,
      msg: error.message || '获取时光宝盒列表失败'
    }
  }
}

// 检查到期的时光宝盒
async function checkExpiredTimeCapsules({ openid }) {
  try {
    const now = new Date()
    
    // 查找所有到期但未开启的时光宝盒（状态为pending且开启时间小于当前时间）
    const expiredCapsules = await db.collection('jiuyu_time_capsules')
      .where({
        openid,
        status: 'pending',
        openDate: _.lte(now)
      })
      .get()

    // 如果有到期的胶囊，更新它们的状态为ended
    if (expiredCapsules.data.length > 0) {
      const capsuleIds = expiredCapsules.data.map(capsule => capsule._id)
      
      // 批量更新状态
      await db.collection('jiuyu_time_capsules')
        .where({
          _id: _.in(capsuleIds)
        })
        .update({
          data: {
            status: 'ended'
          }
        })
    }

    return {
      code: 0,
      msg: 'success',
      data: {
        expiredCapsules: expiredCapsules.data
      }
    }
  } catch (error) {
    console.error('检查时光宝盒失败:', error)
    return {
      code: -1,
      msg: error.message || '检查时光宝盒失败'
    }
  }
}