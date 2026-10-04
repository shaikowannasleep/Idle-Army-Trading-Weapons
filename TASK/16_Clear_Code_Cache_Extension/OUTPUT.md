# 📤 OUTPUT: Clear Code Cache Menu Bar Extension

## 📁 File Đã Tạo & Cấu Hình
1. **Cocos Extension ([extensions/clear-code-cache](file:///Users/macbook/Test00/extensions/clear-code-cache))**:
   - `package.json`: Đăng ký menu bar `Developer -> 🧹 Clear Code Cache & Recompile` và phím tắt `Cmd+Alt+C`.
   - `main.js`: Logic dọn dẹp các thư mục `temp/programming/`, `temp/builder/`, `temp/scene/` và gọi refresh assetDB.
2. **CLI Script ([scripts/clear-cache.js](file:///Users/macbook/Test00/scripts/clear-cache.js))**:
   - Tự động quét và xóa sạch 100% cache compilation qua terminal.
   - Thêm lệnh vào `package.json`: `npm run clean:cache`.

## 🎯 Kết Quả Đạt Được
- ✅ Menu xuất hiện trực tiếp trên thanh menu trên cùng của Cocos Creator Editor.
- ✅ Phím tắt `Cmd + Option + C` giúp dev recompile mã nguồn sạch sẽ chỉ trong 1 thao tác.
