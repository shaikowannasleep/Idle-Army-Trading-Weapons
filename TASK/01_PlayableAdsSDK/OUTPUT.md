# 📤 OUTPUT: PlayableAdsSDK

## 📁 File Tạo Mới
- **Đường dẫn:** `assets/Scripts/Tracking/PlayableAdsSDK.ts`
- **Ngôn ngữ:** TypeScript

## ⚙️ Các API & Phương thức đã triển khai
1. **`PlayableAdsSDK.instance`**: Singleton pattern truy cập toàn cục.
2. **`init(): void`**: Bắt đầu đo thời gian session và đăng ký sự kiện `visibilitychange`.
3. **`logEvent(event: PlayableEvent, params?: any): void`**: Log sự kiện lifecycle chuẩn hóa ra console.
4. **`logProfiler(reason: string): void`**: Ghi nhận timestamp bắt đầu session profiling.
5. **`gameReady(): void`**: Báo hiệu game đã tải xong tới mạng quảng cáo.
6. **`openStore(): void`**: Chuyển hướng tới App Store đa nền tảng.
