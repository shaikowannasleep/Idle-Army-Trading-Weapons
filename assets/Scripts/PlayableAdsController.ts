import { _decorator, Component, Button, macro } from 'cc';
import super_html_playable from '../folder/super_html_playable';
import { PlayableAdsSDK, PlayableEvent } from './Tracking/PlayableAdsSDK';
import { PlayableAdsFlowManager } from './Tracking/PlayableAdsFlowManager';

const { ccclass, property } = _decorator;
const androidUrl = "https://play.google.com/store/apps/details?id=com.unimob.idle.army";
const iosUrl = "https://apps.apple.com/vn/app/idle-army-trading-weapons/id6670773625";

@ccclass('PlayableAdsController')
export class PlayableAdsController extends Component {

    private isBuild: boolean = false;
    private button: Button = null;
    isActiveAutoStore: boolean = false;
    channel: string = '';

    onLoad() {
        this.channel = this.getChannel();

        macro.ENABLE_MULTI_TOUCH = false;
        macro.ENABLE_TRANSPARENT_CANVAS = true;
        if (this.isBuild) console.log = () => { };
        if (this.isBuild) console.warn = () => { };
        if (this.isBuild) console.error = () => { };
        
        PlayableAdsSDK.instance.init();
        PlayableAdsSDK.instance.logEvent(PlayableEvent.LOADING);
        PlayableAdsSDK.instance.logEvent(PlayableEvent.LOADED);

        (window as any).gameReady && (window as any).gameReady();
        super_html_playable.set_app_store_url(iosUrl);
        super_html_playable.set_google_play_url(androidUrl);
    }

    start() {
        PlayableAdsSDK.instance.logEvent(PlayableEvent.DISPLAYED);
        PlayableAdsSDK.instance.gameReady();
        PlayableAdsFlowManager.instance.startLevel(0, 10, true);
    }

    checkOpenStorePlayable() {
       
    }

    openStore() {
        if (this.isBuild) {
            console.log("open store");
            PlayableAdsFlowManager.instance.stopAdsWhilePlaying();
            return;
        }

        PlayableAdsSDK.instance.openStore();
        let linkStore: string = this.getLinkStore();
        window.open(linkStore);
    }

    private click() {
        console.log("autoOpenStore");
    }

    private activeAutoStore() {
        console.log("activeAutoStore");
        this.openStore();
        this.isActiveAutoStore = true;
        if (this.button) {
            this.button.enabled = this.isActiveAutoStore;
        }
    }

    getChannel(): string {
        (window as any).advChannels = '{{__adv_channels_adapter__}}';
        return (window as any).advChannels;
    }

    public installHandle(): void {
        console.log("install");
        let linkStore: string = this.getLinkStore();
        (window as any).gameEnd && (window as any).gameEnd();
        switch (this.channel) {
            case "AppLovin":
                (window as any).mraid.open(linkStore);
                break;
            case "Facebook":
                (window as any).FbPlayableAd.onCTAClick();
                break;
            case "Google":
                (window as any).ExitApi.exit(linkStore);
                break;
            case "Mintegral":
                (window as any).gameEnd && (window as any).gameEnd();
                (window as any).install && (window as any).install();
                break;
            case "Unity":
                (window as any).mraid.open(linkStore);
                break;
            case "Tiktok":
                (window as any).playableSDK.openAppStore();
                break;
            case "IronSource":
                (window as any).dapi.openStoreUrl();
                break;
            default:
                window.open(linkStore);
                break;
        }
    }

    getLinkStore(): string {
        let mobile = this.getMobileOS();
        switch (mobile) {
            case "android":
                return androidUrl;
            case "iOS":
                return iosUrl;
            default:
                return androidUrl;
        }
    }

    getMobileOS(): string {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/android|Android/i.test(userAgent)) {
            return "android";
        } else if (/iPad|iPhone|iPod|Macintosh/.test(userAgent) && !(window as any).MSStream) {
            return "iOS";
        }
        return "unknown";
    }
}

export default PlayableAdsController;
