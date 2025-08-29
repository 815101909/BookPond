// 引入统一的云函数调用工具
const { checkinAPI } = require('../../utils/cloud-api.js');

// 日历打卡页面
Page({
  /**
   * 页面的初始数据
   */
  data: {
    year: 0,
    month: 0,
    checkinDays: 0,
    totalCheckinDays: 0,
    calendarRows: [],
    canCheckInToday: true, // 是否可以进行今日打卡
    checkInRecords: [] // 所有打卡记录
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取当前日期
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // JavaScript 月份从0开始
    
    // 从个人页面获取统计数据
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2]; // 获取上一页实例
    
    if (prevPage) {
      this.setData({
        checkinDays: prevPage.data.checkinDays,
        totalCheckinDays: prevPage.data.totalCheckinDays
      });
    }
    
    // 从云端获取打卡记录
    this.loadCheckInRecords(year, month);
    
    // 加载日历
    this.setData({
      year,
      month
    });
  },
  
  /**
   * 加载打卡记录
   */
  loadCheckInRecords: function(year, month) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 先检查用户是否存在，如果不存在则创建
    checkinAPI.checkAndCreateUser().then(res => {
      if (res.result && res.result.code === 0) {
        console.log('用户检查/创建成功:', res.result);
        
        // 继续获取打卡记录
        this.fetchCheckInRecords(year, month);
      } else {
        wx.hideLoading();
        console.error('用户检查/创建失败:', res);
        
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('用户检查/创建失败:', err);
      
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    });
  },
  
  /**
   * 获取打卡记录
   */
  fetchCheckInRecords: function(year, month) {
    // 调用云函数获取打卡记录
    checkinAPI.getCheckinRecords(year, month).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const data = res.result.data;
        
        // 格式化打卡记录，便于日历使用
        const checkInRecords = data.records.map(record => ({
          date: record.date,
          timestamp: record.timestamp
        }));
        
        // 更新页面数据
        this.setData({
          checkInRecords,
          checkinDays: data.checkinDays,
          totalCheckinDays: data.totalCheckinDays
        });
        
        // 检查今天是否已打卡
        this.checkTodayStatus();
        
        // 生成日历
        this.generateCalendar(this.data.year, this.data.month);
      } else {
        console.error('获取打卡记录失败:', res);
        // 使用空数组初始化
        this.setData({
          checkInRecords: []
        });
        
        // 检查今天是否已打卡
        this.checkTodayStatus();
        
        // 生成日历
        this.generateCalendar(this.data.year, this.data.month);
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('调用云函数失败:', err);
      
      // 使用空数组初始化
      this.setData({
        checkInRecords: []
      });
      
      // 检查今天是否已打卡
      this.checkTodayStatus();
      
      // 生成日历
      this.generateCalendar(this.data.year, this.data.month);
      
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    });
  },
  
  /**
   * 检查今天是否已打卡
   */
  checkTodayStatus: function() {
    // 获取北京时间
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    console.log('检查今日打卡状态:', todayStr, this.data.checkInRecords);
    
    const todayChecked = this.data.checkInRecords.some(record => record.date === todayStr);
    
    this.setData({
      canCheckInToday: !todayChecked
    });
  },

  /**
   * 生成日历数据
   */
  generateCalendar: function(year, month) {
    // 获取当月第一天是星期几
    const firstDay = new Date(year, month - 1, 1).getDay();
    
    // 获取当月天数
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // 获取上个月天数
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
    
    // 获取当前日期
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    // 构建日历数据（包括上月和下月的部分日期）
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
      const isToday = year === currentYear && month === currentMonth && i === currentDay;
      
      // 检查是否已打卡
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isChecked = this.data.checkInRecords.some(record => record.date === dateStr);
      
      days.push({
        day: i,
        isCurrentMonth: true,
        isToday,
        isChecked
      });
    }
    
    // 添加下个月的前几天（使日历保持完整的6行）
    const remainingCells = 42 - days.length; // 6行7列
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isToday: false,
        isChecked: false
      });
    }
    
    // 将日期分成每行7个
    const calendarRows = [];
    for (let i = 0; i < days.length; i += 7) {
      calendarRows.push(days.slice(i, i + 7));
    }
    
    this.setData({
      calendarRows
    });
  },

  /**
   * 切换到上个月
   */
  prevMonth: function() {
    let { year, month } = this.data;
    
    if (month === 1) {
      year--;
      month = 12;
    } else {
      month--;
    }
    
    this.setData({
      year,
      month
    });
    
    // 重新加载打卡记录
    this.loadCheckInRecords(year, month);
  },

  /**
   * 切换到下个月
   */
  nextMonth: function() {
    let { year, month } = this.data;
    
    if (month === 12) {
      year++;
      month = 1;
    } else {
      month++;
    }
    
    this.setData({
      year,
      month
    });
    
    // 重新加载打卡记录
    this.loadCheckInRecords(year, month);
  },

  /**
   * 点击日期
   */
  onDateTap: function(e) {
    const { day, isCurrentMonth } = e.currentTarget.dataset;
    
    if (!isCurrentMonth || day === 0) {
      return; // 不是当前月份或无效日期
    }
    
    const { year, month } = this.data;
    const selectedDate = new Date(year, month - 1, day);
    const today = new Date();
    
    console.log('点击日期:', {
      selectedDate: selectedDate.toISOString(),
      today: today.toISOString(),
      year, month, day,
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth() + 1,
      currentDay: today.getDate()
    });
    
    // 如果日期是未来的，不允许打卡
    if (selectedDate > today) {
      wx.showToast({
        title: '不能提前打卡',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否已经打卡
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isChecked = this.data.checkInRecords.some(record => record.date === dateStr);
    
    if (isChecked) {
      // 已经打卡，显示打卡详情
      wx.showModal({
        title: '打卡详情',
        content: `您已在 ${year}年${month}月${day}日 完成打卡`,
        showCancel: false,
        confirmText: '知道了'
      });
    } else {
      // 如果是当天，允许打卡
      const isSameDay = selectedDate.getDate() === today.getDate() &&
                        selectedDate.getMonth() === today.getMonth() &&
                        selectedDate.getFullYear() === today.getFullYear();
      
      console.log('是否是当天:', isSameDay);
      
      if (isSameDay) {
        this.checkInToday();
      } else {
        // 过去的日期不能补打卡
        wx.showToast({
          title: '不能补打卡',
          icon: 'none'
        });
      }
    }
  },

  /**
   * 今日打卡
   */
  checkInToday: function() {
    if (!this.data.canCheckInToday) {
      wx.showToast({
        title: '今日已打卡',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '学习打卡',
      content: '确定要完成今日打卡吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '打卡中...',
            mask: true
          });
          
          // 调用云函数进行打卡
          checkinAPI.checkIn(0).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.code === 0) {
              const data = res.result.data;
              
              // 更新页面数据
              this.setData({
                checkinDays: data.checkinDays,
                totalCheckinDays: data.totalCheckinDays,
                canCheckInToday: false
              });
              
              // 添加新的打卡记录到本地数组
              const newRecord = data.record;
              const checkInRecords = [...this.data.checkInRecords, newRecord];
              
              this.setData({
                checkInRecords
              });
              
              // 更新父页面数据
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 2];
              if (prevPage) {
                prevPage.setData({
                  checkinDays: data.checkinDays,
                  totalCheckinDays: data.totalCheckinDays
                });
              }
              
              // 重新生成日历以更新视图
              this.generateCalendar(this.data.year, this.data.month);
              
              // 检查是否有激励奖励
              if (data.incentive && data.incentive.achievedMilestone) {
                // 显示激励奖励弹窗
                wx.showModal({
                  title: '🎉 恭喜获得奖励！',
                  content: data.incentive.message,
                  showCancel: false,
                  confirmText: '太棒了',
                  success: () => {
                    // 显示打卡成功提示
                    wx.showToast({
                      title: '打卡成功',
                      icon: 'success'
                    });
                  }
                });
              } else {
                // 显示普通打卡成功提示
                wx.showToast({
                  title: res.result.msg || '打卡成功',
                  icon: 'success'
                });
              }
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
        }
      }
    });
  },

  /**
   * 点击查看日历详情
   */
  viewCalendarDetails: function() {
    // 获取当月打卡记录
    const { year, month, checkInRecords } = this.data;
    
    // 筛选当月打卡记录
    const monthlyRecords = checkInRecords.filter(record => {
      const dateParts = record.date.split('-');
      return parseInt(dateParts[0]) === year && parseInt(dateParts[1]) === month;
    });
    
    if (monthlyRecords.length === 0) {
      wx.showModal({
        title: '本月打卡统计',
        content: `${year}年${month}月暂无打卡记录`,
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    
    // 格式化打卡日期
    const formattedDates = monthlyRecords.map(record => {
      const dateParts = record.date.split('-');
      return `${dateParts[2]}日`;
    }).sort((a, b) => parseInt(a) - parseInt(b));
    
    // 将连续的日期合并显示
    const dateRanges = [];
    let currentRange = [parseInt(formattedDates[0])];
    
    for (let i = 1; i < formattedDates.length; i++) {
      const prevDay = parseInt(currentRange[currentRange.length - 1]);
      const currentDay = parseInt(formattedDates[i]);
      
      if (currentDay === prevDay + 1) {
        currentRange.push(currentDay);
      } else {
        dateRanges.push(currentRange);
        currentRange = [currentDay];
      }
    }
    
    if (currentRange.length > 0) {
      dateRanges.push(currentRange);
    }
    
    // 生成显示内容
    let content = `${year}年${month}月打卡记录：\n\n`;
    
    dateRanges.forEach(range => {
      if (range.length === 1) {
        content += `${month}月${range[0]}日\n`;
      } else {
        content += `${month}月${range[0]}日至${month}月${range[range.length - 1]}日\n`;
      }
    });
    
    // 显示打卡统计
    wx.showModal({
      title: '本月打卡统计',
      content: content,
      showCancel: false,
      confirmText: '知道了'
    });
  }
})