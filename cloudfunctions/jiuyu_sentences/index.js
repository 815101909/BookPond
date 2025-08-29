// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { action } = event
    
    switch (action) {
      case 'getRandomSentence':
        return await getRandomSentence()
      case 'getAllSentences':
        return await getAllSentences()
      default:
        return {
          success: false,
          message: '未知的操作类型'
        }
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

// 获取随机句子
async function getRandomSentence() {
  try {
    // 先获取总数
    const countResult = await db.collection('jiuyu_sentences').count()
    const total = countResult.total
    
    if (total === 0) {
      return {
        success: false,
        message: '暂无句子数据'
      }
    }
    
    // 生成随机索引
    const randomIndex = Math.floor(Math.random() * total)
    
    // 获取随机句子
    const result = await db.collection('jiuyu_sentences')
      .skip(randomIndex)
      .limit(1)
      .get()
    
    if (result.data && result.data.length > 0) {
      const sentence = result.data[0]
      return {
        success: true,
        data: {
          text: sentence.text,
          source: sentence.source
        }
      }
    } else {
      return {
        success: false,
        message: '获取句子失败'
      }
    }
  } catch (error) {
    console.error('获取随机句子错误:', error)
    throw error
  }
}

// 获取所有句子（可选功能，用于管理）
async function getAllSentences() {
  try {
    const result = await db.collection('jiuyu_sentences')
      .field({
        text: true,
        source: true,
        _id: true
      })
      .get()
    
    return {
      success: true,
      data: result.data,
      total: result.data.length
    }
  } catch (error) {
    console.error('获取所有句子错误:', error)
    throw error
  }
}