import { _decorator, Component, AudioSource, AudioClip } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('SoundManager')
export class SoundManager extends Component {

    public static Instance: SoundManager;

    @property(AudioSource)
    bgmSource: AudioSource = null!;

    @property(AudioSource)
    sfxSource: AudioSource = null!;

    @property([AudioClip])
    clipList: AudioClip[] = [];

    @property
    bgmVolume: number = 0.5;

    @property
    sfxVolume: number = 1.0;

    @property
    autoPlayBgm: boolean = true;

    private clips: Map<string, AudioClip> = new Map();

    onLoad() {
        SoundManager.Instance = this;

        for (const clip of this.clipList) {
            if (clip) this.clips.set(clip.name, clip);
        }
    }

    playBGM(name: string = 'bgM') {
        const clip = this.clips.get(name);
        if (!clip || !this.bgmSource) return;
        this.bgmSource.clip = clip;
        this.bgmSource.loop = true;
        this.bgmSource.volume = this.bgmVolume;
        this.stopBGM();
        this.bgmSource.play();
    }

    stopBGM() {
        if (this.bgmSource) this.bgmSource.stop();
    }

    playSfx(name: string, volume: number = this.sfxVolume) {
        const clip = this.clips.get(name);
        if (!clip || !this.sfxSource) return;
        this.sfxSource.playOneShot(clip, volume);
    }

    playClick() { this.playSfx('click1'); }
    playCoinSpend() { this.playSfx('coin'); }
    playCoinTip() { this.playSfx('Coin_Tip'); }
    playFinishOrder() { this.playSfx('finish_order'); }
    playGunshot() { this.playSfx('gun1'); }
    playCoinReceive() { this.playSfx('sound-receive-coin'); }
    playDeath() { this.playSfx('death'); }
}
