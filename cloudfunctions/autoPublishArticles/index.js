// 云函数入口文件
const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

exports.main = async (event, context) => {
  const nowTimestamp = Date.now() // 当前时间的时间戳（毫秒）

  console.log('当前时间戳：', nowTimestamp)

  // 查询 publishTime <= 当前时间戳 的文章
  const { data: articlesToPublish } = await db.collection('star_articles')
    .where({
      publishTime: _.lte(nowTimestamp),
      status: 'pending'
    })
    .get()

  console.log('即将发布文章数量：', articlesToPublish.length)

  const publishedIds = []

  for (const article of articlesToPublish) {
    try {
      await db.collection('star_articles').doc(article._id).update({
        status: 'published',
        publishedAt: nowTimestamp
      })
      publishedIds.push(article._id)
    } catch (err) {
      console.error(`发布文章 ${article._id} 失败：`, err)
    }
  }

  return {
    message: '定时发布完成',
    publishedCount: publishedIds.length,
    publishedArticleIds: publishedIds
  }
}
