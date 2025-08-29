// app.js
wx.cloud.init({
  env: 'cloud1-1gsyt78b92c539ef', // 替换成你的云开发环境ID
  traceUser: true
});

App({
  onLaunch: function () {

    
    // 主动预热API连接
    this.preWarmApiConnection();
    
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);
    
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          wx.getUserInfo({
            success: res => {
              // 可以将 res 发送给后台解码出 unionId
              this.globalData.userInfo = res.userInfo;
              
              // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
              // 所以此处加入 callback 以防止这种情况
              if (this.userInfoReadyCallback) {
                this.userInfoReadyCallback(res);
              }
            }
          });
        }
      }
    });
    
    // 测试后台API连接
    this.testAPIConnection();
  },
  
  // 主动预热API连接 - 已禁用
  preWarmApiConnection: function() {
    // API功能已禁用，无需预热连接
    this.globalData.apiConnectionStatus = {
      status: 'disabled',
      details: 'API功能已禁用'
    };
  },
  
  // 测试API连接 - 已禁用
  testAPIConnection: function() {
    // API功能已禁用，直接设置状态
    this.globalData.apiConnectionStatus = {
      status: 'disabled',
      details: 'API功能已禁用'
    };
    
    // 通知已打开的页面连接状态更新
    if (this.apiConnectionStatusCallback) {
      this.apiConnectionStatusCallback(this.globalData.apiConnectionStatus);
    }
  },
  
  // 更新API路径格式
  updateApiPathFormat: function(detectedPath) {
    const apiUtil = require('./utils/api');
    
    // 检测到的API路径格式
    console.log('检测到的API路径格式:', detectedPath);
    
    // 规范化路径（去掉末尾的斜杠）
    const normalizedPath = detectedPath.endsWith('/') ? detectedPath.slice(0, -1) : detectedPath;
    let apiPrefix = '';
    
    // 分析API路径格式
    if (normalizedPath.startsWith('/api/')) {
      // 例如 /api/v1/news -> 使用 /api 作为路径前缀
      apiPrefix = '/api';
      console.log('检测到API路径格式: /api/...');
    } else if (normalizedPath === '/api') {
      // API根路径是 /api
      apiPrefix = '/api';
      console.log('检测到API根路径: /api');
    } else if (normalizedPath.startsWith('/v1/') || normalizedPath === '/v1') {
      // 例如 /v1/news -> 使用 /v1 作为路径前缀
      apiPrefix = '/v1';
      console.log('检测到API路径格式: /v1/...');
    } else {
      // 其他格式，不使用前缀
      apiPrefix = '';
      console.log('使用直接路径格式，无需前缀');
    }
    
    // 记录到全局数据
    this.globalData.apiPrefix = apiPrefix;
    console.log('已设置API前缀:', apiPrefix);
    
    // 动态修改API路径
    const originalRequest = apiUtil.request;
    
    // 替换request方法，自动添加前缀
    apiUtil.request = function(url, method = 'GET', data = {}, retryCount = 0) {
      // 如果url已经包含前缀，则不重复添加
      let processedUrl = url;
      
      // 当ApiPrefix非空，且URL不是以ApiPrefix开头时，添加前缀
      if (apiPrefix && !url.startsWith(apiPrefix)) {
        // 移除URL可能开头的斜杠
        if (url.startsWith('/')) {
          processedUrl = apiPrefix + url;
        } else {
          processedUrl = apiPrefix + '/' + url;
        }
        console.log(`API路径自动调整: ${url} -> ${processedUrl}`);
      }
      
      return originalRequest(processedUrl, method, data, retryCount);
    };
    
    console.log('已完成API路径格式自适应调整');
    
    // 显示调整成功信息
    wx.showToast({
      title: '已优化API连接',
      icon: 'success',
      duration: 1500
    });
  },
  
  globalData: {
    userInfo: null,
    pendingAudio: null, // 待播放的音频信息
    selectedArticleFromMessenger: null, // 从信使驿站选择的文章信息
    apiConnectionStatus: {
      status: 'unknown',
      message: '尚未检查后台连接状态'
    },
    apiPrefix: ''
  }
})