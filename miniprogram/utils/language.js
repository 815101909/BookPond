// 语言选择管理工具
const languageManager = {
  // 保存选中的语言
  saveSelectedLanguages: function(languages) {
    try {
      wx.setStorageSync('selectedLanguages', languages);
      return true;
    } catch (error) {
      console.error('保存语言选择失败:', error);
      return false;
    }
  },

  // 获取选中的语言
  getSelectedLanguages: function() {
    try {
      return wx.getStorageSync('selectedLanguages') || [];
    } catch (error) {
      console.error('获取语言选择失败:', error);
      return [];
    }
  },

  // 更新选中的语言
  updateSelectedLanguages: function(languages) {
    return this.saveSelectedLanguages(languages);
  }
};

module.exports = languageManager; 