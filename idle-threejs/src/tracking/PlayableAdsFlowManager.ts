// Port of assets/Scripts/Tracking/PlayableAdsFlowManager.ts (Cocos) for the standalone Three.js build.
import { PlayableAdsSDK, PlayableEvent } from './PlayableAdsSDK';

export class PlayableAdsFlowManager {
  private static _instance: PlayableAdsFlowManager;

  private _maxTaps = 10;
  private _currentTapCount = 0;
  private _remainingTaps = 10;
  private _levelIndex = 0;
  private _checkOnlySuccess = true;
  private _isEnded = false;

  public static get instance(): PlayableAdsFlowManager {
    if (!this._instance) this._instance = new PlayableAdsFlowManager();
    return this._instance;
  }

  public get isEnded(): boolean {
    return this._isEnded;
  }

  public startLevel(levelIndex = 0, maxTaps = 10, checkOnlySuccess = true): void {
    this._levelIndex = levelIndex;
    this._maxTaps = maxTaps;
    this._remainingTaps = maxTaps;
    this._currentTapCount = 0;
    this._checkOnlySuccess = checkOnlySuccess;
    this._isEnded = false;
    console.log('[AdsTrackingEvent] Reset tap counter to 0.');
    PlayableAdsSDK.instance.logEvent(PlayableEvent.CHALLENGE_STARTED);
  }

  public trackClick(isSuccess: boolean, costRemaining = 1): void {
    if (this._isEnded) return;
    if (!isSuccess && this._checkOnlySuccess) return;

    this._currentTapCount++;
    this._remainingTaps = Math.max(0, this._remainingTaps - costRemaining);
    console.log(`[AdsTrackingEvent] OnClick handled: isSuccess=${isSuccess} | currentTapCount=${this._currentTapCount} | maxTaps=${this._maxTaps} | remainingTaps=${this._remainingTaps} | levelIndex=${this._levelIndex}`);

    if (this._currentTapCount >= this._maxTaps || this._remainingTaps <= 0) {
      console.log('[AdsTrackingEvent] Tap limit reached -> Calling stopAds().');
      this.stopAdsWhilePlaying();
    }
  }

  public stopAdsWhilePlaying(): void {
    if (this._isEnded) return;
    this._isEnded = true;
    console.log('[AdsTrackingEvent] stopAdsWhilePlaying() invoked -> Emitting Store & EndAds');
    PlayableAdsSDK.instance.openStore();
    this.endSessionGame(this._levelIndex + 1);
  }

  public endSessionGame(levelName: number): void {
    console.log(`[EndSessionGame] EndGame_Stop_LevelName=${levelName}`);
    PlayableAdsSDK.instance.logEvent(PlayableEvent.ENDCARD_SHOWN);
  }
}
