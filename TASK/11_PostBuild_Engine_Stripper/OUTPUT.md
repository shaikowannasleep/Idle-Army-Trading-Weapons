# 📤 OUTPUT: Post-Build Engine Stripper (Parallel Optimization)

## 📁 File Cập Nhật
- `scripts/fast-super-html.js`: Tích hợp module tự động quét và purge các ASM/WASM nặng không dùng.

## 📊 Kết Quả Tối Ưu Thực Tế (Không cần UI Cocos Editor)

| Định dạng Playable Ad | Dung Lượng Cũ (Trước Stripper) | Dung Lượng Mới (Sau Stripper) | Dung lượng giảm được |
| :--- | :--- | :--- | :--- |
| **AppLovin (Single HTML)** | `6,511 KB` (~6.7 MB) | **`5,946 KB` (~5.9 MB)** | 🔻 **Giảm ~600 KB HTML** |
| **Unity Ads (Single HTML)** | `6,511 KB` | **`5,947 KB`** | 🔻 **Giảm ~600 KB HTML** |
| **Facebook (Single HTML)** | `6,511 KB` | **`5,946 KB`** | 🔻 **Giảm ~600 KB HTML** |
| **Google Ads (Single Zip)** | `4,817 KB` | **`4,389 KB`** | 🔻 **Giảm ~430 KB Zip** |
| **TikTok Ads (Single Zip)** | `4,743 KB` | **`4,320 KB`** | 🔻 **Giảm ~423 KB Zip** |
| **Mintegral / Pangle / Liftoff** | `4,743 KB` | **`4,320 KB`** | 🔻 **Giảm ~423 KB Zip** |
