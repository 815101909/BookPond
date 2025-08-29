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
  const { code } = event
  
  console.log('phoneLogin 云函数被调用，参数：', { code })
  console.log('微信上下文：', wxContext)
  
  if (!code) {
    return {
      success: false,
      errorCode: 'MISSING_CODE',
      message: '缺少必要的code参数'
    }
  }
  
  try {
    // 检查云环境和API可用性
    console.log('云环境信息：', {
      currentEnv: cloud.DYNAMIC_CURRENT_ENV,
      hasOpenapi: !!cloud.openapi,
      hasPhoneNumberApi: !!(cloud.openapi && cloud.openapi.phonenumber)
    })
    
    if (!cloud.openapi || !cloud.openapi.phonenumber) {
      console.error('云函数环境异常：openapi或phonenumber不可用')
      return {
        success: false,
        errorCode: 'PHONE_API_UNAVAILABLE',
        message: '手机号获取服务不可用'
      }
    }
    
    // 调用微信API获取手机号
    // 调用微信API获取手机号，使用FROM_APPID
    console.log('开始调用 phonenumber.getPhoneNumber，code：', code, '使用appid:', wxContext.FROM_APPID || 'wx85d92d28575a70f4')
    const phoneResult = await cloud.openapi({appid: wxContext.FROM_APPID || 'wx85d92d28575a70f4'}).phonenumber.getPhoneNumber({
      code: code
    })
    
    console.log('phonenumber.getPhoneNumber 结果：', {
      errcode: phoneResult.errcode || phoneResult.errCode,
      errmsg: phoneResult.errmsg || phoneResult.errMsg,
      hasPhoneInfo: !!(phoneResult.phone_info || phoneResult.phoneInfo),
      resultType: typeof phoneResult,
      resultKeys: Object.keys(phoneResult || {}),
      fullResult: phoneResult
    })
    
    // 检查API返回结果的完整性
    if (!phoneResult || typeof phoneResult !== 'object') {
      console.error('API返回结果异常：', phoneResult)
      return {
        success: false,
        errorCode: 'PHONE_API_FAILED',
        message: `API返回结果异常：${typeof phoneResult}`
      }
    }
    
    // 适配微信云调用的字段格式差异：errCode vs errcode
    const errcode = phoneResult.errcode !== undefined ? phoneResult.errcode : phoneResult.errCode
    const errmsg = phoneResult.errmsg || phoneResult.errMsg
    const phoneInfo = phoneResult.phone_info || phoneResult.phoneInfo
    
    // 检查errcode是否存在
    if (errcode === undefined || errcode === null) {
      console.error('API返回结果缺少errcode字段：', phoneResult)
      return {
        success: false,
        errorCode: 'PHONE_API_FAILED',
        message: `API返回结果格式异常：缺少errcode字段`
      }
    }
    
    if (errcode !== 0) {
      console.error('获取手机号失败：', errcode, errmsg)
      
      // 根据微信API错误码返回不同的错误类型
      if (errcode === 40029) {
        // code无效，通常是验证相关问题
        return {
          success: false,
          errorCode: 'PHONE_VERIFICATION_REQUIRED',
          message: '手机号验证失败，请在微信APP中完成手机号验证后重试'
        }
      } else if (errcode === 45011) {
        // API调用频率限制
        return {
          success: false,
          errorCode: 'PHONE_API_RATE_LIMIT',
          message: 'API调用过于频繁，请稍后重试'
        }
      } else if (errcode === 40013) {
        // appid不匹配
        return {
          success: false,
          errorCode: 'PHONE_APPID_MISMATCH',
          message: 'AppID不匹配，请检查小程序配置'
        }
      } else {
        // 其他错误
        return {
          success: false,
          errorCode: 'PHONE_API_FAILED',
          message: `获取手机号失败：错误码${errcode}，${errmsg || '未知错误'}`
        }
      }
    }
    
    if (!phoneInfo || !phoneInfo.phoneNumber) {
      return {
        success: false,
        errorCode: 'PHONE_DATA_EMPTY',
        message: '手机号数据为空'
      }
    }
    
    const phoneNumber = phoneInfo.phoneNumber
    const purePhoneNumber = phoneInfo.purePhoneNumber
    const countryCode = phoneInfo.countryCode
    
    console.log('获取到手机号信息：', {
      phoneNumber,
      purePhoneNumber,
      countryCode
    })
    
    // 获取用户openid
    const { OPENID, UNIONID, FROM_OPENID } = wxContext
    const userOpenid = FROM_OPENID || OPENID
    
    if (!userOpenid) {
      return {
        success: false,
        errorCode: 'MISSING_OPENID',
        message: '无法获取用户标识'
      }
    }
    
    // 查找或创建用户
    const userResult = await users.where({
      openid: userOpenid
    }).get()
    
    let user
    if (userResult.data.length > 0) {
      // 用户已存在，更新手机号和登录时间
      user = userResult.data[0]
      await users.doc(user._id).update({
        data: {
          phone_number: phoneNumber,
          pure_phone_number: purePhoneNumber,
          country_code: countryCode,
          last_login: db.serverDate(),
          updated_at: db.serverDate()
        }
      })
      
      console.log('更新现有用户手机号：', user._id)
    } else {
      // 创建新用户
      const createResult = await users.add({
        data: {
          openid: userOpenid,
          unionid: UNIONID || '',
          nickname: '',
          avatar: '',
          gender: 0,
          totalCheckinDays: 0,
          checkinDays: 0,
          membershipInfo: {
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后到期
            startDate: db.serverDate(),
            isMember: true
          },
          signature: '',
          status: 0,
          phone_number: phoneNumber,
          pure_phone_number: purePhoneNumber,
          country_code: countryCode,
          created_at: db.serverDate(),
          last_login: db.serverDate(),
          updated_at: db.serverDate()
        }
      })
      
      user = {
        _id: createResult._id,
        openid: userOpenid,
        unionid: UNIONID,
        phone_number: phoneNumber,
        pure_phone_number: purePhoneNumber,
        country_code: countryCode
      }
      
      console.log('创建新用户：', user._id)
    }
    
    return {
      success: true,
      data: {
        userId: user._id,
        openid: userOpenid,
        phoneNumber: phoneNumber,
        purePhoneNumber: purePhoneNumber,
        countryCode: countryCode
      },
      message: '手机号获取成功'
    }
    
  } catch (error) {
    console.error('phoneLogin 云函数执行异常：', error)
    return {
      success: false,
      errorCode: 'PHONE_LOGIN_ERROR',
      message: `手机号登录失败：${error.message || '未知错误'}`
    }
  }
}