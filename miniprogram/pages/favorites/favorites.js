// 我的收藏页面逻辑
Page({
  /**
   * 页面的初始数据
   */
  data: {
    favoriteArticles: [], // 收藏的文章列表
    isLoading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 加载收藏数据
    this.loadFavoriteArticles();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示页面时重新加载数据
    this.loadFavoriteArticles();
  },

  /**
   * 加载收藏的文章
   */
  loadFavoriteArticles: function () {
    const that = this;
    // 设置加载状态
    that.setData({
      isLoading: true
    });

    // 尝试从本地存储获取收藏数据
    try {
      // 从本地存储获取收藏数据
      const favorites = wx.getStorageSync('favoriteArticles') || [];
      
      if (favorites.length === 0) {
        // 如果没有收藏，添加模拟数据（仅用于演示）
        // 模拟的收藏文章数据
        const sampleArticles = [
          {
            id: '1',
            title: '如何提高英语阅读理解能力',
            description: '本文介绍了提高英语阅读理解能力的5个实用技巧，通过每日练习可以显著提升阅读速度和理解深度。',
            date: '2023-11-15',
            category: '阅读技巧',
            imageUrl: '/images/default_article_1.png'
          },
          {
            id: '2',
            title: '高效记忆英语单词的方法',
            description: '记忆英语单词不再困难，使用这些科学的记忆方法，让单词记忆事半功倍。',
            date: '2023-11-10',
            category: '词汇学习',
            imageUrl: '/images/default_article_2.png'
          },
          {
            id: '3',
            title: '英语写作中常见的10个错误',
            description: '很多学习者在英语写作中会犯一些常见错误，本文帮你识别并改正这些问题。',
            date: '2023-11-05',
            category: '写作指导',
            imageUrl: '/images/default_article_3.png'
          }
        ];
        
        // 保存示例数据到本地存储，这样就可以在收藏页面看到数据了
        wx.setStorageSync('favoriteArticles', sampleArticles);
        
        that.setData({
          favoriteArticles: sampleArticles,
          isLoading: false
        });
      } else {
        that.setData({
          favoriteArticles: favorites,
          isLoading: false
        });
      }
    } catch (e) {
      console.error('获取收藏数据失败', e);
      that.setData({
        isLoading: false
      });
      wx.showToast({
        title: '获取收藏失败',
        icon: 'none'
      });
    }
  },

  /**
   * 查看文章详情
   */
  viewArticleDetail: function (e) {
    const articleId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/article-detail/article-detail?id=${articleId}`
    });
  },

  /**
   * 取消收藏
   */
  removeFromFavorites: function (e) {
    const articleId = e.currentTarget.dataset.id;
    const that = this;

    wx.showModal({
      title: '取消收藏',
      content: '确定要取消收藏该文章吗？',
      success: function (res) {
        if (res.confirm) {
          try {
            // 从本地存储获取收藏列表
            let favorites = wx.getStorageSync('favoriteArticles') || [];
            // 过滤掉要删除的文章
            favorites = favorites.filter(item => item.id !== articleId);
            // 保存更新后的收藏列表
            wx.setStorageSync('favoriteArticles', favorites);
            
            // 更新页面数据
            that.setData({
              favoriteArticles: favorites
            });

            wx.showToast({
              title: '已取消收藏',
              icon: 'success'
            });
          } catch (e) {
            console.error('取消收藏失败', e);
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 跳转到阅读页面
   */
  navigateToRead: function () {
    wx.switchTab({
      url: '/pages/read/read'
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    // 重新加载收藏数据
    this.loadFavoriteArticles();
    // 停止下拉刷新
    wx.stopPullDownRefresh();
  }
}) 