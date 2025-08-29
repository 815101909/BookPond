// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    // 获取今天凌晨6点的时间戳（毫秒）
    const now = new Date()
    now.setHours(6, 0, 0, 0)
    const sixAMTimestamp = now.getTime()

    console.log('今日6点时间戳：', sixAMTimestamp)

    // 查询小于今天6点的记录
    const { data: docs } = await db.collection('jiuyu_articles') 
      .where({
        create_time: _.lt(sixAMTimestamp)
      })
      .get()

    console.log('符合条件记录数：', docs.length)

    // 批量更新
    const updatePromises = docs.map(doc => {
      return db.collection('jiuyu_articles') 
        .doc(doc._id)
        .update({
          data: {
            status: true
          }
        })
    })

    await Promise.all(updatePromises)

    return {
      success: true,
      updatedCount: docs.length,
      updatedIds: docs.map(d => d._id)
    }

  } catch (error) {
    console.error('更新失败：', error)
    return {
      success: false,
      error: error.message
    }
  }
}
