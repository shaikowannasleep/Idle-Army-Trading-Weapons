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

    // 'spawning' | 'idle' | 'attacking' | 'stunned' | 'dead'
    private state: string = 'spawning';
    private attackCooldown: number = 1.0;
    private hitReactCooldown: number = 0;

    private currentAnim: string = "";

    @property(SkeletalAnimation) 
    anim: SkeletalAnimation = null;
    
    @property(WorldHPBar)
    hpBarUI: WorldHPBar = null!;

    @property({ tooltip: "Bán kính tấn công của Boss" })
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
                this.playAnim('Boss 1_Idle');
            }

            if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);
            return;
        }

        // Hồi máu tự nhiên (Regen)
        if (this.hp < this.maxHp) {
            this.hp += 30 * dt; // 30 máu/giây
            if (this.hp > this.maxHp) this.hp = this.maxHp;
            
            if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);
        }

        // Logic tấn công
        this.attackCooldown -= dt;

        if (this.attackCooldown <= 0 && this.state == 'idle') {
            // Lấy danh sách mục tiêu hợp lệ trong tầm đánh
            let validTargets = this.getTargetsInRange();

            // CHỈ thực hiện tấn công nếu có ít nhất 1 mục tiêu nằm trong bán kính
            if (validTargets.length > 0) {
                this.doAttack(validTargets);
                this.attackCooldown = 1.0;
            }
        }
    }

    //---------------------------------------
    // Quét và lọc mục tiêu thỏa mãn điều kiện
    //---------------------------------------
    getTargetsInRange(): any[] {
        let inRangeUnits = [];
        let bossPos = this.node.worldPosition;

        for (let i = 0; i < GameManager.Instance.activeUnits.length; i++) {
            let unit = GameManager.Instance.activeUnits[i];
            
            if (unit && unit.node && unit.node.isValid) {
                // Kiểm tra 2 điều kiện: Tên có chứa 'unit' và khoảng cách <= attackRadius
                let nodeName = unit.node.name.toLowerCase();
                if (nodeName.includes('unit')) {
                    let distance = Vec3.distance(bossPos, unit.node.worldPosition);
                    
                    // (Tùy chọn) Có thể thêm check state xem lính có đang tấn công hay không
                    if (distance <= this.attackRadius && unit.state === 'attacking') {
                        inRangeUnits.push(unit);
                    }
                }
            }
        }
        return inRangeUnits;
    }

    //---------------------------------------

    doAttack(targets: any[]) {
        this.state = 'attacking';

        const clip = ATTACK_CLIPS[Math.floor(Math.random() * ATTACK_CLIPS.length)];
        this.playAnim(clip);

        // Gây sát thương lên 1 mục tiêu ngẫu nhiên trong số những mục tiêu hợp lệ
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

    //---------------------------------------

    takeDamage(amount: number) {
        if (this.state === 'stunned' || this.state === 'spawning' || this.state === 'dead')
            return;

        this.hp -= amount;

        if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);
        
        // console.log(`Boss HP: ${this.hp}/${this.maxHp} (bar ${this.healthBars})`);

        if (this.hp <= 0) {
            this.hp = 0;
            this.healthBars = Math.max(0, this.healthBars - 1);

            // Enrage: Cứ mất 1 cây máu cộng thêm 25 sát thương
            let barsLost = 999 - this.healthBars;
            this.currentDamage = 15 + (barsLost * 25);

            if (this.healthBars <= 0) {
                this.state = 'dead';
                this.playAnim('Boss 1_Die');
                // console.log('Boss defeated -> Boss 1_Die');
                return;
            }

            this.state = 'stunned';
            this.playAnim('Boss 1_Stun');
            // console.log(`Boss bar depleted -> stunned. Bars left: ${this.healthBars}, damage now: ${this.currentDamage}`);

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

    healOnKill() {
        if (this.state !== 'stunned' && this.state !== 'dead') {
            this.hp += 50;

            if (this.hp > this.maxHp) this.hp = this.maxHp;

            if (this.hpBarUI) this.hpBarUI.updateHP(this.hp, this.maxHp);
            
            // console.log(`Boss healOnKill -> HP: ${this.hp}/${this.maxHp}`);
        }
    }
}