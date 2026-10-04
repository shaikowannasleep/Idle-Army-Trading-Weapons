# 📥 INPUT: Exclude Engine Modules Optimization

## 🎯 Mục tiêu
Quét toàn bộ các tính năng dự án đang sử dụng và loại bỏ (exclude) tất cả các engine modules không dùng (Ammo 3D Physics, Box2D, Spine, DragonBones, WebSocket, Terrain, Video, WebView, Marionette...) bằng cách tạo profile mới mang tên `Vscode module`.

## 📋 Yêu cầu chi tiết
1. Quét AST và components trong toàn bộ `assets/` (scripts, prefabs, scene).
2. Tạo profile cấu hình engine `Vscode module` (`vscode-module`) trong `settings/v2/packages/engine.json`.
3. Chỉ giữ lại các modules thực sự sử dụng: `2d`, `3d`, `affine-transform`, `animation`, `audio`, `base`, `custom-pipeline`, `gfx-webgl`, `mask`, `skeletal-animation`, `tween`, `ui`.
4. Loại bỏ các modules nặng:
   - `physics` (Ammo.js, Bullet, Cannon, PhysX) -> Giảm ~1.5 - 2.5 MB.
   - `physics-2d` (Box2D) -> Giảm ~500 KB - 1 MB.
   - `spine` & `dragon-bones` -> Giảm ~500 KB.
   - `websocket`, `terrain`, `tiled-map`, `video`, `webview` -> Giảm ~800 KB.
5. Cập nhật `profiles/v2/packages/builder.json` áp dụng `vscode-module`.
