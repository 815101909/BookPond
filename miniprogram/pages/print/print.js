Page({
  data: {
    article: null,
    currentLanguage: 'zh',
    languageIndex: 0,
    languageOptions: [],
    printImage: null
  },

  onLoad: function(options) {
    // 获取传递的文章数据
    const article = wx.getStorageSync('printArticle');
    if (!article) {
      wx.showToast({
        title: '未找到文章数据',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 初始化语言选项
    const languageOptions = [
      { code: 'zh', name: '中文简体' }
    ];

    // 添加已选择的语言
    if (article.titleTranslations) {
      article.titleTranslations.forEach(trans => {
        languageOptions.push({
          code: trans.language,
          name: `${trans.flag} ${trans.languageName}`
        });
      });
    }

    this.setData({
      article,
      languageOptions
    });

    // 获取打印图片
    this.getPrintImage();
  },

  // 处理语言切换
  handleLanguageChange: function(e) {
    const index = e.detail.value;
    const language = this.data.languageOptions[index].code;
    
    this.setData({
      languageIndex: index,
      currentLanguage: language
    });

    // 切换语言时重新获取对应语言的打印图片
    this.getPrintImage();
  },

  // 获取打印图片
  getPrintImage: function() {
    // 这里添加获取打印图片的逻辑
    // 根据当前选择的语言从后台获取对应的A4图片
    const article = wx.getStorageSync('printArticle');
    if (article) {
      // 示例：根据语言获取不同的打印图片
      const printImage = article.printImages ? article.printImages[this.data.currentLanguage] : null;
      this.setData({
        printImage
      });
    }
  },

  // 处理打印
  handlePrint: function() {
    wx.showLoading({
      title: '准备打印...',
    });

    // 延迟执行以确保样式已应用
    setTimeout(() => {
      wx.hideLoading();
      wx.showModal({
        title: '打印提示',
        content: '请使用系统打印功能或截图保存',
        showCancel: false
      });
    }, 500);
  },

  // 返回上一页
  handleBack: function() {
    wx.navigateBack();
  }
}); 