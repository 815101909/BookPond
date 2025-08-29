// 云函数入口文件
const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

exports.main = async (event, context) => {
  const nowTimestamp = Date.now() // 当前时间的时间戳（毫秒）
  console.log('当前时间戳：', nowTimestamp)

  // 查询 unlockDate <= 当前时间 && status !== true 的城市卡片
  const { data: cardsToUnlock } = await db.collection('cityCard')
    .where({
      'basicInfo.unlockDate': _.lte(nowTimestamp),
      'basicInfo.status': _.neq(true)
    })
    .get()

  console.log('即将解锁城市卡片数量：', cardsToUnlock.length)

  const unlockedIds = []

  for (const card of cardsToUnlock) {
    try {
      await db.collection('cityCard').doc(card._id).update({
        basicInfo: {
          ...card.basicInfo,
          status: true
        }
      })
      unlockedIds.push(card._id)
    } catch (err) {
      console.error(`解锁城市卡片 ${card._id} 失败：`, err)
    }
  }

  return {
    message: '城市卡片定时解锁完成',
    unlockedCount: unlockedIds.length,
    unlockedCardIds: unlockedIds
  }
}
