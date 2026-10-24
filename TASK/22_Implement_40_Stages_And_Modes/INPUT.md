# 📥 TASK 22: Triển Khai Logic 40 Màn Chơi & 2 Chế Độ Chơi (Mini Gameplay)

## 1. Yêu Cầu
- Triển khai toàn bộ logic thực tế theo thiết kế tại TASK 20 và công thức cân bằng tại TASK 21 vào `idle-threejs/`:
  1. **Game Mode Selection**: Modal chọn chế độ khi mới vào (Infinite God Mode vs Classic Progression).
  2. **SaveManager**: Lưu và tải trạng thái vào `localStorage` (Stage, Coin, Gem, Weapons, Mode).
  3. **StageManager / 40 Stages**:
     - Cấu hình 40 màn chơi với HP, Damage, Attack Speed của Boss.
     - 4 Chương / Tiers tương ứng.
     - Victory loop: Diệt Boss $\to$ Banner Victory $\to$ Nút "Next Stage" $\to$ Giữ nguyên lính, hồi 50% máu tường.
     - Defeat loop: Tường vỡ $\to$ Nút "Retry Stage".
     - Gỡ bỏ kịch bản ép thua cố định 90s.
  4. **HUD & UI**:
     - Hiển thị `STAGE X / 40` trên HUD.
     - Victory & Defeat dialogs.
  5. **DevTools Enhancements**:
     - Thêm nút Next Stage / Prev Stage / Jump to Stage 40 trong DevTools.
  6. **Build & Test Verification**:
     - `npm run build` và `npm run build:single` đạt 100%.
