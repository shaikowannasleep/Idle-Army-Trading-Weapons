import {
    _decorator,
    Node,
    tween,
    Vec3
} from 'cc';

import { GameManager } from './GameManager';
import { BossController } from './BossController';
import { SlotData } from './SlotData';
import { MovableActor } from './MovableActor';
import { QueueSlotData } from './QueueSlotData';
import { CounterSlotData } from './CounterSlotData';

const { ccclass, property } = _decorator;

export enum UnitState {
    WALKING, QUEUE, MOVE_COUNTER, COUNTER_WAITING, MOVE_ATTACK, ATTACK, DEAD
}

@ccclass('UnitController')
export class UnitController extends MovableActor {

    public state: string = "walking";
    public desiredWeapon = "Pistol";
    public hp = 60;

    @property(Node) pistolWeapon: Node = null!;
    @property(Node) akWeapon: Node = null!;
    @property moveSpeed: number = 1.2;

    public queueSlot: QueueSlotData | null = null;
    public counterSlot: CounterSlotData | null = null;
    public assignedSlot: SlotData | null = null;

    private attackTimer = 0;

    start() {
        if (this.pistolWeapon) this.pistolWeapon.active = false;
        if (this.akWeapon) this.akWeapon.active = false;

        GameManager.Instance.registerUnit(this);

        if (this.queueSlot) {
            const target = this.queueSlot.node.worldPosition;
            const dist = Vec3.distance(this.node.worldPosition, target);
            const duration = Math.max(0.15, dist / this.moveSpeed);

            this.moveTo(target, duration, () => {
                this.state = "queue";
                tween(this.node)
    .to(0.3, {
        eulerAngles: new Vec3(this.node.eulerAngles.x, 0, this.node.eulerAngles.z)
    })
    .start();
                   
    
            });
           
        }
    }

    update(dt: number) {
        if (this.state == "attacking") {
            this.updateAttack(dt);
        }
    }

    moveToCounter(onArrived?: () => void) {
        this.state = "moveCounter";

        if (this.queueSlot) {
            this.counterSlot = GameManager.Instance.counterSlots.find(c => c.slotID === this.queueSlot!.slotID) || null;
        }


        const target = this.counterSlot ? this.counterSlot.npcPos.worldPosition : this.node.worldPosition;
        const dist = Vec3.distance(this.node.worldPosition, target);
        const duration = Math.max(0.2, dist / this.moveSpeed);

        this.moveTo(target, duration, () => {
            this.state = "counterWaiting";
            
            if (onArrived) 
                {onArrived();
                  
                }
        });
         
    }

    receiveWeapon(type: string) {
        this.desiredWeapon = type;

        if (this.pistolWeapon) this.pistolWeapon.active = (type == "Pistol");
        if (this.akWeapon) this.akWeapon.active = (type == "AK");

        const reward = type == "AK" ? 30 : 10;
        GameManager.Instance.addCoin(reward);

        this.scheduleOnce(() => {
            this.moveAttack();
        }, 0.6);
    }

    moveAttack() {
        let targetSlot: SlotData | null = null;

        for (const slot of GameManager.Instance.attackSlots) {
            if (!slot.occupied) {
                slot.occupied = true;
                targetSlot = slot;
                break;
            }
        }

        if (!targetSlot) {

            this.state = "counterWaiting";
            this.playAnim("Idle");
            this.scheduleOnce(() => {
                this.moveAttack();
            }, 0.5);
            return;
        }

        // NPC chính thức rời khỏi điểm đứng (queue/counter) lúc này -> giải phóng slot.
        if (this.queueSlot && this.queueSlot.npc === this) {
            this.queueSlot.npc = null;
        }
        this.queueSlot = null;

        this.assignedSlot = targetSlot;
        this.state = "moveAttack";

        const dist = Vec3.distance(this.node.worldPosition, targetSlot.node.worldPosition);
        const duration = Math.max(0.3, dist / this.moveSpeed);
        if (BossController.Instance)
            this.lookAtTarget(BossController.Instance.node.worldPosition);
        this.moveTo(targetSlot.node.worldPosition, duration, () => {
            this.state = "attacking";
            this.playAnim("Attack_2");
        });
    }

    updateAttack(dt: number) {
        this.attackTimer -= dt;
        if (this.attackTimer > 0) return;
        const dmg = this.desiredWeapon == "AK" ? 100 : 50;
        BossController.Instance.takeDamage(dmg);
        this.attackTimer = this.desiredWeapon == "AK" ? 0.16 : 0.5;
    }

    takeDamage(dmg: number) {
        if (this.state == "dead") return;
        this.hp -= dmg;
        if (this.hp > 0) return;
        this.die();
    }

    die() {
        this.state = "dead";
        // this.playAnim("Death");

        if (this.assignedSlot) {
            this.assignedSlot.occupied = false;
        }

        // Safety net: nếu NPC chết trong lúc vẫn còn giữ slot (trường hợp bất thường),
        // vẫn phải giải phóng để tránh kẹt slot vĩnh viễn.
        if (this.queueSlot && this.queueSlot.npc === this) {
            this.queueSlot.npc = null;
        }
        this.queueSlot = null;

        GameManager.Instance.removeUnit(this);
        BossController.Instance.healOnKill();
        GameManager.Instance.trySpawnNPC();

        this.scheduleOnce(() => {
            this.node.destroy();
        }, 0.6);
    }
}