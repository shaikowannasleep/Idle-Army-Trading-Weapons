mergeInto(LibraryManager.library, {
    JS_LogSDKEvent: function (eventNamePtr) {
        var eventName = UTF8ToString(eventNamePtr);
        console.log("[PlayableAdsSDK] logEvent: " + eventName);

        if (eventName === "DISPLAYED" || eventName === "LOADED") {
            if (typeof mraid !== "undefined" && mraid.isViewable()) {
                console.log("[PlayableAdsSDK] mraid ready");
            }
        }
    },

    JS_GoToStore: function () {
        console.log("[PlayableAdsBridge] GoStore Triggered");

        // 1. Chuan MRAID (AppLovin, Unity Ads, IronSource)
        if (typeof mraid !== "undefined") {
            mraid.open();
            return;
        }
        // 2. Chuan Google (ExitApi)
        if (typeof ExitApi !== "undefined") {
            ExitApi.exit();
            return;
        }
        // 3. Chuan Mintegral
        if (typeof window.install !== "undefined") {
            window.install();
            return;
        }
        // 4. Chuan TikTok
        if (typeof window.playableSDK !== "undefined" && window.playableSDK.openAppStore) {
            window.playableSDK.openAppStore();
            return;
        }

        console.log("[PlayableAdsBridge] Fallback: Direct click/store link");
    }
});
