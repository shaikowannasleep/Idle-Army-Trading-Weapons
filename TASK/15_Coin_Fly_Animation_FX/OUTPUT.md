# 📤 OUTPUT: Coin Fly FX (Scene Pre-Made Nodes & Size Optimization)

## 📁 Cập Nhật Chi Tiết
1. **Thiết Lập Sẵn Hệ Thống Node Trên Scene ([assets/scene.scene](file:///Users/macbook/Test00/assets/scene.scene))**:
   - Tạo sẵn cây node `CoinFlyFX` ngay dưới `UICanvas/Canvas`.
   - Cấu hình sẵn **Pool 6 Node Đồng Xu** (`Coin_0` -> `Coin_5`):
     - Kích thước chuẩn gọn đẹp: **`38 x 38 px`** (Sprite sizeMode: CUSTOM).
     - Gắn sẵn SpriteFrame `Coin.png` (`07f0c5ed-b6d1-4252-9c73-72c286d88b53@f9941`).
     - Tùy chỉnh trực tiếp trong Inspector: Bạn có thể chọn target, đổi camera, chỉnh `coinSize` ngay trên Cocos Creator Editor.

2. **Sửa Vị Trí Đích Bay Chuẩn Xác Đến Icon Coin UI**:
   - Tham chiếu `targetUINode` trỏ đúng vào **Node ID 13 (`UICanvas/Canvas/CoinPanel/Button`)** ở góc trên bên phải màn hình.
   - Các đồng xu bay vòng cung parabol chuẩn xác và tụ lại ngay tại icon Coin ở góc trên bên phải.

3. **Tối Ưu Hoá Hoạt Ảnh ([CoinFlyFX.ts](file:///Users/macbook/Test00/assets/Scripts/CoinFlyFX.ts))**:
   - Sử dụng trực tiếp các node coin có sẵn từ `coinPool` thay vì sinh động (instantiate) liên tục.
   - Nảy nhẹ panel Coin (`1.0 -> 1.22 -> 1.0`) và kích hoạt âm thanh nhận tiền `playCoinReceive()`.

## 🎯 Kết Quả Đạt Được
- ✅ Đồng xu có kích thước vừa vặn (38px), không còn bị khổng lồ.
- ✅ Bay trúng đích 100% vào icon Coin ở góc trên bên phải.
- ✅ Có sẵn toàn bộ cây node trên Scene để dev/designer dễ dàng tinh chỉnh trong Inspector.
