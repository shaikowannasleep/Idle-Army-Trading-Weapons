---
name: cocos-scene-mcp
description: >-
  Inspect, manipulate, and automate Cocos Creator 3.8.x scene (.scene) and node hierarchies using the built-in cocos-mcp server extension. Activate this skill when creating nodes, modifying components, changing transforms, or saving scenes without manual editor intervention.
---

# Cocos Scene MCP Skill

## 1. Overview
The `cocos-mcp` extension runs a Streamable HTTP MCP Server at `http://localhost:3000/mcp` directly inside Cocos Creator Editor.

## 2. Core Workflow: Discover, Then Act

```text
1. Inspect Node Tree    →  query_nodes / nodeGetTree
2. Discover Properties  →  query_components / inspectorGetInstanceDefinition
3. Update Properties    →  modify_nodes / modify_components
4. Save Scene           →  operate_current_scene (action: "save")
```

## 3. Available MCP Tools
- **`query_nodes`**: Inspect scene hierarchy and retrieve node UUIDs.
- **`create_nodes`**: Add new nodes (Sprite, Label, Button, Node) with transforms and initial components.
- **`modify_nodes`**: Update position, scale, rotation, active state, or parent-child hierarchy.
- **`modify_components`**: Modify component fields (e.g. string values, colors, numbers).
- **`operate_current_scene`**: Perform scene lifecycle actions (e.g. `save`).
- **`execute_scene_code`**: Execute arbitrary TypeScript/JavaScript snippets directly inside the Cocos Creator Scene environment.

## 4. MCP Server Configuration
In Antigravity IDE `mcp_config.json`:
```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```
