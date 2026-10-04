# 📤 OUTPUT: PlayableAdsController

## 📁 File Cập Nhật
- **Đường dẫn:** `assets/Scripts/PlayableAdsController.ts`
- **Ngôn ngữ:** TypeScript

## ⚙️ Các Thay Đổi Đã Thực Hiện
1. **Khắc phục lỗi cú pháp:** Loại bỏ dấu ngoặc nhọn `}` thừa ở cuối hàm `openStore()`.
2. **Khởi tạo Tracking Lifecycle:**
   ```typescript
   onLoad() {
       PlayableAdsSDK.instance.init();
       PlayableAdsSDK.instance.logEvent(PlayableEvent.LOADING);
       PlayableAdsSDK.instance.logEvent(PlayableEvent.LOADED);
       ...
   }
   ```
3. **Kích hoạt Game Ready & Flow:**
   ```typescript
   start() {
       PlayableAdsSDK.instance.logEvent(PlayableEvent.DISPLAYED);
       PlayableAdsSDK.instance.gameReady();
       PlayableAdsFlowManager.instance.startLevel(0, 10, true);
   }
   ```
4. **Chuẩn hóa Export:** Khai báo `export class PlayableAdsController extends Component` và `export default PlayableAdsController;`.
