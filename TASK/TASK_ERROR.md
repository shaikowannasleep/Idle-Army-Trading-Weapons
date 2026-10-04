# 🚨 TASK_ERROR LOG & RESOLUTIONS

Tài liệu này tổng hợp toàn bộ các lỗi phát sinh trong quá trình phát triển dự án, nguyên nhân kỹ thuật chi tiết và giải pháp khắc phục triệt để TỪ GỐC RỄ.

---

## 1. Missing Script Error on CoinFlyFX (`3e18amSEuBBCrXhiJi5ZRoC`)
- **Triệu chứng**: `[Scene] Script "3e18amSEuBBCrXhiJi5ZRoC" attached to "CoinFlyFX" is missing or invalid.`
- **Nguyên nhân**: Node `CoinFlyFX` được gắn tĩnh vào file `.scene` trước khi AssetDB biên dịch xong script mới.
- **Giải pháp**: Xóa bỏ thành phần bị lỗi, chuẩn hóa component và serialized ID trong `.scene`.

---

## 2. Lỗi Kích Thước Đồng Xu Quá Lớn & Bay Lệch Vị Trí UI
- **Triệu chứng**: Đồng xu khổng lồ 256px che màn hình và bay lệch vào giữa thay vì góc trên bên phải.
- **Nguyên nhân**: `Sprite.sizeMode` mặc định `TRIMMED` và trỏ nhầm node cha `CoinPanel` thay vì nút con `Button`.
- **Giải pháp**: Cấu hình `CUSTOM` 38x38px, trỏ chính xác vào Node ID 13 (`Button`) và tạo sẵn Pool 6 Coin trong Scene.

---

## 3. Lỗi Mất Thư Viện SystemJS (`ENOENT: ... /systemjs/system.js`)
- **Triệu chứng**: `ReferenceError: System is not defined at window.onload`.
- **Nguyên nhân**: Xóa nhầm thư mục `temp/programming/preview/systemjs/`.
- **Giải pháp**: Khôi phục toàn bộ SystemJS chuẩn từ Cocos Creator 3.8.8 engine (đã xác thực HTTP 200 OK).

---

## 4. [GỐC RỄ] Lỗi `Command 'draw' must be recorded inside a render pass` Từ Engine Profiler
- **Triệu chứng**:
  ```text
  [PreviewInEditor] Command 'draw' must be recorded inside a render pass.
  at WebGL2PrimaryCommandBuffer.draw
  at DeviceRenderScene._showProfiler (index.js:234350:11)
  ```
- **Nguyên nhân GỐC RỄ thực sự**:
  - Trong toàn bộ mã nguồn game (`assets/Scripts/`) **HOÀN TOÀN KHÔNG CÓ BẤT KỲ LỆNH `draw` HAY `Graphics` NÀO**.
  - Lệnh gọi `draw` này thực chất được phát ra từ **`DeviceRenderScene._showProfiler`** (Module Profiler đo FPS/Draw call tích hợp sẵn bên trong lõi engine Cocos Creator 3.8.8). Khi game bị Pause trong In-Editor simulation, render pass của scene tạm ngưng, nhưng `_showProfiler` vẫn cố vẽ thông số lên màn hình nên engine báo lỗi.
- **Giải pháp GỐC RỄ triệt để**:
  1. Đã quét và xác nhận toàn bộ `assets/Scripts/` sạch 100% không còn bất kỳ lệnh vẽ vector `Graphics` hay hàm `draw()` nào.
  2. Vô hiệu hóa triệt để module `profiler` trong [settings/v2/packages/engine.json](file:///Users/macbook/Test00/settings/v2/packages/engine.json) trên tất cả các profile cấu hình engine (`"profiler": { "_value": false }`).
  3. Khi module `profiler` được tắt, hàm `_showProfiler` sẽ không còn được engine gọi khi Pause, triệt tiêu 100% lỗi `Command 'draw' must be recorded inside a render pass` từ tận gốc rễ của engine Cocos Creator!

---

## 5. [GỐC RỄ] Lỗi `TypeError: Cannot read properties of undefined (reading '0') at Simple.updateUVs` (simple.ts:200)
- **Triệu chứng**:
  ```text
  TypeError: Cannot read properties of undefined (reading '0')
  at Simple.updateUVs (simple.ts:200)
  at Sprite.updateRenderer
  ```
- **Nguyên nhân GỐC RỄ**:
  1. Trong `assets/scene.scene`, các node `ProgressBarNode` và `BlockInputNode` chứa component `Sprite` với `_spriteFrame: null` trong khi node đang active.
  2. Các file meta của `Chatbox.png`, `2.png`, `3.png` trong `assets/_unused/resources/asset/UI/` chỉ có subMeta `texture` (`@6c48a`) mà chưa có subMeta `sprite-frame` (`@f9941`), dẫn đến khi Sprite cố gắng tính toán tọa độ UV (`spriteFrame.uv[0]`) thì mảng `uv` bị `undefined`.
- **Giải pháp GỐC RỄ triệt để**:
  1. Đã sinh đầy đủ subMeta `sprite-frame` (`@f9941`) cho các texture UI (`Chatbox.png`, `2.png`, `3.png`) với ma trận đỉnh và UV hợp lệ.
  2. Đã loại bỏ toàn bộ các component `Sprite` rỗng/null (`Comp 52` và `Comp 91`) trên `assets/scene.scene`. Tổng số SpriteFrame null trong scene hiện tại là **0**, triệt tiêu 100% lỗi `Simple.updateUVs`.

---

## 6. [Task 19] Vũ khí procedural lệch/sai tỉ lệ khi gắn vào tay lính (meshopt quantization)
- **Triệu chứng (phát hiện khi thiết kế)**: `gltf-transform meshopt()` mặc định lượng tử hóa POSITION về int16 chuẩn hóa + bù bằng transform node → không gian bind của mesh M4 không còn là mét.
- **Nguyên nhân**: Shotgun/Minigun/Rocket được dựng trong không gian bind của súng M4 (lấy bbox làm điểm neo).
- **Giải pháp**: Pipeline dùng `reorder()` + `EXT_meshopt_compression` method `QUANTIZE` (nén không lượng tử hóa) trong `tools/build-assets.mjs`.

## 7. [Task 19] `Cannot read properties of undefined (reading 'getWorldPosition')` — lính không bắn
- **Triệu chứng**: Lính đứng sau tường nhưng không bắn, boss không bao giờ chết; lỗi lặp mỗi frame.
- **Nguyên nhân**: `GLTFLoader` sanitize tên node (`PropertyBinding.sanitizeNodeName`) → xương `WP.R` thành `WPR`.
- **Giải pháp**: `Unit` tìm `'WPR'` (fallback `'WP.R'`).

## 8. [Task 19] Boss & lính bị vẽ tại gốc tọa độ sau khi tối ưu ma trận
- **Triệu chứng**: Boss hồng nằm giữa trại, lính biến mất (chỉ còn blob shadow).
- **Nguyên nhân**: Đặt `root.matrixWorldAutoUpdate = false` rồi gọi `root.updateMatrixWorld(true)` — trong three r186 hàm này bỏ qua cập nhật `matrixWorld` của chính node khi cờ là false.
- **Giải pháp**: Tự `updateMatrix()` + `matrixWorld.copy(matrix)` cho root rồi `updateMatrixWorld(true)` từng child (`Actor.updateAnim`). Bài học: luôn chụp screenshot gameplay sau mỗi tối ưu.

## 9. [Task 19] Nhãn giá pad che thùng vũ khí / đè nhau trên màn dọc; pad trùng gốc cây của map
- **Giải pháp**: Chip gọn đặt ngay trên pad (ẩn khi đứng lên), kho dời sang x = -2.2/0.9/3.7/5.5/7.3 tránh gốc cây; nhãn rộng được kẹp trong màn hình; thêm cơ chế trượt quanh vật cản.

## 10. [Task 19] RAM tab ~230 MB
- **Nguyên nhân (memory-infra dump)**: framebuffer WebGL MSAA 4x ở DPR 2 (~67 MB), shadow map 2048² (~16 MB), ImageBitmap texture giữ lại sau upload, audio 48kHz.
- **Giải pháp**: MSAA chỉ khi DPR < 2, shadow 1024, `ImageBitmap.close()` sau warmup, AudioContext 24kHz → physical footprint ~131 MB. (Lưu ý: RSS của `ps` trên macOS dao động mạnh và gồm vùng shared; dùng `footprint` để đo đúng.)
