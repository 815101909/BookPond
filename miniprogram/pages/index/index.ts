// index.ts
// 获取应用实例
const app = getApp<IAppOption>()
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Component({
  data: {
    motto: 'Hello World',
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
  },
  lifetimes: {
    attached() {
      // 检查用户是否已登录
      if (app.globalData.hasUserInfo && app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo,
          hasUserInfo: true
        })
        
        // 用户已登录，自动导航到读一读页面（作为主页）
        wx.switchTab({
          url: '/pages/read/read'
        })
      } else {
        // 检查本地存储中是否有用户信息
        const userInfo = wx.getStorageSync('userInfo')
        if (userInfo) {
          app.globalData.userInfo = userInfo
          app.globalData.hasUserInfo = true
          this.setData({
            userInfo: userInfo,
            hasUserInfo: true
          })
          
          // 用户已登录，自动导航到读一读页面（作为主页）
          wx.switchTab({
            url: '/pages/read/read'
          })
        }
      }
    }
  },
  methods: {
    // 事件处理函数
    bindViewTap() {
      wx.navigateTo({
        url: '../logs/logs',
      })
    },
    // 跳过登录，直接进入应用
    skipLogin() {
      console.log('用户选择跳过登录')
      
      // 创建一个临时用户信息
      const tempUserInfo: WechatMiniprogram.UserInfo = {
        nickName: '游客',
        avatarUrl: defaultAvatarUrl,
        gender: 0,
        country: '',
        province: '',
        city: '',
        language: 'zh_CN'
      }
      
      // 更新全局数据
      app.globalData.userInfo = tempUserInfo
      app.globalData.hasUserInfo = false
      
      // 直接导航到读一读页面
      wx.switchTab({
        url: '/pages/read/read'
      })
    },
    onChooseAvatar(e: any) {
      const { avatarUrl } = e.detail
      const { nickName } = this.data.userInfo
      const isUserInfoComplete = nickName && avatarUrl && avatarUrl !== defaultAvatarUrl
      
      this.setData({
        "userInfo.avatarUrl": avatarUrl,
        hasUserInfo: isUserInfoComplete,
      })
      
      if (isUserInfoComplete) {
        // 保存完整的用户信息
        const updatedUserInfo: WechatMiniprogram.UserInfo = {
          nickName: nickName,
          avatarUrl: avatarUrl,
          gender: 0,
          country: '',
          province: '',
          city: '',
          language: 'zh_CN'
        }
        
        // 更新全局数据和本地存储
        app.globalData.userInfo = updatedUserInfo
        app.globalData.hasUserInfo = true
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        // 延迟一下再导航，确保数据已保存
        setTimeout(() => {
          // 导航到读一读页面（作为主页）
          wx.switchTab({
            url: '/pages/read/read'
          })
        }, 500)
      }
    },
    onInputChange(e: any) {
      const nickName = e.detail.value
      const { avatarUrl } = this.data.userInfo
      const isUserInfoComplete = nickName && avatarUrl && avatarUrl !== defaultAvatarUrl
      
      this.setData({
        "userInfo.nickName": nickName,
        hasUserInfo: isUserInfoComplete,
      })
      
      if (isUserInfoComplete) {
        // 保存完整的用户信息
        const updatedUserInfo: WechatMiniprogram.UserInfo = {
          nickName: nickName,
          avatarUrl: avatarUrl,
          gender: 0,
          country: '',
          province: '',
          city: '',
          language: 'zh_CN'
        }
        
        // 更新全局数据和本地存储
        app.globalData.userInfo = updatedUserInfo
        app.globalData.hasUserInfo = true
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        // 延迟一下再导航，确保数据已保存
        setTimeout(() => {
          // 导航到读一读页面（作为主页）
          wx.switchTab({
            url: '/pages/read/read'
          })
        }, 500)
      }
    },
    getUserProfile() {
      // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
      wx.getUserProfile({
        desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
        success: (res) => {
          console.log(res)
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
          
          // 保存用户信息
          app.globalData.userInfo = res.userInfo
          app.globalData.hasUserInfo = true
          wx.setStorageSync('userInfo', res.userInfo)
          
          // 导航到读一读页面（作为主页）
          wx.switchTab({
            url: '/pages/read/read'
          })
        }
      })
    },
  },
})
