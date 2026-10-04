#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const webMobileDir = path.join(projectRoot, 'build', 'web-mobile');
const superHtmlDir = path.join(projectRoot, 'build', 'super-html');

console.log('⚡ [FastPack] Bắt đầu đóng gói Super-HTML siêu tốc...');
const startTime = Date.now();

// 1. Kiểm tra thư mục web-mobile
if (!fs.existsSync(webMobileDir)) {
    console.error('❌ Lỗi: Chưa tìm thấy thư mục build/web-mobile. Hãy build web-mobile trước!');
    process.exit(1);
}

// 2. Nạp module builder của super-html
try {
    const CocosMain = require('../extensions/super-html/dist/platform/cocos/cocos_main.js').default;
    
    // Khởi chạy packager
    new CocosMain("3.8.8", webMobileDir, () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 [FastPack] Đóng gói thành công toàn bộ Playable Ads trong ${duration}s!`);
        console.log(`📂 Thư mục output: ${superHtmlDir}\n`);
    });
} catch (err) {
    console.error('❌ Lỗi đóng gói:', err);
    process.exit(1);
}
