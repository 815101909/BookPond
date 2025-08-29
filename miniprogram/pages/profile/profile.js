// Profile页面逻辑
console.log('Profile页面JS文件加载');

const { authAPI, checkinAPI, messengerAPI, sentencesAPI, writingAPI } = require('../../utils/cloud-api.js');

// 本地存储键名
const READ_MESSAGES_KEY = 'read_messages';

// 本地存储辅助函数
function getReadMessages() {
  try {
    const readMessages = wx.getStorageSync(READ_MESSAGES_KEY);
    return readMessages ? JSON.parse(readMessages) : [];
  } catch (error) {
    console.error('读取已读消息失败:', error);
    return [];
  }
}

function saveReadMessages(readMessages) {
  try {
    wx.setStorageSync(READ_MESSAGES_KEY, JSON.stringify(readMessages));
  } catch (error) {
    console.error('保存已读消息失败:', error);
  }
}

function markMessageAsReadLocal(messageId) {
  const readMessages = getReadMessages();
  if (!readMessages.includes(messageId)) {
    readMessages.push(messageId);
    saveReadMessages(readMessages);
  }
}

// 通用临时链接处理函数
async function getTemporaryFileUrl(fileUrl, type = 'file') {
  if (!fileUrl) {
    console.log(`${type}链接为空，使用占位内容`);
    return getPlaceholderUrl(type);
  }

  try {
    if (fileUrl.startsWith('cloud://')) {
      try {
        // 确保全局 wx.cloud 已初始化
        if (!wx.cloud._initialized) {
          await new Promise((resolve) => {
            wx.cloud.init({
              env: 'cloud1-1gsyt78b92c539ef',
              traceUser: true
            });
            setTimeout(resolve, 1000); // 等待初始化完成
          });
        }
        
        // 跨环境创建 Cloud 实例
        const cloudInstance = new wx.cloud.Cloud({
          identityless: true,
          resourceAppid: 'wx85d92d28575a70f4',
          resourceEnv: 'cloud1-1gsyt78b92c539ef',
        });
        await cloudInstance.init();

        const result = await cloudInstance.getTempFileURL({
          fileList: [fileUrl],
        });

        if (result.fileList?.[0]?.tempFileURL) {
          return result.fileList[0].tempFileURL;
        } else {
          console.error(`${type}云链接转换失败:`, result);
          return getPlaceholderUrl('error_' + type);
        }
      } catch (err) {
        console.error(`${type}云链接转换异常:`, err);
        return getPlaceholderUrl('error_' + type);
      }
    }

    if (fileUrl.startsWith('http')) {
      console.log(`${type}链接为HTTP地址:`, fileUrl);
      return fileUrl;
    }

    console.log(`${type}链接格式未知，使用占位内容。原始链接:`, fileUrl);
    return getPlaceholderUrl(type);
  } catch (error) {
    console.error(`处理${type}链接时出错:`, error);
    return getPlaceholderUrl('error_' + type);
  }
}

// 占位符链接生成函数
function getPlaceholderUrl(type) {
  if (type.includes('image')) {
    return `https://via.placeholder.com/800x600.png?text=${type}`;
  } else if (type.includes('audio')) {
    return `https://dummyimage.com/600x100/cccccc/000000&text=Audio+Placeholder`;
  } else if (type.includes('video')) {
    return `https://dummyimage.com/800x450/aaaaaa/000000&text=Video+Placeholder`;
  } else {
    return `https://dummyimage.com/600x100/999999/ffffff&text=File+${type}`;
  }
}

// 添加全局计时器变量
let statsRefreshTimer = null;

Page({
  data: {
    // 是否已登录
    isLoggedIn: false,
    
    // 用户信息
    userInfo: {
      avatarUrl: '',
      nickName: '小舟学者',
      level: 3,
      signature: '每天进步一点点，离梦想更近一步',
      avatarColor: '' // 用于存储默认头像的颜色
    },
    
    // 默认头像颜色选项
    avatarColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFC145', '#9370DB', '#56C596', '#FF9A8B', '#725AC1', '#699E3E', '#DE5B6D'],
    
    // 会员信息
    membershipInfo: {
      isMember: false,
      startDate: '',
      endDate: ''
    },
    
    // 水波纹效果数据
    showRipple: false,
    rippleTop: 0,
    rippleLeft: 0,
    
    // 学习打卡天数
    checkinDays: 0,
    totalCheckinDays: 0,
    
    // 未读消息数
    unreadMessages: 0,
    
    // 抽签相关
    showFortuneModal: false,
    fortuneContent: '',
    
    // 系统消息
    systemMessages: [],
    
    // 读一读统计数据
    readStats: {
      today: 0,
      articles: 0
    },
    
    // 写一写统计数据
    writeStats: {
      today: 0,
      articles: 0
    },
    
    // 听一听统计数据
    listenStats: {
      today: 0,
      audios: 0
    },
    
    // 说一说统计数据
    speakStats: {
      today: 0,
      exercises: 0
    },
    
    // 添加总学习时间计数器
    totalStudyTime: 0,

    // 个人主页
    writings: [], // 写作列表
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },
  
  onLoad: function() {
    console.log('Profile页面加载');
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      });
    } else {
      // 如果本地没有存储用户信息，则使用默认值
      // 为默认头像随机选择一个颜色
      const randomColorIndex = Math.floor(Math.random() * this.data.avatarColors.length);
      const defaultUserInfo = {
        avatarUrl: '',
        nickName: '小舟学者',
        level: 3,
        signature: '每天进步一点点，离梦想更近一步',
        avatarColor: this.data.avatarColors[randomColorIndex]
      };
      
      this.setData({
        userInfo: defaultUserInfo
      });
      
      // 保存到本地
      wx.setStorageSync('userInfo', defaultUserInfo);
    }
    
    // 获取本地存储的会员信息
    const membershipInfo = wx.getStorageSync('membershipInfo');
    if (membershipInfo) {
      this.setData({
        membershipInfo: membershipInfo
      });
    }
    
    // 加载系统消息
    this.loadSystemMessages();

    // 加载用户学习统计数据
    this.loadStudyStats();

    // 开始周期性刷新统计数据
    this.startStatsRefreshTimer();

    // 测试心灵抽签功能是否正常
    console.log('心灵抽签功能状态：', typeof this.onFortuneDraw === 'function');

    // 加载写作列表
    this.loadWritings();
  },

  // 导航到登录页面
  navigateToLogin: function() {
    wx.reLaunch({
      url: '/pages/login/login'
    });
  },

  // 复制用户ID
  copyUserId: function() {
    if (!this.data.userInfo.userId) {
      wx.showToast({
        title: '用户ID不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.setClipboardData({
      data: this.data.userInfo.userId,
      success: function() {
        wx.showToast({
          title: '用户ID已复制',
          icon: 'success'
        });
      },
      fail: function() {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  // 退出登录
  logout: function() {
    // 清除本地存储的用户数据
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('membershipInfo');
    wx.clearStorageSync(); // 清除所有本地存储
    
    // 更新页面数据
    this.setData({
      isLoggedIn: false,
      userInfo: {
        avatarUrl: '',
        nickName: '小舟学者',
        signature: '每天进步一点点，离梦想更近一步',
        avatarColor: this.data.avatarColors[Math.floor(Math.random() * this.data.avatarColors.length)]
      },
      membershipInfo: {
        isMember: false,
        startDate: '',
        endDate: ''
      }
    });
    
    // 导航到登录页面
    wx.reLaunch({
      url: '/pages/login/login'
    });
  },

  onShow: function() {
    // 清理旧的本地存储数据（一次性操作）
    try {
      wx.removeStorageSync('readSystemMessages');
    } catch (e) {
      // 忽略错误
    }
    
    // 每次页面显示时检查登录状态
    this.checkLoginStatus().then(() => {
      // 如果用户未登录，确保清除本地存储的用户信息和会员信息
      if (!this.data.isLoggedIn) {
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('membershipInfo');
        this.setData({
          userInfo: {},
          membershipInfo: {}
        });
      }
    });
    
    // 每次页面显示时更新学习统计数据
    this.loadStudyStats();
    
    // 重新加载系统消息
    this.loadSystemMessages();
    
    // 重新启动统计数据刷新计时器
    this.startStatsRefreshTimer();
  },
  
  onHide: function() {
    // 当页面隐藏时停止刷新计时器
    this.stopStatsRefreshTimer();
  },
  
  onUnload: function() {
    // 当页面卸载时停止刷新计时器
    this.stopStatsRefreshTimer();
  },

  // 检查登录状态
  async checkLoginStatus() {
    try {
      const result = await authAPI.checkSession();

      if (result.result && result.result.code === 0) {
        // 已登录，更新用户信息
        const userData = result.result.data;
        
        // 处理头像URL，如果是云存储链接则转换为临时链接
        let avatarUrl = userData.avatar || '';
        if (avatarUrl && avatarUrl.startsWith('cloud://')) {
          try {
            avatarUrl = await getTemporaryFileUrl(avatarUrl, 'avatar');
          } catch (error) {
            console.error('头像临时链接转换失败:', error);
            avatarUrl = '';
          }
        }
        
        // 构建用户信息
        const userInfo = {
          avatarUrl: avatarUrl,
          nickName: userData.nickname || '小舟学者',
          level: userData.level || 1,
          signature: userData.signature || '每天进步一点点，离梦想更近一步',
          avatarColor: this.data.avatarColors[Math.floor(Math.random() * this.data.avatarColors.length)],
          userId: userData.userId || '' // 添加userId字段
        };

        // 构建会员信息
        const membershipInfo = userData.membershipInfo || {
          isMember: false,
          startDate: '',
          endDate: ''
        };

        // 格式化日期
        if (membershipInfo.startDate) {
          membershipInfo.startDate = this.formatDate(membershipInfo.startDate);
        }
        if (membershipInfo.endDate) {
          membershipInfo.endDate = this.formatDate(membershipInfo.endDate);
        }

        // 设置页面数据
        this.setData({
          isLoggedIn: true,
          userInfo: userInfo,
          membershipInfo: membershipInfo,
          checkinDays: userData.checkinDays || 0,
          totalCheckinDays: userData.totalCheckinDays || 0
        });

        // 保存到本地存储
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('membershipInfo', membershipInfo);

        console.log('用户数据更新成功:', userInfo);
      } else {
        // 未登录或登录失效
        this.setData({
          isLoggedIn: false,
          userInfo: {},
          membershipInfo: {}
        });
        // 清除本地存储的用户数据
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('membershipInfo');
        console.log('用户未登录或登录已失效');
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 发生错误时，设置为未登录状态
      this.setData({
        isLoggedIn: false,
        userInfo: {},
        membershipInfo: {}
      });
      // 清除本地存储的用户数据
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('membershipInfo');
    }
  },
  
  // 启动周期性刷新统计数据的计时器
  startStatsRefreshTimer: function() {
    // 先清除可能存在的计时器
    this.stopStatsRefreshTimer();
    
    // 每10秒刷新一次统计数据
    statsRefreshTimer = setInterval(() => {
      this.loadStudyStats();
    }, 10000); // 10秒
  },
  
  // 停止统计数据刷新计时器
  stopStatsRefreshTimer: function() {
    if (statsRefreshTimer) {
      clearInterval(statsRefreshTimer);
      statsRefreshTimer = null;
    }
  },
  
  // 加载用户学习统计数据
  loadStudyStats: function() {
    // 获取当前日期
    const today = new Date();
    const todayDateString = today.toDateString();
    
    // 尝试从新格式获取今日统计数据
    const newFormatStats = wx.getStorageSync(`studyStats_${todayDateString}`) || {
      readTime: 0,
      writeTime: 0,
      listenTime: 0,
      speakTime: 0,
      totalTime: 0
    };
    
    // 兼容旧格式数据
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const oldFormatStats = wx.getStorageSync('studyStats') || {};
    const oldTodayStats = oldFormatStats[dateStr] || {
      read: 0,
      write: 0,
      listen: 0,
      speak: 0,
      readArticles: 0,
      writeArticles: 0,
      listenAudios: 0,
      speakExercises: 0
    };
    
    // 合并新旧格式数据，优先使用新格式
    const todayStats = {
      read: newFormatStats.readTime || oldTodayStats.read || 0,
      write: newFormatStats.writeTime || oldTodayStats.write || 0,
      listen: newFormatStats.listenTime || oldTodayStats.listen || 0,
      speak: newFormatStats.speakTime || oldTodayStats.speak || 0,
      readArticles: oldTodayStats.readArticles || 0,
      writeArticles: oldTodayStats.writeArticles || 0,
      listenAudios: oldTodayStats.listenAudios || 0,
      speakExercises: oldTodayStats.speakExercises || 0
    };
    
    // 获取总统计数据（仍从旧格式获取）
    const totalStats = oldFormatStats.total || {
      readArticles: 0,
      writeArticles: 0,
      listenAudios: 0,
      speakExercises: 0
    };
    
    // 计算总学习时间
    const totalStudyTime = todayStats.read + todayStats.write + todayStats.listen + todayStats.speak;
    
    // 更新页面数据
    this.setData({
      'readStats.today': todayStats.read,
      'writeStats.today': todayStats.write,
      'listenStats.today': todayStats.listen,
      'speakStats.today': todayStats.speak,
      'readStats.articles': totalStats.readArticles,
      'writeStats.articles': totalStats.writeArticles,
      'listenStats.audios': totalStats.listenAudios,
      'speakStats.exercises': totalStats.speakExercises,
      'totalStudyTime': totalStudyTime
    });
    
    console.log('学习统计数据已加载', {
      新格式: newFormatStats,
      旧格式今日: oldTodayStats,
      合并后: todayStats,
      总学习时间: totalStudyTime
    });
  },
  
  // 更新学习统计数据（供其他页面调用）
  updateStudyStats: function(type, duration, count = 0) {
    // 获取当前日期
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 从本地存储获取学习统计数据
    let studyStats = wx.getStorageSync('studyStats') || {};
    
    // 确保当天数据和总数据存在
    if (!studyStats[dateStr]) {
      studyStats[dateStr] = {
        read: 0,
        write: 0,
        listen: 0,
        speak: 0,
        readArticles: 0,
        writeArticles: 0,
        listenAudios: 0,
        speakExercises: 0
      };
    }
    
    if (!studyStats.total) {
      studyStats.total = {
        readArticles: 0,
        writeArticles: 0,
        listenAudios: 0,
        speakExercises: 0
      };
    }
    
    // 更新学习时长
    if (duration) {
      studyStats[dateStr][type] = (studyStats[dateStr][type] || 0) + duration;
    }
    
    // 更新学习项目数量
    if (count) {
      const countType = `${type}${type === 'read' ? 'Articles' : type === 'write' ? 'Articles' : type === 'listen' ? 'Audios' : 'Exercises'}`;
      studyStats[dateStr][countType] = (studyStats[dateStr][countType] || 0) + count;
      studyStats.total[countType] = (studyStats.total[countType] || 0) + count;
    }
    
    // 保存到本地存储
    wx.setStorageSync('studyStats', studyStats);
    
    // 更新页面数据
    const dataUpdate = {};
    dataUpdate[`${type}Stats.today`] = studyStats[dateStr][type];
    
    if (count) {
      const statType = type === 'read' ? 'articles' : type === 'write' ? 'articles' : type === 'listen' ? 'audios' : 'exercises';
      dataUpdate[`${type}Stats.${statType}`] = studyStats.total[`${type}${type === 'read' ? 'Articles' : type === 'write' ? 'Articles' : type === 'listen' ? 'Audios' : 'Exercises'}`];
    }
    
    // 计算总学习时间
    const totalStudyTime = 
      (studyStats[dateStr].read || 0) + 
      (studyStats[dateStr].write || 0) + 
      (studyStats[dateStr].listen || 0) + 
      (studyStats[dateStr].speak || 0);
      
    dataUpdate['totalStudyTime'] = totalStudyTime;
    
    this.setData(dataUpdate);
    
    console.log(`${type}学习统计数据已更新`, studyStats[dateStr], '总学习时间:', totalStudyTime);
    
    // 如果总时长达到特定标准，自动触发打卡
    if (totalStudyTime >= 30 && !studyStats[dateStr].checkedIn) {
      // 不再自动打卡，只标记为已完成学习目标
      studyStats[dateStr].checkedIn = true;
      wx.setStorageSync('studyStats', studyStats);
      
      // 提示用户可以手动打卡
      wx.showToast({
        title: '已达到学习目标，可以打卡啦',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  // 点击头像上传
  async uploadAvatar() {
    if (!this.data.isLoggedIn) {
      this.navigateToLogin();
      return;
    }
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        // 获取选中图片的临时路径
        const tempFilePath = res.tempFilePaths[0];
        
        // 显示上传中
        wx.showLoading({
          title: '上传中...',
          mask: true
        });

        // 上传图片到云存储
        const cloudPath = `avatars/${that.data.userInfo.nickName || 'user'}_${Date.now()}${tempFilePath.match(/\.[^.]+?$/)[0]}`;
        
        try {     
          // 跨环境创建 Cloud 实例
          const cloudInstance = new wx.cloud.Cloud({
            identityless: true,
            resourceAppid: 'wx85d92d28575a70f4',
            resourceEnv: 'cloud1-1gsyt78b92c539ef',
          });
          await cloudInstance.init();
          
          const uploadResult = await cloudInstance.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath,
          });
          
          // 获取图片的云存储地址
          const fileID = uploadResult.fileID;
          
          try {
            // 调用云函数更新用户头像
            const result = await authAPI.updateUserInfo('avatar', fileID);

              if (result.result.code === 0) {
                // 转换云存储链接为临时链接用于显示
                let displayAvatarUrl = fileID;
                try {
                  displayAvatarUrl = await getTemporaryFileUrl(fileID, 'avatar');
                } catch (error) {
                  console.error('头像临时链接转换失败:', error);
                }
                
                // 更新本地显示
                const userInfo = that.data.userInfo;
                userInfo.avatarUrl = displayAvatarUrl;
                that.setData({
                  userInfo: userInfo
                });
                wx.setStorageSync('userInfo', userInfo);
                
                wx.showToast({
                  title: '头像更新成功',
                  icon: 'success'
                });
            } else {
              throw new Error(result.result.msg);
            }
          } catch (error) {
            console.error('更新头像失败:', error);
            wx.showToast({
              title: '更新失败',
              icon: 'error'
            });
          }
        } catch (uploadError) {
          console.error('上传图片失败:', uploadError);
          wx.showToast({
            title: '上传失败',
            icon: 'error'
          });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },
  
  // 编辑个人资料
  editProfile() {
    if (!this.data.isLoggedIn) {
      this.navigateToLogin();
      return;
    }
    const that = this;
    wx.showActionSheet({
      itemList: ['修改头像', '修改昵称', '修改个性签名'],
      success: function(res) {
        if (res.tapIndex === 0) {
          // 修改头像
          that.uploadAvatar();
        } else if (res.tapIndex === 1) {
          // 修改昵称
          wx.showModal({
            title: '修改昵称',
            editable: true,
            placeholderText: '请输入新的昵称',
            content: that.data.userInfo.nickName || '',
            success: async function(res) {
              if (res.confirm && res.content) {
                wx.showLoading({
                  title: '更新中...',
                  mask: true
                });

                try {
                  // 调用云函数更新昵称
                  const result = await authAPI.updateUserInfo('nickname', res.content);

                  if (result.result.code === 0) {
                    const userInfo = that.data.userInfo;
                    userInfo.nickName = res.content;
                    that.setData({
                      userInfo: userInfo
                    });
                    wx.setStorageSync('userInfo', userInfo);
                    
                    wx.showToast({
                      title: '昵称已更新',
                      icon: 'success'
                    });
                  } else {
                    throw new Error(result.result.msg);
                  }
                } catch (error) {
                  console.error('更新昵称失败:', error);
                  wx.showToast({
                    title: '更新失败',
                    icon: 'error'
                  });
                } finally {
                  wx.hideLoading();
                }
              }
            }
          });
        } else if (res.tapIndex === 2) {
          // 修改个性签名
          wx.showModal({
            title: '修改个性签名',
            editable: true,
            placeholderText: '请输入新的个性签名',
            content: that.data.userInfo.signature || '',
            success: async function(res) {
              if (res.confirm && res.content) {
                wx.showLoading({
                  title: '更新中...',
                  mask: true
                });

                try {
                  // 调用云函数更新个性签名
                  const result = await authAPI.updateUserInfo('signature', res.content);

                  if (result.result.code === 0) {
                    const userInfo = that.data.userInfo;
                    userInfo.signature = res.content;
                    that.setData({
                      userInfo: userInfo
                    });
                    wx.setStorageSync('userInfo', userInfo);
                    
                    wx.showToast({
                      title: '签名已更新',
                      icon: 'success'
                    });
                  } else {
                    throw new Error(result.result.msg);
                  }
                } catch (error) {
                  console.error('更新签名失败:', error);
                  wx.showToast({
                    title: '更新失败',
                    icon: 'error'
                  });
                } finally {
                  wx.hideLoading();
                }
              }
            }
          });
        }
      },
      fail: function(res) {
        console.log('showActionSheet fail:', res);
      }
    });
  },
  
  // 导航到我的排行
  navigateToRankings() {
    wx.navigateTo({
      url: '/pages/rankings/rankings'
    });
  },
  
  // 导航到我的客服
  navigateToCustomerService() {
    wx.navigateTo({
      url: '/pages/customer-service/customer-service'
    });
  },

  // 导航到系统设置页面
  navigateToSettings() {
    // 展示设置选项列表
    wx.showActionSheet({
      itemList: ['消息通知设置', '清除缓存', '关于我们'],
      success: (res) => {
        // 根据用户选择执行不同操作
        switch(res.tapIndex) {
          case 0: 
            this.setNotifications();
            break;
          case 1:
            this.clearCache();
            break;
          case 2:
            this.showAboutUs();
            break;
        }
      }
    });
  },

  // 消息通知设置
  setNotifications() {
    wx.showActionSheet({
      itemList: ['全部通知', '仅重要通知', '关闭全部通知'],
      success: (res) => {
        let mode = '';
        let message = '';
        
        switch(res.tapIndex) {
          case 0:
            mode = 'all';
            message = '已开启全部通知';
            break;
          case 1:
            mode = 'important';
            message = '已设置仅接收重要通知';
            break;
          case 2:
            mode = 'none';
            message = '已关闭全部通知';
            break;
        }
        
        // 存储设置到本地
        wx.setStorageSync('notificationSettings', {
          mode: mode
        });
        
        wx.showToast({
          title: message,
          icon: 'success'
        });
      }
    });
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除应用缓存吗？这将不会删除您的个人数据和设置。',
      success: (res) => {
        if (res.confirm) {
          // 模拟清除缓存
          setTimeout(() => {
            wx.showToast({
              title: '缓存已清除',
              icon: 'success'
            });
          }, 1000);
        }
      }
    });
  },

  // 关于我们
  showAboutUs() {
    wx.showModal({
      title: '关于我们',
      content: '摇小舟 v1.0.0\n\n摇小舟通过语言重构思维，以听说读写为支点，撬动跨文化思辨、逻辑推演与创意表达。和我们一起小舟摇书池！\n\n©2025 摇小舟团队',
      showCancel: false,
      confirmText: '了解更多'
    });
  },

  // 加载系统消息
  async loadSystemMessages() {
    if (!this.data.isLoggedIn) {
      // 未登录时使用默认消息
      this.calculateUnreadMessages();
      return;
    }

    try {
      const result = await messengerAPI.getSystemMessages(1, 50);

      if (result.result && result.result.code === 0) {
        const messages = result.result.data.list || [];
        
        // 从本地存储读取已读状态
        const readMessages = getReadMessages();
        
        // 转换消息格式，使用本地存储的已读状态
        const formattedMessages = messages.map(msg => ({
            id: msg._id,
            title: msg.title,
            content: msg.content,
            date: this.formatDate(msg.date || msg.createdAt),
            read: readMessages.includes(msg._id)
          }));

        this.setData({
          systemMessages: formattedMessages
        });
        
        // 计算未读消息数
        this.calculateUnreadMessages();
      } else {
        console.error('获取系统消息失败:', result.result?.msg);
        // 失败时使用默认消息
        this.calculateUnreadMessages();
      }
    } catch (error) {
      console.error('加载系统消息出错:', error);
      // 出错时使用默认消息
      this.calculateUnreadMessages();
    }
  },

  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '';
    
    // 处理时间戳格式
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;
    
    // 自定义时间格式化，确保0点显示为0而不是12
    // 只返回日期部分，不包含时间
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}年${month}月${day}日`;
    
  },

  // 标记消息为已读
  markMessageAsRead(messageId, index) {
    // 标记消息为本地已读
    markMessageAsReadLocal(messageId);
    
    // 更新本地数据
    let updatedMessages = [...this.data.systemMessages];
    updatedMessages[index].read = true;
    
    this.setData({
      systemMessages: updatedMessages
    });
    
    // 重新计算未读消息数并更新tabbar红点
    this.calculateUnreadMessages();
    
    console.log('消息已标记为已读');
  },

  // 导航到系统消息页面
  navigateToMessages() {
    if (!this.data.isLoggedIn) {
      this.navigateToLogin();
      return;
    }
    const that = this;
    
    if (that.data.unreadMessages > 0) {
      // 有未读消息，让用户选择查看方式
      wx.showActionSheet({
        itemList: ['查看未读消息', '查看全部消息'],
        success: function(res) {
          if (res.tapIndex === 0) {
            // 查看第一条未读消息
            const unreadIndex = that.data.systemMessages.findIndex(msg => !msg.read);
            if (unreadIndex !== -1) {
              that.showMessageDialog(unreadIndex);
            }
          } else if (res.tapIndex === 1) {
            // 跳转到消息列表页面
            wx.navigateTo({
              url: '/pages/messages/messages'
            });
          }
        }
      });
    } else {
      // 没有未读消息，直接跳转到消息列表页面
      wx.navigateTo({
        url: '/pages/messages/messages'
      });
    }
  },
  
  // 显示消息对话框
  showMessageDialog(index) {
    if (index >= this.data.systemMessages.length) {
      // 所有消息都已显示
      this.calculateUnreadMessages();
      
      // 如果没有未读消息了，显示提示
      if (this.data.unreadMessages === 0) {
        wx.showToast({
          title: '所有消息已读',
          icon: 'success'
        });
      }
      return;
    }
    
    const that = this;
    const message = this.data.systemMessages[index];
    
    wx.showModal({
      title: message.title,
      content: `${message.date}\n\n${message.content}`,
      cancelText: '标为已读',
      confirmText: '下一条',
      success: function(res) {
        // 标记消息为已读
        that.markMessageAsRead(message.id, index);
        
        if (res.confirm) {
          // 用户点击"下一条"，显示下一条未读消息
          const nextUnreadIndex = that.data.systemMessages.findIndex((msg, idx) => !msg.read && idx > index);
          
          if (nextUnreadIndex !== -1) {
            // 有下一条未读消息
            that.showMessageDialog(nextUnreadIndex);
          } else {
            // 没有下一条未读消息了
            that.calculateUnreadMessages();
            
            wx.showToast({
              title: '所有消息已读',
              icon: 'success'
            });
          }
        } else {
          // 用户点击"标为已读"，结束查看
          that.calculateUnreadMessages();
        }
      }
    });
  },
  
  // 计算未读消息数
  calculateUnreadMessages() {
    const unreadCount = this.data.systemMessages.filter(msg => !msg.read).length;
    
    this.setData({
      unreadMessages: unreadCount
    });
    
    // 根据未读消息数量控制tabbar红点
    if (unreadCount > 0) {
      wx.showTabBarRedDot({
        index: 2 // profile页面在tabbar中的索引
      });
    } else {
      wx.hideTabBarRedDot({
        index: 2
      });
    }
  },

  // 导航到学习打卡页面
  navigateToStudyCheckin() {
    // 跳转到日历打卡页面
    wx.navigateTo({
      url: '/pages/calendar/calendar'
    });
  },
  
  // 生成日历数据
  generateCalendarData(year, month, currentDay) {
    return new Promise((resolve, reject) => {
      // 获取当月第一天是星期几
      const firstDay = new Date(year, month - 1, 1).getDay();
      
      // 获取当月天数
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // 获取上个月天数
      const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
      
      // 构建日历数据
      let days = [];
      
      // 添加上个月的最后几天
      for (let i = 0; i < firstDay; i++) {
        const day = daysInPrevMonth - firstDay + i + 1;
        days.push({
          day,
          isCurrentMonth: false,
          isToday: false,
          isChecked: false
        });
      }
      
      // 添加当月的日期
      for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === currentDay;
        days.push({
          day: i,
          isCurrentMonth: true,
          isToday,
          isChecked: false // 先默认为未打卡，后续通过API获取打卡记录后再更新
        });
      }
      
      // 添加下个月的前几天
      const remainingCells = 42 - days.length;
      for (let i = 1; i <= remainingCells; i++) {
        days.push({
          day: i,
          isCurrentMonth: false,
          isToday: false,
          isChecked: false
        });
      }
      
      // 调用云函数获取打卡记录
      checkinAPI.getCheckinRecords(year, month).then(res => {
        if (res.result && res.result.code === 0) {
          const records = res.result.data.records;
          
          // 更新打卡记录
          records.forEach(record => {
            const dateParts = record.date.split('-');
            const day = parseInt(dateParts[2]);
            
            // 找到对应的日期，标记为已打卡
            const dayIndex = firstDay + day - 1;
            if (dayIndex >= 0 && dayIndex < days.length && days[dayIndex].isCurrentMonth) {
              days[dayIndex].isChecked = true;
            }
          });
        }
        
        // 构建日历数据对象
        const calendarData = {
          year,
          month,
          days,
          checkinDays: this.data.checkinDays,
          totalCheckinDays: this.data.totalCheckinDays
        };
        
        resolve(calendarData);
      }).catch(err => {
        console.error('获取打卡记录失败:', err);
        
        // 构建日历数据对象（无打卡记录）
        const calendarData = {
          year,
          month,
          days,
          checkinDays: this.data.checkinDays,
          totalCheckinDays: this.data.totalCheckinDays
        };
        
        resolve(calendarData);
      });
    });
  },

  // 显示日历对话框
  async showCalendarDialog(calendarData, currentDay) {
    // 构建日历视图
    let calendarView = `${calendarData.year}年${calendarData.month}月\n\n`;
    calendarView += '日 一 二 三 四 五 六\n';
    
    // 将日期数据按每行7个进行分组
    for (let i = 0; i < calendarData.days.length; i += 7) {
      const weekDays = calendarData.days.slice(i, i + 7);
      let weekRow = '';
      
      weekDays.forEach(day => {
        // 当前月份的日期
        if (day.isCurrentMonth) {
          if (day.isToday) {
            // 今天
            weekRow += day.isChecked ? '◉' : '○';
          } else {
            // 其他日期
            weekRow += day.isChecked ? '●' : '·';
          }
        } else {
          // 非当前月份
          weekRow += ' ';
        }
        weekRow += ' ';
      });
      
      calendarView += weekRow + '\n';
    }
    
    // 添加打卡统计
    calendarView += `\n连续打卡: ${calendarData.checkinDays}天`;
    calendarView += `\n总打卡: ${calendarData.totalCheckinDays}天`;
    
    // 显示日历对话框
    wx.showModal({
      title: '打卡日历',
      content: calendarView,
      confirmText: '查看详情',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          this.showMonthlyCheckinRecord(calendarData);
        }
      }
    });
  },
  
  // 执行今日打卡
  checkInToday(day) {
    const today = new Date();
    const currentDay = today.getDate();
    
    console.log('执行今日打卡:', { day, currentDay });
    
    if (day !== currentDay) {
      wx.showToast({
        title: '只能打卡当天',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '今日打卡',
      content: '确定要完成今日打卡吗？',
      confirmText: '确定打卡',
      success: (res) => {
        if (res.confirm) {
          this.performCheckIn();
        }
      }
    });
  },

  // 执行打卡操作
  performCheckIn() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '打卡中...',
      mask: true
    });
    
    // 先检查用户是否存在，如果不存在则创建
    checkinAPI.checkAndCreateUser().then(res => {
      if (res.result && res.result.code === 0) {
        console.log('用户检查/创建成功:', res.result);
        
        // 继续执行打卡操作
        this.executeCheckIn();
      } else {
        wx.hideLoading();
        console.error('用户检查/创建失败:', res);
        
        wx.showToast({
          title: '打卡失败，请重试',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('用户检查/创建失败:', err);
      
      wx.showToast({
        title: '打卡失败，请重试',
        icon: 'none'
      });
    });
  },
  
  // 执行打卡
  executeCheckIn() {
    // 调用云函数进行打卡
    checkinAPI.checkIn(this.data.totalStudyTime || 0).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const data = res.result.data;
        
        // 更新页面数据
        this.setData({
          checkinDays: data.checkinDays,
          totalCheckinDays: data.totalCheckinDays
        });
        
        // 显示成功提示
        wx.showToast({
          title: '打卡成功',
          icon: 'success'
        });
      } else {
        console.error('打卡失败:', res);
        wx.showToast({
          title: res.result?.msg || '打卡失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('调用云函数失败:', err);
      wx.showToast({
        title: '打卡失败，请重试',
        icon: 'none'
      });
    });
  },
  
  // 显示本月打卡记录
  showMonthlyCheckinRecord(calendarData) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 调用云函数获取月度打卡统计
    checkinAPI.getCheckinRecords(calendarData.year, calendarData.month).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const records = res.result.data.records;
        
        if (records.length === 0) {
          wx.showModal({
            title: '本月打卡记录',
            content: `${calendarData.year}年${calendarData.month}月暂无打卡记录`,
            showCancel: false,
            confirmText: '我知道了'
          });
          return;
        }
        
        // 获取已打卡的日期
        const checkedDays = records.map(record => {
          const dateParts = record.date.split('-');
          return parseInt(dateParts[2]);
        }).sort((a, b) => a - b);
        
        // 将日期分组显示
        const dayGroups = [];
        let currentGroup = [];
        
        checkedDays.forEach(d => {
          if (currentGroup.length === 0) {
            currentGroup.push(d);
          } else if (d === currentGroup[currentGroup.length - 1] + 1) {
            currentGroup.push(d);
          } else {
            dayGroups.push(currentGroup);
            currentGroup = [d];
          }
        });
        
        if (currentGroup.length > 0) {
          dayGroups.push(currentGroup);
        }
        
        // 生成打卡记录描述
        let checkinRecord = `${calendarData.year}年${calendarData.month}月打卡记录：\n\n`;
        
        dayGroups.forEach(group => {
          if (group.length === 1) {
            checkinRecord += `${calendarData.month}月${group[0]}日\n`;
          } else {
            checkinRecord += `${calendarData.month}月${group[0]}日至${calendarData.month}月${group[group.length - 1]}日\n`;
          }
        });
        
        // 显示打卡记录
        wx.showModal({
          title: '本月打卡记录',
          content: checkinRecord,
          showCancel: false,
          confirmText: '我知道了',
          success: (res) => {
            // 如果当天还未打卡，提示用户
            const today = new Date();
            const currentDay = today.getDate();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();
            
            // 只有当前月才提示打卡
            if (calendarData.year === currentYear && calendarData.month === currentMonth && !checkedDays.includes(currentDay)) {
              wx.showModal({
                title: '今日打卡',
                content: '您今天还未完成打卡，是否现在打卡？',
                confirmText: '立即打卡',
                cancelText: '稍后再说',
                success: (res) => {
                  if (res.confirm) {
                    this.checkInToday(currentDay);
                  }
                }
              });
            }
          }
        });
      } else {
        wx.showModal({
          title: '获取打卡记录失败',
          content: '无法获取本月打卡记录，请稍后再试',
          showCancel: false,
          confirmText: '我知道了'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获取打卡记录失败:', err);
      wx.showModal({
        title: '获取打卡记录失败',
        content: '无法获取本月打卡记录，请稍后再试',
        showCancel: false,
        confirmText: '我知道了'
      });
    });
  },

  // 导航到会员页面
  navigateToMembership() {
    if (!this.data.isLoggedIn) {
      this.navigateToLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/membership/membership'
    });
  },
  
  // 显示会员权益
  showMembershipBenefits() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 模拟从API获取会员权益信息
    setTimeout(() => {
      wx.hideLoading();
      
      wx.showModal({
        title: '会员权益',
        content: '更多会员权益详情请前往会员页面查看',
        showCancel: false,
        confirmText: '前往会员页面',
        success: (res) => {
          if (res.confirm) {
            this.navigateToMembership();
          }
        }
      });
    }, 500);
  },
  
  // 购买会员
  purchaseMembership(type) {
    const membershipTypes = ['月度会员', '季度会员', '年度会员'];
    const membershipPrices = ['¥28', '¥78', '¥268'];
    const membershipDays = [30, 90, 365];
    
    wx.showModal({
      title: '购买' + membershipTypes[type],
      content: `您选择了${membershipTypes[type]}，价格${membershipPrices[type]}，确认购买吗？`,
      success: (res) => {
        if (res.confirm) {
          // 模拟购买过程，实际应用中应该调用支付API
          wx.showLoading({
            title: '处理中...',
          });
          
          setTimeout(() => {
            wx.hideLoading();
            
            // 创建会员开始和结束日期
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + membershipDays[type]);
            
            // 格式化日期
            const startDateStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
            const endDateStr = `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`;
            
            // 更新会员信息
            const membershipInfo = {
              isMember: true,
              startDate: startDateStr,
              endDate: endDateStr
            };
            
            // 保存会员信息到本地和页面数据
            wx.setStorageSync('membershipInfo', membershipInfo);
            this.setData({
              membershipInfo: membershipInfo
            });
            
            wx.showToast({
              title: '购买成功',
              icon: 'success'
            });
          }, 1500);
        }
      }
    });
  },
  
  // 续费会员
  renewMembership() {
    wx.showActionSheet({
      itemList: ['月度续费 ¥28', '季度续费 ¥78', '年度续费 ¥268'],
      success: (res) => {
        const renewalTypes = ['月度', '季度', '年度'];
        const renewalPrices = ['¥28', '¥78', '¥268'];
        const renewalDays = [30, 90, 365];
        
        wx.showModal({
          title: renewalTypes[res.tapIndex] + '续费',
          content: `您选择了${renewalTypes[res.tapIndex]}续费，价格${renewalPrices[res.tapIndex]}，确认续费吗？`,
          success: (confirmRes) => {
            if (confirmRes.confirm) {
              // 模拟续费过程
              wx.showLoading({
                title: '处理中...',
              });
              
              setTimeout(() => {
                wx.hideLoading();
                
                // 解析当前结束日期
                const currentEndDate = new Date(this.data.membershipInfo.endDate.replace(/年|月/g, '-').replace(/日/g, ''));
                
                // 计算新的结束日期
                const newEndDate = new Date(currentEndDate);
                newEndDate.setDate(newEndDate.getDate() + renewalDays[res.tapIndex]);
                
                // 格式化新的结束日期
                const endDateStr = `${newEndDate.getFullYear()}年${newEndDate.getMonth() + 1}月${newEndDate.getDate()}日`;
                
                // 更新会员信息
                const membershipInfo = { ...this.data.membershipInfo };
                membershipInfo.endDate = endDateStr;
                
                // 保存会员信息到本地和页面数据
                wx.setStorageSync('membershipInfo', membershipInfo);
                this.setData({
                  membershipInfo: membershipInfo
                });
                
                wx.showToast({
                  title: '续费成功',
                  icon: 'success'
                });
              }, 1500);
            }
          }
        });
      }
    });
  },
  
  // 设置自动续费
  setAutoRenewal() {
    wx.showModal({
      title: '自动续费设置',
      content: '开启自动续费后，会员到期前将自动扣款续费，避免会员权益中断。',
      confirmText: '开启',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '已开启自动续费',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '已关闭自动续费',
            icon: 'none'
          });
        }
      }
    });
  },
  
  // 导航到读一读页面
  navigateToRead() {
    wx.switchTab({
      url: '/pages/read/read'
    });
  },

  // 导航到写一写页面
  navigateToWrite() {
    wx.switchTab({
      url: '/pages/write/write'
    });
  },

  // 导航到听一听页面
  navigateToListen() {
    wx.switchTab({
      url: '/pages/listen/listen'
    });
  },

  // 导航到说一说页面
  navigateToSpeak() {
    wx.switchTab({
      url: '/pages/speak/speak'
    });
  },
  
  // 心灵抽签功能
  onFortuneDraw: function() {
    console.log('抽签函数被调用');
    // 显示加载中
    wx.showLoading({
      title: '正在抽取...',
      mask: true
    });
    
    // 先刷新一次统计数据，确保显示最新的学习时间
    this.loadStudyStats();
    
    // 调用云函数获取随机句子
    sentencesAPI.getRandomSentence().then(res => {
      console.log('云函数调用成功:', res);
      
      if (res.result && res.result.success && res.result.data) {
        const sentence = res.result.data;
        
        // 延迟显示，增加仪式感
        setTimeout(() => {
          wx.hideLoading();
          
          // 显示自定义弹窗
          this.setData({
            showFortuneModal: true,
            fortuneContent: `${sentence.text}\n\n—— ${sentence.source}`
          });
        }, 800);
      } else {
        console.error('云函数返回数据格式错误:', res);
        this.showFallbackSentence();
      }
    }).catch(err => {
      console.error('云函数调用失败:', err);
      this.showFallbackSentence();
    });
  },
  
  // 备用句子显示（当云函数调用失败时）
  showFallbackSentence: function() {
    const fallbackSentences = [
      { text: '天行健，君子以自强不息。', source: '《周易》' },
      { text: '千里之行，始于足下。', source: '老子' },
      { text: '学而不思则罔，思而不学则殆。', source: '孔子' },
      { text: '路漫漫其修远兮，吾将上下而求索。', source: '屈原《离骚》' },
      { text: 'The journey of a thousand miles begins with a single step.', source: 'Lao Tzu' }
    ];
    
    const randomIndex = Math.floor(Math.random() * fallbackSentences.length);
    const sentence = fallbackSentences[randomIndex];
    
    setTimeout(() => {
      wx.hideLoading();
      
      this.setData({
        showFortuneModal: true,
        fortuneContent: `${sentence.text}\n\n—— ${sentence.source}`
      });
    }, 800);
  },

  // 处理抽签确认
  onFortuneConfirm: function() {
    this.setData({
      showFortuneModal: false
    });
    
    // 显示一个温暖的提示
    wx.showToast({
      title: '愿你被温柔以待',
      icon: 'none',
      duration: 2000,
      backgroundColor: '#FFE4E1',
      color: '#FF69B4'
    });
  },

  // 导航到文章收藏页面
  navigateToArticleFavorites() {
    if (!this.data.isLoggedIn) {
      this.navigateToLogin();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/article-favorites/article-favorites'
    });
  },

  // 导航到信使驿站页面
  navigateToMessengerStation() {
    wx.navigateTo({
      url: '/pages/messenger-station/messenger-station'
    });
  },

  // 导航到听力错题页面
  navigateToListeningErrors() {
    if (!this.data.isLoggedIn) {
      this.navigateToLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/listening-errors/listening-errors'
    });
  },

  // 导航到录音仓库页面
  navigateToRecordingRepository() {
    if (!this.data.isLoggedIn) {
      this.navigateToLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/recording-repository/recording-repository'
    });
  },

  // 加载写作列表
  async loadWritings() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const result = await writingAPI.getWritingHistory(this.data.page, this.data.pageSize);

      if (result.result.code === 0) {
        const { list, total } = result.result.data;
        
        this.setData({
          writings: this.data.page === 1 ? list : [...this.data.writings, ...list],
          hasMore: list.length === this.data.pageSize,
          page: this.data.page + 1
        });
      } else {
        throw new Error(result.result.msg || '获取写作列表失败');
      }
    } catch (error) {
      console.error('加载写作列表失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({
      page: 1,
      hasMore: true,
      writings: []
    }, () => {
      this.loadWritings().then(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  // 上拉加载更多
  onReachBottom: function() {
    if (this.data.hasMore) {
      this.loadWritings();
    }
  },

  // 点击写作项
  onWritingTap: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `../writing-detail/writing-detail?id=${id}`
    });
  }
});