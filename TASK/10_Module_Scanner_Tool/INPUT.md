# 📥 INPUT: Module Scanner & Size Optimizer Tool

## 🎯 Mục tiêu
Viết công cụ CLI và giao diện Popup HTML để quét toàn bộ AST TypeScript, Scene và Prefab trong project, tự động phát hiện các module đang dùng và các module nặng không dùng để tối ưu dung lượng (loại bỏ Physics Ammo/Box2D, Spine, Terrain...).

## 📋 Yêu cầu chi tiết
1. Viết script `scripts/scan-modules.js` quét toàn bộ file `.ts`, `.scene`, `.prefab`.
2. Tạo giao diện báo cáo Popup HTML tại `scripts/module-analyzer/index.html`.
3. Thêm lệnh `npm run scan:modules` và `npm run view:modules` vào `package.json`.
4. Tính toán dung lượng tiết kiệm được (~4.2 - 5.5 MB).
