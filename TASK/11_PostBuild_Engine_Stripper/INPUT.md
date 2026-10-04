# 📥 INPUT: Post-Build Engine Stripper (Parallel Optimization)

## 🎯 Mục tiêu
Tìm và xây dựng giải pháp song song (không phụ thuộc vào UI Project Settings của Cocos Creator) để tự động cắt bỏ mã nguồn các module nặng (Ammo.js 3D Physics, Spine Runtime...) ngay sau khi build `web-mobile` và trước khi Super-HTML đóng gói.

## 📋 Yêu cầu chi tiết
1. Tự động phát hiện và stub các file ASM/WASM nặng trong `build/web-mobile/cocos-js/`:
   - `bullet.release.asm-*.js` (Ammo.js 3D Physics: ~940 KB)
   - `spine.asm-*.js` (Spine 2D Runtime: ~362 KB)
   - `spine.js.mem-*.bin` (~20 KB)
2. Tích hợp trực tiếp vào quy trình đóng gói `npm run pack:super`.
3. Đo lường dung lượng thực tế giảm được trên các mạng quảng cáo.
