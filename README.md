# Idle Army: Trading Weapons 🛡️

[![Engine](https://img.shields.io/badge/Engines-Cocos%20Creator%203.8%20%7C%20Three.js%20r186-blue?style=flat-square)](https://github.com/shaikowannasleep)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Playable Ad](https://img.shields.io/badge/Format-Playable%20Ad%20%26%20Mini%20Game-orange?style=flat-square)](https://github.com/shaikowannasleep)

> 🎮 **Three.js Standalone Demo**: [https://shaikowannasleep.github.io/](https://github.com/shaikowannasleep)

Repository chứa toàn bộ mã nguồn và pipeline tối ưu hóa của dự án **Idle Army: Trading Weapons** — trò chơi phòng thủ kết hợp kinh tế bán vũ khí (Idle Armory & Base Defense). Dự án được triển khai song song trên hai nền tảng:
1. **Cocos Creator 3.8.x (`assets/`)**: Bản thiết kế gốc phục vụ chỉnh sửa trực quan và build xuất bản đa kênh.
2. **Three.js r186 Standalone (`idle-threejs/`)**: Bản dựng độc lập siêu nhẹ (**~4.88 MB** single-file HTML), 60 FPS mượt mà cho Playable Ads và Web Game với chiến dịch **40 Màn Chơi** hoàn chỉnh.

---

## 🚀 Quick Start

### 1. Standalone Three.js Version (Khuyên dùng cho Web / Ad Networks)
Thư mục: `idle-threejs/`
```bash
cd idle-threejs
npm install
npm run dev            # Chơi ngay tại http://localhost:5173
npm run build          # Xuất bản bản web nhiều file (dist/)
npm run build:single   # Xuất bản 1 file HTML duy nhất ~4.88 MB (dist-single/index.html)
```

### 2. Cocos Creator 3.8.x Version
- Mở thư mục gốc `Test00` bằng **Cocos Creator 3.8.x**.
- Scene chính: `assets/Scene/GameScene.scene`.
- Build Web Mobile hoặc SuperHTML bằng Cocos Build Panel.

---

## 🎮 Gameplay & Tính Năng

- **Core Loop**:
  1. Người chơi đứng sau quầy phục vụ khách hàng mua súng (0.8s/lượt).
  2. Khách nhận vũ khí sẽ lập tức chuyển thành **quân lính**, di chuyển ra hàng rào cát phòng thủ (tối đa 18 vị trí).
  3. Lính xả đạn tiêu diệt Boss đang liên tục tấn công tường thành.
  4. Boss chết rơi tiền vàng, kim cương và rương buff vĩnh viễn (sát thương +25%, tốc bắn +20%, hồi máu tường +30%).
- **Hệ Thống 40 Màn Chơi (40-Stage Campaign)**:
  - 4 Chương chiến dịch: *Desert Outpost*, *Magma Canyon*, *Toxic Abyss*, *Apex Void*.
  - Giữ nguyên toàn bộ binh lính đã chiêu mộ khi vượt màn; tường thành tự động hồi phục 50% máu.
- **2 Chế Độ Chơi Độc Lập**:
  - 👑 **Vô Hạn Tiền (God Mode)**: 99M Coin, 9K Gem, mở full 5 vũ khí tối đa để trải nghiệm càn quét hoặc QA.
  - ⚔️ **Cày Cuốc (Classic Grinding)**: Khởi đầu từ 0 Coin, súng lục cơ bản, nâng cấp từng nấc chiến thuật.
- **5 Loại Vũ Khí Đa Dạng**: Pistol, Assault Rifle, Shotgun, Minigun, Rocket Launcher.
- **Lưu Tiến Trình (Persistence)**: Tự động lưu màn chơi, số tiền, cấp súng vào `localStorage` qua `SaveManager`.
- **In-Game DevTools**: Bấm phím **`~`** hoặc thêm `?debug=1` để bật bảng debug (FPS, Draw Calls, Tris, nhảy màn, bơm tiền).

---

## 📊 So Sánh Kiến Trúc Hai Bản Dựng

| Tiêu Chí | Cocos Creator 3.8.x | Three.js Standalone (`idle-threejs/`) |
|---|---|---|
| **Dung lượng build** | ~7–12 MB (sau khi strip engine) | **4.88 MB** (Single-file HTML trọn gói) |
| **FPS trên Mobile yếu** | 45–60 FPS | **Khóa cứng 60 FPS** |
| **RAM tab trình duyệt** | ~180–240 MB | **~131 MB** |
| **CPU Main Thread** | ~22–28% | **~9–16%** |
| **Garbage Collection** | Định kỳ quét rác engine | **Zero-GC** (Không cấp phát trong tick) |
| **Khả năng tương thích Ad** | Cần tool đóng gói SuperHTML | Tích hợp sẵn `vite-plugin-singlefile` |

---

## 🛠️ Cấu Trúc Dự Án (Repository Layout)

```text
Test00/
├── assets/                  # Tài nguyên & mã nguồn Cocos Creator 3.8.x
│   ├── Scripts/             # TypeScript components (Player, Boss, Unit, Tracking)
│   ├── Scene/               # Các scene game Cocos (.scene)
│   └── FBX_Raw/             # Model 3D gốc (FBX), Textures, Audio
├── idle-threejs/            # Bản dựng Three.js độc lập siêu tối ưu (Vite + TS)
│   ├── src/                 # Engine, Game director, 40-Stage Manager, VFX, UI
│   ├── tools/               # Tool chuyển đổi asset Blender, cân bằng game, perf test
│   └── package.json
├── .agents/                 # Hệ thống Agent Skills & Customizations
│   └── skills/
│       ├── threejs-game-perf/       # Skill tối ưu hiệu năng Three.js 60 FPS
│       ├── threejs-stage-balancer/  # Skill thiết kế & cân bằng 40 màn chơi
│       ├── cocos-playable-tracking/ # Skill tracking 3 lớp cho Playable Ads
│       └── cocos-scene-mcp/         # Skill thao tác node hierarchy qua MCP
├── TASK/                    # Quản lý task và nhật ký cải tiến dự án
└── AGENTS.md                # Quy định bắt buộc cho AI Pair Programming
```

---

## 🎯 Chuẩn 3-Layer Playable Tracking
Cả hai bản dựng đều tuân thủ chặt chẽ mô hình tracking 3 lớp chuẩn MMP / Ad Networks:
1. **Tầng UI / Input**: Bắt mọi thao tác chạm/kéo $\to$ Gọi `trackClick(isSuccess, cost)`.
2. **Tầng Điều Phối (`PlayableAdsFlowManager`)**: Đếm số tap, giới hạn tương tác, kích hoạt Store khi đạt ngưỡng.
3. **Tầng SDK (`PlayableAdsSDK`)**: Phát các sự kiện vòng đời (`LOADING`, `LOADED`, `DISPLAYED`, `ENDCARD_SHOWN`) và gọi Store API (`mraid`, `ExitApi`, `super_html`).
