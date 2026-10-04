#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(projectRoot, 'assets');
const unusedTargetDir = path.join(assetsDir, '_unused');

console.log('🔍 [AssetPruner] Đang phân tích toàn bộ cây phụ thuộc Asset...');

function getAllFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    for (const item of fs.readdirSync(dir)) {
        if (item.startsWith('.') || item === '_unused') continue;
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

const allAssets = getAllFiles(assetsDir);
const metaFiles = allAssets.filter(f => f.endsWith('.meta'));

// Map uuid -> file
const uuidToFile = new Map();
for (const mf of metaFiles) {
    const rawFile = mf.slice(0, -5);
    try {
        const meta = JSON.parse(fs.readFileSync(mf, 'utf8'));
        uuidToFile.set(meta.uuid, rawFile);
        if (meta.subMetas) {
            for (const k of Object.keys(meta.subMetas)) {
                if (meta.subMetas[k].uuid) {
                    uuidToFile.set(meta.subMetas[k].uuid, rawFile);
                }
            }
        }
    } catch(e) {}
}

// Start with root assets: scene.scene and all scripts
const rootFiles = [
    path.join(assetsDir, 'scene.scene'),
    ...allAssets.filter(f => f.endsWith('.ts'))
];
const usedFiles = new Set(rootFiles);
const queue = [...rootFiles];

while (queue.length > 0) {
    const current = queue.shift();
    if (!fs.existsSync(current)) continue;
    let content = '';
    try {
        content = fs.readFileSync(current, 'utf8');
    } catch(e) {
        continue;
    }

    for (const [uuid, targetFile] of uuidToFile.entries()) {
        if (!usedFiles.has(targetFile) && content.includes(uuid)) {
            usedFiles.add(targetFile);
            queue.push(targetFile);
        }
    }
}

console.log(`✅ Tìm thấy ${usedFiles.size} asset ĐANG ĐƯỢC SỬ DỤNG (Scene + Transitive Dependencies).`);

const unusedFiles = [];
let totalUnusedBytes = 0;

for (const f of allAssets) {
    if (f.endsWith('.meta')) continue;
    if (fs.statSync(f).isDirectory()) continue;
    if (!usedFiles.has(f)) {
        const size = fs.statSync(f).size;
        unusedFiles.push(f);
        totalUnusedBytes += size;
    }
}

console.log(`📦 Tìm thấy ${unusedFiles.length} asset KHÔNG SỬ DỤNG (${(totalUnusedBytes / 1024 / 1024).toFixed(2)} MB).`);

if (!fs.existsSync(unusedTargetDir)) {
    fs.mkdirSync(unusedTargetDir, { recursive: true });
}

let movedCount = 0;
for (const rawPath of unusedFiles) {
    const relPath = path.relative(assetsDir, rawPath);
    const destPath = path.join(unusedTargetDir, relPath);
    const destMetaPath = destPath + '.meta';
    const srcMetaPath = rawPath + '.meta';

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    
    // Move asset
    fs.renameSync(rawPath, destPath);
    // Move meta if exists
    if (fs.existsSync(srcMetaPath)) {
        fs.renameSync(srcMetaPath, destMetaPath);
    }
    movedCount++;
    console.log(`   🚚 Moved: ${relPath}`);
}

// Clean up empty directories in assets/
function cleanEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
            cleanEmptyDirs(full);
        }
    }
    const remaining = fs.readdirSync(dir);
    if (remaining.length === 0 && dir !== assetsDir) {
        fs.rmdirSync(dir);
    }
}
cleanEmptyDirs(assetsDir);

console.log(`\n🎉 [Hoàn thành] Đã di chuyển ${movedCount} asset thừa ra thư mục: ${unusedTargetDir}`);
console.log(`💾 Tiết kiệm được ${(totalUnusedBytes / 1024 / 1024).toFixed(2)} MB asset không cần nạp!`);
