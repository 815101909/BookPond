// 文章收藏页面逻辑
const app = getApp();
// 引入统一的云函数调用工具
const { favoritesAPI } = require('../../utils/cloud-api.js');

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
          desc: article.highlights,
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
      title: '小舟摇书池 - 发现更多精彩文章',
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
      title: '小舟摇书池 - 发现更多精彩文章',
      query: '',
      imageUrl: '/images/share-default.png'
    };
  },

  loadArticles: async function (callback) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 调用云函数获取收藏列表
      const result = await favoritesAPI.getUserFavorites({
        page: this.data.page,
        pageSize: this.data.pageSize
      });
      
      console.log('获取收藏列表API返回结果:', result);
      
      // 兼容两种返回格式：直接返回result或包装在result.result中
      const actualResult = result?.result || result;
      
      if (actualResult && actualResult.code === 0) {
        const { list, total } = actualResult.data;
        
        // 格式化数据，处理日期和添加本地ID
        const formattedList = list.map(item => ({
          id: item.article_id,
          title: item.title || '未知标题',
          highlights: item.highlights || '暂无简介', // 由于字段不存在，使用默认值
          image: item.cover_url || '/images/default-article.png',
          date: this.formatDate(item.create_time),
          type: item.type || 'news',
          level: item.level || 'sprout',
          // 保存原始数据，用于后续操作
          _id: item._id,
          _raw: item
        }));
        
        // 更新页面数据
        this.setData({
          articles: this.data.page === 1 ? formattedList : this.data.articles.concat(formattedList),
          total: total,
          page: this.data.page + 1,
          loading: false,
          hasMore: list.length === this.data.pageSize
        });
      } else {
        throw new Error(result.result?.msg || '获取收藏失败');
      }
    } catch (error) {
      console.error('加载收藏列表失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    } finally {
      wx.hideLoading();
      if (callback) callback();
    }
  },

  // 格式化日期
  formatDate: function (timestamp) {
    if (!timestamp) return '未知日期';
    
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
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

  deleteArticle: async function (e) {
    const articleId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认取消收藏',
      content: '确定要取消收藏这篇文章吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          try {
            // 调用云函数删除收藏
            const result = await favoritesAPI.removeFavorite({
              articleId: articleId
            });
            
            console.log('删除收藏API返回结果:', result);
            
            // 兼容两种返回格式：直接返回result或包装在result.result中
            const actualResult = result?.result || result;
            
            if (actualResult && actualResult.code === 0) {
              // 从页面数据中删除文章
              const updatedArticles = this.data.articles.filter(item => item.id !== articleId);
              
              this.setData({
                articles: updatedArticles,
                total: this.data.total - 1
              });
              
              wx.showToast({
                title: '已取消收藏',
                icon: 'success'
              });
              
              // 如果当前页面没有数据了，但总数不为0，则重新加载
              if (updatedArticles.length === 0 && this.data.total > 0) {
                this.setData({
                  page: 1,
                  hasMore: true
                });
                this.loadArticles();
              }
            } else {
              throw new Error(result.result?.msg || '取消收藏失败');
            }
          } catch (error) {
            console.error('取消收藏失败:', error);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
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