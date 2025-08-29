// 文章收藏云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const favoritesCollection = db.collection('jiuyu_favorites')
const _ = db.command

/**
 * 收藏相关的云函数
 * @param {object} event 
 * @param {string} event.action - 操作类型，可选值：addFavorite, removeFavorite, checkFavorite, getUserFavorites
 * @param {object} event.data - 操作的数据
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
  const userId = FROM_OPENID || OPENID

  // 如果没有用户ID，返回错误
  if (!userId) {
    return {
      code: 1,
      msg: '未获取到用户信息'
    }
  }

  // 解构请求参数
  const { action, data = {} } = event

  try {
    // 根据不同操作执行对应逻辑
    switch (action) {
      // 添加收藏
      case 'addFavorite':
        return await addFavorite(userId, data)
      
      // 移除收藏
      case 'removeFavorite':
        return await removeFavorite(userId, data)
      
      // 检查是否已收藏
      case 'checkFavorite':
        return await checkFavorite(userId, data)
      
      // 获取用户收藏列表
      case 'getUserFavorites':
        return await getUserFavorites(userId, data)

      default:
        return {
          code: 1,
          msg: '未知操作'
        }
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    return {
      code: 1,
      msg: '操作失败: ' + error.message
    }
  }
}

/**
 * 添加收藏
 * @param {string} userId - 用户ID
 * @param {object} data - 文章数据
 */
async function addFavorite(userId, data) {
  const { articleId, title, coverUrl, type, level, highlights } = data

  // 验证必要字段
  if (!articleId) {
    return {
      code: 1,
      msg: '缺少文章ID'
    }
  }

  // 检查是否已收藏
  const isExist = await checkExist(userId, articleId)
  if (isExist) {
    return {
      code: 0,
      msg: '已经收藏过了',
      data: { isFavorite: true }
    }
  }

  // 创建收藏记录
  const favoriteData = {
    openid: userId,
    article_id: articleId,
    title: title || '未知标题',
    cover_url: coverUrl || '',
    type: type || 'news',
    level: level || 'sprout',
    create_time: Date.now(),
    highlights: highlights || ''
  }

  const result = await favoritesCollection.add({
    data: favoriteData
  })

  return {
    code: 0,
    msg: '收藏成功',
    data: {
      id: result._id,
      isFavorite: true
    }
  }
}

/**
 * 移除收藏
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function removeFavorite(userId, data) {
  const { articleId } = data

  // 验证必要字段
  if (!articleId) {
    return {
      code: 1,
      msg: '缺少文章ID'
    }
  }

  // 删除收藏记录
  const result = await favoritesCollection.where({
    openid: userId,
    article_id: articleId
  }).remove()

  return {
    code: 0,
    msg: '取消收藏成功',
    data: {
      isFavorite: false,
      deleted: result.stats.removed
    }
  }
}

/**
 * 检查是否已收藏
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function checkFavorite(userId, data) {
  const { articleId } = data

  // 验证必要字段
  if (!articleId) {
    return {
      code: 1,
      msg: '缺少文章ID'
    }
  }

  const isExist = await checkExist(userId, articleId)

  return {
    code: 0,
    data: { isFavorite: isExist }
  }
}

/**
 * 获取用户收藏列表
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function getUserFavorites(userId, data) {
  const { page = 1, pageSize = 10, type } = data
  
  // 构建查询条件
  const condition = { openid: userId }
  if (type && type !== 'all') {
    condition.type = type
  }
  
  // 查询总数
  const countResult = await favoritesCollection.where(condition).count()
  const total = countResult.total
  
  // 查询数据
  const list = await favoritesCollection
    .where(condition)
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    code: 0,
    msg: '获取成功',
    data: {
      list: list.data,
      total,
      page,
      pageSize
    }
  }
}

/**
 * 检查收藏是否存在
 * @param {string} userId - 用户ID
 * @param {string} articleId - 文章ID
 */
async function checkExist(userId, articleId) {
  const result = await favoritesCollection.where({
    openid: userId,
    article_id: articleId
  }).count()
  
  return result.total > 0
}