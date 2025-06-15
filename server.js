const express = require('express');
const app = express();
const PORT = 3000;

// 启用CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// 解析JSON请求体
app.use(express.json());

// API路由
app.get('/api/articles', (req, res) => {
  const { level, page = 1, date, languages } = req.query;
  console.log(`收到文章请求: 级别=${level}, 页码=${page}, 日期=${date}, 语言=${languages}`);
  
  // 模拟延迟
  setTimeout(() => {
    // 根据难度级别生成不同的文章
    const articles = [];
    const categories = ['自然科学', '社会科学', '文化艺术'];
    
    if (level === 'sprout') {
      // 萌芽岛文章
      articles.push(
        {
          _id: 'sprout-article-1',
          title: '探索海洋的奥秘',
          coverImage: '/images/news/ocean.jpg',
          introduction: '海洋覆盖了地球表面的71%，让我们一起探索这个神秘的世界。',
          category: categories[0],
          publishDate: date || new Date().toISOString(),
          difficulty: 'sprout',
          type: 'news'
        },
        {
          _id: 'sprout-article-2',
          title: '有趣的动物行为',
          coverImage: '/images/news/animal.jpg',
          introduction: '动物们有着令人惊叹的生存智慧，让我们一起来了解它们。',
          category: categories[0],
          publishDate: date || new Date().toISOString(),
          difficulty: 'sprout',
          type: 'news'
        },
        {
          _id: 'sprout-article-3',
          title: '神奇的植物世界',
          coverImage: '/images/news/plant.jpg',
          introduction: '植物是地球上最古老的生命形式之一，它们有着独特的生存方式。',
          category: categories[0],
          publishDate: date || new Date().toISOString(),
          difficulty: 'sprout',
          type: 'news'
        }
      );
    } else if (level === 'forest') {
      // 森林谷文章
      articles.push(
        {
          _id: 'forest-article-1',
          title: '人工智能的未来发展',
          coverImage: '/images/news/ai.jpg',
          introduction: '人工智能正在改变我们的生活，让我们看看它的发展方向。',
          category: categories[1],
          publishDate: date || new Date().toISOString(),
          difficulty: 'forest',
          type: 'news'
        },
        {
          _id: 'forest-article-2',
          title: '全球气候变化',
          coverImage: '/images/news/climate.jpg',
          introduction: '气候变化正在影响着地球的每个角落，我们需要采取行动。',
          category: categories[1],
          publishDate: date || new Date().toISOString(),
          difficulty: 'forest',
          type: 'news'
        },
        {
          _id: 'forest-article-3',
          title: '现代艺术的发展',
          coverImage: '/images/news/art.jpg',
          introduction: '艺术是人类文明的结晶，让我们探索现代艺术的魅力。',
          category: categories[2],
          publishDate: date || new Date().toISOString(),
          difficulty: 'forest',
          type: 'news'
        }
      );
    }

    const mockData = {
      currentPage: parseInt(page),
      totalPages: 1,
      articles: articles
    };
    
    res.json(mockData);
  }, 300);
});

// 获取文章词汇
app.get('/api/articles/:id/vocabulary', (req, res) => {
  const { id } = req.params;
  const { language = 'zh-CN', languages } = req.query;
  
  console.log(`收到词汇请求: 文章ID=${id}, 语言=${language}, 对照语言=${languages}`);
  
  // 模拟响应
  const vocabulary = [
    {
      text: "科技",
      translations: {
        en: "technology",
        fr: "technologie",
        ja: "科学技術"
      }
    },
    {
      text: "创新",
      translations: {
        en: "innovation",
        fr: "innovation",
        ja: "革新"
      }
    },
    {
      text: "研究",
      translations: {
        en: "research",
        fr: "recherche",
        ja: "研究"
      }
    }
  ];
  
  res.json(vocabulary);
});

// 测试端点
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'API服务器工作正常!' });
});

// === 用户管理API ===

// 获取用户列表
app.get('/api/admin/users', (req, res) => {
  const { page = 1, pageSize = 10, status, role, searchQuery } = req.query;
  
  // 模拟用户数据
  const mockUsers = [];
  const totalUsers = 25;
  
  for (let i = 1; i <= pageSize; i++) {
    const userId = (page - 1) * pageSize + i;
    if (userId <= totalUsers) {
      mockUsers.push({
        id: `user-${userId}`,
        username: `user${userId}`,
        nickname: `用户${userId}`,
        role: userId % 3 === 0 ? 'admin' : 'user',
        status: userId % 5 === 0 ? 'inactive' : 'active',
        lastLoginTime: new Date(Date.now() - userId * 86400000).toISOString(),
        registrationTime: new Date(Date.now() - userId * 86400000 * 2).toISOString()
      });
    }
  }
  
  res.json({
    users: mockUsers,
    pagination: {
      currentPage: parseInt(page),
      pageSize: parseInt(pageSize),
      totalItems: totalUsers,
      totalPages: Math.ceil(totalUsers / pageSize)
    }
  });
});

// 获取用户详情
app.get('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;
  
  // 模拟用户详情数据
  const userDetail = {
    id: id,
    username: `user${id.split('-')[1]}`,
    nickname: `用户${id.split('-')[1]}`,
    email: `user${id.split('-')[1]}@example.com`,
    phone: `1385555${id.split('-')[1].padStart(4, '0')}`,
    role: parseInt(id.split('-')[1]) % 3 === 0 ? 'admin' : 'user',
    status: parseInt(id.split('-')[1]) % 5 === 0 ? 'inactive' : 'active',
    lastLoginTime: new Date(Date.now() - parseInt(id.split('-')[1]) * 86400000).toISOString(),
    registrationTime: new Date(Date.now() - parseInt(id.split('-')[1]) * 86400000 * 2).toISOString(),
    usageStats: {
      totalReadArticles: parseInt(id.split('-')[1]) * 5,
      totalFavorites: parseInt(id.split('-')[1]) * 2,
      totalListenHours: parseInt(id.split('-')[1]) * 0.5,
      totalSpeakingExercises: parseInt(id.split('-')[1]) * 3
    }
  };
  
  res.json(userDetail);
});

// 创建管理员用户
app.post('/api/admin/users', (req, res) => {
  const { username, password, email, role, status } = req.body;
  
  // 验证必填字段
  if (!username || !password || !email) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段'
    });
  }
  
  // 模拟创建用户
  res.status(201).json({
    success: true,
    message: '用户创建成功',
    user: {
      id: `user-${Date.now()}`,
      username,
      email,
      role: role || 'admin',
      status: status || 'active',
      createdAt: new Date().toISOString()
    }
  });
});

// 更新用户状态
app.put('/api/admin/users/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // 验证状态参数
  if (!status || !['active', 'inactive', 'blocked'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: '无效的状态值'
    });
  }
  
  res.json({
    success: true,
    message: `用户状态已更新为: ${status}`,
    user: {
      id,
      status
    }
  });
});

// 重置用户密码
app.post('/api/admin/users/:id/reset-password', (req, res) => {
  const { id } = req.params;
  
  // 模拟生成随机密码
  const newPassword = Math.random().toString(36).slice(-8);
  
  res.json({
    success: true,
    message: '密码已重置',
    newPassword: newPassword
  });
});

// === 系统设置API ===

// 获取系统配置
app.get('/api/admin/settings', (req, res) => {
  // 模拟系统配置数据
  const settings = {
    appName: '九域语言学习',
    siteLogo: '/images/logo.png',
    supportedLanguages: [
      { code: 'zh-CN', name: '中文（简体）', isDefault: true },
      { code: 'en', name: 'English', isDefault: false },
      { code: 'fr', name: 'Français', isDefault: false },
      { code: 'ja', name: '日本語', isDefault: false }
    ],
    defaultPageSize: 10,
    articleCacheDuration: 3600,
    enableUserRegistration: true,
    enablePushNotifications: true,
    systemMaintenanceMode: false
  };
  
  res.json(settings);
});

// 更新系统配置
app.put('/api/admin/settings', (req, res) => {
  const { appName, siteLogo, defaultPageSize, enableUserRegistration, enablePushNotifications, systemMaintenanceMode } = req.body;
  
  // 模拟更新响应
  res.json({
    success: true,
    message: '系统设置已更新',
    settings: {
      appName: appName || '九域语言学习',
      siteLogo: siteLogo || '/images/logo.png',
      defaultPageSize: defaultPageSize || 10,
      enableUserRegistration: enableUserRegistration !== undefined ? enableUserRegistration : true,
      enablePushNotifications: enablePushNotifications !== undefined ? enablePushNotifications : true,
      systemMaintenanceMode: systemMaintenanceMode !== undefined ? systemMaintenanceMode : false,
      lastUpdated: new Date().toISOString()
    }
  });
});

// 管理支持的语言
app.put('/api/admin/settings/languages', (req, res) => {
  const { languages } = req.body;
  
  // 验证语言数组
  if (!languages || !Array.isArray(languages)) {
    return res.status(400).json({
      success: false,
      message: '无效的语言配置'
    });
  }
  
  res.json({
    success: true,
    message: '语言设置已更新',
    supportedLanguages: languages
  });
});

// 系统数据备份
app.post('/api/admin/settings/backup', (req, res) => {
  // 模拟备份创建过程
  setTimeout(() => {
    res.json({
      success: true,
      message: '系统备份已创建',
      backup: {
        id: `backup-${Date.now()}`,
        fileName: `backup-${new Date().toISOString().split('T')[0]}.zip`,
        createdAt: new Date().toISOString(),
        fileSize: '28.5MB',
        downloadUrl: `/api/admin/settings/backup/download/${Date.now()}`
      }
    });
  }, 500);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('支持的API端点:');
  console.log('- GET /api/articles?level=<level>&page=<page>&date=<date>&languages=<languages>');
  console.log('- GET /api/articles/:id/vocabulary?language=<language>&languages=<languages>');
  console.log('- GET /api/admin/users - 获取用户列表');
  console.log('- GET /api/admin/users/:id - 获取用户详情');
  console.log('- POST /api/admin/users - 创建管理员用户');
  console.log('- PUT /api/admin/users/:id/status - 更新用户状态');
  console.log('- POST /api/admin/users/:id/reset-password - 重置用户密码');
  console.log('- GET /api/admin/settings - 获取系统配置');
  console.log('- PUT /api/admin/settings - 更新系统配置');
  console.log('- PUT /api/admin/settings/languages - 管理支持的语言');
  console.log('- POST /api/admin/settings/backup - 系统数据备份');
  console.log('- GET /api/test');
}); 
 
 
 