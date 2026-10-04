# 📤 OUTPUT: Exclude Engine Modules Optimization

## 📁 File Cấu Hình Đã Cập Nhật
- `settings/v2/packages/engine.json` (Thêm profile `Vscode module` và đặt làm `globalConfigKey`)
- `profiles/v2/packages/builder.json` (Gán `engineModulesConfigKey: "vscode-module"`)

## 📊 So Sánh Modules Giữ Lại vs Exclude

| Danh mục | Modules Giữ lại (Enabled) | Modules Loại bỏ (Excluded - Tiết kiệm dung lượng) |
| :--- | :--- | :--- |
| **Core & Graphics** | `base`, `gfx-webgl`, `custom-pipeline` | `gfx-webgl2`, `gfx-webgpu`, `meshopt`, `profiler`, `occlusion-query`, `debug-renderer` |
| **2D & UI** | `2d`, `affine-transform`, `ui`, `mask` | `rich-text`, `graphics`, `ui-skew`, `sorting-2d`, `tiled-map` |
| **3D & Animation** | `3d`, `animation`, `skeletal-animation` | `terrain`, `light-probe`, `procedural-animation`, `marionette` |
| **Physics (Nặng nhất)** | *None (Không sử dụng physics engine)* | `physics` (Ammo.js, Cannon, PhysX), `physics-2d` (Box2D), `intersection-2d` |
| **Animation Runtimes** | *None* | `spine` (Spine 3.8, Spine 4.2), `dragon-bones` |
| **Media & Network** | `audio`, `tween` | `video`, `webview`, `websocket`, `websocket-server`, `particle`, `particle-2d` |
