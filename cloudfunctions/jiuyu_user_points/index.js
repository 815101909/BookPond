// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, data } = event
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
  const userOpenid = FROM_OPENID || OPENID

  switch (action) {
    case 'getUserPoints':
      return await getUserPoints(userOpenid)
    case 'updateUserPoints':
      return await updateUserPoints(userOpenid, data)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// 获取用户积分和花朵
async function getUserPoints(openid) {
  const doc = await db.collection('jiuyu_user_points').where({ openid }).get()
  if (doc.data.length > 0) {
    return { code: 0, data: doc.data[0] }
  } else {
    // 没有则初始化
    const now = new Date()
    const initData = {
      openid,
      listen_points: 0,
      listen_flowers: 0,
      speak_points: 0,
      speak_flowers: 0,
      created_at: now,
      updated_at: now
    }
    await db.collection('jiuyu_user_points').add({ data: initData })
    return { code: 0, data: initData }
  }
}

// 更新用户积分和花朵
async function updateUserPoints(openid, data) {
  // data: { type: 'listen_points'|'listen_flowers'|'speak_points'|'speak_flowers', delta: 1|-1|N }
  const { type, delta } = data
  if (!['listen_points', 'listen_flowers', 'speak_points', 'speak_flowers'].includes(type)) {
    return { code: -1, msg: '类型错误' }
  }
  const now = new Date()
  await db.collection('jiuyu_user_points').where({ openid }).update({
    data: {
      [type]: _.inc(delta),
      updated_at: now
    }
  })
  return { code: 0, msg: '更新成功' }
}