# 🎮 Cocos Creator & Playable Ads Project Rules

## 1. Ngôn Ngữ & Môi Trường (TypeScript First)
- Toàn bộ mã nguồn gameplay và hệ thống trong `assets/Scripts/` **bắt buộc dùng 100% TypeScript (`.ts`)**.
- Không sử dụng file JavaScript rời hoặc ngôn ngữ khác trong `assets/`.
- Tuân thủ cú pháp component Cocos Creator 3.8+:
  ```typescript
  import { _decorator, Component } from 'cc';
  const { ccclass, property } = _decorator;

  @ccclass('MyComponent')
  export class MyComponent extends Component {
      // Logic
  }
  export default MyComponent;
  ```
- **Tuyệt đối tránh lỗi cú pháp đứt gãy** (như dấu đóng ngoặc `}` thừa) làm hỏng bộ phân tích AST của Cocos Creator, dẫn đến lỗi mất script UUID (`Script missing or invalid`).

---

## 2. Chuẩn Kiến Trúc Tracking Playable Ads (3 Lớp)
Mọi tương tác và sự kiện quảng cáo phải tuân thủ nghiêm ngặt mô hình 3 lớp:
1. **Tầng Gameplay Input:**
   - Mọi sự kiện tap/click của người chơi phải gọi qua:
     ```typescript
     PlayableAdsFlowManager.instance.trackClick(isSuccess: boolean, cost: number);
     ```
   - Thao tác thành công: `isSuccess = true, cost = 1`.
   - Thao tác thất bại / tap vùng trống: `isSuccess = false, cost = 0`.
2. **Tầng Flow Logic:**
   - Quản lý `maxTaps`, `remainingTaps`, `currentTapCount`.
   - Khi hết lượt hoặc hoàn thành mục tiêu, kích hoạt CTA qua:
     ```typescript
     PlayableAdsFlowManager.instance.stopAdsWhilePlaying();
     ```
3. **Tầng SDK & Adapter:**
   - Quản lý vòng đời (`LOADING`, `LOADED`, `DISPLAYED`, `CHALLENGE_STARTED`, `ENDCARD_SHOWN`).
   - Tự động theo dõi profiler khi chuyển tab qua `document.visibilitychange`.
   - Mở Store đa nền tảng (`super_html.download`, `mraid.open`, `ExitApi.exit`, `window.install`, `playableSDK.openAppStore`).

---

## 3. Quy Chuẩn Ghi Nhật Ký Nhiệm Vụ (TASK Directory Standard)
Khi thực hiện chỉnh sửa nhiều script hoặc thực thi tác vụ phức tạp:
1. Tạo thư mục `TASK/` ngoài `assets/`.
2. Mỗi task/script chỉnh sửa tạo thành 1 subtask folder (ví dụ: `TASK/01_TenTask/`).
3. Mỗi subtask bắt buộc có 2 file riêng:
   - `INPUT.md`: Mô tả yêu cầu, mục tiêu, đầu vào.
   - `OUTPUT.md`: Báo cáo kết quả, file đã sửa, thay đổi cụ thể.
4. Mọi lỗi phát sinh, nguyên nhân gốc rễ và cách xử lý phải được ghi tập trung vào file:
   - `TASK/TASK_ERROR.md`.
