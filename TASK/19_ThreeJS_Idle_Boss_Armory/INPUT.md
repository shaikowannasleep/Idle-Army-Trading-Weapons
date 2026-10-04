# 📥 TASK 19: MINI GAME IDLE "BOSS ARMORY" (THREE.JS) TỪ ASSET HIỆN CÓ

## 🎯 Yêu cầu
- Dùng các asset trong game hiện tại (**trừ code**) dựng thành 1 mini game Idle bằng **Three.js**.
- Core loop: bán vũ khí cho khách → khách trang bị, thành lính, đi đánh boss → boss chết rơi **xu / gem / trang bị** → người chơi nhặt, hoặc vật phẩm **tự bay vào túi sau 10s**.
- Dùng tiền **nâng cấp vũ khí trong kho**, **mở rộng vùng chơi**; mỗi lần nâng cấp **boss cũng tiến hóa**.
- Kịch bản ~**1p30s**: boss quá mạnh, người chơi không đủ xu → **thua** → endcard với CTA **Continue** (mở GitHub `shaikowanansleep`) và **Retry** (chơi lại từ đầu).
- Tự bổ sung VFX, rung màn hình, thêm model vũ khí & quân binh nếu chưa đa dạng.
- Chất lượng hình ảnh cực nét (AAA), không làm nóng máy: **~10% CPU, RAM 100–160MB, ≥60fps**.

## 📦 Đầu vào (asset gốc trong `assets/`)
- Model FBX: `Monster 1` (boss, 12 clip), `Staff` (nhân viên, 13 clip), `Customer 1` (khách + dao/súng lục/M4, 8 clip), map `2-1.001`, thùng `Machine_2/4`, `MachineSlot_2`, hộp `Hop mo khoa`, `Coin`.
- Texture: palette `base.png`, `TT_citizens_B.tga`, `base1.png` (citizens A), `TT_Soldiers_texture_A.tga`, `Main_Face_512`, `map21`, `Texture_Map 1-2`.
- Âm thanh: `bgM`, `gun1`, `coin`, `Coin_Tip`, `sound-receive-coin`, `death`, `click1`, `finish_order`.
- UI: `Coin.png`, `hand1.png`, `Reward_Back_Shine.png`, `logo.png`, icon `2.png`/`3.png`, `Upgrade.png`, `smoke`.
- Ràng buộc project: TypeScript, tracking 3 lớp (`trackClick` / `logEvent` / `stopAdsWhilePlaying`).
