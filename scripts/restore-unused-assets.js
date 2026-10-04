#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(projectRoot, 'assets');
const unusedTargetDir = path.join(assetsDir, '_unused');

if (!fs.existsSync(unusedTargetDir)) {
    console.log('ℹ️ Không có thư mục assets/_unused để khôi phục.');
    process.exit(0);
}

console.log('🔄 [RestoreAssets] Đang khôi phục toàn bộ asset đã di chuyển...');

function getAllFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    for (const item of fs.readdirSync(dir)) {
        if (item.startsWith('.')) continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            files = files.concat(getAllFiles(full));
        } else {
            files.push(full);
        }
    }
    return files;
}

const files = getAllFiles(unusedTargetDir);
let restoredCount = 0;

for (const f of files) {
    const relPath = path.relative(unusedTargetDir, f);
    const destPath = path.join(assetsDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.renameSync(f, destPath);
    restoredCount++;
    console.log(`   ↩️ Restored: ${relPath}`);
}

// Remove _unused_assets dir
function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
removeDir(unusedTargetDir);

console.log(`\n🎉 [Khôi phục hoàn tất] Đã đưa ${restoredCount} file trở lại thư mục assets/!`);
