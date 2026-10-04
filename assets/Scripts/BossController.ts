import { _decorator, Component, SkeletalAnimation, Vec3, Node } from 'cc';
import { GameManager } from './GameManager';
import { WorldHPBar } from './HPBarFollower';

const { ccclass, property } = _decorator;

const ATTACK_CLIPS = [
    'Boss 1_Attack 1',
    'Boss 1_Attack 2',
    'Boss 1_Attack 3',
    'Boss 1_Attack 4'
];

const COMBO_CHANCE = 0.3;
const COMBO_DAMAGE_MULT = 2;

@ccclass('BossController')
export class BossController extends Component {
    public static Instance: BossController;

    private maxHp: number = 1000;
    private hp: number = 1000;
    private healthBars: number = 999;
    private currentDamage: number = 15;

    private state: string = 'spawning';
    private attackCooldown: number = 1.0;
    private hitCount: number = 0;

    private currentAnim: string = "";

    @property(SkeletalAnimation) 
    anim: SkeletalAnimation = null;
    
    @property(WorldHPBar)
    hpBarUI: WorldHPBar = null!;

    @property({ tooltip: "Boss attack radius" })
    attackRadius: number = 10.0;

    onLoad() {
        BossController.Instance = this;
    }

    start() {
        if (!this.anim) return;

        this.state = 'spawning';

        // Hide HP bar initially until camera zoom-out completes + 0.5s
        if (this.hpBarUI && this.hpBarUI.node && this.hpBarUI.node.isValid) {
            this.hpBarUI.node.active = false;
        }

        // Initially hide Boss model to allow 1s loading / camera preparation
        this.node.setScale(new Vec3(0, 0, 0));

        // Wait 1.0s before activating Boss and playing spawn anim at normal speed
        this.scheduleOnce(() => {
            if (!this.node || !this.node.isValid) return;
            this.node.setScale(new Vec3(1, 1, 1));

            const spawnState = this.anim.getState('Boss 1_Spawn');
            if (spawnState) {
                spawnState.speed = 1.0; // Normal animation speed
            }

            this.playAnim('Boss 1_Spawn', true);

            this.anim.once(SkeletalAnimation.EventType.FINISHED, () => {
                this.state = 'idle';
                this.playAnim('Boss 1_Idle');
            }, this);
        }, 1.0);
    }

    /**
     * Show HP Bar after Camera zoom out completes + 0.5s
     */
    public showHPBar() {
        if (this.hpBarUI && this.hpBarUI.node && this.hpBarUI.node.isValid) {
            this.hpBarUI.node.active = true;
            this.hpBarUI.updateHP(this.hp, this.maxHp);
            console.log("🩸 [BossController] HP Bar displayed after camera zoom-out + 0.5s!");
        }
    }

    // Play boss animation clip
    playAnim(name: string, force: boolean = false, blend: number = 0.15) {
        if (!this.anim) return;
        if (this.currentAnim == name && !force) return;

        this.currentAnim = name;
        this.anim.crossFade(name, blend);
    }

    update(dt: number) {
        if (this.state == 'spawning' || this.state == 'dead')
            return;

        if (this.state === 'stunned') {
            this.hp += 500 * dt;

            if (this.hp >= this.maxHp) {
                this.hp = this.maxHp;
                this.state = 'idle';
                this.playAnim('Boss 1_Idle');
            }

            if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);
            return;
        }

        if (this.hp < this.maxHp) {
            this.hp += 30 * dt;
            if (this.hp > this.maxHp) this.hp = this.maxHp;

            if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);
        }

        this.attackCooldown -= dt;

        if (this.attackCooldown <= 0 && this.state == 'idle') {
            let validTargets = this.getTargetsInRange();

            if (validTargets.length > 0) {
                if (Math.random() < COMBO_CHANCE) {
                    this.doComboAttack(validTargets);
                    this.attackCooldown = 3.0;
                } else {
                    this.doAttack(validTargets);
                    this.attackCooldown = 1.0;
                }
            }
        }
    }

    // Find units in attack range and state
    getTargetsInRange(): any[] {
        let inRangeUnits = [];
        let bossPos = this.node.worldPosition;

        for (let unit of GameManager.Instance.activeUnits) {
            if (unit.state !== 'attacking') continue;

            let dist = Vec3.distance(bossPos, unit.node.worldPosition);
            if (dist <= this.attackRadius) {
                inRangeUnits.push(unit);
            }
        }

        return inRangeUnits;
    }

    // Normal attack on targets
    doAttack(targets: any[]) {
        this.state = 'attacking';

        let clipIndex = Math.floor(Math.random() * ATTACK_CLIPS.length);
        let clip = ATTACK_CLIPS[clipIndex];

        this.playAnim(clip, true);

        this.scheduleOnce(() => {
            if (this.state !== 'attacking') return;

            for (let unit of targets) {
                if (unit && unit.node && unit.node.isValid && unit.state === 'attacking') {
                    unit.takeDamage(this.currentDamage);
                }
            }
        }, 0.5);

        this.anim.once(SkeletalAnimation.EventType.FINISHED, () => {
            if (this.state === 'attacking') {
                this.state = 'idle';
                this.playAnim('Boss 1_Idle');
            }
        }, this);
    }

    // High damage combo attack
    doComboAttack(targets: any[]) {
        this.state = 'combo';

        let clipIndex = Math.floor(Math.random() * ATTACK_CLIPS.length);
        let clip = ATTACK_CLIPS[clipIndex];

        this.playAnim(clip, true);

        let comboDamage = this.currentDamage * COMBO_DAMAGE_MULT;

        this.scheduleOnce(() => {
            if (this.state !== 'combo') return;

            for (let unit of targets) {
                if (unit && unit.node && unit.node.isValid && unit.state === 'attacking') {
                    unit.takeDamage(comboDamage);
                }
            }
        }, 0.5);

        this.anim.once(SkeletalAnimation.EventType.FINISHED, () => {
            if (this.state === 'combo') {
                this.state = 'idle';
                this.playAnim('Boss 1_Idle');
            }
        }, this);
    }

    // Boss takes damage from unit attacks
    takeDamage(amount: number) {
        if (this.state === 'spawning' || this.state === 'dead') return;

        this.hp -= amount;

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'stunned';
            this.playAnim('Boss 1_Stun');
            this.hitCount = 0;
        } else {
            this.hitCount++;
            if (this.hitCount >= 5 && this.state === 'idle') {
                this.hitCount = 0;
                this.playAnim('Boss 1_Hit', true);

                this.anim.once(SkeletalAnimation.EventType.FINISHED, () => {
                    if (this.state === 'idle') {
                        this.playAnim('Boss 1_Idle');
                    }
                }, this);
            }
        }

        if (this.hpBarUI) {
            this.hpBarUI.updateHP(this.hp, this.maxHp);
        }
    }

    // Restore health when defeating a unit
    healOnKill() {
        this.hp += 100;
        if (this.hp > this.maxHp) this.hp = this.maxHp;

        if (this.hpBarUI) {
            this.hpBarUI.updateHP(this.hp, this.maxHp);
        }
    }
}