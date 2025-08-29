Page({
  data: {
    article: null,
    currentLanguage: 'zh-CN',
    languageIndex: 0,
    languages: [],
    printImages: [], // 当前语言的所有打印图片
    currentImageIndex: 0, // 当前显示的图片索引
    totalImages: 0 // 当前语言的图片总数
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
    const languages = ['中文'];

    // 添加已选择的语言
    if (article.titleTranslations && article.titleTranslations.length > 0) {
      article.titleTranslations.forEach(trans => {
        languages.push(`${trans.languageName}`);
      });
    }

    this.setData({
      article,
      languages
    });

    // 获取打印图片
    this.getPrintImage();
  },

  // 处理语言切换
  onLanguageChange: function(e) {
    const index = e.detail.value;
    let language = 'zh-CN';
    
    // 根据索引获取对应的语言代码
    if (index > 0 && this.data.article.titleTranslations && this.data.article.titleTranslations[index - 1]) {
      language = this.data.article.titleTranslations[index - 1].language;
    }
    
    this.setData({
      languageIndex: index,
      currentLanguage: language,
      currentImageIndex: 0 // 切换语言时重置图片索引
    });

    // 切换语言时重新获取对应语言的打印图片
    this.getPrintImage();
  },

  // 获取打印图片
  getPrintImage: function() {
    const article = this.data.article;
    if (!article || !article.printImages) {
      this.setData({
        printImages: [],
        totalImages: 0
      });
      return;
    }
    
    // 获取当前选择语言的打印图片数组
    let images = article.printImages[this.data.currentLanguage] || [];
    
    // 如果当前语言没有打印图片，不自动切换到中文，而是显示空数据和提示信息
    if (!images || images.length === 0) {
      this.setData({
        printImages: [],
        totalImages: 0
      });
      
      const currentLangName = this.data.languages[this.data.languageIndex];
      wx.showToast({
        title: `${currentLangName}版本暂无打印页面`,
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({
      printImages: images,
      totalImages: images.length,
      currentImageIndex: 0
    });
  },

  // 切换到上一张图片
  prevImage: function() {
    if (this.data.totalImages <= 1) return;
    
    let newIndex = this.data.currentImageIndex - 1;
    if (newIndex < 0) {
      newIndex = this.data.totalImages - 1;
    }
    
    this.setData({
      currentImageIndex: newIndex
    });
  },

  // 切换到下一张图片
  nextImage: function() {
    if (this.data.totalImages <= 1) return;
    
    let newIndex = this.data.currentImageIndex + 1;
    if (newIndex >= this.data.totalImages) {
      newIndex = 0;
    }
    
    this.setData({
      currentImageIndex: newIndex
    });
  },
  
  // 预览图片，可放大查看和保存
  previewImage: function() {
    const currentImage = this.data.printImages[this.data.currentImageIndex];
    if (!currentImage) {
      wx.showToast({
        title: '图片不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.previewImage({
      current: currentImage, // 当前显示图片的链接
      urls: this.data.printImages, // 需要预览的图片链接列表
      showmenu: true, // 显示长按菜单，可保存图片
      success: () => {
        console.log('图片预览成功');
      },
      fail: (err) => {
        console.error('图片预览失败:', err);
        wx.showToast({
          title: '预览失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 处理打印
  handlePrint: function() {
    if (this.data.printImages.length === 0) {
      wx.showToast({
        title: '无可打印内容',
        icon: 'none'
      });
      return;
    }
    
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