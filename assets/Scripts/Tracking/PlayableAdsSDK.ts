export enum PlayableEvent {
    LOADING = "LOADING",
    LOADED = "LOADED",
    DISPLAYED = "DISPLAYED",
    CHALLENGE_STARTED = "CHALLENGE_STARTED",
    ENDCARD_SHOWN = "ENDCARD_SHOWN"
}

export class PlayableAdsSDK {
    private static _instance: PlayableAdsSDK;
    private _startTime: number = 0;

    public static get instance(): PlayableAdsSDK {
        if (!this._instance) this._instance = new PlayableAdsSDK();
        return this._instance;
    }

    public init(): void {
        this._startTime = Date.now();
        this.logProfiler("GameBootstrap_Load");

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    const duration = ((Date.now() - this._startTime) / 1000).toFixed(2);
                    console.log("[PlayableAdsSDK] System EVENT_HIDE (User pressed Home/Switched Tab)");
                    console.log(`=== PROFILER SESSION ENDED | Duration: ${duration}s | Reason: TabHidden_StopPlay ===`);
                } else {
                    this._startTime = Date.now();
                    console.log("[PlayableAdsSDK] System EVENT_SHOW (User returned to App)");
                }
            });
        }
    }

    public logEvent(event: PlayableEvent, params?: any): void {
        console.log(`[PlayableAdsSDK] logEvent: ${event} ${params !== undefined ? params : "undefined"}`);
    }

    public logProfiler(reason: string): void {
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
        console.log(`=== PROFILER SESSION STARTED [${timeStr}] Reason: ${reason} ===`);
    }

    public gameReady(): void {
        console.log("[PlayableAdsSDK] gameReady called");
        if (typeof window !== "undefined") {
            if ((window as any).super_html && (window as any).super_html.game_ready) {
                (window as any).super_html.game_ready();
            }
            if (typeof (window as any).gameReady === "function") {
                (window as any).gameReady();
            }
        }
    }

    public openStore(): void {
        console.log("[PlayableAdsSDK] Trigger open store");
        if (typeof window !== "undefined") {
            if ((window as any).super_html && (window as any).super_html.download) {
                (window as any).super_html.download();
                return;
            }
            if (typeof (window as any).mraid !== "undefined" && (window as any).mraid.open) {
                (window as any).mraid.open();
                return;
            }
            if (typeof (window as any).ExitApi !== "undefined" && (window as any).ExitApi.exit) {
                (window as any).ExitApi.exit();
                return;
            }
            if (typeof (window as any).install === "function") {
                (window as any).install();
                return;
            }
            if ((window as any).playableSDK && (window as any).playableSDK.openAppStore) {
                (window as any).playableSDK.openAppStore();
                return;
            }
        }
    }
}
