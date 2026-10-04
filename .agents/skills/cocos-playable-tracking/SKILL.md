---
name: cocos-playable-tracking
description: >-
  Design, implement, debug, and integrate 3-layer Playable Ads tracking systems for Cocos Creator HTML5/WebGL playable ads. Activate this skill when adding click tracking, managing tap counters, setting up lifecycle events, configuring store CTA triggers, or handling tab visibility profiling.
---

# Cocos Playable Tracking Skill

## 1. Overview
This skill provides standard patterns and best practices for developing Playable Ads tracking in Cocos Creator 3.8.x.

## 2. 3-Layer Architecture
```text
[ Gameplay UI / Input Events ]
             │ (Touch/Click: isSuccess, cost)
             ▼
[ PlayableAdsFlowManager ]  ──> Tap Limits, cost deduction, CTA condition trigger
             │
             ▼
[ PlayableAdsSDK / Bridge ] ──> Lifecycle: LOADED, DISPLAYED, VISIBILITY CHANGE
             │
             ▼
[ Ad Network / MRAID ]     ──> Dispatcher: super_html.download(), mraid.open(), ExitApi.exit()
```

## 3. Integration Patterns

### A. Lifecycle Hooking in Controller
```typescript
import { PlayableAdsSDK, PlayableEvent } from './Tracking/PlayableAdsSDK';
import { PlayableAdsFlowManager } from './Tracking/PlayableAdsFlowManager';

onLoad() {
    PlayableAdsSDK.instance.init();
    PlayableAdsSDK.instance.logEvent(PlayableEvent.LOADING);
    PlayableAdsSDK.instance.logEvent(PlayableEvent.LOADED);
}

start() {
    PlayableAdsSDK.instance.logEvent(PlayableEvent.DISPLAYED);
    PlayableAdsSDK.instance.gameReady();
    PlayableAdsFlowManager.instance.startLevel(0, 10, true);
}
```

### B. Tracking Gameplay Input
```typescript
// On successful action:
PlayableAdsFlowManager.instance.trackClick(true, 1);

// On failed action or tapping empty space:
PlayableAdsFlowManager.instance.trackClick(false, 0);

// On manual Store button click or game completion:
PlayableAdsFlowManager.instance.stopAdsWhilePlaying();
```

## 4. Multi-Channel Store Support
The SDK automatically checks available global objects:
- `super_html.download()` (super-html single file build)
- `mraid.open()` (AppLovin, Unity Ads, IronSource)
- `ExitApi.exit()` (Google Ads)
- `window.install()` (Mintegral)
- `playableSDK.openAppStore()` (TikTok)
