const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertDefaultAvatar() {
  const svgPath = path.join(__dirname, '../public/profile/default.svg');
  const pngPath = path.join(__dirname, '../public/profile/default.png');
  
  try {
    const svgBuffer = fs.readFileSync(svgPath);
    await sharp(svgBuffer)
      .resize(500, 500)
      .png()
      .toFile(pngPath);
    console.log('默认头像转换成功！');
  } catch (error) {
    console.error('转换默认头像失败:', error);
  }
}

convertDefaultAvatar(); 