# 📥 INPUT: Loading UI & Slot Overlap Fix

## 🎯 Mục tiêu
1. Bổ sung Loading UI (icon xoay xoay + thanh progress bar tiến trình) khi nhân vật Staff chế tạo vũ khí (`Crafting...`) và khi nạp đạn/giao vũ khí cho khách hàng (`Reloading...`).
2. Khắc phục triệt để lỗi các nhân vật (Units/Customers) đi đè lên slot hoặc va chạm trùng vị trí trong hàng chờ và vị trí tấn công.
3. Inject trực tiếp cấu trúc Node UI vào file `assets/scene.scene`.
