import { _decorator, Component, Node, SkeletalAnimation } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('BossController')
export class BossController extends Component {
    public static Instance: BossController;

    private maxHp: number = 1000;
    private hp: number = 1000;
    private healthBars: number = 999;
    private currentDamage: number = 15;
    
    private state: string = 'normal'; // 'normal' hoặc 'recovering'
    private attackCooldown: number = 1.0;

    @property(SkeletalAnimation) anim: SkeletalAnimation = null;

    start() {
        if (this.anim) {
            // Chơi animation Spawn
            this.anim.play('Boss 1_Spawn');
            
            // Lắng nghe sự kiện khi anim Spawn kết thúc
            this.anim.once(SkeletalAnimation.EventType.FINISHED, () => {
                // Chuyển sang trạng thái Idle
                this.anim.crossFade('Boss 1_Idle', 0.2);
            }, this);
        }
    }
    onLoad() {
        BossController.Instance = this;
    }

    update(dt: number) {
        return;
        if (this.state === 'recovering') {
            this.hp += 500 * dt; // Hồi máu xám cực nhanh
            if (this.hp >= this.maxHp) {
                this.hp = this.maxHp;
                this.state = 'normal';
                // Tắt VFX khiên máu xám ở đây
            }
            return;
        }

        // Hồi máu tự nhiên (Regen)
        if (this.hp < this.maxHp) {
            this.hp += 30 * dt; // 30 máu/giây
            if (this.hp > this.maxHp) this.hp = this.maxHp;
        }

        // Logic tấn công lính (nếu có Animation, gọi Anim ở đây)
        this.attackCooldown -= dt;
        if (this.attackCooldown <= 0) {
            this.attackRandomSoldier();
            this.attackCooldown = 1.0;
        }
    }

    takeDamage(amount: number) {
        if (this.state === 'recovering') return;

        this.hp -= amount;
        
        if (this.hp <= 0) {
            this.hp = 0;
            this.healthBars = Math.max(0, this.healthBars - 1);
            this.state = 'recovering';
            
            // Enrage: Cứ mất 1 cây máu cộng thêm 25 sát thương
            let barsLost = 999 - this.healthBars;
            this.currentDamage = 15 + (barsLost * 25);
            
            // Bật VFX khiên máu xám ở đây
        }
    }
    onNoTargets() {
        if (this.state !== 'idle') {
            this.state = 'idle';
            this.anim.crossFade('Boss 1_Idle', 0.2);
        }
    }
    attackRandomSoldier() {
        // Tìm các lính đang đứng bắn
        let targets = GameManager.Instance.activeUnits.filter(u => u.state === 'attacking');
        if (targets.length > 0) {
            let randomTarget = targets[Math.floor(Math.random() * targets.length)];
            randomTarget.takeDamage(this.currentDamage);
        }
    }

    healOnKill() {
        if (this.state !== 'recovering') {
            this.hp += 50;
            if (this.hp > this.maxHp) this.hp = this.maxHp;
        }
    }
}