# 📋 BÁO CÁO NHẬT KÝ THỰC THI NHIỆM VỤ (TASK LOG)

---

## 📥 1. INPUT (Yêu cầu đầu vào)
1. **Hệ thống Tracking Playable Ads (3 lớp)**:
   - Triển khai toàn bộ mã nguồn tracking hành vi người chơi, quản lý lượt tap (`maxTaps`, `remainingTaps`, `cost`), điều kiện lọc (`checkOnlySuccess`), quản lý vòng đời (`LOADING`, `LOADED`, `DISPLAYED`, `CHALLENGE_STARTED`, `ENDCARD_SHOWN`), profiler session khi ẩn/hiện tab (`visibilitychange`), và dispatcher mở Store (`super_html.download`, `mraid.open`, `ExitApi.exit`, `install`, `playableSDK.openAppStore`).
2. **Dự án Hiện Tại (Cocos Creator - TypeScript)**:
   - Tự động tích hợp bằng 100% TypeScript vào các file gameplay trong `assets/Scripts/`.
3. **Sửa lỗi Script Missing trên Cocos Creator**:
   - Khắc phục lỗi `Script "aaf47ZoVHRD+Z2v5Hn4r/nN" attached to "PlayableAdsController" is missing or invalid.`
4. **Tích hợp MCP Server cho Cocos Creator (`cocos-mcp`)**:
   - Tải, cài đặt dependencies và build extension `cocos-mcp` (mã nguồn mở, miễn phí 100%) từ repo `https://github.com/RomaRogov/cocos-mcp.git` vào thư mục `extensions/` để Antigravity có thể trực tiếp can thiệp, đọc hiểu và chỉnh sửa `.scene` trong Cocos Creator Editor.

---

## 📤 2. OUTPUT (Kết quả thực thi)

### A. Hệ Thống Tracking Playable Ads (TypeScript - Cocos Creator)
- **`assets/Scripts/Tracking/PlayableAdsSDK.ts`**:
  - Singleton SDK xử lý vòng đời, trigger Store và theo dõi thời gian chơi game qua `document.visibilitychange`.
- **`assets/Scripts/Tracking/PlayableAdsFlowManager.ts`**:
  - Quản lý logic lượt tap của màn chơi, điều kiện trừ lượt, kích hoạt Store khi chạm giới hạn.
- **`assets/Scripts/PlayableAdsController.ts`**:
  - Hook khởi tạo SDK khi load scene và khởi tạo flow tương tác ban đầu.
- **`assets/Scripts/GameManager.ts`**:
  - Tích hợp hàm `trackClick(isSuccess, cost)` vào các thao tác click chuột/chạm màn hình của người chơi.

### B. Thư Mục Tham Chiếu Cho Unity WebGL
- **`TrackingReference/Unity/Assets/Plugins/WebGL/PlayableBridge.jslib`**: JS Bridge MRAID, ExitApi, Mintegral, TikTok.
- **`TrackingReference/Unity/Assets/Scripts/PlayableAnalyticsManager.cs`**: C# MonoBehaviour Tracking Manager.
- **`TrackingReference/README.md`**: Tài liệu thiết kế hệ thống.

### C. Extension MCP Cocos Creator (`extensions/cocos-mcp`)
- Đã clone từ `https://github.com/RomaRogov/cocos-mcp.git` vào `extensions/cocos-mcp`.
- Đã chạy `npm install` và `npm run build` thành công 100% ra thư mục `dist/`.
- Cung cấp sẵn 16 Tools MCP để Antigravity thao tác trên Scene:
  - `query_nodes` / `nodeGetTree`: Đọc toàn bộ cây Node trong scene.
  - `query_components`: Đọc thuộc tính các component.
  - `create_nodes`: Tạo mới Node, Sprite, Label, Button...
  - `modify_nodes`: Sửa vị trí (Position), Scale, Rotation, Active/Inactive.
  - `modify_components`: Đổi giá trị các trường trong component.
  - `operate_current_scene`: Lưu scene (`save-scene`), mở scene.
  - `execute_scene_code`: Thực thi code TypeScript/JavaScript trực tiếp trên Scene runtime.

---

## ⚠️ 3. ERROR LOG & RESOLUTION (Nhật ký lỗi và Cách xử lý)

| STT | Lỗi Phát Sinh | Nguyên Nhân | Cách Xử Lý | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `Script "aaf47ZoVHRD+Z2v5Hn4r/nN" attached to "PlayableAdsController" is missing or invalid.` | File `PlayableAdsController.ts` có một dấu đóng ngoặc `}` thừa tại hàm `openStore()`, làm đứt gãy cú pháp class TypeScript khiến Cocos Creator không biên dịch được component. | Xóa dấu ngoặc thừa, chuẩn hóa lại cú pháp khai báo `@ccclass` và `export default`. Cocos Creator đã nạp lại component bình thường. | ✅ Đã khắc phục |
| **2** | `npx tsc --noEmit` ở thư mục gốc không tìm thấy local compiler | Workspace Cocos Creator dùng compiler nội bộ `temp/tsconfig.cocos.json`. | Sử dụng TypeScript compiler được cấu hình trong `extensions/cocos-mcp/node_modules/typescript` để build extension. | ✅ Đã khắc phục |

---

## 🔌 4. HƯỚNG DẪN KÍCH HOẠT MCP ĐỂ ANTIGRAVITY ĐIỀU KHIỂN SCENE

1. **Bật Extension trong Cocos Creator**:
   - Mở Cocos Creator -> Vào **Extension** -> **Extension Manager** -> Tab **Project**.
   - Tìm extension `cocos-mcp` và gạt nút **Enable**.
   - Extension sẽ tự khởi động HTTP/SSE MCP Server tại địa chỉ: `http://localhost:3000/mcp`.
2. **Cấu hình Antigravity IDE**:
   - Thêm vào file cấu hình MCP của Antigravity IDE (`~/.gemini/antigravity-ide/mcp_config.json`):
   ```json
   {
     "mcpServers": {
       "cocos-creator": {
         "url": "http://localhost:3000/mcp"
       }
     }
   }
   ```
3. **Thực thi**:
   - Khi đó, bạn chỉ cần ra lệnh trong chat với Antigravity (ví dụ: *"Thêm Node Button vào scene, đặt tọa độ (0, 50, 0) và lưu lại"*), Antigravity sẽ tự động gọi MCP tools để hoàn thành ngay lập tức!

### J. Module Scanner & Feature Cropping
- **`scripts/scan-modules.js`**: Tự động phân tích AST TypeScript và Scene để lập danh sách module thừa cần exclude.
- **`scripts/module-analyzer/index.html`**: Bảng dashboard trực quan kiểm tra tối ưu hóa dung lượng module.

### K. Asset Optimization & Pruning
- **`scripts/prune-unused-assets.js`**: Phân tích cây phụ thuộc Asset (Transitive Dependency Graph) và di chuyển 40 asset thừa ra thư mục `assets/_unused/`, giải phóng 1.26 MB asset không cần thiết.
- **`scripts/restore-unused-assets.js`**: Công cụ khôi phục lại asset từ `assets/_unused/` khi cần.
- **`package.json`**: Bổ sung các lệnh `npm run prune:assets`, `npm run restore:assets`.

### L. Loading UI & Slot Overlap Optimization
- **`assets/Scripts/LoadingUI.ts`**: Hệ thống hiển thị hiệu ứng Loading nạp đạn/chế tạo với icon xoay 360° và progress bar mượt mà.
- **`assets/Scripts/GameManager.ts` & `assets/Scripts/UnitController.ts`**: Triển khai thuật toán tịnh tiến hàng chờ `advanceQueue()` và cơ chế khóa slot `claimAttackSlot()` chống hoàn toàn lỗi nhân vật đi đè lên vị trí của nhau.
- **`assets/scene.scene`**: Inject trực tiếp node `LoadingUI` vào Canvas.

### M. Tutorial Hand Guide (Scale/Zoom Animation)
- **`assets/Scripts/TutorialHand.ts`**: Hệ thống bàn tay chỉ dẫn có hiệu ứng zoom scale nhấp nháy (`0.75x -> 1.22x`) kết hợp gợn sóng nhấp nháy chỉ thẳng vào các hộp quà/vũ khí (`boxPistol`, `boxAK`, `boxTool`) khi xuất hiện.
- **`assets/Scripts/GameManager.ts`**: Tích hợp kích hoạt/ẩn bàn tay theo đúng tiến trình tương tác của người chơi, giảm giá mở khóa AK xuống 2 coin để test nhanh và thêm floating banner hook text sinh động.

### N. Coin Fly Animation FX
- **`assets/Scripts/CoinFlyFX.ts`**: Hệ thống hiệu ứng đồng xu bung nổ từ vị trí 3D của NPC và bay theo đường cong Parabol/Bezier mượt mà lên góc trên bên phải (khu vực hiển thị UI Coin).
- **`assets/Scripts/UnitController.ts` & `assets/Scripts/GameManager.ts`**: Tích hợp gọi hiệu ứng bay tiền khi NPC nhận vũ khí và thanh toán, kèm hiệu ứng nảy phóng to UI Coin và âm thanh nhận tiền.

### O. Clear Code Cache Menu Bar Extension
- **`extensions/clear-code-cache`**: Extension Cocos Creator tích hợp menu bar `Developer -> 🧹 Clear Code Cache & Recompile` và phím tắt `Cmd+Alt+C` để dọn dẹp sạch `temp/programming/` và ép Cocos biên dịch lại toàn bộ TypeScript.
- **`scripts/clear-cache.js` & `package.json`**: Thêm script CLI `npm run clean:cache`.

### P. Scene Restructure, 2.5D Coin Spin & Inspector Setup
- **`assets/Scripts/CoinFlyFX.ts`**: Nâng cấp hiệu ứng đồng xu xoay lật 2.5D quanh trục Y (`scaleX: 1.0 -> 0.15 -> 1.0`) trong khi bay vòng cung parabol, thêm kiểm tra an toàn chống lỗi null reference.
- **`assets/Scripts/LoadingUI.ts` & `assets/Scripts/TutorialHand.ts`**: Tích hợp asset vòng xoay `Progress_Circle_1.png` và phơi toàn bộ thuộc tính UI lên Inspector để dev dễ dàng tùy biến kích cỡ, text, tốc độ.
- **`assets/scene.scene`**: Tái cấu trúc cây thư mục phân khối bằng các header `---`, đưa các node Manager/Script lên trên cùng để click nhanh nhất.

### Q. Loading UI Visual Design & Background Polish
- **`assets/scene.scene`**: Bổ sung node khung nền `BgNode` (kích thước `220x66` px, sử dụng Sprite 9-slice `khung_popup.png` với nền xanh navy đậm `rgba(15, 23, 42, 240)` và viền bo góc sắc nét).
- **`assets/resources/asset/UI/Button_Green_1.png`**: Gắn SpriteFrame 9-slice màu xanh ngọc bích cho thanh tiến trình `BarFill`.
- **`assets/Scripts/LoadingUI.ts`**: Cân chỉnh thanh nạp đạn mượt mà từ `0` đến `116` px, chữ tiêu đề hiển thị to rõ vàng gold `#fef08a`.

### R. Cinematic Boss Spawn Camera & Full-Queue Input Blocker
- **`assets/Scripts/PlayerController.ts`**: Đồng bộ chính xác 100% thời gian Loading UI và thời gian tương tác (chế tạo/giao vũ khí) thông qua callback trực tiếp, triệt tiêu độ trễ hoặc chạy lệch pha.
- **`assets/Scripts/GameManager.ts`**:
  - Bổ sung **Cinematic Camera Focus**: Khi game vừa bắt đầu, Camera 3D sẽ zoom gần vào Boss (`(0, 9.2, -4.0)`) để bắt trọn hoạt ảnh Boss gầm rú/xuất hiện (`Boss 1_Spawn`), sau đó lướt mượt mà `1.1s` về góc nhìn gameplay toàn cảnh (`(0.5, 15.9, 13.7)`).
  - Tích hợp **Block Touch Input**: Bật node chắn touch màn hình ngay từ đầu game (`alpha = 0` + `BlockInputEvents`). Người chơi không thể chạm lung tung cho đến khi 4 NPC đi vào đầy đủ các slot hàng đợi (`arrivedNPCCount >= 4`), lúc này hệ thống mới mở chặn tương tác và kích hoạt bàn tay hướng dẫn!
- **`assets/scene.scene`**: Tạo sẵn `BlockInputNode` (kích thước `1080x1920`, Sprite `alpha=0` + component `BlockInputEvents`) gắn trực tiếp vào `Canvas`.

### S. Boss Spawn Timing, Normal Speed & Frame-0 Stutter Optimization
- **`assets/Scripts/BossController.ts`**:
  - Đặt độ trễ 1.0s trước khi Boss xuất hiện và chạy anim spawn, giúp engine load xong toàn bộ asset và camera ổn định.
  - Chỉnh tốc độ hoạt ảnh Boss về **1.0x (bình thường)**.
  - **Ẩn thanh máu (HP Bar)** trong lúc Boss đang spawn; chỉ hiển thị thanh máu khi Boss hoàn thành hoạt ảnh xuất hiện và chuyển sang `Boss 1_Idle`.
- **`assets/Scripts/GameManager.ts`**:
  - Giãn cách thời gian spawn NPC (staggered spawning từ `1.2s`, `1.6s`, `2.0s`, `2.4s`) thay vì gọi 4 lệnh `instantiate()` cùng lúc ở Frame 0, triệt tiêu hoàn toàn hiện tượng tụt frame / lag giật lúc mới vào game!

### T. NPC Attack Movement Fix, Loading UI Duration Sync & HP Bar Camera Delay
- **`assets/scene.scene` & `assets/Scripts/GameManager.ts`**:
  - Khắc phục lỗi NPC nhận súng đứng yên: Bổ sung liên kết và cơ chế tự động tìm kiếm `queueSlots` và `attackSlots` (6 điểm tấn công xung quanh Boss). Khi NPC nhận súng, hệ thống cấp phát ngay `AttackSlot`, NPC tiến hành di chuyển tới vị trí tấn công và xả đạn vào Boss.
  - Cập nhật thời điểm hiện thanh máu Boss: Đúng yêu cầu **sau khi Camera hoàn tất quá trình zoom out toàn cảnh + 0.5s** mới kích hoạt thanh máu.
- **`assets/Scripts/PlayerController.ts`**:
  - Điều chỉnh thời gian chế tạo (`1.8s`) và giao nạp đạn (`1.6s`) khớp trọn vẹn với toàn bộ chu kỳ hoạt ảnh `"Manufacture"` của Staff, bảng Loading UI hiển thị đầy đủ tiến trình và đóng đồng bộ khi nhân vật kết thúc thao tác.

### U. Refactor UI Components For Direct Inspector Camera Binding
- **`assets/Scripts/TutorialHand.ts`, `assets/Scripts/LoadingUI.ts`, `assets/Scripts/CoinFlyFX.ts`**:
  - Gỡ bỏ toàn bộ các hàm tìm kiếm động runtime (`find()`, `director.getScene()`, `resolveCamera()`, `getOrCreate()`).
  - Phơi thuộc tính `@property(Camera) public mainCamera: Camera = null!;` để gán trực tiếp Camera trên Inspector Cocos Creator.
  - Sử dụng trực tiếp `this.mainCamera.convertToUINode(...)` để tính toán tọa độ UI, tối ưu hiệu năng và mã nguồn sạch sẽ, tinh gọn 100%.
- **`assets/Scripts/PlayerController.ts` & `assets/Scripts/GameManager.ts`**:
  - Chuyển sang gọi trực tiếp qua Singleton pattern (`LoadingUI.Instance?.show(...)`, `TutorialHand.Instance?.show(...)`, `CoinFlyFX.Instance?.playFly(...)`).

### V. Staff Action Loop Fix & Exact Animation Duration Synchronization
- **`assets/Scripts/MovableActor.ts`**:
  - Thêm phương thức `getAnimDuration(name: string, fallback: number)` tự động truy vấn độ dài thời gian chính xác của từng Animation Clip từ `SkeletalAnimation.getState(name).duration` và ghi log chi tiết (`⏱️ [Staff] Animation clip [Manufacture] duration: ...s`).
- **`assets/Scripts/LoadingUI.ts`**:
  - Cải tiến hàm `show()`: Đảm bảo luồng tween thời gian và thanh tiến trình luôn luôn kích hoạt callback `onComplete()` khi hết thời lượng `duration`, khắc phục lỗi Loading UI đóng sớm hoặc bị bỏ qua callback.
- **`assets/Scripts/PlayerController.ts`**:
  - Truy vấn trực tiếp thời lượng hoạt ảnh `"Manufacture"` để truyền vào `LoadingUI.show()`, giúp thanh loading hiển thị chuẩn xác từng mili-giây với hành động của Staff.
  - Bổ sung cơ chế bảo vệ kép (Safety Fallback Timer) đảm bảo Staff **100% không bao giờ bị kẹt lại trong vòng lặp thu thập/chế tạo**, tự động chuyển sang giao hàng và quay về trạng thái `Idle` mượt mà.

### W. Cap Maximum NPCs to 4 & Video/HTML Reference Analysis Readiness
- **`assets/Scripts/GameManager.ts`**:
  - Giới hạn cứng số lượng khách tối đa trong game: `maxNPCs = 4`.
  - Khắc phục lỗi `advanceQueue()` liên tục gọi `trySpawnNPC()` khiến NPC tràn ngập màn hình (10+ khách). Giờ đây game chỉ sinh đúng **4 khách duy nhất**, 4 khách này lần lượt nhận súng và di chuyển lên tuyến đầu tấn công Boss.

### X. Comprehensive Video/Source Analysis & Standalone Scene Baker Tool
- **`TASK/18_Video_Gameplay_Analysis/INPUT.md` & `OUTPUT.md`**:
  - Biên soạn tài liệu phân tích chi tiết 100% dòng thời gian gameplay (Timeline Benchmark), chu kỳ phục vụ 2.0s, quy trình biến hình quân nhân, hệ thống bắn đạn Boss fight và tiến trình mở Rương 1 -> Rương 2 -> Rương 3.
- **`scripts/bake-scene-nodes.js`**:
  - Xây dựng công cụ độc lập ngoài runtime: Khởi tạo tĩnh 100% các node hiệu ứng (`SmokeFX_0..3`, `ThoughtBubble_0..3` kèm icon Pistol/AK, `BulletTracer_0..5`) trực tiếp vào file `assets/scene.scene`.
  - **Đảm bảo 0 GC runtime**, không tạo rác bộ nhớ khi chơi. Sau khi nạp xong có thể xoá hoặc cất script mà không ảnh hưởng gì tới project.

### Y. Align Project Core Gameplay to Reference Benchmark
- **`assets/Scripts/PlayerController.ts`**:
  - Triển khai trọn vẹn chu trình 3 pha phục vụ chuẩn:
    1. Tiếp nhận order tại quầy (2.0s) + âm thanh `finish_order` + hiện ThoughtBubble trên đầu khách.
    2. Sang kệ lấy/chế tạo súng tương ứng (2.0s) + âm thanh `finish_order` + cầm súng trên tay.
    3. Giao hàng cho khách, khách biến hình sang lính chiến đấu, nhận tiền xu bay lên bảng Coin UI và tiến lên tuyến đầu nã đạn vào Boss.
- **`assets/Scripts/UnitController.ts`**:
  - Khách hàng ẩn bóng suy nghĩ, tự động hoán đổi từ thường phục (`Body_01_blackjacket`) sang quân phục lính (`1` / `armyPart`) và trang bị súng (Pistol/AK).
  - Tự động di chuyển vào các slot tấn công quanh Boss và xả đạn nhịp nhàng.
- **`assets/Scripts/GameManager.ts`**:
  - Quản lý mở Rương 1 (Pistol) lúc khởi đầu -> Sau khi phục vụ 2 khách, Rương 2 (AK) rơi xuống với bàn tay hướng dẫn -> Sau 4 khách, Rương 3 (Mystery Box) xuất hiện dẫn tới Store CTA.
  - Cố định tối đa 4 khách trong hàng đợi. Không sinh khách vô hạn.
  - Tích hợp điều khiển mượt mà với `LoadingUI.Instance`, `TutorialHand.Instance`, `CoinFlyFX.Instance`.

### Z. Complete Texture Mapping, Soldier Transformation & Thought Bubble Order System
- **`assets/Prefab/Unit2.prefab` & `assets/_unused/Mat/TT_Solider.mtl`**:
  - Cập nhật Prefab lính: Khôi phục Node `1` (Soldier body mesh) với chất liệu rằn ri nón cối `TT_Solider.mtl` (`TT_Soldiers_texture_A.tga`) và Node `Body_01_blackjacket` với `TT_NPC.mtl`.
  - Khắc phục lỗi texture của NPC và lỗi không hiện thân lính khi biến hình.
- **`scripts/bake-scene-nodes.js` & `assets/scene.scene`**:
  - Nạp tĩnh toàn bộ 4 Node `ThoughtBubble_0..3` vào `ThoughtBubbleContainer` trên Canvas, bao gồm khung thoại `Chatbox.png` và Icon súng lục `2.png` / AK `3.png`.
- **`assets/Scripts/GameManager.ts` & `assets/Scripts/UnitController.ts`**:
  - Tích hợp hàm `showThoughtBubble(unit, weaponType)` và `hideThoughtBubble(unit)` quản lý bóng suy nghĩ hiển thị ngay trên đỉnh đầu từng vị trí khách khi Staff nhận order.
  - Khi giao súng: Tự động tắt bóng suy nghĩ, bùng nổ biến hình sang quân phục lính rằn ri, phát thưởng đồng xu và tiến lên bắn Boss.

### AA. Task 19 — Mini game Idle "Boss Armory" (Three.js, `idle-threejs/`)
- Chuyển toàn bộ model FBX → GLB (Blender headless, relink texture), tối ưu meshopt + WebP; tái dùng âm thanh/UI gốc.
- Gameplay idle hoàn chỉnh: bán vũ khí → khách biến thành lính → bắn boss → loot (xu/gem/rương, tự vào túi sau 10s) → pad nâng cấp/mở rộng → boss tiến hóa mỗi lần nâng cấp → kịch bản thua ~1:30 → endcard Continue (GitHub) / Retry.
- 3 vũ khí procedural mới (Shotgun/Minigun/Rocket), trợ lý bán hàng, VFX instanced, rung màn hình, slow-mo.
- Port tracking 3 lớp sang TS thuần. Đo hiệu năng tự động: 60fps khóa, footprint ~131 MB. Chi tiết: `TASK/19_ThreeJS_Idle_Boss_Armory/OUTPUT.md`.
