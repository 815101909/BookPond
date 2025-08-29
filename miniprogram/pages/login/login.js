// 登录页面
// 引入跨环境云函数调用工具
const { authAPI } = require('../../utils/cloud-api.js');

Page({
  data: {
    // 是否已获取手机号
    hasPhoneNumber: false,
    
    // 用户微信信息
    userInfo: {
      nickName: '',
      avatarUrl: ''
    },
    
    // 手机号信息
    phoneNumber: '',
    
    // 登录方式
    loginMethod: 'wechat', // wechat, phone, code
    
    // 验证码相关
    countdown: 60,
    isCounting: false,
    verificationCode: '',
    
    // 隐私协议
    isPrivacyChecked: false,
    
    // 登录状态
    isLoggingIn: false
  },
  
  onLoad: function() {
    // 初始化页面，检查登录状态
    console.log('登录页面加载');
    this.checkLoginStatus();
  },

  // 检查登录状态
  async checkLoginStatus() {
    try {
      // 检查本地是否有用户信息，如果没有，则不进行会话检查，直接认为未登录
      const localUserInfo = wx.getStorageSync('userInfo');
      if (!localUserInfo) {
        console.log('本地无用户信息，无需检查登录状态');
        return;
      }

      const result = await authAPI.checkSession();

      if (result.result.code === 0) {
        // 已登录，保存用户信息并跳转
        wx.setStorageSync('userInfo', result.result.data);
        this.navigateAfterLogin();
      } else {
        // 会话失效，清除本地用户信息
        wx.removeStorageSync('userInfo');
        console.log('会话失效，已清除本地用户信息');
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 发生错误时，也清除本地用户信息
      wx.removeStorageSync('userInfo');
    }
  },
  
  // 用户点击微信登录
  async handleGetUserProfile() {
    if (!this.data.isPrivacyChecked) {
      wx.showToast({
        title: '请先同意用户协议和隐私政策',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      isLoggingIn: true
    });
    
    try {
      // 获取用户信息
      const userProfile = await wx.getUserProfile({
        desc: '用于完善个人资料'
      });

      // 调用云函数登录
      const loginResult = await authAPI.login(userProfile.userInfo);

      if (loginResult.result.code === 0) {
        // 登录成功，保存用户信息
        wx.setStorageSync('userInfo', loginResult.result.data);
        
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          this.navigateAfterLogin();
        }, 1500);
      } else {
        throw new Error(loginResult.result.msg);
      }
    } catch (error) {
      console.error('登录失败:', error);
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      });
    } finally {
      this.setData({
        isLoggingIn: false
      });
    }
  },

  // 通过微信获取手机号
  getPhoneNumber: function(e) {
    if (!this.data.isPrivacyChecked) {
      wx.showToast({
        title: '请先同意用户协议和隐私政策',
        icon: 'none'
      });
      return;
    }
    
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      this.setData({
        isLoggingIn: true
      });
      
      // 使用getPhoneNumber事件返回的code，而不是wx.login获取的code
      const code = e.detail.code;
      
      if (!code) {
        console.error('未获取到有效的code');
        wx.showToast({
          title: '获取手机号失败，请重试',
          icon: 'none'
        });
        this.setData({
          isLoggingIn: false
        });
        return;
      }
      
      // 直接使用button返回的code调用云函数
      this.callPhoneLoginAPI(code);
    } else {
      console.log('用户拒绝授权手机号', e.detail.errMsg);
      
      // 用户拒绝授权手机号，回退到微信登录
      this.setData({
        loginMethod: 'wechat',  // 改为 wechat 而不是 code
        isLoggingIn: false
      });
      
      // 显示提示信息
      wx.showToast({
        title: '拒绝授权手机号，已切换回微信登录',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  // 调用手机号登录API
  callPhoneLoginAPI: async function(code) {
    try {
      // 调用云函数获取手机号并登录
      const result = await authAPI.phoneLogin(code);
      
      // 修改这里：检查 result.result.success 而不是 result.success
      if (result.result && result.result.success) {
        // 获取手机号成功，直接完成登录流程
        this.setData({
          hasPhoneNumber: true,
          phoneNumber: result.result.data.phoneNumber,
          isLoggingIn: false
        });
        
        console.log('手机号登录成功：', result.result.data);
        
        // 保存用户信息到本地存储
        wx.setStorageSync('userInfo', {
          userId: result.result.data.userId,
          openid: result.result.data.openid,
          phoneNumber: result.result.data.phoneNumber
        });
        
        // 显示登录成功提示
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });
        
        // 延迟跳转
        setTimeout(() => {
          this.navigateAfterLogin();
        }, 1500);
        
      } else {
        // 获取手机号失败
        console.error('获取手机号失败：', result.result || result);
        
        // 处理手机号登录错误
        this.handlePhoneLoginError(result.result || result);
      }
    } catch (error) {
      console.error('手机号登录异常：', error);
      wx.showToast({
        title: '手机号登录失败，请重试',
        icon: 'none'
      });
      this.setData({
        isLoggingIn: false,
        loginMethod: 'code' // 切换到验证码登录
      });
    }
  },
  
  // 处理手机号登录错误
  handlePhoneLoginError: function(result) {
    let errorMessage = '获取手机号失败';
    let switchToCodeLogin = true;
    
    if (result.errorCode === 'PHONE_VERIFICATION_REQUIRED') {
      errorMessage = '请在微信中完成手机号验证后重试';
    } else if (result.errorCode === 'PHONE_API_RATE_LIMIT') {
      errorMessage = 'API调用过于频繁，请稍后重试';
    } else if (result.errorCode === 'PHONE_LOGIN_ERROR' && result.message.includes('40029')) {
      errorMessage = '授权已过期，请重新点击获取手机号';
      // 对于code无效的情况，提示用户重新授权
      switchToCodeLogin = false;
    } else if (result.message) {
      errorMessage = result.message;
    }
    
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 3000
    });
    
    this.setData({
      isLoggingIn: false,
      loginMethod: switchToCodeLogin ? 'code' : 'wechat' // 根据错误类型决定是否切换到验证码登录
    });
  },
  
  // 验证码输入
  handleCodeInput: function(e) {
    this.setData({
      verificationCode: e.detail.value
    });
  },
  
  // 发送验证码
  sendVerificationCode: function() {
    const phoneInput = this.selectComponent('#phoneInput');
    const phone = phoneInput ? phoneInput.getPhoneNumber() : '';
    
    if (!phone || !/^1\d{10}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }
    
    // 开始倒计时
    this.setData({
      isCounting: true
    });
    
    // TODO: 调用云函数发送验证码
    console.log('发送验证码到手机:', phone);
    
    // 倒计时
    let count = this.data.countdown;
    const timer = setInterval(() => {
      count--;
      this.setData({
        countdown: count
      });
      
      if (count === 0) {
        clearInterval(timer);
        this.setData({
          isCounting: false,
          countdown: 60
        });
      }
    }, 1000);
  },
  
  // 手动输入手机号并验证码登录
  loginWithPhoneAndCode: function() {
    if (!this.data.isPrivacyChecked) {
      wx.showToast({
        title: '请先同意用户协议和隐私政策',
        icon: 'none'
      });
      return;
    }
    
    const phoneInput = this.selectComponent('#phoneInput');
    const phone = phoneInput ? phoneInput.getPhoneNumber() : '';
    
    if (!phone || !/^1\d{10}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.verificationCode || this.data.verificationCode.length !== 6) {
      wx.showToast({
        title: '请输入正确的验证码',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      isLoggingIn: true
    });
    
    // TODO: 调用云函数验证手机号和验证码
    setTimeout(() => {
      this.setData({
        isLoggingIn: false
      });
      
      // 登录成功
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });
      
      // 延迟跳转
      setTimeout(() => {
        this.navigateAfterLogin();
      }, 1500);
    }, 1000);
  },
  
  // 切换登录方式
  switchLoginMethod: function(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      loginMethod: method
    });
  },
  
  // 同意隐私政策
  onPrivacyChecked: function(e) {
    this.setData({
      isPrivacyChecked: e.detail.value.length > 0
    });
  },
  
  // 查看用户协议
  viewAgreement: function() {
    wx.navigateTo({
      url: '/pages/agreement/index'
    });
  },
  
  // 查看隐私政策
  viewPrivacy: function() {
    wx.navigateTo({
      url: '/pages/agreement/index?type=privacy'
    });
  },
  
  // 使用服务器登录
  async loginWithServer() {
    console.log('开始服务器登录流程');
    
    try {
      // 调用云函数进行登录验证
      const loginResult = await authAPI.login();
      
      if (loginResult.result.code === 0) {
        // 登录成功，保存用户信息
        wx.setStorageSync('userInfo', loginResult.result.data);
        
        this.setData({
          isLoggingIn: false
        });
        
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });
        
        // 延迟跳转
        setTimeout(() => {
          this.navigateAfterLogin();
        }, 1500);
      } else {
        throw new Error(loginResult.result.msg);
      }
    } catch (error) {
      console.error('登录失败:', error);
      
      this.setData({
        isLoggingIn: false
      });
      
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      });
    }
  },
  
  // 登录成功后的跳转处理
  navigateAfterLogin: function() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      // 如果有上一页，直接返回
      wx.navigateBack({
        delta: 1
      });
    } else {
      // 如果没有上一页，跳转到读一读页面
      wx.switchTab({
        url: '/pages/read/read'
      });
    }
  }
});