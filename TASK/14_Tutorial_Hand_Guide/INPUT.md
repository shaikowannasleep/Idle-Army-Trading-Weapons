# 📥 INPUT: Tutorial Hand Guide (Scale/Zoom Animation)

## 🎯 Mục tiêu
Thêm bàn tay hướng dẫn (Tutorial Hand) có hiệu ứng zoom / scale nhấp nháy chỉ thẳng vào các rương / hộp vũ khí (box) khi xuất hiện để hướng dẫn người chơi bấm vào.

## 📋 Yêu cầu
1. Hiệu ứng hoạt ảnh: Scale zoom co giãn liên tục (`scale 1.0 -> 0.75 -> 1.15`), kết hợp vòng tròn gợn sóng (ripple pulse).
2. Tự động quy đổi tọa độ 3D của Box sang 2D UI Canvas.
3. Kích hoạt đúng thời điểm:
   - Khi vào game: Chỉ vào `boxPistol`.
   - Khi đủ 50 Coin: Xuất hiện `boxAK` -> Bàn tay xuất hiện chỉ vào `boxAK`.
   - Khi đủ điều kiện Level 3: Xuất hiện `boxTool` -> Bàn tay xuất hiện chỉ vào `boxTool`.
   - Khi người chơi click mở hộp: Bàn tay tự động ẩn đi mượt mà.
