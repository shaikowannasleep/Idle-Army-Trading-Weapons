# 📥 INPUT: Clear Code Cache Menu Bar Extension

## 🎯 Mục tiêu
Tạo menu bar item trong Cocos Creator Editor để xóa sạch bộ nhớ đệm biên dịch code (code compilation cache), giúp dev có thể ép buộc Cocos Creator biên dịch lại toàn bộ TypeScript từ đầu khi gặp lỗi cache hay class missing.

## 📋 Yêu cầu
1. Tích hợp Cocos Creator Extension ([extensions/clear-code-cache](file:///Users/macbook/Test00/extensions/clear-code-cache)):
   - Menu Bar: `Developer -> 🧹 Clear Code Cache & Recompile` và `Project -> 🧹 Clear Code Cache & Recompile`.
   - Phím tắt nhanh (Shortcut): `Cmd + Option + C` (macOS) hoặc `Ctrl + Alt + C` (Windows).
2. Xóa các thư mục cache:
   - `temp/programming/` (bộ nhớ đệm packer-driver của TypeScript).
   - `temp/builder/` (bộ nhớ đệm builder).
   - `temp/scene/`.
   - Gửi lệnh `asset-db:refresh-asset` để editor recompile code ngay tức thì.
3. Hỗ trợ lệnh CLI: `npm run clean:cache`.
