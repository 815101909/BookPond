// 编辑个人资料页面逻辑
Page({
  data: {
    type: '', // 编辑类型：nickname 或 signature
    inputValue: '', // 输入的值
    placeholder: '', // 占位提示文本
    maxLength: 10, // 最大输入长度
    pageTitle: '编辑资料', // 页面标题
    showCounter: false // 是否显示计数器
  },

  onLoad: function(options) {
    // 获取传递的参数
    const type = options.type || 'nickname';
    const value = options.value ? decodeURIComponent(options.value) : '';
    
    // 根据编辑类型设置相关数据
    let title = '编辑资料';
    let placeholder = '';
    let maxLength = 10;
    let showCounter = false;
    
    if (type === 'nickname') {
      title = '修改昵称';
      placeholder = '请输入昵称';
      maxLength = 10; // 昵称最多10个字符
      showCounter = true;
    } else if (type === 'signature') {
      title = '修改个性签名';
      placeholder = '请输入个性签名';
      maxLength = 15; // 签名最多15个字符
      showCounter = true;
    }
    
    this.setData({
      type,
      inputValue: value,
      placeholder,
      maxLength,
      pageTitle: title,
      showCounter
    });
  },
  
  // 监听输入变化
  onInputChange: function(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },
  
  // 保存按钮点击事件
  onSave: function() {
    const eventName = this.data.type === 'nickname' ? 'updateNickname' : 'updateSignature';
    
    // 使用事件通道将数据返回到上一页
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.emit(eventName, { value: this.data.inputValue });
    
    // 返回上一页
    wx.navigateBack();
  },
  
  // 取消按钮点击事件
  onCancel: function() {
    wx.navigateBack();
  }
}) 
Page({
  data: {
    type: '', // 编辑类型：nickname 或 signature
    inputValue: '', // 输入的值
    placeholder: '', // 占位提示文本
    maxLength: 10, // 最大输入长度
    pageTitle: '编辑资料', // 页面标题
    showCounter: false // 是否显示计数器
  },

  onLoad: function(options) {
    // 获取传递的参数
    const type = options.type || 'nickname';
    const value = options.value ? decodeURIComponent(options.value) : '';
    
    // 根据编辑类型设置相关数据
    let title = '编辑资料';
    let placeholder = '';
    let maxLength = 10;
    let showCounter = false;
    
    if (type === 'nickname') {
      title = '修改昵称';
      placeholder = '请输入昵称';
      maxLength = 10; // 昵称最多10个字符
      showCounter = true;
    } else if (type === 'signature') {
      title = '修改个性签名';
      placeholder = '请输入个性签名';
      maxLength = 15; // 签名最多15个字符
      showCounter = true;
    }
    
    this.setData({
      type,
      inputValue: value,
      placeholder,
      maxLength,
      pageTitle: title,
      showCounter
    });
  },
  
  // 监听输入变化
  onInputChange: function(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },
  
  // 保存按钮点击事件
  onSave: function() {
    const eventName = this.data.type === 'nickname' ? 'updateNickname' : 'updateSignature';
    
    // 使用事件通道将数据返回到上一页
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.emit(eventName, { value: this.data.inputValue });
    
    // 返回上一页
    wx.navigateBack();
  },
  
  // 取消按钮点击事件
  onCancel: function() {
    wx.navigateBack();
  }
}) 