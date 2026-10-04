# Playable Ads Tracking System Specification & Implementation

Tài liệu thiết kế và mã nguồn hoàn chỉnh cho hệ thống tracking hành vi người chơi trong Playable Ads (tương thích Cocos Creator/HTML5 và Unity WebGL).

---

## 1. ⚙️ Kiến Trúc Hệ Thống (3 Lớp)

```text
[ Gameplay UI / Input Events ]
             │ (Touch/Click: isSuccess, cost)
             ▼
[ PlayableAdsFlowManager ]  ──> Quản lý giới hạn Tap, logic trừ lượt, điều kiện Trigger CTA
             │
             ▼
[ PlayableAdsSDK / Bridge ] ──> Quản lý vòng đời (Lifecycle: LOADED, DISPLAYED, VISIBILITY CHANGE)
             │
             ▼
[ Ad Network Wrapper / MRAID ] ──> Dispatcher gọi lệnh Store: mraid.open(), ExitApi.exit(), install()
```

---

## 2. 🕹️ Triển Khai Cho Cocos Creator / TypeScript

### Vị trí các file trong dự án:
- `assets/Scripts/Tracking/PlayableAdsSDK.ts`: Quản lý lifecycle (`LOADING`, `LOADED`, `DISPLAYED`, `CHALLENGE_STARTED`, `ENDCARD_SHOWN`), sự kiện `visibilitychange` (Profiler Session Duration), và trigger Store (`super_html.download`, `mraid.open`, `ExitApi.exit`, `install`, `playableSDK.openAppStore`).
- `assets/Scripts/Tracking/PlayableAdsFlowManager.ts`: Quản lý bộ đếm tap (`maxTaps`, `remainingTaps`), lọc click theo `checkOnlySuccess`, và tự động trigger `stopAdsWhilePlaying()` khi hết lượt tap.
- `assets/Scripts/PlayableAdsController.ts`: Hook khởi tạo SDK & khởi tạo flow level.
- `assets/Scripts/GameManager.ts`: Tích hợp tracking sự kiện tương tác touch/tap người chơi.

---

## 3. 🎮 Triển Khai Cho Unity WebGL (C# & .jslib)

### Vị trí các file tham chiếu:
- `TrackingReference/Unity/Assets/Plugins/WebGL/PlayableBridge.jslib`: Tầng JS Bridge giao tiếp giữa WebGL và Ad Networks (MRAID, ExitApi, Mintegral, TikTok).
- `TrackingReference/Unity/Assets/Scripts/PlayableAnalyticsManager.cs`: Tầng C# MonoBehaviour quản lý lifecycle, tap count, và focus change.

---

## 4. 🌐 Tầng Wrapper HTML (`index.html`)

```html
<script>
  document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
      console.log("[PlayableAdsSDK] System EVENT_HIDE (User pressed Home/Switched Tab)");
    } else {
      console.log("[PlayableAdsSDK] System EVENT_SHOW (User returned to App)");
    }
  });

  if (typeof mraid !== "undefined" && mraid.getState() === 'loading') {
    mraid.addEventListener('ready', function() {
      console.log("[PlayableAdsSDK] MRAID is ready");
    });
  }
</script>
```
