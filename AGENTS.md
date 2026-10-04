# 🎮 Project Rules: Cocos Creator Playable Ads

## Core Constraints
1. **TypeScript Only**: All game code under `assets/Scripts/` must be written in TypeScript (`.ts`) conforming to Cocos Creator 3.8.x standards (`@ccclass`, `Component`).
2. **3-Layer Playable Tracking System**:
   - Route all gameplay interactions through `PlayableAdsFlowManager.instance.trackClick(isSuccess, cost)`.
   - Manage game lifecycle via `PlayableAdsSDK.instance.logEvent(PlayableEvent)`.
   - Route Store redirects through `PlayableAdsFlowManager.instance.stopAdsWhilePlaying()`.
3. **Task & Log Reporting**:
   - Maintain the `TASK/` folder outside `assets/`.
   - Separate subtask directories with `INPUT.md` and `OUTPUT.md`.
   - Centralize all error logs and resolutions in `TASK/TASK_ERROR.md`.
4. **Cocos MCP Automation**:
   - Use `cocos-mcp` tools (`query_nodes`, `modify_nodes`, `modify_components`, `operate_current_scene`) for scene inspection and modification.
