# 📊 BẢN PHÂN TÍCH TOÀN DIỆN VIDEO & SOURCE CODE GAMEPLAY GỐC

---

## 🎬 1. BẢNG DÒNG THỜI GIAN GAMEPLAY CHUẨN (TIMELINE BENCHMARK)

| Mốc Thời Gian | Hành Động Hệ Thống / Nhân Vật | Hiệu Ứng (VFX) & UI Kích Hoạt | Âm Thanh Phù Hợp |
|---|---|---|---|
| **0.0s – 1.0s** | Game khởi tạo, Camera zoom cận Boss, màn hình bị khóa chặn touch (`isBusy = true`). | Khóa toàn màn hình (`BlockInputNode`). | BGM nền bắt đầu phát. |
| **1.0s – 1.7s** | Boss xuất hiện và gầm rú (`Boss 1_Spawn`). | Model Boss hiện hình ở tốc độ 1.0x. | Tiếng gầm của Boss. |
| **1.7s – 2.4s** | Boss vung đòn đe dọa (`Boss 1_Attack 4`), sau đó về `Boss 1_Idle`. | Boss chuyển trạng thái sẵn sàng chiến đấu. | Âm thanh vung vũ khí. |
| **2.4s – 3.4s** | Camera 3D lướt mượt mà `1.0s` về góc nhìn toàn cảnh bàn chơi (`eulerAngles: (-35°, 0, 0)`). | Camera tween mượt mà (`cubicOut`). | Tiếng lướt nhẹ. |
| **3.9s (+0.5s)** | **Camera kết thúc zoom-out + 0.5s:**<br>1. Thanh máu Boss (`groupHP`) hiện lên.<br>2. Bàn tay hướng dẫn chỉ vào **Rương 1 (Pistol Box)**.<br>3. Mở khóa màn hình (`isBusy = false`). | - `HPBarFollower` kích hoạt.<br>- `TutorialHand` hiện bàn tay & banner nhấp nháy.<br>- `BlockInputNode` tắt. | Hiệu ứng pop UI. |
| **Tap 1 (Mở Rương 1)** | Người chơi nhấn vào Rương 1: Mở kệ súng lục (`groupWeapon1`), ẩn Rương 1. | Pháo hoa / bụi sao bùng nổ ăn mừng (`Reward_Back_Shine`, `glow1`). | `click1.mp3` |
| **Khách 1..4 Xếp Hàng** | Tối đa đúng **4 khách** lần lượt đi vào 4 vị trí hàng đợi đối diện quầy gỗ. | Khách đi bộ (`Move`) ➡️ đến nơi quay mặt về quầy (`(0,0,0)`) và đứng `Idle`. | Tiếng bước chân. |
| **Staff Phục Vụ (Quầy)** | Staff chạy tới đối diện khách, chạy anim `"Manufacture"` trong **2.0s**. | Thanh Loading UI nạp từ `0% -> 100%`. Khách hiện bóng suy nghĩ (`Chatbox.png` + Icon `2.png`). | `finish_order.mp3` |
| **Staff Lấy Súng (Kệ)** | Staff chạy sang Kệ Pistol, chạy anim `"Manufacture"` trong **2.0s**. | Thanh Loading UI nạp từ `0% -> 100%`. Staff nhận súng trên tay. | `finish_order.mp3` |
| **Giao Hàng & Biến Hình** | Staff trao súng cho khách:<br>1. Khách bùng nổ khói biến hình thành lính (`armyPart.active = true`).<br>2. 3 đồng xu bay lên Coin UI (+25 Coins). | - `Smoke Particle` (khói xám bung tròn).<br>- `CoinFlyFX` bay parabol lên góc phải. | `coin.mp3`, `Coin_Tip.mp3` |
| **Tấn Công Boss** | Lính chạy lên 1 trong 6 vị trí quanh Boss (`listCharPos[6..11]`), quay mặt về Boss và nã đạn liên tục (`Attack_2`). | - Tia lửa đầu nòng (`Muzzle Flash`).<br>- Tia đạn bay (`Bullet Tracers`) trúng Boss làm trừ thanh máu Boss. | `gun1.mp3`, tiếng trúng đạn. |
| **Sau Khi Xong 2 Khách** | Rương 2 (AK Box) từ trên trời rơi xuống quầy với bàn tay hướng dẫn người chơi mở. | Bàn tay hướng dẫn `TutorialHand` trỏ vào Rương 2. | Tiếng rơi rương, `click1.mp3`. |
| **Tap 2 (Mở Rương 2)** | Mở kệ súng AK (`groupWeapon2`). Staff bắt đầu phục vụ súng AK mạnh hơn (`Attack_3`). | Hiệu ứng pháo sáng mở rương. | `click1.mp3`. |
| **Sau Khi Xong 5 Khách** | Rương 3 (Mystery Box) rơi xuống quầy. | Bàn tay hướng dẫn chỉ vào Rương 3. | Tiếng rơi rương. |
| **Tap 3 (CTA Store)** | Nhấn vào Rương 3 hoặc Boss chết ➡️ Dẫn trực tiếp người chơi sang Store tải game (`PPSDK.openStore()`). | End card / CTA chuyển hướng Store. | Âm thanh chiến thắng. |

---

## 🎨 2. CHI TIẾT CÁC HIỆU ỨNG (VFX) CẦN NẠP VÀO SCENE

1. **`SmokeTransformFX_Pool` (Hiệu Ứng Khói Biến Hình):**
   - 4 Node khói ParticleSystem gắn sẵn tại 4 vị trí quầy nhận súng.
   - Texture: `assets/_unused/resources/asset/Par/Smoke/cloud_2x2_hard_softshadow.png`.
   - Khi giao súng, gọi `smoke.play()`, sinh khói cuộn tròn trong 0.6s che giấu khoảnh khắc swap từ thường phục sang quân phục lính.

2. **`BulletPool` & `HitEffect` (Hệ Thống Đạn & Tia Lửa Va Chạm):**
   - Pool 6 viên đạn (`2-1.001.fbx` hoặc quad sprite có glow) bay theo đường thẳng từ nòng súng vào Boss trong 0.25s.
   - Node `HitEffect` gắn tại ngực Boss sử dụng `explosion_spritesheet_3x3.png` và `glow1.png`, bùng sáng khi đạn chạm vào Boss.

3. **`CustomerThoughtBubble_Pool` (Bong Bóng Suy Nghĩ Trên Đầu Khách):**
   - 4 Node UI 2D Follower đặt trên đỉnh đầu 4 vị trí khách.
   - Gồm Sprite nền `Chatbox.png` và Icon vũ khí (Sprite `2.png` cho Pistol, Sprite `3.png` cho AK).
   - Pop-up bật mở với hiệu ứng scale spring (`0 -> 1.1 -> 1.0`).

4. **`BoxCelebrationFX` (Hiệu Ứng Ăn Mừng Mở Rương):**
   - Hiệu ứng sao tỏa và ánh hào quang (`Reward_Back_Shine.png` + `Upgrade.png`) kích hoạt khi bấm mở Rương 1 & Rương 2.

---

## 💡 3. ĐỀ XUẤT CÁC CẢI TIẾN CAO CẤP (BEYOND THE REFERENCE)

Sau khi hoàn thiện chính xác 100% theo bản gốc, áp dụng các điểm vượt trội để nâng tầm trải nghiệm:
1. **Đồng Xu 2.5D Xoay Lật Trục Y:** Nâng cấp từ đồng xu phẳng 2D thành hiệu ứng xoay lật 2.5D có bóng đổ và độ nảy khi tiếp đất vào nút Coin UI.
2. **Khung Badge Loading UI Hiện Đại:** Sử dụng viền 9-slice bo góc và vòng quay nạp đạn cyan/vàng ánh kim tạo cảm giác cao cấp hơn thanh màu cơ bản của bản cũ.
3. **Staggered Spawning Chống Giật Lag (60 FPS Khởi Động):** Khắc phục hoàn toàn hiện tượng tụt khung hình ở Frame 0 của bản gốc.
4. **Cinematic Camera Easing Mượt Mà:** Sử dụng đường cong `cubicOut` lướt êm ái thay vì giật cục.

---

## 🚀 4. KỊCH BẢN SCENE BAKER (`scripts/bake-scene-nodes.js`)

Script tự động phân tích file `assets/scene.scene` và tạo tĩnh:
- `SmokeFX_0..3`
- `ThoughtBubble_0..3`
- `BulletPool_0..5`
- `HitEffect`
- `BoxCelebrationFX`

Tất cả được gán sẵn ID và kết nối vào `GameManager` / `UnitController` mà không cần gọi `new Node()` hay `addComponent()` trong runtime!
