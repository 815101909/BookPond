const languageManager = require('../../utils/language');

Page({
  data: {
    // ... existing data ...
    selectedLanguages: [], // 选中的语言代码数组
    languages: [
      { code: 'zh-TW', name: '中文（繁体）', flag: '🇹🇼' },
      { code: 'en', name: '英语', flag: '🇬🇧' },
      { code: 'fr', name: '法语', flag: '🇫🇷' },
      { code: 'es', name: '西班牙语', flag: '🇪🇸' },
      { code: 'de', name: '德语', flag: '🇩🇪' },
      { code: 'it', name: '意大利语', flag: '🇮🇹' },
      { code: 'ar', name: '阿拉伯语', flag: '🇸🇦' },
      { code: 'ja', name: '日语', flag: '🇯🇵' },
      { code: 'pt-PT', name: '葡萄牙语（葡萄牙）', flag: '🇵🇹' },
      { code: 'pt-BR', name: '葡萄牙语（巴西）', flag: '🇧🇷' },
      { code: 'th', name: '泰语', flag: '🇹🇭' },
      { code: 'ru', name: '俄语', flag: '🇷🇺' },
      { code: 'ms', name: '马来语', flag: '🇲🇾' },
      { code: 'ko', name: '韩语', flag: '🇰🇷' }
    ]
  },

  onLoad: function() {
    // 获取已保存的语言选择
    const languages = wx.getStorageSync('selectedLanguages') || [];
    console.log('读一读页面加载时获取的语言选择:', languages);
    this.setData({
      selectedLanguages: languages
    });
  },

  // 处理语言选择变化
  handleLanguageSelect: function(e) {
    const { language } = e.currentTarget.dataset;
    let selectedLanguages = [...this.data.selectedLanguages];
    
    // 切换语言选择状态
    const index = selectedLanguages.indexOf(language);
    if (index > -1) {
      selectedLanguages.splice(index, 1);
    } else {
      selectedLanguages.push(language);
    }
    
    console.log('读一读页面选择语言:', selectedLanguages);
    
    // 更新语言选择
    this.setData({
      selectedLanguages: selectedLanguages
    });
    
    // 保存语言选择到本地存储
    wx.setStorageSync('selectedLanguages', selectedLanguages);
    
    // 显示选择结果
    wx.showToast({
      title: `已选择 ${selectedLanguages.length} 种语言`,
      icon: 'none',
      duration: 1500
    });
  },

  // 跳转到新闻详情页
  navigateToNewsDetail: function(e) {
    const newsId = e.currentTarget.dataset.id;
    // 确保语言选择已保存
    const selectedLanguages = this.data.selectedLanguages;
    wx.setStorageSync('selectedLanguages', selectedLanguages);
    
    // 将选中的语言作为参数传递给新闻详情页
    wx.navigateTo({
      url: `/pages/news-detail/news-detail?id=${newsId}&languages=${JSON.stringify(selectedLanguages)}`
    });
  },

  // ... rest of existing code ...
}); 