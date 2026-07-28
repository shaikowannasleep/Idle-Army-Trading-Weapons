import { _decorator, Component, SkeletalAnimation } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

const ATTACK_CLIPS = [
    'Boss 1_Attack 1',
    'Boss 1_Attack 2',
    'Boss 1_Attack 3',
    'Boss 1_Attack 4'
];

@ccclass('BossController')
export class BossController extends Component {
    public static Instance: BossController;

    private maxHp: number = 1000;
    private hp: number = 1000;
    private healthBars: number = 999;
    private currentDamage: number = 15;

    // 'spawning' | 'idle' | 'attacking' | 'stunned' | 'dead'
    private state: string = 'spawning';
    private attackCooldown: number = 1.0;
    private hitReactCooldown: number = 0;

    private currentAnim: string = "";

    @property(SkeletalAnimation) anim: SkeletalAnimation = null;

    onLoad() {
        BossController.Instance = this;
    }

    start() {

        if (!this.anim) return;

        this.state = 'spawning';

        const spawnState = this.anim.getState('Boss 1_Spawn');
        spawnState.speed = 0.45;

        this.playAnim('Boss 1_Spawn');

        this.anim.once(SkeletalAnimation.EventType.FINISHED, () => {

            this.state = 'idle';

            this.playAnim('Boss 1_Idle');

        }, this);

    }

    //---------------------------------------

    playAnim(name: string) {

        if (!this.anim) return;

        if (this.currentAnim == name) return;

        this.currentAnim = name;

        this.anim.crossFade(name, 0.15);

    }

    //---------------------------------------

    update(dt: number) {

        if (this.state == 'spawning' || this.state == 'dead')
            return;

        if (this.hitReactCooldown > 0)
            this.hitReactCooldown -= dt;

        if (this.state === 'stunned') {

            this.hp += 500 * dt; // Hồi máu xám cực nhanh

            if (this.hp >= this.maxHp) {

                this.hp = this.maxHp;
                this.state = 'idle';

                //console.log(`Boss recovered -> HP: ${this.hp}/${this.maxHp}`);

                this.playAnim('Boss 1_Idle');

                // Tắt VFX khiên máu xám ở đây
            }

            return;

        }

        // Hồi máu tự nhiên (Regen)
        if (this.hp < this.maxHp) {
            this.hp += 30 * dt; // 30 máu/giây
            if (this.hp > this.maxHp) this.hp = this.maxHp;
        }

        // Logic tấn công lính
        this.attackCooldown -= dt;

        if (this.attackCooldown <= 0 && this.state == 'idle') {

            this.doAttack();

            this.attackCooldown = 1.0;

        }

    }

    //---------------------------------------

    doAttack() {

        this.state = 'attacking';

        const clip =
            ATTACK_CLIPS[Math.floor(Math.random() * ATTACK_CLIPS.length)];

        this.playAnim(clip);

        this.attackRandomSoldier();

        this.scheduleOnce(() => {

            if (this.state == 'attacking') {

                this.state = 'idle';

                this.playAnim('Boss 1_Idle');

            }

        }, 0.8);

    }

    //---------------------------------------

    takeDamage(amount: number) {

        if (this.state === 'stunned' || this.state === 'spawning' || this.state === 'dead')
            return;

        this.hp -= amount;

        console.log(`Boss HP: ${this.hp}/${this.maxHp} (bar ${this.healthBars})`);

        if (this.hp <= 0) {

            this.hp = 0;
            this.healthBars = Math.max(0, this.healthBars - 1);

            // Enrage: Cứ mất 1 cây máu cộng thêm 25 sát thương
            let barsLost = 999 - this.healthBars;
            this.currentDamage = 15 + (barsLost * 25);

            if (this.healthBars <= 0) {

                this.state = 'dead';

                this.playAnim('Boss 1_Die');

                console.log('Boss defeated -> Boss 1_Die');

                return;

            }

            this.state = 'stunned';

            this.playAnim('Boss 1_Stun');

            console.log(`Boss bar depleted -> stunned. Bars left: ${this.healthBars}, damage now: ${this.currentDamage}`);

            // Bật VFX khiên máu xám ở đây

            return;

        }

        // Phản ứng bị đánh, throttle để không spam đè lên anim Attack/Idle
        if (this.state == 'idle' && this.hitReactCooldown <= 0) {

            this.hitReactCooldown = 0.4;

            this.playAnim('Boss 1_Bi tan cong');

            this.scheduleOnce(() => {

                if (this.state == 'idle')
                    this.playAnim('Boss 1_Idle');

            }, 0.3);

        }

    }

    //---------------------------------------

    onNoTargets() {

        if (this.state !== 'idle' && this.state !== 'attacking')
            return;

        this.state = 'idle';

        this.playAnim('Boss 1_Idle');

    }

    //---------------------------------------

    attackRandomSoldier() {

        let targets = GameManager.Instance.activeUnits.filter(u => u.state === 'attacking');

        if (targets.length > 0) {
            let randomTarget = targets[Math.floor(Math.random() * targets.length)];
            randomTarget.takeDamage(this.currentDamage);
        }

    }

    //---------------------------------------

    healOnKill() {

        if (this.state !== 'stunned' && this.state !== 'dead') {

            this.hp += 50;

            if (this.hp > this.maxHp) this.hp = this.maxHp;

            console.log(`Boss healOnKill -> HP: ${this.hp}/${this.maxHp}`);

        }

    }

}
