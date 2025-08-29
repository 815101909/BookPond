// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const users = db.collection('jiuyu_users')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { type } = event

  switch (type) {
    case 'login':
      return handleLogin(wxContext)
    case 'checkSession':
      return checkSession(wxContext)
    case 'updateUserInfo':
      return updateUserInfo(event, wxContext)
    default:
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 处理登录
async function handleLogin(wxContext) {
  try {
    // 获取用户信息
    const { OPENID, UNIONID, FROM_OPENID } = wxContext
    // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
    const userOpenid = FROM_OPENID || OPENID
    
    // 查找是否已存在用户
    const userResult = await users.where({
      openid: userOpenid
    }).get()

    if (userResult.data.length > 0) {
      // 用户已存在，更新登录时间
      const user = userResult.data[0]
      await users.doc(user._id).update({
        data: {
          last_login: db.serverDate()
        }
      })

      return {
        code: 0,
        msg: '登录成功',
        data: {
          ...user,
          openid: userOpenid,
          unionid: UNIONID || '',
        }
      }
    }

    // 生成唯一的随机userId
    const generateUniqueUserId = async () => {
      let userId
      let isUnique = false
      
      while (!isUnique) {
        const randomNum = Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
        userId = `SC_${randomNum}`
        
        // 检查userId是否已存在
        const existingUser = await users.where({
          userId: userId
        }).get()
        
        if (existingUser.data.length === 0) {
          isUnique = true
        }
      }
      
      return userId
    }

    // 用户不存在，创建新用户
    const newUser = {
      openid: userOpenid,
      unionid: UNIONID || '',
      userId: await generateUniqueUserId(),
      nickname: '',
      avatar: '',
      gender: 0,
      created_at: db.serverDate(),
      last_login: db.serverDate(),
      totalCheckinDays: 0,
      checkinDays: 0,
      membershipInfo: {
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天后到期，13位时间戳
        startDate: Date.now(), // 当前时间，13位时间戳
        isMember: true
      },
      signature: '',
      status: 0,
    }

    const result = await users.add({
      data: newUser
    })

    return {
      code: 0,
      msg: '注册成功',
      data: {
        ...newUser,
        _id: result._id
      }
    }

  } catch (error) {
    console.error('登录失败:', error)
    return {
      code: -1,
      msg: '登录失败',
      error: error.message
    }
  }
}

// 检查会话状态
async function checkSession(wxContext) {
  try {
    const { OPENID, FROM_OPENID } = wxContext
    // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
    const userOpenid = FROM_OPENID || OPENID
    
    const userResult = await users.where({
      openid: userOpenid
    }).get()

    if (userResult.data.length === 0) {
      return {
        code: -1,
        msg: '用户未登录'
      }
    }

    return {
      code: 0,
      msg: '会话有效',
      data: userResult.data[0]
    }

  } catch (error) {
    console.error('检查会话状态失败:', error)
    return {
      code: -1,
      msg: '检查会话状态失败',
      error: error.message
    }
  }
}

// 更新用户信息
async function updateUserInfo(event, wxContext) {
  try {
    const { OPENID, FROM_OPENID } = wxContext
    // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
    const userOpenid = FROM_OPENID || OPENID
    const { field, value } = event

    // 检查用户是否存在
    const userResult = await users.where({
      openid: userOpenid
    }).get()

    if (userResult.data.length === 0) {
      return {
        code: -1,
        msg: '用户不存在'
      }
    }

    const user = userResult.data[0]

    // 根据字段类型进行更新
    let updateData = {}
    switch (field) {
      case 'avatar':
        updateData = { avatar: value }
        break
      case 'nickname':
        updateData = { nickname: value }
        break
      case 'signature':
        updateData = { signature: value }
        break
      default:
        return {
          code: -1,
          msg: '不支持的更新字段'
        }
    }

    // 更新用户信息
    await users.doc(user._id).update({
      data: updateData
    })

    // 返回更新后的完整用户信息
    const updatedUser = await users.doc(user._id).get()

    return {
      code: 0,
      msg: '更新成功',
      data: updatedUser.data
    }

  } catch (error) {
    console.error('更新用户信息失败:', error)
    return {
      code: -1,
      msg: '更新用户信息失败',
      error: error.message
    }
  }
}