# 📤 OUTPUT: Module Scanner & Size Optimizer Tool

## 📁 File Đã Tạo
1. **Tool quét CLI:** `scripts/scan-modules.js`
2. **Giao diện Dashboard / Popup:** `scripts/module-analyzer/index.html`
3. **Lệnh thực thi trong `package.json`:**
   ```bash
   npm run scan:modules  # Quét AST, phân loại module và in báo cáo
   npm run view:modules  # Mở popup giao diện đồ họa phân tích dung lượng
   ```

## 📊 Kết Quả Quét AST & Phân Loại Modules

### 🟢 Modules Đang Sử Dụng (10 modules):
- `base`, `gfx-webgl`, `3d`, `2d`, `ui`, `affine-transform`, `animation`, `skeletal-animation`, `audio`, `tween`.

### 🔴 Modules Đã Exclude (25 modules - Tiết kiệm ~4.2 - 5.5 MB):
- ❌ **3D Physics (Ammo.js / Bullet / Cannon / PhysX)**: Tiết kiệm ~1.8 - 2.5 MB
- ❌ **2D Physics (Box2D)**: Tiết kiệm ~750 KB - 1 MB
- ❌ **Spine 3.8 / 4.2 & DragonBones**: Tiết kiệm ~500 KB
- ❌ **WebSocket / WebSocket Server**: Tiết kiệm ~120 KB
- ❌ **Terrain, TiledMap, Video, WebView, Particle, Particle2D, Marionette, RichText, Graphics, Primitive, LightProbe**...
