# 📥 TASK 21: Bổ Sung Skills & Tools Tự Động Hóa Cho Three.js

## 1. Yêu Cầu
- Lên ý tưởng và triển khai các Agent Skills chuyên sâu cho Three.js Web Game.
- Bổ sung các công cụ tự động (CLI tools, simulation engine, in-game devtools) hỗ trợ kiểm thử, balancing và QA cho project.

## 2. Tiêu Chí Đầu Ra
- Skill `.agents/skills/threejs-game-perf`: Hướng dẫn kiến trúc tối ưu 60 FPS, Zero-GC, shared skeleton, InstancedMesh.
- Skill `.agents/skills/threejs-stage-balancer`: Hướng dẫn cân bằng game 40 màn, công thức toán học HP/Dmg, TTK curve, chế độ Infinite vs Classic.
- Tool `tools/sim-balance.mjs`: Script Node.js mô phỏng tự động 40 màn trong 10ms, kiểm tra độ cân bằng và xuất bảng kết quả.
- Module runtime `src/core/DevTools.ts`: Giao diện QA & debug trong game, toggle bằng phím `~` hoặc `?debug=1`.
