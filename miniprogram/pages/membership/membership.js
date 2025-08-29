// 会员页面逻辑
const cloudApi = require('../../utils/cloud-api.js');

// 通用临时链接处理函数
async function getTemporaryFileUrl(fileUrl, type = 'file') {
  if (!fileUrl) {
    console.log(`${type}链接为空`);
    return null;
  }

  try {
    if (fileUrl.startsWith('cloud://')) {
      try {
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
          console.log(`${type}云存储URL转换成功:`, fileUrl, '->', result.fileList[0].tempFileURL);
          return result.fileList[0].tempFileURL;
        } else {
          console.error(`${type}云链接转换失败:`, result);
          return fileUrl; // 返回原URL
        }
      } catch (err) {
        console.error(`${type}云链接转换异常:`, err);
        return fileUrl; // 返回原URL
      }
    }

    if (fileUrl.startsWith('http')) {
      console.log(`${type}链接为HTTP地址:`, fileUrl);
      return fileUrl;
    }

    console.log(`${type}链接格式未知，返回原链接:`, fileUrl);
    return fileUrl;
  } catch (error) {
    console.error(`处理${type}链接时出错:`, error);
    return fileUrl;
  }
}

Page({
  data: {
    isLoading: true,
    apiError: false,
    promoImageUrl: '', // 宣传图片URL，由后端提供
    selectedPlan: 'monthly', // 默认选中月度会员
    bestValue: 'yearly', // 最佳性价比标记
    prices: {
      monthly: 0,
      quarterly: 0,
      halfYear: 0,
      yearly: 0
    },
    originalPrices: {
      monthly: 0,
      quarterly: 0,
      halfYear: 0,
      yearly: 0
    }
  },

  onLoad: function() {
    this.loadMembershipData();
  },
  
  // 加载会员数据
  loadMembershipData: async function() {
    this.setData({
      isLoading: true,
      apiError: false
    });
    
    try {
        const res = await cloudApi.callCloudFunction('jiuyu_membership', { action: 'getMembershipPlans' });
      console.log('获取会员计划结果:', res);

      if (res.result.code === 0 && res.result.data && res.result.data.length > 0) {
        const prices = {};
        const originalPrices = {};
        let promoImageUrl = '';
        let bestValue = '';

        res.result.data.forEach(plan => {
          console.log('处理计划:', plan.id, '价格:', plan.price, '原价:', plan.original);
          prices[plan.id] = plan.price;
          originalPrices[plan.id] = plan.original;
          if (plan.isPromo) {
            promoImageUrl = plan.promoImageUrl; // 假设有一个isPromo字段来标识宣传图片
          }
          if (plan.isBestValue) {
            bestValue = plan.id; // 假设有一个isBestValue字段来标识最佳性价比
          }
        });
        
        console.log('构建的prices对象:', prices);

        // 处理宣传图片URL
        const cloudPromoImageUrl = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/membership/小舟摇书池会员.jpg';
        let finalPromoImageUrl = cloudPromoImageUrl;
        
        try {
          // 转换云存储链接为临时链接
          finalPromoImageUrl = await getTemporaryFileUrl(cloudPromoImageUrl, '宣传图片');
        } catch (error) {
          console.error('宣传图片临时链接转换失败:', error);
          // 如果转换失败，使用原始云存储链接
          finalPromoImageUrl = cloudPromoImageUrl;
        }

        this.setData({
          promoImageUrl: finalPromoImageUrl,
          prices: prices,
          originalPrices: originalPrices,
          bestValue: bestValue || 'yearly',
          isLoading: false,
          apiError: false
        });
      } else {
        this.setData({
          isLoading: false,
          apiError: true
        });
        wx.showToast({
          title: '获取会员计划失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('调用云函数获取会员计划失败:', error);
      this.setData({
        isLoading: false,
        apiError: true
      });
      wx.showToast({
        title: '网络错误，获取会员计划失败',
        icon: 'none'
      });
    }
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
  subscribeMembership: async function() {
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
      success: async (res) => {
        if (res.confirm) {
          // 显示支付处理中
          wx.showLoading({
            title: '处理中...',
            mask: true
          });
          
          try {
            const orderRes = await cloudApi.callCloudFunction('jiuyu_pay', {
              action: 'createOrder',
              planType: plan,
              amount: price * 100 // 微信支付金额单位为分
            });
            console.log('创建订单结果:', orderRes);

            if (orderRes.result && orderRes.result.data) {
              const payParams = orderRes.result.data;

              // 发起微信支付
              wx.requestPayment({
                timeStamp: payParams.timeStamp,
                nonceStr: payParams.nonceStr,
                package: payParams.package,
                signType: payParams.signType,
                paySign: payParams.paySign,
                success: (res) => {
                  wx.hideLoading();
                  wx.showToast({
                    title: '支付成功',
                    icon: 'success'
                  });
                  // 支付成功后，清除会员过期弹窗的本地存储标志
                  wx.removeStorageSync('hasShownExpiredModal');
                  // 支付成功后，刷新会员状态
                  // 可以在这里调用一个方法来更新用户界面的会员状态
                  // 例如：this.checkMemberStatus();
                  wx.navigateBack(); // 返回上一页
                },
                fail: (err) => {
                  wx.hideLoading();
                  console.error('支付失败:', err);
                  wx.showToast({
                    title: '支付失败',
                    icon: 'none'
                  });
                }
              });
            } else {
              wx.hideLoading();
              wx.showToast({
                title: (orderRes.result && orderRes.result.errmsg) || '创建订单失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('调用云函数创建订单失败:', error);
            wx.hideLoading();
            wx.showToast({
              title: '网络错误，创建订单失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },
  
  // 更新会员状态
  updateMembershipStatus: async function(plan, orderId) {
    wx.showLoading({
      title: '激活会员中...', 
      mask: true
    });
    try {
      const activateRes = await cloudApi.callCloudFunction('jiuyu_pay', {
        action: 'activateMember',
        outTradeNo: orderId,
        planType: plan
      });
      console.log('激活会员结果:', activateRes);

      wx.hideLoading();
      if (activateRes.result && activateRes.result.success) {
        wx.showToast({
          title: '会员激活成功',
          icon: 'success'
        });
        // 刷新会员数据或跳转到个人中心等
        // this.loadMembershipData(); // 可以选择重新加载数据
      } else {
        wx.showToast({
          title: (activateRes.result && activateRes.result.errmsg) || '会员激活失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('调用云函数激活会员失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '网络错误，激活会员失败',
        icon: 'none'
      });
    }
    
    // 创建会员开始和结束日期
    const planDays = {
      monthly: 30,
      quarterly: 90,
      halfYear: 180,
      yearly: 365
    };
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

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 