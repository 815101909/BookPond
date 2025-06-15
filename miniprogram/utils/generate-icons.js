const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// 图标配置
const icons = {
  read: '📖',
  write: '✍️',
  profile: '👤',
  listen: '👂',
  speak: '💬'
};

// 创建图标的函数
function createIcon(emoji, filename, isActive = false) {
  const canvas = createCanvas(81, 81);
  const ctx = canvas.getContext('2d');

  // 设置背景
  ctx.fillStyle = isActive ? '#FFB6C1' : '#ffffff';
  ctx.fillRect(0, 0, 81, 81);

  // 设置文字样式
  ctx.font = '40px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isActive ? '#ffffff' : '#999999';

  // 绘制emoji，x坐标从40改为35，使图标向左移动
  ctx.fillText(emoji, 35, 40);

  // 保存图片
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, '../images/tabbar', filename), buffer);
}

// 生成所有图标
Object.entries(icons).forEach(([key, emoji]) => {
  createIcon(emoji, `${key}.png`);
  createIcon(emoji, `${key}-active.png`, true);
}); 