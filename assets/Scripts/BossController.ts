import { _decorator, Component, SkeletalAnimation, Vec3 } from 'cc';
import { GameManager } from './GameManager';
import { WorldHPBar } from './HPBarFollower';

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

    private state: string = 'spawning';
    private attackCooldown: number = 1.0;
    private hitReactCooldown: number = 0;

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

        const spawnState = this.anim.getState('Boss 1_Spawn');
        if (spawnState) {
            spawnState.speed = 0.45;
        }

        this.playAnim('Boss 1_Spawn');

        this.anim.once(SkeletalAnimation.EventType.FINISHED, () => {
            this.state = 'idle';
            this.playAnim('Boss 1_Idle');
        }, this);

        if (this.hpBarUI) 
            this.hpBarUI.updateHP(this.hp, this.maxHp);
    }

    // Play boss animation clip
    playAnim(name: string) {
        if (!this.anim) return;
        if (this.currentAnim == name) return;

        this.currentAnim = name;
        this.anim.crossFade(name, 0.15);
    }

    update(dt: number) {
        if (this.state == 'spawning' || this.state == 'dead')
            return;

        if (this.hitReactCooldown > 0)
            this.hitReactCooldown -= dt;

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
                this.doAttack(validTargets);
                this.attackCooldown = 1.0;
            }
        }
    }

    // Find units in attack range and state
    getTargetsInRange(): any[] {
        let inRangeUnits = [];
        let bossPos = this.node.worldPosition;

        for (let i = 0; i < GameManager.Instance.activeUnits.length; i++) {
            let unit = GameManager.Instance.activeUnits[i];

            if (unit && unit.node && unit.node.isValid) {
                let nodeName = unit.node.name.toLowerCase();
                if (nodeName.includes('unit')) {
                    let distance = Vec3.distance(bossPos, unit.node.worldPosition);

                    if (distance <= this.attackRadius && unit.state === 'attacking') {
                        inRangeUnits.push(unit);
                    }
                }
            }
        }
        return inRangeUnits;
    }

    // Play attack clip and damage a random target
    doAttack(targets: any[]) {
        this.state = 'attacking';

        const clip = ATTACK_CLIPS[Math.floor(Math.random() * ATTACK_CLIPS.length)];
        this.playAnim(clip);

        if (targets.length > 0) {
            let randomTarget = targets[Math.floor(Math.random() * targets.length)];
            randomTarget.takeDamage(this.currentDamage);
        }

        this.scheduleOnce(() => {
            if (this.state == 'attacking') {
                this.state = 'idle';
                this.playAnim('Boss 1_Idle');
            }
        }, 0.8);
    }

    // Apply damage, handle stun/enrage/death
    takeDamage(amount: number) {
        if (this.state === 'stunned' || this.state === 'spawning' || this.state === 'dead')
            return;

        this.hp -= amount;

        if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);

        if (this.hp <= 0) {
            this.hp = 0;
            this.healthBars = Math.max(0, this.healthBars - 1);

            let barsLost = 999 - this.healthBars;
            this.currentDamage = 15 + (barsLost * 25);

            if (this.healthBars <= 0) {
                this.state = 'dead';
                this.playAnim('Boss 1_Die');
                return;
            }

            this.state = 'stunned';
            this.playAnim('Boss 1_Stun');

            return;
        }

        if (this.state == 'idle' && this.hitReactCooldown <= 0) {
            this.hitReactCooldown = 0.4;
            this.playAnim('Boss 1_Bi tan cong');

            this.scheduleOnce(() => {
                if (this.state == 'idle')
                    this.playAnim('Boss 1_Idle');
            }, 0.3);
        }
    }

    // Reset boss to idle when no targets remain
    onNoTargets() {
        if (this.state !== 'idle' && this.state !== 'attacking')
            return;

        this.state = 'idle';
        this.playAnim('Boss 1_Idle');
    }

    // Heal boss when a unit is killed
    healOnKill() {
        if (this.state !== 'stunned' && this.state !== 'dead') {
            this.hp += 50;

            if (this.hp > this.maxHp) this.hp = this.maxHp;

            if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);
        }
    }
}