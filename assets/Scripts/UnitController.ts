import {
    _decorator,
    Node,
    Vec3
} from 'cc';

import { GameManager } from './GameManager';
import { BossController } from './BossController';
import { SlotData } from './SlotData';
import { MovableActor } from './MovableActor';

const { ccclass, property } = _decorator;

// walking -> queue -> moveCounter -> counterWaiting -> moveAttack -> attacking -> dead
export enum UnitState {
    WALKING,
    QUEUE,
    MOVE_COUNTER,
    COUNTER_WAITING,
    MOVE_ATTACK,
    ATTACK,
    DEAD
}

@ccclass('UnitController')
export class UnitController extends MovableActor {

    public state: string = "walking";

    public desiredWeapon = "Pistol";

    public hp = 60;

    @property(Node)
    pistolWeapon: Node = null!;

    @property(Node)
    akWeapon: Node = null!;

    @property
    moveSpeed: number = 1.2;

    public queueIndex: number = -1;

    private attackTimer = 0;

    public assignedSlot: Node = null;

    start() {

        if (this.pistolWeapon) this.pistolWeapon.active = false;
        if (this.akWeapon) this.akWeapon.active = false;

        GameManager.Instance.registerUnit(this);

    }

    update(dt: number) {

        if (this.state == "attacking") {
            this.updateAttack(dt);
        }

    }

    //---------------------------------------
    // Queue: chỉ gọi bởi GameManager.refreshQueue(), chỉ khi state là walking/queue.
    // NPC luôn nhìn về Staff trong lúc đứng/di chuyển trong hàng.

    refreshQueue(index: number) {

        this.queueIndex = index;

        const positions = GameManager.Instance.queuePositions;

        if (index >= positions.length)
            return;

        const staff = GameManager.Instance.staffCounter;

        if (staff) this.lookAtTarget(staff.worldPosition);

        const target = positions[index].worldPosition;

        const dist = Vec3.distance(this.node.worldPosition, target);

        if (dist < 0.05) {

            if (this.state == "walking")
                this.state = "queue";

            return;

        }

        const duration = Math.max(0.15, dist / this.moveSpeed);

        this.moveTo(target, duration, () => {

            if (staff) this.lookAtTarget(staff.worldPosition);

            if (this.state == "walking")
                this.state = "queue";

        });

    }

    //---------------------------------------
    // Được Player gọi khi chọn phục vụ NPC này. NPC tự rời queue và tự di chuyển,
    // Player không đụng vào position/tween của NPC.

    moveToCounter(onArrived?: () => void) {

        this.state = "moveCounter";

        const positions = GameManager.Instance.npcCounterPositions;

        const npcCounter =
            (this.queueIndex >= 0 && this.queueIndex < positions.length)
                ? positions[this.queueIndex]
                : null;

        GameManager.Instance.refreshQueue();

        const target =
            npcCounter ? npcCounter.worldPosition : this.node.worldPosition;

        const dist = Vec3.distance(this.node.worldPosition, target);

        const duration = Math.max(0.2, dist / this.moveSpeed);

        this.moveTo(target, duration, () => {

            this.state = "counterWaiting";

            const staff = GameManager.Instance.staffCounter;

            if (staff) this.lookAtTarget(staff.worldPosition);

            if (onArrived) onArrived();

        });

    }

    //---------------------------------------

    receiveWeapon(type: string) {

        this.desiredWeapon = type;

        this.playAnim("Take");

        if (this.pistolWeapon) this.pistolWeapon.active = (type == "Pistol");
        if (this.akWeapon) this.akWeapon.active = (type == "AK");

        const reward =
            type == "AK"
                ? 30
                : 10;

        GameManager.Instance.addCoin(reward);

        this.scheduleOnce(() => {

            this.moveAttack();

        }, 0.6);

    }

    //---------------------------------------

    moveAttack() {

        let targetSlot: Node = null;

        for (const slot of GameManager.Instance.attackSlots) {

            const data =
                slot.getComponent(SlotData);

            if (!data) continue;

            if (data.occupied) continue;

            data.occupied = true;

            targetSlot = slot;

            break;

        }

        if (!targetSlot) {

            this.state = "counterWaiting";

            this.scheduleOnce(() => {

                this.moveAttack();

            }, 0.5);

            return;

        }

        this.assignedSlot = targetSlot;

        this.state = "moveAttack";

        const dist = Vec3.distance(this.node.worldPosition, targetSlot.worldPosition);

        const duration = Math.max(0.3, dist / this.moveSpeed);

        this.moveTo(targetSlot.worldPosition, duration, () => {

            this.state = "attacking";

            if (BossController.Instance)
                this.lookAtTarget(BossController.Instance.node.worldPosition);

            this.playAnim("Attack_2");

        });

    }

    //---------------------------------------

    updateAttack(dt: number) {

        this.attackTimer -= dt;

        if (this.attackTimer > 0)
            return;

        const dmg =
            this.desiredWeapon == "AK"
                ? 8
                : 2;

        BossController.Instance.takeDamage(dmg);

        this.attackTimer =
            this.desiredWeapon == "AK"
                ? 0.16
                : 0.5;

    }

    //---------------------------------------

    takeDamage(dmg: number) {

        if (this.state == "dead")
            return;

        this.hp -= dmg;

        if (this.hp > 0)
            return;

        this.die();

    }

    //---------------------------------------

    die() {

        this.state = "dead";

        this.playAnim("Death");

        if (this.assignedSlot) {

            const slot =
                this.assignedSlot.getComponent(SlotData);

            if (slot)
                slot.occupied = false;

        }

        GameManager.Instance.removeUnit(this);

        BossController.Instance.healOnKill();

        GameManager.Instance.trySpawnNPC();

        this.scheduleOnce(() => {

            this.node.destroy();

        }, 0.6);

    }

}
