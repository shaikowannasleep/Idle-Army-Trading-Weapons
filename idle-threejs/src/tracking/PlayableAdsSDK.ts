// Port of assets/Scripts/Tracking/PlayableAdsSDK.ts (Cocos) for the standalone Three.js build.
export enum PlayableEvent {
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  DISPLAYED = 'DISPLAYED',
  CHALLENGE_STARTED = 'CHALLENGE_STARTED',
  ENDCARD_SHOWN = 'ENDCARD_SHOWN',
}

export const STORE_URL = 'https://github.com/shaikowanansleep';

type AnyWindow = Window & Record<string, any>;

export class PlayableAdsSDK {
  private static _instance: PlayableAdsSDK;
  private _startTime = 0;

  public static get instance(): PlayableAdsSDK {
    if (!this._instance) this._instance = new PlayableAdsSDK();
    return this._instance;
  }

  public init(onVisibility?: (hidden: boolean) => void): void {
    this._startTime = Date.now();
    this.logProfiler('GameBootstrap_Load');
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const duration = ((Date.now() - this._startTime) / 1000).toFixed(2);
        console.log('[PlayableAdsSDK] System EVENT_HIDE (User pressed Home/Switched Tab)');
        console.log(`=== PROFILER SESSION ENDED | Duration: ${duration}s | Reason: TabHidden_StopPlay ===`);
      } else {
        this._startTime = Date.now();
        console.log('[PlayableAdsSDK] System EVENT_SHOW (User returned to App)');
      }
      onVisibility?.(document.hidden);
    });
  }

  public logEvent(event: PlayableEvent, params?: unknown): void {
    console.log(`[PlayableAdsSDK] logEvent: ${event} ${params !== undefined ? params : 'undefined'}`);
  }

  public logProfiler(reason: string): void {
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    console.log(`=== PROFILER SESSION STARTED [${timeStr}] Reason: ${reason} ===`);
  }

  public gameReady(): void {
    console.log('[PlayableAdsSDK] gameReady called');
    const w = window as AnyWindow;
    if (w.super_html && w.super_html.game_ready) w.super_html.game_ready();
    if (typeof w.gameReady === 'function') w.gameReady();
  }

  /** Ad-network redirect first; plain web falls back to opening the URL in a new tab. */
  public openStore(url: string = STORE_URL): void {
    console.log('[PlayableAdsSDK] Trigger open store');
    const w = window as AnyWindow;
    if (w.super_html && w.super_html.download) return void w.super_html.download();
    if (typeof w.mraid !== 'undefined' && w.mraid.open) return void w.mraid.open(url);
    if (typeof w.ExitApi !== 'undefined' && w.ExitApi.exit) return void w.ExitApi.exit();
    if (typeof w.install === 'function') return void w.install();
    if (w.playableSDK && w.playableSDK.openAppStore) return void w.playableSDK.openAppStore();
    const win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url;
  }
}
