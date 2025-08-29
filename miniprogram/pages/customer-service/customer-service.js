// 客服页面逻辑
Page({
  data: {
    // 客服信息
    serviceInfo: {
      email: 'xiaoxiaovision@foxmail.com',
      wechat: 'xiaovisiontogether' // 示例客服微信号
    },
    // 二维码相关数据
    qrCodeOfficialUrl: '', // 公众号二维码临时链接
    isLoading: true // 加载状态
  },
  
  // 页面加载时执行
  onLoad: function() {
    this.loadQRCode();
  },

  // 加载二维码
  loadQRCode: async function() {
    const that = this;
    const qrCodeCloudPath = 'cloud://cloud1-1gsyt78b92c539ef.636c-cloud1-1gsyt78b92c539ef-1370520707/wx_QR/20250810-155526.png';
    
    // 获取临时链接
     // 跨环境创建 Cloud 实例
      const cloudInstance = new wx.cloud.Cloud({
        identityless: true,
        resourceAppid: 'wx85d92d28575a70f4',
        resourceEnv: 'cloud1-1gsyt78b92c539ef',
      });
      await cloudInstance.init();

      await cloudInstance.getTempFileURL({
      fileList: [qrCodeCloudPath],
      success: res => {
        console.log('获取临时链接成功:', res);
        if (res.fileList && res.fileList.length > 0) {
          that.setData({
            qrCodeOfficialUrl: res.fileList[0].tempFileURL,
            isLoading: false
          });
        } else {
          console.error('获取临时链接失败');
          that.setData({
            isLoading: false
          });
        }
      },
      fail: err => {
        console.error('获取临时链接失败:', err);
        that.setData({
          isLoading: false
        });
      }
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
  },

  // 复制微信到剪贴板
  copyWeChat: function() {
    wx.setClipboardData({
      data: this.data.serviceInfo.wechat,
      success: function() {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 预览二维码
  previewQRCode: function() {
    const qrCodeUrl = this.data.qrCodeOfficialUrl;
    if (qrCodeUrl) {
      wx.previewImage({
        current: qrCodeUrl, // 当前显示图片的http链接
        urls: [qrCodeUrl] // 需要预览的图片http链接列表
      });
    } else {
      wx.showToast({
        title: '二维码未加载',
        icon: 'none'
      });
    }
  }
})