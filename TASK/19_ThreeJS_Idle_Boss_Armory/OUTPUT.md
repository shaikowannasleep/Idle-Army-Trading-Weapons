# 📤 TASK 19: KẾT QUẢ — `idle-threejs/` (Vite + TypeScript + Three.js r186)

## 1. Vị trí & cách chạy
- Thư mục mới **`idle-threejs/`** (ngoài `assets/` → Cocos không import, không vi phạm rule TS-only của `assets/Scripts`).
- `npm run dev` (chơi thử) · `npm run build` → `dist/` · `npm run build:single` → `dist-single/index.html` (**4.86 MB**, 1 file cho mạng quảng cáo).
- `npm run assets` tái tạo asset tối ưu từ `raw/` (raw sinh bởi `tools/convert_fbx.py` qua Blender headless).

## 2. Pipeline asset
- `tools/convert_fbx.py` (Blender 5.2): import FBX → **relink texture** (FBX trỏ ổ `D:/...` không tồn tại) → export GLB kèm toàn bộ animation, bỏ clip A-pose.
- `tools/build-assets.mjs` (gltf-transform): prune/dedup/weld/resample, **meshopt** (không lượng tử hóa vị trí — xem TASK_ERROR #6), texture **WebP lossless**; skin lính/dân thường → WebP.
- Khám phá: skin dân thường & lính **chung UV** → "biến hình" = đổi material + hiện súng.

## 3. Gameplay (src/game)
| Hệ thống | Mô tả |
|---|---|
| Bán vũ khí | Joystick nổi (kéo bất kỳ đâu, WASD trên desktop). Đứng vào vòng sáng sau quầy → vòng tiến độ 0.8s → súng bay từ thùng tới khách → khói + đổi skin lính → xu bay về HUD. |
| Lính | 18 vị trí bắn sau tường bao cát, bắn tracer + muzzle flash + tia lửa; rocket có quỹ đạo + nổ. |
| Vũ khí | Súng lục, M4 (model gốc) + **Shotgun, Minigun, Rocket Launcher** (procedural, skin vào xương tay `WP.R`). Lính vũ khí nặng to hơn. |
| Boss | 12 animation gốc; lao tới đánh tường, giết lính, sóng xung kích; tiến hóa: to hơn, đỏ dần, phát sáng, đổi tên (Void Scorpion → World Eater → Apex). |
| Loot | Xu/gem (InstancedMesh) + rương trang bị (buff sát thương / tốc bắn / sửa tường). Nhặt bằng nam châm, **tự bay vào túi sau 10s** (nhấp nháy 3s cuối). |
| Nâng cấp | Ô trả tiền trên mặt đất: mở khóa/lv vũ khí trong kho, **Expand** (quầy 2 + trợ lý tự bán), **Fortify** (sửa tường). **Mỗi lần mua → boss tiến hóa**. |
| Kịch bản | Intro dolly 2.8s → tiến hóa theo thời gian (22/40/56/70s) → cảnh báo 60s → **Final Evolution 78s** (giá ×4, đánh 1.35s/lần) → tường sập ~88s → slow-mo → **DEFEAT** endcard (~1:30). |
| Endcard | CONTINUE → `stopAdsWhilePlaying()` → mở `https://github.com/shaikowanansleep`; RETRY → reset toàn bộ, chơi lại từ intro. |

## 4. Tracking 3 lớp (src/tracking — port từ Cocos)
- `trackClick(isDrag, cost)` cho mọi thao tác chạm; `logEvent` LOADING → LOADED → DISPLAYED → CHALLENGE_STARTED → ENDCARD_SHOWN; `openStore(url)` ưu tiên `super_html`/`mraid`/`ExitApi`/`install`/`playableSDK`, fallback `window.open(GitHub)`.

## 5. Hiệu năng (đo bằng `tools/perf.mjs`, Chrome 154, M1 Pro, viewport 414×800 @2x, cả ván ~100s)
| Chỉ số | Kết quả | Mục tiêu |
|---|---|---|
| FPS | khóa **60** (frameMs max 16.67), không tụt suốt ván | ≥ 60 |
| RAM tab (physical footprint, như Activity Monitor) | **~131 MB** (single-file ~153 MB) | 100–160 MB |
| JS heap | 12–24 MB | — |
| CPU main thread | ~16% (JS game ≈ 9%: render 6% + logic 3.5%) | ~10% |
| CPU process renderer / GPU | ~23% / ~17% — trang WebGL **trống** cùng kích thước đã tốn ~6–9% / ~10–14% | — |
- Kỹ thuật: cap 60fps (màn 120Hz vẽ cách frame), DPR thích ứng, dừng hẳn khi ẩn tab, shadow 1024 cập nhật 30Hz, chỉ boss/props đổ bóng (nhân vật dùng blob shadow instanced), **dùng chung skeleton** mỗi nhân vật, animation 30Hz xen kẽ cho unit đứng yên + chỉ tính ma trận khi pose/vị trí đổi, particle/tracer/xu/gem instanced (0 cấp phát mỗi frame), HUD DOM chỉ ghi khi giá trị đổi + animate bằng transform/opacity, giải phóng ImageBitmap sau upload, audio 24kHz, MSAA chỉ bật trên màn < 2x.
- Tham số chất lượng: `?dpr=1`, `?shadows=0`, `?aa=0|1`, `?audio=0`.

## 6. Công cụ kiểm thử (idle-threejs/tools)
- `perf.mjs` (chơi tự động cả ván, đo CPU/RAM/FPS, `PROFILE=1`), `baseline.mjs` (chi phí sàn trình duyệt), `memdump.mjs` (bộ nhớ theo allocator), `trace.mjs`, `endflow.mjs` (kiểm tra Retry/Continue).
