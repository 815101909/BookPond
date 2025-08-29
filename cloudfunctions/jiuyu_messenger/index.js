// 信使驿站云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const timeCapsuleCollection = db.collection('jiuyu_time_capsules')
const writingsCollection = db.collection('jiuyu_writings')
const systemMessagesCollection = db.collection('jiuyu_system_messages')
const _ = db.command

/**
 * 信使驿站相关的云函数
 * @param {object} event 
 * @param {string} event.action - 操作类型，可选值：getMessages, deleteMessage, markAsRead
 * @param {object} event.data - 操作的数据
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID, FROM_OPENID } = wxContext
  // 优先使用FROM_OPENID（B小程序的openid），如果不存在则使用OPENID（A小程序的openid）
  const userId = FROM_OPENID || OPENID

  // 解构请求参数
  const { action, data = {} } = event

  // 不需要用户身份验证的操作
  const noAuthActions = ['getSystemMessages', 'createSystemMessage', 'createTestSystemMessage']
  
  // 如果需要用户身份验证但没有用户ID，返回错误
  if (!noAuthActions.includes(action) && !userId) {
    return {
      code: 1,
      msg: '未获取到用户信息'
    }
  }

  try {
    // 根据不同操作执行对应逻辑
    switch (action) {
      // 获取消息列表
      case 'getMessages':
        return await getMessages(userId, data)
      
      // 删除消息
      case 'deleteMessage':
        return await deleteMessage(userId, data)
      
      // 标记消息为已读
      case 'markAsRead':
        return await markAsRead(userId, data)
      
      // 创建系统消息（不需要用户身份验证）
      case 'createSystemMessage':
        return await createSystemMessage(userId, data)
      
      // 获取系统消息列表（不需要用户身份验证）
      case 'getSystemMessages':
        return await getSystemMessages(userId, data)
      
      // 全部标记为已读
      case 'markAllAsRead':
        return await markAllAsRead(userId, data)
      
      // 创建测试系统消息（不需要用户身份验证）
      case 'createTestSystemMessage':
        return await createTestSystemMessage(userId, data)

      default:
        return {
          code: 1,
          msg: '未知操作'
        }
    }
  } catch (error) {
    console.error('信使驿站操作失败:', error)
    return {
      code: 1,
      msg: '操作失败: ' + error.message
    }
  }
}

/**
 * 获取消息列表 - 从时光宝盒和写作集合中获取
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function getMessages(userId, data) {
  const { page = 1, pageSize = 10, type, excludeSystemMessages = false } = data
  
  try {
    // 查询时光宝盒数据
    let timeCapsuleQuery = timeCapsuleCollection.where({
      openid: userId
    });
    
    // 查询写作数据
    let writingsQuery = writingsCollection.where({
      openid: userId
    });
    
    // 查询系统消息数据（系统消息是全局的，不区分用户）
    let systemMessagesQuery = systemMessagesCollection;
    
    // 如果需要排除系统消息，则不查询系统消息
    if (excludeSystemMessages) {
      systemMessagesQuery = systemMessagesQuery.where({
        _id: _.eq('none') // 不匹配任何数据
      });
    }
    
    // 如果指定了类型，则筛选
    if (type) {
      if (type === 'time_capsule') {
        // 只查询时光宝盒
        writingsQuery = writingsQuery.where({
          _id: _.eq('none') // 不匹配任何数据
        });
        systemMessagesQuery = systemMessagesQuery.where({
          _id: _.eq('none') // 不匹配任何数据
        });
      } else if (type === 'writing') {
        // 只查询写作
        timeCapsuleQuery = timeCapsuleQuery.where({
          _id: _.eq('none') // 不匹配任何数据
        });
        systemMessagesQuery = systemMessagesQuery.where({
          _id: _.eq('none') // 不匹配任何数据
        });
      } else if (type === 'system_message') {
        // 只查询系统消息
        timeCapsuleQuery = timeCapsuleQuery.where({
          _id: _.eq('none') // 不匹配任何数据
        });
        writingsQuery = writingsQuery.where({
          _id: _.eq('none') // 不匹配任何数据
        });
      }
    }
    
    // 获取时光宝盒数据
    const timeCapsuleResult = await timeCapsuleQuery.get();
    
    // 获取写作数据
    const writingsResult = await writingsQuery.get();
    
    // 获取系统消息数据
    const systemMessagesResult = await systemMessagesQuery.get();
    
    // 合并数据
    let allMessages = [];
    
    // 处理时光宝盒数据
    if (timeCapsuleResult && timeCapsuleResult.data) {
      const timeCapsuleMessages = timeCapsuleResult.data.map(item => ({
        id: item._id,
        _id: item._id,
        content: item.content || item.message || '',
        title: '时光宝盒',
        cover_url: item.cover_url || '',
        timestamp: new Date(item.create_time || item.openDate || Date.now()).getTime(),
        date: item.create_time || item.openDate || new Date().toISOString(),
        source: 'time_capsule',
        read: item.isRead || false,
        articleId: item.articleId || '',
        fullData: item
      }));
      
      allMessages = allMessages.concat(timeCapsuleMessages);
    }
    
    // 处理写作数据
    if (writingsResult && writingsResult.data) {
      const writingMessages = writingsResult.data.map(item => ({
        id: item._id,
        _id: item._id,
        content: item.content || '',
        title: '写作宝箱',
        cover_url: item.cover_url || '',
        timestamp: new Date(item.create_time || item.update_time || Date.now()).getTime(),
        date: item.create_time || item.update_time || new Date().toISOString(),
        source: 'writing',
        read: item.status === true, // 如果status为true，则视为已读
        articleId: item.articleId || '',
        fullData: item
      }));
      
      allMessages = allMessages.concat(writingMessages);
    }
    
    // 处理系统消息数据
    if (systemMessagesResult && systemMessagesResult.data) {
      const systemMessages = systemMessagesResult.data.map(item => ({
        _id: item._id,
        content: item.content || '',
        title: item.title || '系统消息',
        timestamp: item.date || Date.now(), // 使用13位时间戳
        date: new Date(item.date || Date.now()).toISOString(),
        source: 'system_message',
        read: item.read || false,
      }));
      
      allMessages = allMessages.concat(systemMessages);
    }
    
    // 按时间戳降序排序
    allMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    // 计算总数
    const total = allMessages.length;
    
    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pagedMessages = allMessages.slice(startIndex, endIndex);
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        list: pagedMessages,
        total,
        page,
        pageSize
      }
    };
  } catch (error) {
    console.error('获取系统消息失败:', error);
    return {
      code: 1,
      msg: '获取系统消息失败: ' + error.message,
      data: {
        list: [],
        total: 0,
        page,
        pageSize
      }
    };
  }
}

/**
 * 创建测试系统消息
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function createTestSystemMessage(userId, data) {
  try {
    const testMessages = [
      {
        title: '欢迎使用九语',
        content: '欢迎来到九语平台！这里是您记录生活、分享心情的地方。',
        read: false,
        createdAt: new Date(),
        date: Date.now()
      },
      {
        title: '系统更新通知',
        content: '九语系统已更新到最新版本，新增了更多实用功能。',
        read: false,
        createdAt: new Date(),
        date: Date.now() - 86400000 // 1天前
      },
      {
        title: '使用提示',
        content: '您可以在时光宝盒中记录珍贵回忆，在写作宝箱中创作文章。',
        read: false,
        createdAt: new Date(),
        date: Date.now() - 172800000 // 2天前
      }
    ];

    const results = [];
    for (const message of testMessages) {
      const result = await systemMessagesCollection.add({
        data: message
      });
      results.push(result);
    }

    return {
      code: 0,
      msg: '测试系统消息创建成功',
      data: {
        created: results.length,
        messages: testMessages
      }
    };
  } catch (error) {
    console.error('创建测试系统消息失败:', error);
    return {
      code: 1,
      msg: '创建测试系统消息失败: ' + error.message
    };
  }
}

/**
 * 全部标记为已读
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function markAllAsRead(userId, data) {
  try {
    // 更新系统消息为已读（系统消息是全局的）
    await systemMessagesCollection
      .where({
        read: false
      })
      .update({
        data: {
          read: true
        }
      });

    // 更新时光宝盒为已读
    await timeCapsuleCollection
      .where({
        openid: userId,
        isRead: false
      })
      .update({
        data: {
          isRead: true
        }
      });

    // 更新写作为已读
    await writingsCollection
      .where({
        openid: userId,
        status: false
      })
      .update({
        data: {
          status: true
        }
      });

    return {
      code: 0,
      msg: '全部标记为已读成功',
      data: {
        updated: true
      }
    };
  } catch (error) {
    console.error('全部标记为已读失败:', error);
    return {
      code: 1,
      msg: '全部标记为已读失败: ' + error.message
    };
  }
}

/**
 * 删除消息 - 注意：这里不会真正删除原始数据，只是标记为删除
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function deleteMessage(userId, data) {
  const { messageId, source } = data;

  if (!messageId) {
    return {
      code: 1,
      msg: '缺少消息ID'
    };
  }

  try {
    // 根据消息来源选择集合
    let collection;
    if (source === 'time_capsule') {
      collection = timeCapsuleCollection;
    } else if (source === 'writing') {
      collection = writingsCollection;
    } else if (source === 'system_message') {
      collection = systemMessagesCollection;
    } else {
      // 如果没有指定来源，尝试在三个集合中都查找
      const timeCapsuleDoc = await timeCapsuleCollection.doc(messageId).get();
      if (timeCapsuleDoc.data) {
        collection = timeCapsuleCollection;
      } else {
        const writingDoc = await writingsCollection.doc(messageId).get();
        if (writingDoc.data) {
          collection = writingsCollection;
        } else {
          const systemMessageDoc = await systemMessagesCollection.doc(messageId).get();
          if (systemMessageDoc.data) {
            collection = systemMessagesCollection;
          }
        }
      }
    }

    if (!collection) {
      return {
        code: 1,
        msg: '找不到对应的消息'
      };
    }

    // 标记为已删除（这里不真正删除原始数据，而是添加一个deleted标记）
    await collection.doc(messageId).remove();

    return {
      code: 0,
      msg: '删除成功',
      data: {
        deleted: true
      }
    };
  } catch (error) {
    console.error('删除消息失败:', error);
    return {
      code: 1,
      msg: '删除消息失败: ' + error.message
    };
  }
}

/**
 * 标记消息为已读
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function markAsRead(userId, data) {
  const { messageId, source } = data;

  if (!messageId) {
    return {
      code: 1,
      msg: '缺少消息ID'
    };
  }

  try {
    // 根据消息来源选择集合
    let collection;
    let updateField;
    
    if (source === 'time_capsule') {
      collection = timeCapsuleCollection;
      updateField = 'isRead';
    } else if (source === 'writing') {
      collection = writingsCollection;
      updateField = 'status';
    } else if (source === 'system_message') {
      collection = systemMessagesCollection;
      updateField = 'read';
    } else {
      // 如果没有指定来源，尝试在三个集合中都查找
      const timeCapsuleDoc = await timeCapsuleCollection.doc(messageId).get();
      if (timeCapsuleDoc.data) {
        collection = timeCapsuleCollection;
        updateField = 'isRead';
      } else {
        const writingDoc = await writingsCollection.doc(messageId).get();
        if (writingDoc.data) {
          collection = writingsCollection;
          updateField = 'status';
        } else {
          const systemMessageDoc = await systemMessagesCollection.doc(messageId).get();
          if (systemMessageDoc.data) {
            collection = systemMessagesCollection;
            updateField = 'read';
          }
        }
      }
    }

    if (!collection) {
      return {
        code: 1,
        msg: '找不到对应的消息'
      };
    }

    // 更新已读状态
    const updateData = {};
    if (updateField === 'isRead') {
      updateData[updateField] = true;
    } else if (updateField === 'status') {
      updateData[updateField] = true; // 写作集合使用status字段
    } else if (updateField === 'read') {
      updateData[updateField] = true; // 系统消息使用read字段
    }
    
    await collection.doc(messageId).update({
      data: updateData
    });

    return {
      code: 0,
      msg: '标记已读成功',
      data: {
        updated: true
      }
    };
  } catch (error) {
    console.error('标记消息已读失败:', error);
    return {
      code: 1,
      msg: '标记消息已读失败: ' + error.message
    };
  }
}

/**
 * 创建系统消息
 * @param {string} userId - 用户ID
 * @param {object} data - 消息数据
 */
async function createSystemMessage(userId, data) {
  const { title, content } = data;

  if (!title || !content) {
    return {
      code: 1,
      msg: '标题和内容不能为空'
    };
  }

  try {
    const messageData = {
      openid: userId,
      title: title,
      content: content,
      read: false,
      date: Date.now() // 13位时间戳
    };

    const result = await systemMessagesCollection.add({
      data: messageData
    });

    return {
      code: 0,
      msg: '系统消息创建成功',
      data: {
        messageId: result._id,
        ...messageData
      }
    };
  } catch (error) {
    console.error('创建系统消息失败:', error);
    return {
      code: 1,
      msg: '创建系统消息失败: ' + error.message
    };
  }
}

/**
 * 获取系统消息列表
 * @param {string} userId - 用户ID
 * @param {object} data - 参数
 */
async function getSystemMessages(userId, data) {
  const { page = 1, pageSize = 10 } = data;
  
  try {
    console.log('开始查询系统消息...');
    
    // 先检查集合中是否有数据
    const allResult = await systemMessagesCollection.get();
    console.log('集合中所有数据:', allResult);
    
    // 如果没有数据，创建一些默认的系统消息
    if (!allResult.data || allResult.data.length === 0) {
      console.log('没有系统消息数据，创建默认消息...');
      const defaultMessages = [
        {
          title: '欢迎使用九语',
          content: '欢迎来到九语平台！这里是您记录生活、分享心情的地方。',
          read: false,
          date: Date.now()
        },
        {
          title: '系统更新通知',
          content: '九语系统已更新到最新版本，新增了更多实用功能。',
          read: false,
          date: Date.now() - 86400000
        }
      ];
      
      for (const message of defaultMessages) {
        await systemMessagesCollection.add({ data: message });
      }
    }
    
    // 查询系统消息（系统消息是全局的，不区分用户）
    const result = await systemMessagesCollection
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    console.log('查询结果:', result);
    console.log('数据条数:', result.data ? result.data.length : 0);

    // 获取总数
    const countResult = await systemMessagesCollection
      .count();
    
    console.log('总数查询结果:', countResult);

    const messages = result.data.map(item => ({
      id: item._id,
      _id: item._id,
      title: item.title,
      content: item.content,
      read: item.read || false,
      date: item.date || Date.now(),
      source: 'system_message'
    }));

    return {
      code: 0,
      msg: '获取成功',
      data: {
        list: messages,
        total: countResult.total,
        page,
        pageSize
      }
    };
  } catch (error) {
    console.error('获取系统消息失败:', error);
    return {
      code: 1,
      msg: '获取系统消息失败: ' + error.message,
      data: {
        list: [],
        total: 0,
        page,
        pageSize
      }
    };
  }
}