// 排行榜页面
// 引入跨环境云函数调用工具
const { pointsAPI } = require('../../utils/cloud-api.js');

Page({
  data: {
    // 当前选中的标签页
    currentTab: 'daily',
    
    // 用户信息
    userInfo: {
      avatarUrl: '',
      nickName: '晓学者'
    },
    
    // 积分数据
    todayPoints: 0,
    monthPoints: 0,
    
    // 我的排名
    myDailyRank: '--',
    myMonthlyRank: '--',
    
    // 今日排行榜数据
    dailyRankings: [],
    
    // 本月排行榜数据
    monthlyRankings: [],
    
    // 虚拟用户数据
    virtualUsers: [],
    
    // 本地存储监听定时器
    storageListener: null
  },

  onLoad: function() {
    console.log('排行榜页面加载');
    
    try {
      // 获取本地存储的用户信息
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({
          userInfo: userInfo
        });
      }
      
      // 获取用户积分数据
      this.loadUserPoints();
      
      // 加载排行榜数据
      this.loadRankingData();
    } catch (error) {
      console.error('排行榜页面加载错误:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },
  
  onShow: function() {
    try {
      // 每次页面显示时刷新数据
      this.loadUserPoints();
      this.loadRankingData();
      
      // 启动本地存储监听
      this.startStorageListener();
    } catch (error) {
      console.error('排行榜页面显示错误:', error);
    }
  },
  
  onHide: function() {
    // 停止本地存储监听
    this.stopStorageListener();
  },
  
  onUnload: function() {
    // 停止本地存储监听
    this.stopStorageListener();
  },
  
  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadUserPoints();
    this.loadRankingData();
    
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 800);
  },
  
  // 加载用户积分数据
  loadUserPoints: function() {
    // 从听一听页面的本地存储中读取今日积分
    const todayListenPoints = wx.getStorageSync('todayListenPoints') || 0;
    
    // 从云端获取总积分作为月积分的基础
    pointsAPI.getUserPoints().then(res => {
      console.log('获取用户积分结果:', res);
      let monthPoints = 0;
      if (res.result && res.result.code === 0 && res.result.data) {
        const userData = res.result.data;
        monthPoints = userData.listen_points || 0; // 使用总积分作为月积分
      }
      
      this.setData({
        todayPoints: todayListenPoints, // 今日积分从听一听本地存储获取
        monthPoints: monthPoints // 月积分使用总积分
      });
      
      console.log('加载到的用户积分:', { todayPoints: todayListenPoints, monthPoints: monthPoints });
    }).catch(err => {
      console.error('获取用户积分出错', err);
      // 如果云函数调用失败，至少显示今日积分
      this.setData({
        todayPoints: todayListenPoints,
        monthPoints: 0
      });
      console.log('云函数调用失败，使用本地今日积分:', todayListenPoints);
    });
  },
  
  // 加载排行榜数据
  loadRankingData: function() {
    try {
      // 显示加载中提示
      wx.showLoading({
        title: '加载排行数据',
      });
      
      // 获取最新的积分数据
      const currentTodayPoints = wx.getStorageSync('todayListenPoints') || 0;
      
      // 生成虚拟用户
      const virtualUsers = this.generateVirtualUsers(100);
      
      // 插入真实用户
      const userId = wx.getStorageSync('userId') || 'current_user';
      
      // 今日排行榜 - 为用户随机分配一个位置
      const dailyRankings = JSON.parse(JSON.stringify(virtualUsers)).map(user => {
        // 为日排行榜使用日积分
        return {
          ...user,
          points: user.dailyPoints // 使用今日积分
        };
      });
      const userDailyRank = Math.floor(Math.random() * 30) + 5; // 5-35之间的随机位置
      
      // 插入真实用户到随机位置
      dailyRankings.splice(userDailyRank - 1, 0, {
        userId: userId,
        nickName: this.data.userInfo.nickName || '晓学者',
        avatarUrl: this.data.userInfo.avatarUrl || '',
        avatarColor: this.data.userInfo.avatarColor || '#4ECDC4',
        points: currentTodayPoints, // 使用最新的今日积分
        isMe: true
      });
      
      // 本月排行榜 - 为用户随机分配一个位置
      const monthlyRankings = JSON.parse(JSON.stringify(virtualUsers)).map(user => {
        // 为月排行榜使用月积分
        return {
          ...user,
          points: user.monthlyPoints // 使用月积分
        };
      });
      const userMonthlyRank = Math.floor(Math.random() * 30) + 5; // 5-35之间的随机位置
      
      // 插入真实用户到随机位置
      monthlyRankings.splice(userMonthlyRank - 1, 0, {
        userId: userId,
        nickName: this.data.userInfo.nickName || '晓学者',
        avatarUrl: this.data.userInfo.avatarUrl || '',
        avatarColor: this.data.userInfo.avatarColor || '#4ECDC4',
        points: this.data.monthPoints || 0, // 使用当前的月积分
        isMe: true
      });
      
      // 重新排序
      dailyRankings.sort((a, b) => b.points - a.points);
      monthlyRankings.sort((a, b) => b.points - a.points);
      
      // 限制为前100名
      const limitedDailyRankings = dailyRankings.slice(0, 100);
      const limitedMonthlyRankings = monthlyRankings.slice(0, 100);
      
      // 查找用户排名
      const myDailyRank = limitedDailyRankings.findIndex(user => user.isMe) + 1;
      const myMonthlyRank = limitedMonthlyRankings.findIndex(user => user.isMe) + 1;
      
      // 更新数据
      this.setData({
        dailyRankings: limitedDailyRankings,
        monthlyRankings: limitedMonthlyRankings,
        myDailyRank: myDailyRank > 0 ? myDailyRank : '--',
        myMonthlyRank: myMonthlyRank > 0 ? myMonthlyRank : '--'
      });
      
      console.log('用户积分信息:', {
        todayPoints: this.data.todayPoints,
        monthPoints: this.data.monthPoints,
        myDailyRank: myDailyRank,
        myMonthlyRank: myMonthlyRank
      });
      
      // 隐藏加载提示
      wx.hideLoading();
      
    } catch (error) {
      console.error('加载排行榜数据错误:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载排行数据失败',
        icon: 'none'
      });
    }
  },
  
  // 生成虚拟用户数据
  generateVirtualUsers: function(count) {
    try {
      const today = new Date();
      
      // 为日积分生成基于日期的种子（每天刷新）
      const dailyDateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      let dailySeed = 0;
      for (let i = 0; i < dailyDateString.length; i++) {
        dailySeed = ((dailySeed << 5) - dailySeed + dailyDateString.charCodeAt(i)) & 0xffffffff;
      }
      
      // 为月积分生成基于月份的种子（每月刷新）
      const monthlyDateString = `${today.getFullYear()}-${today.getMonth()}`;
      let monthlySeed = 0;
      for (let i = 0; i < monthlyDateString.length; i++) {
        monthlySeed = ((monthlySeed << 5) - monthlySeed + monthlyDateString.charCodeAt(i)) & 0xffffffff;
      }
      
      // 基于日期种子的伪随机数生成器（用于日积分）
      const dailySeededRandom = (function(seed) {
        return function() {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
      })(Math.abs(dailySeed));
      
      // 基于月份种子的伪随机数生成器（用于月积分）
      const monthlySeededRandom = (function(seed) {
        return function() {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
      })(Math.abs(monthlySeed));
      
      // 用户名列表 - 多样化的名字
      const usernames = [
        // 英文名/网名
        'Chai', '迢迢迢迢', '是Mia呀', 'juliana', '落子无悔',
        'deepocean', '雪见', 'jiyoon', '何', '白色芝士黑洞',
        '且放白鹿青崖间', 'Étienne', '一壹', 'Ferrero-迪', '大洋彼岸',
        
        // 体育相关
        '1月10日', '灌篮高手teddy', '去巴黎看你', 'SwimChampion', 'André',
        '曼谷小哪吒', '汐泷', 'TableTennis', 'MarathonRunner', 'SkiExpert',
        
        // 德语/北欧语
        'Wanderlust', 'Zeitgeist', 'Blitzkrieg', 'Kindergarten', 'Wunderkind',
        'Hygge', 'Fika', 'Lagom', 'Fjord', 'Køben',
        
        // 友好名字 (替换古代名人)
        '李白', '沙里瓦', '苏轼', '清照', '康康2007',
        
        // 西班牙语/葡萄牙语
        'Amigo', 'Siesta', 'Fiesta', 'Gracias', 'Flamenco',
        'Saudade', 'Carnaval', 'Cafézinho', 'Capoeira', 'Bacana',
        
        // 日语名称
        '桜花', '夢想', '青空', '月光', '風神',
        '雪月', '我要学西语', '星空', '雨林', '山川',
        
        // 韩语名称 (减少几个)
        '浩宇知时节', 'bruce', '희망',
        '별빛', '햇살', '기쁨',
        
        // 中英混合
        'Joy小草', 'CooL', 'しみず まこと', 'XICUN橙子', 'Sky蓝蓝',
        '阳光Boy', '微笑Girl', '要勇敢', '晓Wonder', '梦Dream',
        
        // 数字混合
        'momo', 'ENSP', 'King2023', '7up', 'Lucky888',
        '婷婷', '101点点', '里约煎饼侠', '日语不到N1不改名', '总是在发呆',
        
        // 符号/特殊字符混合
        'Star✨', 'Love♥', 'XICUN☀', 'Moon🌙', 'dudu0721',
        'Dog🐶', '无价♫', 'Dance💃', '光明小镇', 'Water💧',
        
        // 自然风光
        '青山绿水', '落霞孤鹜', '秋水长天', '春风十里', '火炎炎',
        
        // 动植物
        '熊猫', '提升自己', '蝴蝶', '黄玫瑰rrr', '兰花',
        
        // 生活相关
        '斯里兰卡小雨点', '午后茶香', '晚风轻拂', '看见彩虹啦', '阳光明媚',
        
        // 电子竞技/游戏
        '五门语言任我行', '啄木鸟铃声', 'Sniper', 'TheHero', '山上',
        'คาเมลเลีย', '罗马假日', 'be高考状元!', 'Tiagoooooo', '量子蜗牛',
        
        // 职业/身份
        '好运拿会员', '设计狮', '雨夜慕尼', 'onlymyself', '天涯各一方',
        '一粒豌豆芽芽', '李明熹', '采蘑菇的云南君君', '崎岖咚巴拉', '学英西法语走天下',
        
        // 食物相关
        '甜甜圈', '抹茶冰淇淋', '那年盛夏', '草莓酱', '450931',
        '桃酪酪', '秋夏冬春', '爱弹钢琴的珠珠', '披萨王', '面包树下你和我',
        
        // 随机杂乱无章
        '风一样的男子', '雨中漫步', '咫尺而又天涯', 'goodnotbye', '早起打卡',
        '你喝过墨汁吗我喝过', 'tangpinggaoshou', '内卷冠军', '猜猜看', '佛系青年',
        '沙发第一', 'Praha', '在下吕是韦', '社恐患者', '梦想是环游世界',
        '宜林爱吃胡萝卜', '哎呦喂成冠军', '人间清醒', '道非道', '打call',
        
        // 增加更多可爱的名字
        '小熊软糖', 'woo呼', '棉花读者', '饺子', '昼夜也不舍',
        '小小勇士', 'Tatiana', 'Dannyinengland', '鳄鱼式俄语', '彩色气球',
        '回头见晴语', '勇敢小兔', '聪明狐狸', '南极一只鹅', '月月年年岁岁',
        '阳光少年', '挥一挥衣袖', '不悔', '噼里啪啦', '月亮船长',
        'Vladimir', '数学天才', '知澳赵', '玉米鱼米', 'AI小明',
        '英语小达人', '绘画冠军', '桑榆非晚', '西语我服了', 'dudu0721',
        'iiiiiiiiii', '花木兰', '哈利波特', '小王子', '滑雪最好玩',
        'bairain', '我愿：', '摩天轮', '生旦净末丑', '蓝莓蛋糕'
      ];
      
      // 随机颜色生成
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFC145', '#9370DB', '#56C596', '#FF9A8B', '#725AC1', '#699E3E', '#DE5B6D'];
      
      // 生成虚拟用户
      const users = [];
      const usedNames = new Set(); // 防止名称重复
      
      for (let i = 0; i < count; i++) {
        // 使用月份种子选择用户名（确保每月用户名固定）
        let username;
        do {
          const randomNameIndex = Math.floor(monthlySeededRandom() * usernames.length);
          username = usernames[randomNameIndex];
        } while (usedNames.has(username) && usedNames.size < usernames.length);
        
        usedNames.add(username);
        
        // 为每日和月度排行榜生成不同的分数，符合特定倍数分布
        let dailyPoints, monthlyPoints;
        
        // 为日积分生成分数（0-110范围）
        const generateDailyPoints = () => {
          // 决定使用哪种模式（3的倍数、5的倍数、8的倍数或7的倍数）
          const pattern = i % 4; // 按用户索引决定模式，确保平均分布
          
          let points = 0;
          if (pattern === 0) {
            // 3的倍数 (0-108)
            const max = Math.floor(110 / 3);
            const multiplier = Math.floor(dailySeededRandom() * (max + 1));
            points = multiplier * 3;
          } else if (pattern === 1) {
            // 5的倍数 (0-110)
            const max = Math.floor(110 / 5);
            const multiplier = Math.floor(dailySeededRandom() * (max + 1));
            points = multiplier * 5;
          } else if (pattern === 2) {
            // 8的倍数 (0-104)
            const max = Math.floor(110 / 8);
            const multiplier = Math.floor(dailySeededRandom() * (max + 1));
            points = multiplier * 8;
          } else {
            // 7的倍数 (0-105)
            const max = Math.floor(110 / 7);
            const multiplier = Math.floor(dailySeededRandom() * (max + 1));
            points = multiplier * 7;
          }
          
          return points;
        };
        
        // 为月积分生成分数（550-3550范围）
        const generateMonthlyPoints = () => {
          // 决定使用哪种模式（3的倍数、5的倍数、8的倍数或7的倍数）
          const pattern = i % 4; // 按用户索引决定模式，确保平均分布
          
          let points = 0;
          if (pattern === 0) {
            // 3的倍数 (551-3549)
            // 找到550和3550之间的3的倍数范围
            const minMultiplier = Math.ceil(550 / 3);
            const maxMultiplier = Math.floor(3550 / 3);
            const multiplier = Math.floor(monthlySeededRandom() * (maxMultiplier - minMultiplier + 1)) + minMultiplier;
            points = multiplier * 3;
          } else if (pattern === 1) {
            // 5的倍数 (550-3550)
            const minMultiplier = Math.ceil(550 / 5);
            const maxMultiplier = Math.floor(3550 / 5);
            const multiplier = Math.floor(monthlySeededRandom() * (maxMultiplier - minMultiplier + 1)) + minMultiplier;
            points = multiplier * 5;
          } else if (pattern === 2) {
            // 8的倍数 (552-3544)
            const minMultiplier = Math.ceil(550 / 8);
            const maxMultiplier = Math.floor(3550 / 8);
            const multiplier = Math.floor(monthlySeededRandom() * (maxMultiplier - minMultiplier + 1)) + minMultiplier;
            points = multiplier * 8;
            } else {
            // 7的倍数 (553-3549)
            const minMultiplier = Math.ceil(550 / 7);
            const maxMultiplier = Math.floor(3550 / 7);
            const multiplier = Math.floor(monthlySeededRandom() * (maxMultiplier - minMultiplier + 1)) + minMultiplier;
            points = multiplier * 7;
          }
          
          return points;
        };
        
        // 生成积分
        dailyPoints = generateDailyPoints();
        monthlyPoints = generateMonthlyPoints();
        
        // 随机颜色
        const colorIndex = Math.floor(monthlySeededRandom() * colors.length);
        
        // 为每个虚拟用户存储日积分和月积分
        users.push({
          userId: `virtual_user_${i}`,
          nickName: username,
          avatarUrl: '', // 默认头像（显示为晓字颜色）
          avatarColor: colors[colorIndex],
          dailyPoints: dailyPoints,   // 存储日积分
          monthlyPoints: monthlyPoints, // 存储月积分
          isMe: false
        });
      }
      
      return users;
      
    } catch (error) {
      console.error('生成虚拟用户错误:', error);
      // 返回一组基本的虚拟用户，确保即使出错也有数据显示
      // 使用简单的基于日期的随机数
      const today = new Date();
      const simpleSeed = today.getDate() + today.getMonth() * 31;
      return Array(20).fill(null).map((_, i) => ({
        userId: `virtual_user_backup_${i}`,
        nickName: `用户${i+1}`,
        avatarUrl: '',
        avatarColor: '#4ECDC4',
        points: ((simpleSeed + i * 7) % 100) + 1,
        isMe: false
      }));
    }
  },
  
  // 更新月度积分
  updateMonthPoints: function() {
    // 将今日积分累加到月度积分
    const monthPoints = this.data.monthPoints + this.data.todayPoints;
    
    this.setData({
      monthPoints: monthPoints
    });
    
    // 保存到本地存储
    wx.getStorage({
      key: 'user_points',
      success: (res) => {
        const pointsData = res.data;
        pointsData.monthPoints = monthPoints;
        
        wx.setStorage({
          key: 'user_points',
          data: pointsData
        });
      },
      fail: () => {
        // 如果没有存储数据，创建新的
        wx.setStorage({
          key: 'user_points',
          data: {
            todayPoints: this.data.todayPoints,
            monthPoints: monthPoints,
            totalPoints: this.data.todayPoints,
            lastUpdateDate: this.getToday()
          }
        });
      }
    });
  },
  
  // 获取今天日期的辅助函数
  getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // 切换标签页
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
  },
  
  // 刷新排行榜
  refreshRankings: function() {
    try {
      // 显示加载中
      wx.showLoading({
        title: '刷新中...',
      });
      
      // 重新加载数据
      this.loadUserPoints();
      
      setTimeout(() => {
        this.loadRankingData();
        
        wx.hideLoading();
        wx.showToast({
          title: '排行榜已刷新',
          icon: 'success',
          duration: 1500
        });
      }, 300);
    } catch (error) {
      console.error('刷新排行榜错误:', error);
      wx.hideLoading();
    }
  },
  
  // 启动本地存储监听
   startStorageListener: function() {
     // 清除之前的监听器
     if (this.data.storageListener) {
       clearInterval(this.data.storageListener);
     }
     
     // 设置定时器监听本地存储变化
     const listener = setInterval(() => {
       try {
         // 检查今日积分是否有变化
         const currentTodayPoints = wx.getStorageSync('todayListenPoints') || 0;
         
         if (currentTodayPoints !== this.data.todayPoints) {
           console.log('检测到今日积分变化:', currentTodayPoints, '之前:', this.data.todayPoints);
           
           // 立即更新页面显示的积分
           this.setData({
             todayPoints: currentTodayPoints
           });
           
           // 更新排行榜数据，确保列表中的积分也同步
           this.loadRankingData();
         }
       } catch (error) {
         console.error('本地存储监听错误:', error);
       }
     }, 1000); // 每1秒检查一次，提高响应速度
     
     this.setData({
       storageListener: listener
     });
   },
  
  // 停止本地存储监听
  stopStorageListener: function() {
    if (this.data.storageListener) {
      clearInterval(this.data.storageListener);
      this.setData({
        storageListener: null
      });
    }
  }
})