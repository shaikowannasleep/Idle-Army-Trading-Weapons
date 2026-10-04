# 📥 INPUT: PlayableAdsSDK

## 🎯 Mục tiêu
Triển khai Singleton SDK đóng vai trò Tầng SDK/Bridge trong kiến trúc tracking 3 lớp cho Playable Ads Cocos Creator.

## 📋 Yêu cầu chi tiết
1. **Quản lý Lifecycle Enum**:
   - `LOADING`, `LOADED`, `DISPLAYED`, `CHALLENGE_STARTED`, `ENDCARD_SHOWN`.
2. **Theo dõi Profiler Session Duration qua `visibilitychange`**:
   - Lắng nghe `document.visibilitychange`.
   - Khi ẩn tab (`document.hidden`): log `[PlayableAdsSDK] System EVENT_HIDE` và tính duration thời gian chơi `=== PROFILER SESSION ENDED | Duration: Xs | Reason: TabHidden_StopPlay ===`.
   - Khi quay lại tab: log `[PlayableAdsSDK] System EVENT_SHOW` và reset mốc thời gian bắt đầu.
3. **Đồng bộ tín hiệu game ready**:
   - Hàm `gameReady()` gọi `super_html.game_ready()` hoặc `window.gameReady()`.
4. **Dispatcher mở App Store**:
   - Hàm `openStore()` hỗ trợ fallback theo thứ tự ưu tiên:
     - `super_html.download()`
     - `mraid.open()`
     - `ExitApi.exit()`
     - `window.install()`
     - `playableSDK.openAppStore()`
