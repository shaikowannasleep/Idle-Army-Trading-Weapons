# 📤 OUTPUT: Asset Optimization & Pruning Unused Assets

## 📁 File Đã Tạo
- `scripts/prune-unused-assets.js`: Công cụ phân tích cây phụ thuộc và dọn dẹp asset thừa.
- `scripts/restore-unused-assets.js`: Công cụ khôi phục lại asset từ `_unused_assets/`.
- `_unused_assets/`: Thư mục lưu trữ 40 asset đã được loại bỏ an toàn.

## 📊 Kết Quả Quét & Dọn Dẹp

- **Tổng số asset đang sử dụng thực tế:** 39 asset (Scene + Scripts + Model FBX thực sự dùng).
- **Tổng số asset thừa đã di chuyển:** 40 asset.
- **Dung lượng asset tiết kiệm được:** **1.26 MB** (gồm các file texture TGA uncompressed, FBX thừa, UI thừa).

## 🚀 Các lệnh npm mới:
- `npm run prune:assets`: Quét và tự động di chuyển toàn bộ asset thừa ra `_unused_assets/`.
- `npm run restore:assets`: Khôi phục 100% asset về lại vị trí cũ trong `assets/`.
