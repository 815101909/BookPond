// 会员页面逻辑
Page({
  data: {
    isLoading: true,
    apiError: false,
    promoImageUrl: '', // 宣传图片URL，由后端提供
    selectedPlan: 'monthly', // 默认选中月度会员
    bestValue: 'yearly', // 最佳性价比标记
    prices: {
      monthly: 28,
      quarterly: 78,
      halfYear: 138,
      yearly: 268
    }
  },

  onLoad: function() {
    this.loadMembershipData();
  },
  
  // 加载会员数据
  loadMembershipData: function() {
    this.setData({
      isLoading: true,
      apiError: false
    });
    
    // 从后端获取会员数据的API调用
    const that = this;
    
    // 模拟API请求
    setTimeout(() => {
      // 这里应该是真实的API请求，获取会员图片和价格信息
      // wx.request({
      //   url: 'https://api.example.com/membership',
      //   success: (res) => {
      //     that.setData({
      //       promoImageUrl: res.data.promoImageUrl,
      //       prices: res.data.prices,
      //       bestValue: res.data.bestValue || 'yearly',
      //       isLoading: false
      //     });
      //   },
      //   fail: () => {
      //     that.setData({
      //       isLoading: false,
      //       apiError: true
      //     });
      //   }
      // });
      
      // 临时使用占位图和模拟数据
      that.setData({
        promoImageUrl: '/images/membership-promo.png',
        prices: {
          monthly: 28,
          quarterly: 78,
          halfYear: 138,
          yearly: 268
        },
        bestValue: 'yearly',
        isLoading: false
      });
    }, 500);
  },
  
  // 选择会员方案
  selectPlan: function(e) {
    const plan = e.currentTarget.dataset.plan;
    this.setData({
      selectedPlan: plan
    });
  },
  
  // 上传宣传图片
  uploadPromoImage: function() {
    const that = this;
    
    // 管理员权限检查
    const isAdmin = wx.getStorageSync('isAdmin') || false;
    if (!isAdmin) {
      wx.showToast({
        title: '仅管理员可修改',
        icon: 'none'
      });
      return;
    }
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFilePaths[0];
        
        // 显示上传中状态
        wx.showLoading({
          title: '上传中...',
          mask: true
        });
        
        // 这里模拟上传图片到服务器
        // 实际应用中应该调用上传API
        setTimeout(() => {
          // 实际项目中这里应该调用真实的上传API
          // wx.uploadFile({
          //   url: 'https://api.example.com/upload-membership-image',
          //   filePath: tempFilePath,
          //   name: 'file',
          //   success: (uploadRes) => {
          //     const response = JSON.parse(uploadRes.data);
          //     that.setData({
          //       promoImageUrl: response.imageUrl
          //     });
          //     wx.hideLoading();
          //     wx.showToast({
          //       title: '上传成功',
          //       icon: 'success'
          //     });
          //   },
          //   fail: () => {
          //     wx.hideLoading();
          //     wx.showToast({
          //       title: '上传失败',
          //       icon: 'none'
          //     });
          //   }
          // });
          
          // 模拟上传成功
          that.setData({
            promoImageUrl: tempFilePath
          });
          wx.hideLoading();
          wx.showToast({
            title: '上传成功',
            icon: 'success'
          });
        }, 1000);
      }
    });
  },
  
  // 开通会员
  subscribeMembership: function() {
    const plans = {
      'monthly': '月度会员',
      'quarterly': '季度会员',
      'halfYear': '半年会员',
      'yearly': '年度会员'
    };
    
    const plan = this.data.selectedPlan;
    const price = this.data.prices[plan];
    
    wx.showModal({
      title: '确认开通会员',
      content: `您选择了${plans[plan]}，需支付${price}元，确认开通吗？`,
      success: (res) => {
        if (res.confirm) {
          // 显示支付处理中
          wx.showLoading({
            title: '处理中...',
            mask: true
          });
          
          // 模拟支付过程
          setTimeout(() => {
            // 实际应用中，这里应该调用支付API
            // wx.requestPayment({
            //   ...payParams,
            //   success: () => {
            //     // 支付成功
            //     that.updateMembershipStatus(plan);
            //   },
            //   fail: (err) => {
            //     wx.hideLoading();
            //     wx.showToast({
            //       title: '支付取消',
            //       icon: 'none'
            //     });
            //   }
            // });
            
            // 模拟支付成功
            wx.hideLoading();
            this.updateMembershipStatus(plan);
          }, 1500);
        }
      }
    });
  },
  
  // 更新会员状态
  updateMembershipStatus: function(plan) {
    const planDays = {
      'monthly': 30,
      'quarterly': 90,
      'halfYear': 180,
      'yearly': 365
    };
    
    // 创建会员开始和结束日期
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planDays[plan]);
    
    // 格式化日期
    const startDateStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
    const endDateStr = `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`;
    
    // 更新会员信息
    const membershipInfo = {
      isMember: true,
      startDate: startDateStr,
      endDate: endDateStr
    };
    
    // 保存会员信息到本地
    wx.setStorageSync('membershipInfo', membershipInfo);
    
    wx.showToast({
      title: '开通成功',
      icon: 'success',
      duration: 2000
    });
    
    // 延迟返回到个人页面
    setTimeout(() => {
      wx.navigateBack();
    }, 2000);
  }
});

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 