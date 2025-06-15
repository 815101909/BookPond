// 客服页面逻辑
Page({
  data: {
    // 客服信息
    serviceInfo: {
      email: 'xiao_shi_jie@126.com'
    },
    // 客服微信二维码图片路径
    qrCodeServiceUrl: '', // 空字符串，预留端口，将从后台加载
    // 公众号二维码图片路径
    qrCodeOfficialUrl: '', // 空字符串，预留端口，将从后台加载
    // 是否正在加载二维码
    isLoading: false
  },
  
  onLoad: function() {
    // 预留接口，从后台加载二维码
    // this.fetchQrCodes();
  },
  
  // 从后台获取二维码数据 - 预留接口
  fetchQrCodes: function() {
    const that = this;
    
    // 显示加载提示
    that.setData({
      isLoading: true
    });
    
    wx.showLoading({
      title: '加载二维码...',
    });
    
    // 实际项目中，从后台获取二维码URL的示例代码
    /*
    wx.request({
      url: 'https://api.example.com/qrcodes',
      method: 'GET',
      success: function(res) {
        if (res.statusCode === 200 && res.data) {
          // 设置二维码URL
          that.setData({
            qrCodeServiceUrl: res.data.serviceQrCode || '',
            qrCodeOfficialUrl: res.data.officialQrCode || '',
            isLoading: false
          });
        } else {
          that.handleFetchError();
        }
      },
      fail: function(err) {
        that.handleFetchError();
      },
      complete: function() {
        wx.hideLoading();
      }
    });
    */
    
    // 演示用，可在后台上传后替换
    setTimeout(function() {
      wx.hideLoading();
      that.setData({
        isLoading: false
        // 二维码URL将从后台获取
      });
    }, 1000);
  },
  
  // 处理获取二维码失败
  handleFetchError: function() {
    this.setData({
      isLoading: false
    });
    
    wx.showToast({
      title: '获取二维码失败',
      icon: 'none'
    });
  },
  
  // 复制邮箱到剪贴板
  copyEmail: function() {
    wx.setClipboardData({
      data: this.data.serviceInfo.email,
      success: function() {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success'
        });
      }
    });
  }
}) 