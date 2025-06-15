// 文章收藏页面逻辑
const app = getApp();

Page({
  data: {
    articles: [],
    total: 0,
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true
  },

  onLoad: function (options) {
    this.loadArticles();
  },
  
  onShow: function () {
    // 每次页面展示时刷新数据
    this.setData({
      page: 1,
      articles: [],
      hasMore: true
    });
    this.loadArticles();
  },

  onPullDownRefresh: function () {
    this.setData({
      page: 1,
      articles: [],
      hasMore: true
    });
    this.loadArticles(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadArticles();
    }
  },

  onShareAppMessage: function (res) {
    if (res.from === 'button') {
      const article = this.data.articles.find(item => item.id === res.target.dataset.id);
      if (article) {
        return {
          title: article.title,
          path: `/pages/${article.type === 'news' ? 'news-detail' : 'classics-detail'}/news-detail?id=${article.id}`,
          imageUrl: article.image || '/images/default-article.png',
          desc: article.description,
          success: function (res) {
            wx.showToast({
              title: '分享成功',
              icon: 'success'
            });
          },
          fail: function (res) {
            wx.showToast({
              title: '分享失败',
              icon: 'none'
            });
          }
        };
      }
    }
    return {
      title: '晓世界 - 发现更多精彩文章',
      path: '/pages/read/read',
      imageUrl: '/images/share-default.png'
    };
  },

  onShareTimeline: function (res) {
    if (res.from === 'button') {
      const article = this.data.articles.find(item => item.id === res.target.dataset.id);
      if (article) {
        return {
          title: article.title,
          query: `id=${article.id}`,
          imageUrl: article.image || '/images/default-article.png'
        };
      }
    }
    return {
      title: '晓世界 - 发现更多精彩文章',
      query: '',
      imageUrl: '/images/share-default.png'
    };
  },

  loadArticles: function (callback) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    wx.showLoading({ title: '加载中...' });
    
    // 从本地存储获取收藏文章
    const favoriteArticles = wx.getStorageSync('favoriteArticles') || [];
    
    // 处理分页逻辑
    const start = (this.data.page - 1) * this.data.pageSize;
    const end = start + this.data.pageSize;
    const currentPageArticles = favoriteArticles.slice(start, end);
    
    const hasMore = end < favoriteArticles.length;
    
    setTimeout(() => {
    this.setData({
        articles: this.data.page === 1 ? currentPageArticles : this.data.articles.concat(currentPageArticles),
      total: favoriteArticles.length,
        page: this.data.page + 1,
        loading: false,
        hasMore: hasMore
      });
      
      wx.hideLoading();
      
      if (callback) callback();
    }, 300);
  },

  navigateToArticle: function (e) {
    const { id, type } = e.currentTarget.dataset;
    let url = '';
    
    if (type === 'news') {
      url = `/pages/news-detail/news-detail?id=${id}`;
    } else {
      url = `/pages/classics-detail/classics-detail?id=${id}`;
    }
    
    wx.navigateTo({ url });
  },

  deleteArticle: function (e) {
    const articleId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这篇收藏文章吗？',
      success: (res) => {
        if (res.confirm) {
          // 从本地存储中删除文章
          let favoriteArticles = wx.getStorageSync('favoriteArticles') || [];
          favoriteArticles = favoriteArticles.filter(item => item.id !== articleId);
          wx.setStorageSync('favoriteArticles', favoriteArticles);
          
          // 从页面数据中删除文章
          const updatedArticles = this.data.articles.filter(item => item.id !== articleId);
          
          this.setData({
            articles: updatedArticles,
            total: favoriteArticles.length
          });
          
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  shareArticle: function (e) {
    const articleId = e.currentTarget.dataset.id;
    const article = this.data.articles.find(item => item.id === articleId);
    
    if (!article) return;
    
    // 显示分享菜单
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    // 显示分享提示
    wx.showActionSheet({
      itemList: ['分享给好友', '分享到朋友圈'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 分享给好友
          wx.showToast({
            title: '请点击右上角分享',
            icon: 'none'
          });
        } else if (res.tapIndex === 1) {
          // 分享到朋友圈
          wx.showToast({
            title: '请点击右上角分享到朋友圈',
            icon: 'none'
          });
        }
      }
    });
  },

  backToProfile: function () {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  navigateToExplore: function () {
    wx.switchTab({
      url: '/pages/read/read'
    });
  }
}); 