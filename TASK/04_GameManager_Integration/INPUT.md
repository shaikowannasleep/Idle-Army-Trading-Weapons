# 📥 INPUT: GameManager Integration

## 🎯 Mục tiêu
Kết nối các sự kiện tương tác của người chơi trong quá trình chơi game vào hệ thống tracking `PlayableAdsFlowManager`.

## 📋 Yêu cầu chi tiết
1. **Theo dõi Touch/Click:**
   - Khi người chơi mở khóa Pistol (level 1): Gọi `trackClick(true, 1)`.
   - Khi người chơi mở khóa súng AK:
     - Đủ tiền (coins >= 50): Gọi `trackClick(true, 1)`.
     - Không đủ tiền: Gọi `trackClick(false, 0)`.
   - Khi mở Box Tool (level 3): Gọi `trackClick(true, 1)`.
   - Khi bấm vào vùng trống không thực hiện được hành động: Gọi `trackClick(false, 0)`.
2. **Kích hoạt Store:**
   - Trong `unlockStore()` và `gostore()`: Thay thế việc gọi trực tiếp `super_html.download()` bằng `PlayableAdsFlowManager.instance.stopAdsWhilePlaying()`.
