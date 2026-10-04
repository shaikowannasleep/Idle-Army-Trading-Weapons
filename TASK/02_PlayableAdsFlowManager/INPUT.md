# 📥 INPUT: PlayableAdsFlowManager

## 🎯 Mục tiêu
Quản lý luồng tương tác của người chơi, giới hạn lượt click/tap, lọc tương tác theo điều kiện và tự động kích hoạt Call-To-Action (CTA) khi đạt ngưỡng.

## 📋 Yêu cầu chi tiết
1. **Thiết lập level**:
   - `startLevel(levelIndex, maxTaps, checkOnlySuccess)`: Khởi tạo biến đếm `currentTapCount = 0`, `remainingTaps = maxTaps`, phát sự kiện `CHALLENGE_STARTED`.
2. **Theo dõi tương tác**:
   - `trackClick(isSuccess, costRemaining)`:
     - Nếu `!isSuccess` và `checkOnlySuccess == true`: Bỏ qua không tăng biến đếm.
     - Nếu hợp lệ: Tăng `currentTapCount++`, trừ `remainingTaps = max(0, remainingTaps - cost)`.
     - Log định dạng: `[AdsTrackingEvent] OnClick handled...` và `[PlayableAdsFlowManager] Shooter Click Tracked...`.
3. **Kích hoạt CTA / Store**:
   - Khi `currentTapCount >= maxTaps` hoặc `remainingTaps <= 0`: Tự động gọi `stopAdsWhilePlaying()`.
   - `stopAdsWhilePlaying()`: Gọi `PlayableAdsSDK.instance.openStore()`, phát `ENDCARD_SHOWN`.
