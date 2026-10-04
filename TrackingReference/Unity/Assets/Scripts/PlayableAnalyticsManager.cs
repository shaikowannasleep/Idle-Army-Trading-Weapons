using System.Runtime.InteropServices;
using UnityEngine;

public enum PlayableEvent
{
    LOADING,
    LOADED,
    DISPLAYED,
    CHALLENGE_STARTED,
    ENDCARD_SHOWN
}

public class PlayableAnalyticsManager : MonoBehaviour
{
    public static PlayableAnalyticsManager Instance { get; private set; }

    [Header("Tracking Settings")]
    [SerializeField] private int maxTaps = 10;
    [SerializeField] private bool checkOnlySuccess = true;

    private int currentTapCount = 0;
    private int remainingTaps;
    private int levelIndex = 0;
    private bool isEnded = false;
    private float sessionStartTime;

    #if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] private static extern void JS_LogSDKEvent(string eventName);
    [DllImport("__Internal")] private static extern void JS_GoToStore();
    #else
    private static void JS_LogSDKEvent(string eventName) => Debug.Log($"[Mock JS_LogSDKEvent] {eventName}");
    private static void JS_GoToStore() => Debug.Log("[Mock JS_GoToStore] Open URL");
    #endif

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    private void Start()
    {
        remainingTaps = maxTaps;
        currentTapCount = 0;
        sessionStartTime = Time.realtimeSinceStartup;

        SendSDKEvent(PlayableEvent.LOADING.ToString());
        SendSDKEvent(PlayableEvent.LOADED.ToString());
        SendSDKEvent(PlayableEvent.DISPLAYED.ToString());
        SendSDKEvent(PlayableEvent.CHALLENGE_STARTED.ToString());
    }

    public void TrackInteraction(bool isSuccess, int cost = 1)
    {
        if (isEnded) return;

        if (!isSuccess)
        {
            Debug.Log($"[PlayableAdsFlowManager] Click Tracked: isSuccess=false | maxTaps={maxTaps} | remainingTaps={remainingTaps} | levelIndex={levelIndex}");
            if (checkOnlySuccess)
            {
                Debug.Log("[AdsTrackingEvent] Tap failed and checkOnlySuccess is true -> Ignored.");
                return;
            }
        }

        currentTapCount++;
        remainingTaps = Mathf.Max(0, remainingTaps - cost);

        Debug.Log($"[AdsTrackingEvent] OnClick handled: isSuccess={isSuccess} | currentTapCount={currentTapCount} | maxTaps={maxTaps} | remainingTaps={remainingTaps} | levelIndex={levelIndex}");
        Debug.Log($"[PlayableAdsFlowManager] Shooter Click Tracked: isSuccess={isSuccess} | maxTaps={maxTaps} | remainingTaps={remainingTaps} | levelIndex={levelIndex}");

        if (currentTapCount >= maxTaps || remainingTaps <= 0)
        {
            Debug.Log($"[AdsTrackingEvent] Tap limit reached ({currentTapCount}>={maxTaps} or {remainingTaps}<=0) -> Calling stopAds().");
            TriggerStoreAndEnd(levelIndex + 1);
        }
    }

    public void TriggerStoreAndEnd(int completedLevel)
    {
        if (isEnded) return;
        isEnded = true;

        Debug.Log("[AdsTrackingEvent] stopAdsWhilePlaying() invoked -> Emitting Store & EndAds");
        Debug.Log("GoStoreWhenPlaying");
        
        JS_GoToStore();

        Debug.Log("EndSessionGame");
        Debug.Log($"[EndSessionGame] EndGame_Stop_LevelName={completedLevel}");
        SendSDKEvent(PlayableEvent.ENDCARD_SHOWN.ToString());
    }

    public void SendSDKEvent(string eventName)
    {
        Debug.Log($"[PlayableAdsSDK] logEvent: {eventName} undefined");
        JS_LogSDKEvent(eventName);
    }

    private void OnApplicationFocus(bool hasFocus)
    {
        if (hasFocus)
        {
            Debug.Log("[PlayableAdsSDK] System EVENT_SHOW (User returned to App)");
        }
        else
        {
            float duration = Time.realtimeSinceStartup - sessionStartTime;
            Debug.Log("[PlayableAdsSDK] System EVENT_HIDE (User pressed Home/Switched Tab)");
            Debug.Log($"=== PROFILER SESSION ENDED | Duration: {duration:F2}s | Reason: TabHidden_StopPlay ===");
        }
    }
}
