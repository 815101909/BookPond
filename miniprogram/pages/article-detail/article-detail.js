// 文章详情页逻辑
Page({
  /**
   * 页面的初始数据
   */
  data: {
    article: null,
    articleId: null,
    isLoading: true,
    isFavorite: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取文章ID
    if (options.id) {
      this.setData({
        articleId: options.id
      });
      this.loadArticle();
      this.checkIfFavorite();
    } else {
      this.setData({
        isLoading: false
      });
      wx.showToast({
        title: '文章不存在',
        icon: 'error'
      });
    }
  },

  /**
   * 加载文章数据
   */
  loadArticle: function () {
    const that = this;
    that.setData({
      isLoading: true
    });

    // 模拟从服务器获取文章数据
    setTimeout(() => {
      // 模拟的文章数据（根据文章ID）
      const articleData = {
        '1': {
          id: '1',
          title: '如何提高英语阅读理解能力',
          category: '阅读技巧',
          date: '2023-11-15',
          imageUrl: '/images/default_article_1.png',
          content: '<p style="margin-bottom: 20px;">提高英语阅读理解能力是学习英语的重要部分。本文将介绍几种有效的方法：</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">1. 每天坚持阅读</h3><p style="margin-bottom: 15px;">坚持每天阅读英语材料是提高阅读能力的最基本方法。可以从简单的文章开始，逐渐增加难度。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">2. 扩大词汇量</h3><p style="margin-bottom: 15px;">词汇量的大小直接影响阅读理解能力。建议每天学习10-15个新单词，并在阅读中巩固使用。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">3. 理解上下文</h3><p style="margin-bottom: 15px;">遇到不懂的单词时，尝试从上下文推断其含义，而不是立即查词典。这有助于培养语感和推理能力。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">4. 多种阅读策略</h3><p style="margin-bottom: 15px;">学习使用不同的阅读策略：略读、精读、主题阅读等，针对不同类型的文章采用不同的方法。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">5. 做阅读笔记</h3><p>阅读后做笔记可以帮助你记忆内容并深入理解文章。养成记录重点、疑问和感想的习惯。</p>'
        },
        '2': {
          id: '2',
          title: '高效记忆英语单词的方法',
          category: '词汇学习',
          date: '2023-11-10',
          imageUrl: '/images/default_article_2.png',
          content: '<p style="margin-bottom: 20px;">记忆英语单词对很多学习者来说是一个挑战，下面介绍几种科学有效的记忆方法：</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">1. 间隔重复法</h3><p style="margin-bottom: 15px;">根据艾宾浩斯遗忘曲线安排复习时间，如第一天学习后，分别在1天、2天、4天、7天后进行复习。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">2. 联想记忆法</h3><p style="margin-bottom: 15px;">将单词与图像、声音或故事联系起来，创建生动的联想，使记忆更加深刻。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">3. 词根词缀法</h3><p style="margin-bottom: 15px;">学习常见的词根和词缀，通过分析单词的构成来理解和记忆，这样可以一举多得。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">4. 情景记忆法</h3><p style="margin-bottom: 15px;">在真实场景或情境中使用单词，增强记忆的同时也提高了实际应用能力。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">5. 多感官学习</h3><p>结合听、说、读、写多种感官同时学习单词，全方位刺激大脑，提高记忆效率。</p>'
        },
        '3': {
          id: '3',
          title: '英语写作中常见的10个错误',
          category: '写作指导',
          date: '2023-11-05',
          imageUrl: '/images/default_article_3.png',
          content: '<p style="margin-bottom: 20px;">英语写作中有一些常见错误，识别并改正这些错误可以显著提高你的写作水平：</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">1. 主谓不一致</h3><p style="margin-bottom: 15px;">主语和谓语在人称和数上必须一致。例如："He walk" 应改为 "He walks"。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">2. 时态混乱</h3><p style="margin-bottom: 15px;">在同一段落或句子中不恰当地切换时态会让读者困惑。保持时态一致或有意义地变化。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">3. 冠词使用不当</h3><p style="margin-bottom: 15px;">英语中的冠词（a, an, the）使用规则复杂，错误使用会改变句子含义或造成语法错误。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">4. 介词误用</h3><p style="margin-bottom: 15px;">每个介词都有其特定用法和搭配，如"depend on"不能写成"depend in"。</p><h3 style="font-size: 18px; color: #333; margin: 20px 0 10px;">5. 过度使用被动语态</h3><p>虽然被动语态在学术写作中很常见，但过度使用会使文章显得呆板。主动语态通常更直接有力。</p>'
        }
      };

      // 根据ID获取文章
      const article = articleData[that.data.articleId];
      
      if (article) {
        that.setData({
          article: article,
          isLoading: false
        });
      } else {
        that.setData({
          isLoading: false
        });
        wx.showToast({
          title: '文章不存在',
          icon: 'error'
        });
      }
    }, 1000);
  },

  /**
   * 检查文章是否已收藏
   */
  checkIfFavorite: function () {
    try {
      // 从本地存储获取收藏列表
      const favorites = wx.getStorageSync('favoriteArticles') || [];
      // 检查当前文章是否在收藏列表中
      const isFavorite = favorites.some(item => item.id === this.data.articleId);
      
      this.setData({
        isFavorite: isFavorite
      });
    } catch (e) {
      console.error('获取收藏状态失败', e);
    }
  },

  /**
   * 收藏/取消收藏文章
   */
  toggleFavorite: function () {
    if (!this.data.article) return;
    
    try {
      // 获取当前收藏列表
      let favorites = wx.getStorageSync('favoriteArticles') || [];
      const articleId = this.data.article.id;
      
      // 检查是否已收藏
      const index = favorites.findIndex(item => item.id === articleId);
      
      if (index > -1) {
        // 已收藏，取消收藏
        favorites.splice(index, 1);
        this.setData({
          isFavorite: false
        });
        wx.showToast({
          title: '已取消收藏',
          icon: 'success'
        });
      } else {
        // 未收藏，添加收藏
        favorites.push({
          id: this.data.article.id,
          title: this.data.article.title,
          description: this.data.article.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...',
          date: this.data.article.date,
          category: this.data.article.category,
          imageUrl: this.data.article.imageUrl
        });
        this.setData({
          isFavorite: true
        });
        wx.showToast({
          title: '收藏成功',
          icon: 'success'
        });
      }
      
      // 保存更新后的收藏列表
      wx.setStorageSync('favoriteArticles', favorites);
    } catch (e) {
      console.error('操作收藏失败', e);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * 分享文章
   */
  shareArticle: function () {
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    if (this.data.article) {
      return {
        title: this.data.article.title,
        path: '/pages/article-detail/article-detail?id=' + this.data.articleId
      };
    }
    return {
      title: '英语学习文章',
      path: '/pages/read/read'
    };
  }
}) 