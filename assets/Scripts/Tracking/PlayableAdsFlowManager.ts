import { PlayableAdsSDK, PlayableEvent } from "./PlayableAdsSDK";

export class PlayableAdsFlowManager {
    private static _instance: PlayableAdsFlowManager;

    private _maxTaps: number = 10;
    private _currentTapCount: number = 0;
    private _remainingTaps: number = 10;
    private _levelIndex: number = 0;
    private _checkOnlySuccess: boolean = true;
    private _isEnded: boolean = false;

    public static get instance(): PlayableAdsFlowManager {
        if (!this._instance) this._instance = new PlayableAdsFlowManager();
        return this._instance;
    }

    public startLevel(levelIndex: number = 0, maxTaps: number = 10, checkOnlySuccess: boolean = true): void {
        this._levelIndex = levelIndex;
        this._maxTaps = maxTaps;
        this._remainingTaps = maxTaps;
        this._currentTapCount = 0;
        this._checkOnlySuccess = checkOnlySuccess;
        this._isEnded = false;

        console.log("[AdsTrackingEvent] Reset tap counter to 0.");
        PlayableAdsSDK.instance.logEvent(PlayableEvent.CHALLENGE_STARTED);
    }

    public trackClick(isSuccess: boolean, costRemaining: number = 1): void {
        if (this._isEnded) return;

        if (!isSuccess) {
            console.log(`[PlayableAdsFlowManager] Shooter Click Tracked: isSuccess=false | maxTaps=${this._maxTaps} | remainingTaps=${this._remainingTaps} | levelIndex=${this._levelIndex}`);
            if (this._checkOnlySuccess) {
                console.log("[AdsTrackingEvent] Tap failed and checkOnlySuccess is true -> Ignored.");
                return;
            }
        }

        this._currentTapCount++;
        this._remainingTaps = Math.max(0, this._remainingTaps - costRemaining);

        console.log(`[AdsTrackingEvent] OnClick handled: isSuccess=${isSuccess} | currentTapCount=${this._currentTapCount} | maxTaps=${this._maxTaps} | remainingTaps=${this._remainingTaps} | levelIndex=${this._levelIndex}`);
        console.log(`[PlayableAdsFlowManager] Shooter Click Tracked: isSuccess=${isSuccess} | maxTaps=${this._maxTaps} | remainingTaps=${this._remainingTaps} | levelIndex=${this._levelIndex}`);

        if (this._currentTapCount >= this._maxTaps || this._remainingTaps <= 0) {
            console.log(`[AdsTrackingEvent] Tap limit reached (currentTapCount=${this._currentTapCount} >= maxTaps=${this._maxTaps} or remainingTaps=${this._remainingTaps} <= 0) -> Calling stopAds().`);
            this.stopAdsWhilePlaying();
        }
    }

    public stopAdsWhilePlaying(): void {
        if (this._isEnded) return;
        this._isEnded = true;

        console.log("[AdsTrackingEvent] stopAdsWhilePlaying() invoked -> Emitting Store & EndAds");
        console.log("GoStoreWhenPlaying");

        PlayableAdsSDK.instance.openStore();
        this.endSessionGame(this._levelIndex + 1);
    }

    public endSessionGame(levelName: number): void {
        console.log("EndSessionGame");
        console.log(`[EndSessionGame] EndGame_Stop_LevelName=${levelName}`);
        PlayableAdsSDK.instance.logEvent(PlayableEvent.ENDCARD_SHOWN);
    }
}
