# 📤 OUTPUT: PlayableAdsFlowManager

## 📁 File Tạo Mới
- **Đường dẫn:** `assets/Scripts/Tracking/PlayableAdsFlowManager.ts`
- **Ngôn ngữ:** TypeScript

## ⚙️ Các API & Phương thức đã triển khai
1. **`PlayableAdsFlowManager.instance`**: Singleton pattern truy cập toàn cục.
2. **`startLevel(levelIndex, maxTaps, checkOnlySuccess): void`**: Đặt lại số lượt bấm về 0 và kích hoạt màn chơi.
3. **`trackClick(isSuccess: boolean, costRemaining: number = 1): void`**: Trừ lượt bấm và kiểm tra giới hạn kết thúc màn chơi.
4. **`stopAdsWhilePlaying(): void`**: Dừng game và chuyển hướng mở Store/Endcard.
5. **`endSessionGame(levelName: number): void`**: Log kết thúc level và gửi sự kiện `ENDCARD_SHOWN`.
