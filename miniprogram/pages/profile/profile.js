// 我的主页页面逻辑
console.log('Profile页面JS文件加载');

// 添加全局计时器变量
let statsRefreshTimer = null;

Page({
  data: {
    // 用户信息
    userInfo: {
      avatarUrl: '',
      nickName: '晓学者',
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
    checkinDays: 21,
    totalCheckinDays: 45,
    
    // 未读消息数
    unreadMessages: 5,
    
    // 抽签相关
    showFortuneModal: false,
    fortuneContent: '',
    
    // 系统消息
    systemMessages: [
      {
        id: 1,
        title: '系统维护通知',
        content: '亲爱的用户，我们将于2023年12月25日凌晨2:00-4:00进行系统维护，届时可能无法正常使用app，请您错峰使用。',
        date: '2023-12-23',
        read: false
      },
      {
        id: 2,
        title: '新功能上线通知',
        content: '【AI口语评测】功能已正式上线！快去"说一说"模块体验实时口语评分和发音指导吧！',
        date: '2023-12-20',
        read: false
      },
      {
        id: 3,
        title: '学习提醒',
        content: '您已经连续学习21天，继续保持每日学习习惯，英语能力提升会更快哦！',
        date: '2023-12-18',
        read: false
      },
      {
        id: 4,
        title: '会员优惠活动',
        content: '年末感恩回馈，VIP会员限时8折优惠，有效期至2023年12月31日。',
        date: '2023-12-15',
        read: false
      },
      {
        id: 5,
        title: '账号安全提醒',
        content: '我们发现您的账号在新设备上登录，如非本人操作，请及时修改密码。',
        date: '2023-12-10',
        read: false
      }
    ],
    
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
    totalStudyTime: 0
  },
  
  onLoad: function() {
    console.log('Profile页面加载');
    
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
        nickName: '晓学者',
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
    
    // 获取本地存储的系统消息
    const messages = wx.getStorageSync('systemMessages');
    if (messages) {
      this.setData({
        systemMessages: messages
      });
      
      // 计算未读消息数
      this.calculateUnreadMessages();
    } else {
      // 如果本地没有存储，则使用默认值并保存到本地
      wx.setStorageSync('systemMessages', this.data.systemMessages);
    }

    // 加载用户学习统计数据
    this.loadStudyStats();

    // 开始周期性刷新统计数据
    this.startStatsRefreshTimer();

    // 测试心灵抽签功能是否正常
    console.log('心灵抽签功能状态：', typeof this.onFortuneDraw === 'function');
  },

  onShow: function() {
    // 每次页面显示时更新学习统计数据
    this.loadStudyStats();
    
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
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 从本地存储获取学习统计数据
    const studyStats = wx.getStorageSync('studyStats') || {};
    const todayStats = studyStats[dateStr] || {
      read: 0,
      write: 0,
      listen: 0,
      speak: 0,
      readArticles: 0,
      writeArticles: 0,
      listenAudios: 0,
      speakExercises: 0
    };
    
    // 获取总统计数据
    const totalStats = studyStats.total || {
      readArticles: 0,
      writeArticles: 0,
      listenAudios: 0,
      speakExercises: 0
    };
    
    // 计算总学习时间
    const totalStudyTime = todayStats.read + todayStats.write + todayStats.listen + todayStats.speak;
    
    // 更新页面数据
    this.setData({
      'readStats.today': todayStats.read || 0,
      'writeStats.today': todayStats.write || 0,
      'listenStats.today': todayStats.listen || 0,
      'speakStats.today': todayStats.speak || 0,
      'readStats.articles': totalStats.readArticles || 0,
      'writeStats.articles': totalStats.writeArticles || 0,
      'listenStats.audios': totalStats.listenAudios || 0,
      'speakStats.exercises': totalStats.speakExercises || 0,
      'totalStudyTime': totalStudyTime
    });
    
    console.log('学习统计数据已加载', todayStats, '总学习时间:', totalStudyTime);
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
      // 自动打卡
      const currentDay = today.getDate();
      this.checkInToday(currentDay);
      studyStats[dateStr].checkedIn = true;
      wx.setStorageSync('studyStats', studyStats);
    }
  },
  
  // 点击头像上传
  uploadAvatar() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        // 获取选中图片的临时路径
        const tempFilePath = res.tempFilePaths[0];
        
        // 更新本地显示
        const userInfo = that.data.userInfo;
        userInfo.avatarUrl = tempFilePath;
        
        that.setData({
          userInfo: userInfo
        });
        
        // 存储到本地
        wx.setStorageSync('userInfo', userInfo);
        
        // 实际项目中这里应该调用API上传图片到服务器
        wx.showToast({
          title: '头像更新成功',
          icon: 'success',
          duration: 2000
        });
      }
    });
  },
  
  // 编辑个人资料
  editProfile() {
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
            success: function(res) {
              if (res.confirm && res.content) {
                const userInfo = that.data.userInfo;
                userInfo.nickName = res.content;
                that.setData({
                  userInfo: userInfo
                });
                // 保存到本地存储
                wx.setStorageSync('userInfo', userInfo);
                
                // 显示成功提示
                wx.showToast({
                  title: '昵称已更新',
                  icon: 'success',
                  duration: 2000
                });
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
            success: function(res) {
              if (res.confirm && res.content) {
                const userInfo = that.data.userInfo;
                userInfo.signature = res.content;
                that.setData({
                  userInfo: userInfo
                });
                // 保存到本地存储
                wx.setStorageSync('userInfo', userInfo);
                
                // 显示成功提示
                wx.showToast({
                  title: '签名已更新',
                  icon: 'success',
                  duration: 2000
                });
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
      content: '晓学习 v1.0.0\n\n晓学习通过语言重构思维，以听说读写为支点，撬动跨文化思辨、逻辑推演与创意表达。和我们一起晓世界！\n\n©2025 晓学习团队',
      showCancel: false,
      confirmText: '了解更多'
    });
  },

  // 导航到系统消息页面
  navigateToMessages() {
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
      // 所有消息都已显示，更新本地存储
      wx.setStorageSync('systemMessages', this.data.systemMessages);
      
      // 计算剩余未读消息
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
        // 标记当前消息为已读
        let updatedMessages = [...that.data.systemMessages];
        updatedMessages[index].read = true;
        
        that.setData({
          systemMessages: updatedMessages
        });
        
        if (res.confirm) {
          // 用户点击"下一条"，显示下一条未读消息
          const nextUnreadIndex = updatedMessages.findIndex((msg, idx) => !msg.read && idx > index);
          
          if (nextUnreadIndex !== -1) {
            // 有下一条未读消息
            that.showMessageDialog(nextUnreadIndex);
          } else {
            // 没有下一条未读消息了
            wx.setStorageSync('systemMessages', updatedMessages);
            that.calculateUnreadMessages();
            
            wx.showToast({
              title: '所有消息已读',
              icon: 'success'
            });
          }
        } else {
          // 用户点击"标为已读"，结束查看
          wx.setStorageSync('systemMessages', updatedMessages);
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
    // 获取当月天数
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // 获取当月第一天是星期几
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    
    // 构建日历数据
    const calendarDays = [];
    
    // 填充前面的空白
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push({
        day: 0,
        isCurrentMonth: false,
        isToday: false,
        isChecked: false
      });
    }
    
    // 填充当月日期
    for (let i = 1; i <= daysInMonth; i++) {
      // 模拟已打卡日期，实际应从后端获取
      // 这里假设本月currentDay之前的日期都已打卡
      const isChecked = i < currentDay;
      
      calendarDays.push({
        day: i,
        isCurrentMonth: true,
        isToday: i === currentDay,
        isChecked: isChecked
      });
    }
    
    return {
      year,
      month,
      days: calendarDays
    };
  },
  
  // 显示日历对话框
  showCalendarDialog(calendarData, currentDay) {
    // 构建日历HTML模板
    let dialogContent = `
      <view style="font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 10px;">
        ${calendarData.year}年${calendarData.month}月
      </view>
      <view style="display: flex; justify-content: space-around; margin-bottom: 10px;">
        <view style="width: 14.28%; text-align: center;">日</view>
        <view style="width: 14.28%; text-align: center;">一</view>
        <view style="width: 14.28%; text-align: center;">二</view>
        <view style="width: 14.28%; text-align: center;">三</view>
        <view style="width: 14.28%; text-align: center;">四</view>
        <view style="width: 14.28%; text-align: center;">五</view>
        <view style="width: 14.28%; text-align: center;">六</view>
      </view>
    `;
    
    // 使用 wx.showActionSheet 显示日历选项
    const dateOptions = ['今日打卡', '查看本月打卡记录', '返回'];
    
    wx.showActionSheet({
      itemList: dateOptions,
      success: (res) => {
        const tapIndex = res.tapIndex;
        
        if (tapIndex === 0) {
          // 用户选择今日打卡
          this.checkInToday(currentDay);
        } else if (tapIndex === 1) {
          // 查看本月打卡记录
          this.showMonthlyCheckinRecord(calendarData);
        }
      }
    });
  },
  
  // 执行今日打卡
  checkInToday(day) {
    const today = new Date();
    const currentDay = today.getDate();
    
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
          // 模拟打卡成功
          wx.showToast({
            title: '打卡成功',
            icon: 'success'
          });
          
          // 更新数据
          this.setData({
            checkinDays: this.data.checkinDays + 1,
            totalCheckinDays: this.data.totalCheckinDays + 1
          });
          
          // 实际应用中这里应该调用API保存打卡记录
          // 这里只是模拟，实际应从后端获取并保存数据
        }
      }
    });
  },
  
  // 显示本月打卡记录
  showMonthlyCheckinRecord(calendarData) {
    // 获取已打卡的日期
    const checkedDays = calendarData.days
      .filter(day => day.isCurrentMonth && day.isChecked)
      .map(day => day.day);
    
    // 将日期分组显示
    const dayGroups = [];
    let currentGroup = [];
    
    checkedDays.sort((a, b) => a - b).forEach(d => {
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
    
    if (dayGroups.length === 0) {
      checkinRecord += '本月暂无打卡记录';
    } else {
      dayGroups.forEach(group => {
        if (group.length === 1) {
          checkinRecord += `${calendarData.month}月${group[0]}日\n`;
        } else {
          checkinRecord += `${calendarData.month}月${group[0]}日至${calendarData.month}月${group[group.length - 1]}日\n`;
        }
      });
    }
    
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
        
        if (!checkedDays.includes(currentDay)) {
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
  },

  // 导航到会员页面
  navigateToMembership() {
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
    
    // 句子库 - 更丰富多样
    const sentences = [
      // 中文古诗词
      { text: '天行健，君子以自强不息。', source: '《周易》' },
      { text: '千里之行，始于足下。', source: '老子' },
      { text: '学而不思则罔，思而不学则殆。', source: '孔子' },
      { text: '路漫漫其修远兮，吾将上下而求索。', source: '屈原《离骚》' },
      { text: '宝剑锋从磨砺出，梅花香自苦寒来。', source: '古谚语' },
      { text: '不经一番寒彻骨，怎得梅花扑鼻香。', source: '黄櫱《励学篇》' },
      { text: '纸上得来终觉浅，绝知此事要躬行。', source: '陆游' },
      { text: '业精于勤，荒于嬉；行成于思，毁于随。', source: '韩愈' },
      { text: '三人行，必有我师焉。', source: '孔子' },
      { text: '知之者不如好之者，好之者不如乐之者。', source: '孔子' },
      
      // 英文经典
      { text: 'The journey of a thousand miles begins with a single step.', source: 'Lao Tzu' },
      { text: 'What we think, we become.', source: 'Buddha' },
      { text: 'Be the change that you wish to see in the world.', source: 'Gandhi' },
      { text: 'You miss 100% of the shots you don\'t take.', source: 'Wayne Gretzky' },
      { text: 'If you want to live a happy life, tie it to a goal, not to people or things.', source: 'Albert Einstein' },
      { text: 'The only way to do great work is to love what you do.', source: 'Steve Jobs' },
      
      // 其他语言
      { text: 'Lo que no te mata, te hace más fuerte.', source: '西班牙语 (意为：不能杀死你的，会使你更强大)' },
      { text: 'La vie est un défi à relever, un bonheur à mériter, une aventure à tenter.', source: '法语 (意为：生活是一个挑战，一种幸福，一场冒险)' },
      { text: 'Der Weg ist das Ziel.', source: '德语 (意为：道路即目标)' },
      { text: 'Sii il cambiamento che vuoi vedere nel mondo.', source: '意大利语 (意为：成为你想在世界上看到的改变)' }
    ];
    
    // 从本地存储获取上次显示的句子索引
    let lastIndex = wx.getStorageSync('lastFortuneIndex');
    if (lastIndex === '') lastIndex = -1;
    
    // 获取已显示过的句子历史
    let shownHistory = wx.getStorageSync('fortuneShownHistory') || [];
    // 保留最近10次的历史
    if (shownHistory.length > 10) {
      shownHistory = shownHistory.slice(-10);
    }
    
    // 过滤出没有最近显示过的句子
    let availableSentences = sentences.filter((_, index) => !shownHistory.includes(index));
    
    // 如果所有句子都显示过了，重置可用句子
    if (availableSentences.length === 0) {
      availableSentences = sentences;
      shownHistory = [];
    }
    
    // 随机选择一条句子
    const randomIndex = Math.floor(Math.random() * availableSentences.length);
    const realIndex = sentences.indexOf(availableSentences[randomIndex]);
    const sentence = sentences[realIndex];
    
    // 更新显示历史
    shownHistory.push(realIndex);
    wx.setStorageSync('fortuneShownHistory', shownHistory);
    wx.setStorageSync('lastFortuneIndex', realIndex);
    
    // 延迟显示，增加仪式感
    setTimeout(() => {
      wx.hideLoading();
      
      // 显示自定义弹窗
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
    wx.navigateTo({
      url: '/pages/listening-errors/listening-errors'
    });
  },

  // 导航到录音仓库页面
  navigateToRecordingRepository() {
    wx.navigateTo({
      url: '/pages/recording-repository/recording-repository'
    });
  }
}); 