// 登录页面
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
    isLoggingIn: false,
    
    // 协议页链接
    privacyUrl: '/pages/privacy/privacy',
    agreementUrl: '/pages/agreement/agreement'
  },
  
  onLoad: function() {
    // 检查用户是否已登录
    const token = wx.getStorageSync('token');
    if (token) {
      this.navigateAfterLogin();
    }
    
    // 尝试获取已有的用户信息
    const savedUserInfo = wx.getStorageSync('userInfo');
    if (savedUserInfo) {
      this.setData({
        userInfo: savedUserInfo
      });
    }
  },
  
  // 用户点击微信登录
  handleGetUserProfile: function() {
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
    
    // 获取用户信息
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo
        });
        
        // 保存用户信息
        wx.setStorageSync('userInfo', res.userInfo);
        
        // 如果用户还没有获取手机号，引导获取手机号
        if (!this.data.hasPhoneNumber) {
          this.setData({
            loginMethod: 'phone'
          });
        } else {
          this.loginWithServer();
        }
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          isLoggingIn: false
        });
      }
    });
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
      
      // 获取到加密的手机号信息
      const encryptedData = e.detail.encryptedData;
      const iv = e.detail.iv;
      
      // 获取微信登录凭证
      wx.login({
        success: (res) => {
          if (res.code) {
            // 将code、encryptedData和iv发送到服务器解密获取手机号
            // 这里是模拟请求，实际开发中应该调用真实的API
            setTimeout(() => {
              // 模拟获取手机号成功
              this.setData({
                hasPhoneNumber: true,
                phoneNumber: '138****1234' // 实际情况会从服务器获取解密后的手机号
              });
              
              // 登录
              this.loginWithServer();
            }, 1000);
          } else {
            console.error('微信登录失败', res.errMsg);
            wx.showToast({
              title: '微信登录失败',
              icon: 'none'
            });
            this.setData({
              isLoggingIn: false
            });
          }
        },
        fail: (err) => {
          console.error('微信登录失败', err);
          wx.showToast({
            title: '微信登录失败',
            icon: 'none'
          });
          this.setData({
            isLoggingIn: false
          });
        }
      });
    } else {
      console.log('用户拒绝授权手机号', e.detail.errMsg);
      
      // 用户拒绝授权手机号，切换到验证码登录
      this.setData({
        loginMethod: 'code'
      });
    }
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
    
    // 模拟发送验证码请求
    // 实际开发中应该调用真实的API
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
    
    // 模拟验证手机号和验证码的请求
    // 实际开发中应该调用真实的API
    setTimeout(() => {
      this.setData({
        hasPhoneNumber: true,
        phoneNumber: phone,
        isLoggingIn: false
      });
      
      // 登录
      this.loginWithServer();
    }, 1000);
  },
  
  // 与服务器交互完成登录
  loginWithServer: function() {
    this.setData({
      isLoggingIn: true
    });
    
    // 获取微信登录凭证
    wx.login({
      success: (res) => {
        if (res.code) {
          // 准备登录数据
          const loginData = {
            code: res.code
          };
          
          // 如果有手机号，添加到登录数据
          if (this.data.loginMethod === 'phone' && this.data.phone) {
            loginData.phone = this.data.phone;
          } else if (this.data.loginMethod === 'code' && this.data.inputPhone && this.data.verificationCode) {
            loginData.inputPhone = this.data.inputPhone;
            loginData.verificationCode = this.data.verificationCode;
          }
          
          // 判断是否在开发模式
          const api = require('../../utils/api.js');
          if (api.DEV_CONFIG.BYPASS_AUTH) {
            console.log('开发模式：跳过实际登录API调用，使用模拟登录');
            // 模拟登录成功，设置token
            wx.setStorageSync('token', 'mock_token_' + Date.now());
            
            wx.showToast({
              title: '登录成功（开发模式）',
              icon: 'success',
              duration: 1500,
              success: () => {
                setTimeout(() => {
                  this.navigateAfterLogin();
                }, 1500);
              }
            });
            
            this.setData({
              isLoggingIn: false
            });
            return;
          }
          
          // 调用登录API
          wx.request({
            url: api.BASE_URL + '/api/auth/login',
            method: 'POST',
            data: loginData,
            header: {
              'content-type': 'application/json'
            },
            success: (res) => {
              if (res.statusCode === 200 && res.data && res.data.token) {
                // 保存令牌到本地存储
                wx.setStorageSync('token', res.data.token);
                
                // 如果有用户信息，也保存
                if (res.data.user) {
                  wx.setStorageSync('userInfo', res.data.user);
                }
                
                wx.showToast({
                  title: '登录成功',
                  icon: 'success',
                  duration: 1500,
                  success: () => {
                    setTimeout(() => {
                      this.navigateAfterLogin();
                    }, 1500);
                  }
                });
              } else {
                console.error('登录失败', res);
                let errorMsg = '登录失败';
                if (res.data && res.data.msg) {
                  errorMsg = res.data.msg;
                } else if (res.data && res.data.message) {
                  errorMsg = res.data.message;
                }
                
                wx.showToast({
                  title: errorMsg,
                  icon: 'none',
                  duration: 2000
                });
              }
              
              this.setData({
                isLoggingIn: false
              });
            },
            fail: (err) => {
              console.error('登录请求失败', err);
              wx.showToast({
                title: '网络错误，请稍后重试',
                icon: 'none',
                duration: 2000
              });
              
              this.setData({
                isLoggingIn: false
              });
            }
          });
        } else {
          console.error('微信登录失败', res.errMsg);
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
          this.setData({
            isLoggingIn: false
          });
        }
      },
      fail: (err) => {
        console.error('微信登录失败', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
        this.setData({
          isLoggingIn: false
        });
      }
    });
  },
  
  // 切换登录方式
  switchLoginMethod: function(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      loginMethod: method
    });
  },
  
  // 勾选隐私协议
  togglePrivacyCheck: function() {
    this.setData({
      isPrivacyChecked: !this.data.isPrivacyChecked
    });
  },
  
  // 登录成功后的跳转
  navigateAfterLogin: function() {
    // 获取登录前的页面路径
    const redirectUrl = wx.getStorageSync('redirectUrl') || '/pages/index/index';
    
    // 清除登录前的页面路径
    wx.removeStorageSync('redirectUrl');
    
    // 跳转到登录前的页面或首页
    wx.reLaunch({
      url: redirectUrl
    });
  },
  
  // 查看用户协议
  viewAgreement: function() {
    wx.navigateTo({
      url: this.data.agreementUrl
    });
  },
  
  // 查看隐私政策
  viewPrivacy: function() {
    wx.navigateTo({
      url: this.data.privacyUrl
    });
  }
}) 