# 📥 INPUT: Scene Restructure, 2.5D Coin Spin & Inspector Setup

## 🎯 Mục tiêu
1. **Hiệu ứng Đồng xu 2.5D**: Giúp đồng xu xoay lật 3D quanh trục Y (`scaleX` flip) trong quá trình bay parabol lên UI, tạo cảm giác 2.5D xịn sò và chân thực.
2. **Setup Toàn Bộ UI Trực Tiếp Trên Scene & Inspector**:
   - `LoadingUI`: Đưa sẵn node lên Scene, gắn asset vòng xoay `Progress_Circle_1.png` để xoay tròn lúc nạp đạn/chế tạo, phơi đầy đủ `@property` trên Inspector.
   - `TutorialHand`: Phơi đầy đủ `@property` của `HookBanner` (text, scale, speed) để có thể chỉnh sửa trực tiếp trên Editor.
   - `CoinFlyFX`: Chứa sẵn pool 6 node coin 38px bám đúng vị trí nút Coin trên Canvas.
3. **Sắp Xếp Lại Toàn Bộ Cây Node Trên Scene**:
   - Sử dụng các header phân cách `---` để gom nhóm rõ ràng.
   - Đưa tất cả các node Manager/Script (`GManager`, `PlayableAdsController`, `SoundManager`) lên **vị trí cao nhất trên cùng** để dev click vào chỉnh sửa nhanh nhất.
4. **Fix lỗi Command 'draw' inside a render pass**:
   - Chuyển toàn bộ các lệnh khởi tạo hình ảnh/graphics sang `onLoad`/`start` tĩnh thay vì vẽ động trong frame loop preview.
