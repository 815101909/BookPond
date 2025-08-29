// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const users = db.collection('jiuyu_users')
const checkinRecords = db.collection('jiuyu_checkin_records')
const _ = db.command
const $ = db.command.aggregate

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
  const userOpenid = FROM_OPENID || OPENID
  const { type } = event

  console.log('打卡云函数调用:', { type, openid: userOpenid, event })

  if (!userOpenid) {
    console.error('未获取到用户OPENID')
    return {
      code: -1,
      msg: '未获取到用户信息'
    }
  }

  switch (type) {
    case 'checkIn':
      return handleCheckIn(event, userOpenid)
    case 'getCheckinRecords':
      return getCheckinRecords(event, userOpenid)
    case 'getCheckinStats':
      return getCheckinStats(userOpenid)
    case 'checkAndCreateUser':
      return checkAndCreateUser(userOpenid)
    default:
      console.error('未知的操作类型:', type)
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 检查用户是否存在，如果不存在则创建
async function checkAndCreateUser(openid) {
  try {
    console.log('检查用户是否存在:', openid)
    
    // 查询用户
    const userResult = await users.where({
      openid
    }).get()
    
    if (userResult.data.length > 0) {
      console.log('用户已存在:', userResult.data[0])
      return {
        code: 0,
        msg: '用户已存在',
        data: userResult.data[0]
      }
    }
    
    // 创建新用户
    console.log('创建新用户:', openid)
    const now = new Date()
    const userData = {
      openid,
      nickname: '晓学者',
      avatar: '',
      level: 1,
      signature: '每天进步一点点，离梦想更近一步',
      checkinDays: 0,
      totalCheckinDays: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }
    
    const result = await users.add({
      data: userData
    })
    
    console.log('用户创建结果:', result)
    
    return {
      code: 0,
      msg: '用户创建成功',
      data: {
        ...userData,
        _id: result._id
      }
    }
  } catch (error) {
    console.error('检查/创建用户失败:', error)
    return {
      code: -1,
      msg: '检查/创建用户失败',
      error: error.message,
      stack: error.stack
    }
  }
}

// 处理打卡
async function handleCheckIn(event, openid) {
  try {
    console.log('开始处理打卡:', { openid, event })
    
    // 获取当前日期（使用UTC+8时区，即北京时间）
    const now = new Date()
    // 调整为北京时间
    const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
    const today = new Date(chinaTime.getFullYear(), chinaTime.getMonth(), chinaTime.getDate())
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    console.log('当前日期(北京时间):', todayStr, '原始时间:', now.toISOString())
    
    // 检查今天是否已经打卡
    const todayRecord = await checkinRecords.where({
      openid,
      date: todayStr
    }).get()
    
    console.log('今日打卡记录查询结果:', todayRecord)
    
    if (todayRecord.data.length > 0) {
      console.log('今日已打卡')
      return {
        code: -1,
        msg: '今日已打卡'
      }
    }
    
    // 获取用户信息
    console.log('查询用户信息:', openid)
    const userResult = await users.where({
      openid
    }).get()
    
    console.log('用户查询结果:', userResult)
    
    let user = null
    
    if (userResult.data.length === 0) {
      console.log('用户不存在，尝试创建用户')
      // 创建新用户
      const userData = {
        openid,
        nickname: '晓学者',
        avatar: '',
        level: 1,
        signature: '每天进步一点点，离梦想更近一步',
        checkinDays: 0,
        totalCheckinDays: 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }
      
      try {
        const result = await users.add({
          data: userData
        })
        
        console.log('用户创建结果:', result)
        
        // 获取新创建的用户
        const newUserResult = await users.doc(result._id).get()
        user = newUserResult.data
        console.log('新创建用户信息:', user)
      } catch (err) {
        console.error('创建用户失败:', err)
        return {
          code: -1,
          msg: '创建用户失败',
          error: err.message
        }
      }
    } else {
      user = userResult.data[0]
      console.log('用户信息:', user)
    }
    
    if (!user) {
      console.error('无法获取用户信息')
      return {
        code: -1,
        msg: '无法获取用户信息'
      }
    }
    
    // 检查是否连续打卡
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    
    console.log('检查昨日打卡:', yesterdayStr)
    const yesterdayRecord = await checkinRecords.where({
      openid,
      date: yesterdayStr
    }).get()
    
    console.log('昨日打卡记录:', yesterdayRecord)
    
    // 判断是否连续打卡
    let checkinDays = user.checkinDays || 0
    if (yesterdayRecord.data.length > 0) {
      // 连续打卡
      checkinDays++
      console.log('连续打卡天数更新:', checkinDays)
    } else {
      // 中断了连续打卡，重新开始计数
      checkinDays = 1
      console.log('连续打卡中断，重新开始计数:', checkinDays)
    }
    
    // 总打卡天数增加
    const totalCheckinDays = (user.totalCheckinDays || 0) + 1
    console.log('总打卡天数更新:', totalCheckinDays)
    
    // 创建打卡记录
    const checkInData = {
      openid,
      date: todayStr,
      timestamp: now.getTime(),
      study_time: event.study_time || 0,
      created_at: now.toISOString()
    }
    
    console.log('准备添加打卡记录:', checkInData)
    
    // 添加打卡记录
    const recordResult = await checkinRecords.add({
      data: checkInData
    })
    
    console.log('打卡记录添加结果:', recordResult)
    
    // 检查打卡激励规则
    const incentiveResult = await checkIncentiveRules(openid, user, checkinDays)
    
    // 更新用户打卡统计
    console.log('准备更新用户打卡统计:', { userId: user._id, checkinDays, totalCheckinDays })
    const updateData = {
      checkinDays,
      totalCheckinDays
    }
    
    // 如果有会员奖励，更新会员信息
    if (incentiveResult.membershipDays > 0) {
      // 获取当前会员信息
      const currentMembershipInfo = user.membershipInfo || { isMember: false, startDate: null, endDate: null }
      
      let membershipEndDate
      if (currentMembershipInfo.endDate) {
        const currentEndDate = new Date(currentMembershipInfo.endDate)
        // 如果当前会员还未过期，在原有基础上增加天数
        if (currentEndDate > now) {
          membershipEndDate = new Date(currentEndDate.getTime() + incentiveResult.membershipDays * 24 * 60 * 60 * 1000)
        } else {
          // 如果已过期，从当前时间开始计算
          membershipEndDate = new Date(now.getTime() + incentiveResult.membershipDays * 24 * 60 * 60 * 1000)
        }
      } else {
        // 如果从未有过会员，从当前时间开始计算
        membershipEndDate = new Date(now.getTime() + incentiveResult.membershipDays * 24 * 60 * 60 * 1000)
      }
      
      // 更新会员信息对象
      updateData.membershipInfo = {
        isMember: true,
        startDate: currentMembershipInfo.startDate || now.getTime(),
        endDate: membershipEndDate.getTime()
      }
      
      // 为了兼容性，同时更新旧的字段格式
      updateData.membershipEndDate = membershipEndDate.toISOString()
      updateData.isMember = true
    }
    
    const updateResult = await users.doc(user._id).update({
      data: updateData
    })
    
    console.log('用户打卡统计更新结果:', updateResult)
    
    return {
      code: 0,
      msg: incentiveResult.message || '打卡成功',
      data: {
        checkinDays,
        totalCheckinDays,
        record: checkInData,
        incentive: incentiveResult
      }
    }
  } catch (error) {
    console.error('打卡失败:', error)
    return {
      code: -1,
      msg: '打卡失败',
      error: error.message,
      stack: error.stack
    }
  }
}

// 检查打卡激励规则
async function checkIncentiveRules(openid, user, checkinDays) {
  try {
    console.log('检查打卡激励规则:', { openid, checkinDays })
    
    let membershipDays = 0
    let message = '打卡成功'
    let achievedMilestone = null
    
    // 检查是否达到激励里程碑
    if (checkinDays === 10) {
      membershipDays = 3
      message = '恭喜！连续打卡10天，获得3天会员奖励！'
      achievedMilestone = { days: 10, reward: 3 }
    } else if (checkinDays === 20) {
      membershipDays = 7
      message = '太棒了！连续打卡20天，获得7天会员奖励！'
      achievedMilestone = { days: 20, reward: 7 }
    } else if (checkinDays === 30) {
      membershipDays = 15
      message = 'amazing！连续打卡30天，获得15天会员奖励！'
      achievedMilestone = { days: 30, reward: 15 }
    }
    
    // 记录激励发放日志
    if (membershipDays > 0) {
      console.log('发放会员奖励:', {
        openid,
        checkinDays,
        membershipDays,
        timestamp: new Date().toISOString()
      })
      
      // 可以在这里添加激励记录到数据库
      try {
        await db.collection('jiuyu_incentive_records').add({
          data: {
            openid,
            type: 'checkin_milestone',
            checkinDays,
            membershipDays,
            achieved_at: new Date().toISOString(),
            milestone: achievedMilestone
          }
        })
      } catch (err) {
        console.error('记录激励日志失败:', err)
      }
    }
    
    return {
      membershipDays,
      message,
      achievedMilestone
    }
  } catch (error) {
    console.error('检查打卡激励规则失败:', error)
    return {
      membershipDays: 0,
      message: '打卡成功',
      achievedMilestone: null
    }
  }
}

// 获取打卡记录
async function getCheckinRecords(event, openid) {
  try {
    const { year, month } = event;
    
    console.log('获取打卡记录:', { year, month, openid });
    
    let query = {
      openid
    };
    
    // 如果指定了年月，则筛选对应月份的记录
    if (year && month) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      
      // 计算下个月的第一天
      let nextMonth = month + 1;
      let nextMonthYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextMonthYear++;
      }
      const endDate = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
      
      query.date = _.gte(startDate).and(_.lt(endDate));
      
      console.log('日期查询范围:', { startDate, endDate });
    }
    
    // 获取打卡记录
    const records = await checkinRecords.where(query)
      .orderBy('date', 'desc')
      .get();
    
    console.log('查询到的打卡记录:', records.data);
    
    // 获取用户信息
    const userResult = await users.where({
      openid
    }).get();
    
    if (userResult.data.length === 0) {
      console.error('用户不存在:', openid);
      return {
        code: -1,
        msg: '用户不存在'
      };
    }
    
    const user = userResult.data[0];
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        checkinDays: user.checkinDays || 0,
        totalCheckinDays: user.totalCheckinDays || 0,
        records: records.data
      }
    };
  } catch (error) {
    console.error('获取打卡记录失败:', error);
    return {
      code: -1,
      msg: '获取打卡记录失败',
      error: error.message
    };
  }
}

// 获取打卡统计数据
async function getCheckinStats(openid) {
  try {
    console.log('获取打卡统计:', openid);
    
    // 获取用户信息
    const userResult = await users.where({
      openid
    }).get();
    
    if (userResult.data.length === 0) {
      console.error('用户不存在:', openid);
      return {
        code: -1,
        msg: '用户不存在'
      };
    }
    
    const user = userResult.data[0];
    console.log('用户信息:', user);
    
    // 获取月度打卡统计
    const monthlyStatsResult = await checkinRecords.aggregate()
      .match({
        openid
      })
      .addFields({
        yearMonth: $.substr(['$date', 0, 7]) // 提取YYYY-MM部分
      })
      .group({
        _id: '$yearMonth',
        count: $.sum(1)
      })
      .end();
    
    console.log('月度统计结果:', monthlyStatsResult);
    
    // 格式化月度统计数据
    const monthlyStats = {};
    monthlyStatsResult.list.forEach(item => {
      monthlyStats[item._id] = item.count;
    });
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        checkinDays: user.checkinDays || 0,
        totalCheckinDays: user.totalCheckinDays || 0,
        monthlyStats
      }
    };
  } catch (error) {
    console.error('获取打卡统计失败:', error);
    return {
      code: -1,
      msg: '获取打卡统计失败',
      error: error.message
    };
  }
}