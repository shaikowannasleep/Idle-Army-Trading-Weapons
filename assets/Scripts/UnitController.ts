import {
    _decorator,
    Node,
    tween,
    Vec3,
    find
} from 'cc';

import { GameManager } from './GameManager';
import { BossController } from './BossController';
import { SlotData } from './SlotData';
import { MovableActor } from './MovableActor';
import { QueueSlotData } from './QueueSlotData';
import { CounterSlotData } from './CounterSlotData';
import { SoundManager } from './SoundManager';

const { ccclass, property } = _decorator;

const PISTOL_DAMAGE = 50;
const PISTOL_FIRE_RATE = 1.6;

const AK_DAMAGE = 100;
const AK_FIRE_RATE = 0.9;

@ccclass('UnitController')
export class UnitController extends MovableActor {

    public state: string = "walking";
    public desiredWeapon = "Pistol";
    public hp = 200;

    @property(Node) normalPart: Node = null!;
    @property(Node) armyPart: Node = null!;
    @property(Node) pistolWeapon: Node = null!;
    @property(Node) akWeapon: Node = null!;
    @property(Node) thoughtBubbleNode: Node = null!;
    @property moveSpeed: number = 1.3;

    public queueSlot: QueueSlotData | null = null;
    public counterSlot: CounterSlotData | null = null;
    public assignedSlot: SlotData | null = null;

    private attackTimer = 0;

    start() {
        this.resolveMeshParts();
        GameManager.Instance?.registerUnit(this);

        if (this.queueSlot) {
            const target = this.queueSlot.node.worldPosition;
            const dist = Vec3.distance(this.node.worldPosition, target);
            const duration = Math.max(0.2, dist / this.moveSpeed);

            this.moveTo(target, duration, () => {
                this.state = "queue";
                tween(this.node)
                    .to(0.25, {
                        eulerAngles: new Vec3(this.node.eulerAngles.x, 0, this.node.eulerAngles.z)
                    })
                    .start();
                GameManager.Instance?.onNPCArrivedQueue(this);
            });
        }
    }

    private resolveMeshParts() {
        if (!this.normalPart) this.normalPart = this.node.getChildByName("Body_01_blackjacket")!;
        if (!this.armyPart) this.armyPart = this.node.getChildByName("1")!;
        if (!this.pistolWeapon) this.pistolWeapon = this.node.getChildByName("Pistol")!;
        if (!this.akWeapon) this.akWeapon = this.node.getChildByName("AK")!;

        if (this.normalPart) this.normalPart.active = true;
        if (this.armyPart) this.armyPart.active = false;
        if (this.pistolWeapon) this.pistolWeapon.active = false;
        if (this.akWeapon) this.akWeapon.active = false;
        if (this.thoughtBubbleNode) this.thoughtBubbleNode.active = false;
    }

    update(dt: number) {
        if (this.state === "attacking") {
            this.updateAttack(dt);
        }
    }

    /**
     * Show speech bubble with desired weapon icon above head
     */
    public showThoughtBubble(weaponType: string) {
        this.desiredWeapon = weaponType;
        GameManager.Instance?.showThoughtBubble(this, weaponType);
    }

    public hideThoughtBubble() {
        GameManager.Instance?.hideThoughtBubble(this);
    }

    /**
     * Receive crafted weapon, transform into soldier, reward coins, and advance to attack Boss
     */
    public receiveWeapon(type: string) {
        this.desiredWeapon = type;
        this.hideThoughtBubble();

        // 1. Transform from civilian to combat soldier with uniform & weapon
        if (this.normalPart) this.normalPart.active = false;
        if (this.armyPart) this.armyPart.active = true;
        if (this.pistolWeapon) this.pistolWeapon.active = (type === "Pistol");
        if (this.akWeapon) this.akWeapon.active = (type === "AK");

        // 2. Play 2.5D Coin Fly reward
        const reward = type === "AK" ? 25 : 25;
        GameManager.Instance?.addCoin(reward, this.node.worldPosition);
        SoundManager.Instance?.playFinishOrder();

        // 3. Move up to frontline to attack Boss
        this.scheduleOnce(() => {
            this.moveAttack();
        }, 0.15);
    }

    moveAttack() {
        if (this.state === "dead") return;

        const targetSlot = GameManager.Instance.claimAttackSlot(this);

        if (!targetSlot) {
            this.state = "counterWaiting";
            this.playAnim("Idle");
            this.scheduleOnce(() => {
                this.moveAttack();
            }, 0.4);
            return;
        }

        // Vacate queue slot and advance the queue cleanly
        if (this.queueSlot && this.queueSlot.npc === this) {
            this.queueSlot.npc = null;
            this.queueSlot = null;
            GameManager.Instance.advanceQueue();
        }

        this.assignedSlot = targetSlot;
        this.state = "moveAttack";

        const dist = Vec3.distance(this.node.worldPosition, targetSlot.node.worldPosition);
        const duration = Math.max(0.35, dist / this.moveSpeed);

        if (BossController.Instance) {
            this.lookAtTarget(BossController.Instance.node.worldPosition);
        }

        this.moveTo(targetSlot.node.worldPosition, duration, () => {
            this.state = "attacking";
            if (BossController.Instance) {
                this.lookAtTarget(BossController.Instance.node.worldPosition);
            }
            const animName = this.desiredWeapon === "AK" ? "Attack_3" : "Attack_2";
            this.playAnim(animName);
        });
    }

    updateAttack(dt: number) {
        this.attackTimer -= dt;
        if (this.attackTimer > 0) return;

        const isAK = this.desiredWeapon === "AK";
        const dmg = isAK ? AK_DAMAGE : PISTOL_DAMAGE;

        BossController.Instance?.takeDamage(dmg);
        SoundManager.Instance?.playGunshot();
        this.attackTimer = isAK ? AK_FIRE_RATE : PISTOL_FIRE_RATE;
    }

    takeDamage(dmg: number) {
        if (this.state === "dead") return;
        this.hp -= dmg;
        if (this.hp > 0) return;
        this.die();
    }

    die() {
        if (this.state === "dead") return;
        this.state = "dead";
        SoundManager.Instance?.playDeath();

        if (this.assignedSlot) {
            GameManager.Instance.releaseAttackSlot(this);
            this.assignedSlot = null;
        }

        if (this.queueSlot && this.queueSlot.npc === this) {
            this.queueSlot.npc = null;
            this.queueSlot = null;
            GameManager.Instance.advanceQueue();
        }

        GameManager.Instance.removeUnit(this);
        BossController.Instance?.healOnKill();

        this.scheduleOnce(() => {
            this.node.destroy();
        }, 0.5);
    }
}