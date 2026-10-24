# 📥 TASK 20: Phân Tích Hiện Trạng & Thiết Kế Mở Rộng 40 Màn Chơi (Mini Gameplay)

## 1. Yêu Cầu Người Dùng
- Phân tích toàn diện hiện trạng dự án (Cocos Playable + Three.js Idle Boss Armory).
- Vẽ các biểu đồ Sequence Diagram, Use Case Diagram làm rõ các trường dữ liệu (fields) và API.
- Lên kế hoạch chi tiết mở rộng thành Mini Gameplay khoảng 40 màn chơi (Campaign System).
- Hỗ trợ 2 chế độ chơi ngay khi mới vào:
  1. **Mode Vô hạn tiền (God/Infinite Money Mode)**
  2. **Mode Cày từ đầu (Standard Grinding Progression)**

## 2. Tiêu Chí Đầu Ra
- Bản phân tích cấu trúc mã nguồn, lifecycle, hệ thống kinh tế, logic combat hiện tại.
- Diagram Use Case & 4 Sequence Diagrams Mermaid chi tiết về:
  + Phục vụ khách & biến hình lính
  + Combat Boss, đòn đánh tường & cơ chế Loot/Buff
  + Nâng cấp trên Pad & phản ứng tiến hóa Boss
  + 3-Layer Playable Tracking & Store CTA
- Thiết kế hệ thống 40 Màn (Level Design Formula, Boss HP/Damage curve, Wave pacing, Win/Loss conditions).
- Hệ thống Save Manager, Game Mode Selection UI, Data Models (`LevelConfig`, `SaveData`).
- Kế hoạch triển khai từng bước (Phase roadmap).
