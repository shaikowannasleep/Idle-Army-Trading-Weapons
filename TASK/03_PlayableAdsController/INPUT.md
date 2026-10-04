# 📥 INPUT: PlayableAdsController

## 🎯 Mục tiêu
1. Tích hợp `PlayableAdsSDK` và `PlayableAdsFlowManager` vào vòng đời của Scene Cocos Creator (`onLoad`, `start`).
2. Sửa lỗi cú pháp làm hỏng component trong Cocos Creator Editor (`Script aaf47ZoVHRD+Z2v5Hn4r/nN missing or invalid`).

## 📋 Yêu cầu chi tiết
1. Trong `onLoad()`: Gọi `PlayableAdsSDK.instance.init()`, log `PlayableEvent.LOADING`, `PlayableEvent.LOADED`.
2. Trong `start()`: Log `PlayableEvent.DISPLAYED`, gọi `PlayableAdsSDK.instance.gameReady()`, khởi tạo level với `PlayableAdsFlowManager.instance.startLevel(0, 10, true)`.
3. Trong `openStore()`: Sử dụng `PlayableAdsFlowManager.instance.stopAdsWhilePlaying()`.
4. Loại bỏ mọi lỗi cú pháp TypeScript, bảo đảm export đúng chuẩn Cocos Creator `@ccclass`.
