# 📥 INPUT: Coin Fly Animation FX

## 🎯 Mục tiêu
Thực hiện hiệu ứng đồng xu (Coin Fly FX) khi nhận tiền từ NPC: các đồng xu sẽ bung ra từ vị trí nhân vật (3D world) và bay theo đường cong parabol/bezier mượt mà lên góc trên bên phải (khu vực hiển thị UI Coin), kèm hiệu ứng nảy phóng to UI và âm thanh ting ting nhận tiền.

## 📋 Yêu cầu
1. Tự động chuyển đổi tọa độ 3D của NPC sang 2D UI Canvas.
2. Hiệu ứng:
   - Nổ nhẹ (burst/scatter) các đồng xu xung quanh NPC.
   - Bay theo đường cong tự nhiên lên icon Coin UI.
   - Khi từng đồng xu chạm đích: UI Coin panel phóng to nảy (punch scale), phát âm thanh `playCoinReceive()`, và tăng số lượng Coin hiển thị.
