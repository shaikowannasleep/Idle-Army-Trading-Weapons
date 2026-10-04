# 📥 INPUT: Asset Optimization & Pruning Unused Assets

## 🎯 Mục tiêu
Quét toàn bộ dependency graph của project Cocos Creator 3.8.x, tìm tất cả asset không được tham chiếu trong `scene.scene`, `Prefab/`, `.mat`, `.ts` và di chuyển ra thư mục riêng `_unused_assets/` để tối ưu dung lượng bản build.

## 📋 Yêu cầu
1. Lập bản đồ toàn bộ UUID và SubMetas trong `assets/`.
2. Truy vết cây phụ thuộc (Transitive Dependency Graph) bắt đầu từ Root (`assets/scene.scene` + `assets/Scripts/*.ts`).
3. Tự động di chuyển toàn bộ asset thừa và file `.meta` tương ứng ra thư mục `_unused_assets/`.
4. Cung cấp script khôi phục (`npm run restore:assets`) khi cần thiết.
