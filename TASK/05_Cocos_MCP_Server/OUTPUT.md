# 📤 OUTPUT: Cocos Creator MCP Server Integration

## 📁 Thư Mục Extension
- **Đường dẫn:** `extensions/cocos-mcp/`
- **Thư mục build:** `extensions/cocos-mcp/dist/` (Bao gồm `main.js`, `mcp/`, `panels/`, `scene/`)

## ⚙️ Trạng Thái & Danh Sách Tools Sẵn Sàng
Extension đã được build thành công, cung cấp 16 công cụ MCP:
1. `query_nodes` - Đọc cây node hierarchy.
2. `query_components` - Đọc thuộc tính và kiểu component.
3. `create_nodes` - Tạo node mới cùng transforms và components.
4. `modify_nodes` - Đổi vị trí, kích thước, góc quay, cấu trúc cây.
5. `modify_components` - Cấu hình giá trị thuộc tính component.
6. `operate_current_scene` - Lưu scene (`save-scene`), mở scene.
7. `execute_scene_code` - Chạy trực tiếp mã TypeScript trong Scene context.
8. `operate_prefab_assets`, `node_linked_prefabs_operations`, `operate_project_settings`...

## 🔌 Endpoint Kết Nối
- **URL:** `http://localhost:3000/mcp`
- **Transport:** Streamable HTTP / SSE
