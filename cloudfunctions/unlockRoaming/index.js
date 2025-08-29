// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 获取今天6点的时间戳
function getTodaySixAM() {
  const now = new Date()
  const today6am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0)
  return today6am.getTime()
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const today6am = getTodaySixAM()
    
    // 查找需要解锁的漫游记录（unlockDate小于今天6点的）
    const result = await db.collection('cityCard')
      .where({
        'basicInfo.status': false,
        'basicInfo.unlockDate': db.command.lt(today6am)  // 使用lt而不是lte
      })
      .update({
        data: {
          'basicInfo.status': true,
          updatedAt: db.serverDate()
        }
      })

    console.log('解锁漫游记结果:', result)

    return {
      success: true,
      data: {
        updated: result.stats.updated
      }
    }
  } catch (error) {
    console.error('解锁漫游记失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 