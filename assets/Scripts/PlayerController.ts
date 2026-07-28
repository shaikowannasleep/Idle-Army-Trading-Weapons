import {
    _decorator,
    Node
} from 'cc';

import { GameManager } from './GameManager';
import { UnitController } from './UnitController';
import { MovableActor } from './MovableActor';
import { CounterSlotData } from './CounterSlotData';

const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends MovableActor {

    @property(Node)
    pistolRack: Node = null!;

    @property(Node)
    akRack: Node = null!;

    private target: UnitController | null = null;
    private activeCounter: CounterSlotData | null = null;

    private holdingWeapon = "";
    private busy = false;
    private lastServedIndex = -1;

    update() {
        if (this.busy) return;
        this.findCustomer();
    }

    findCustomer() {
        const slots = GameManager.Instance.queueSlots;

        for (let offset = 1; offset <= slots.length; offset++) {
            const i = (this.lastServedIndex + offset) % slots.length;
            const slot = slots[i];

            if (slot.npc && slot.npc.state == "queue") {
                this.lastServedIndex = i;
                this.target = slot.npc;
                this.busy = true;

                this.activeCounter = GameManager.Instance.counterSlots.find(c => c.slotID === slot.slotID) || null;

                this.target.moveToCounter(() => {
                    this.moveToCounter(() => {
                        this.lookAtTarget(this.target!.node.worldPosition);
                        this.target!.lookAtTarget(this.node.worldPosition);

                        this.scheduleOnce(() => {
                            this.askCustomer();
                        }, 0.3);
                    });
                });
                break;
            }
        }
    }

    moveToCounter(callback: () => void) {
        const targetPos = this.activeCounter ? this.activeCounter.staffPos.worldPosition : this.node.worldPosition;
        this.moveTo(targetPos, 0.45, () => {
            if (callback) callback();
        });
    }

    askCustomer() {
        if (!this.target) {
            this.resetWorker();
            return;
        }

        if (GameManager.Instance.unlockLevel >= 2)
            this.target.desiredWeapon = "AK";
        else
            this.target.desiredWeapon = "Pistol";

        this.moveToRack();
    }

    moveToRack() {
        const rack = this.target!.desiredWeapon == "AK" ? this.akRack : this.pistolRack;
        
        this.moveTo(rack.worldPosition, 0.45, () => {
            this.playAnim("Craft");
            this.scheduleOnce(() => {
                this.finishCraft();
            }, 1.2);
        });
    }

    finishCraft() {
        this.holdingWeapon = this.target!.desiredWeapon;
        this.moveDeliver();
    }

    moveDeliver() {
        const targetPos = this.activeCounter ? this.activeCounter.staffPos.worldPosition : this.node.worldPosition;
        
        this.moveTo(targetPos, 0.45, () => {
            if (this.target) {
                this.lookAtTarget(this.target.node.worldPosition);
                this.target.lookAtTarget(this.node.worldPosition);
            }
            this.scheduleOnce(() => {
                this.deliver();
            }, 0.25);
        });
    }

    deliver() {
        if (!this.target) {
            this.resetWorker();
            return;
        }

        this.target.receiveWeapon(this.holdingWeapon);
        this.resetWorker();
    }

    resetWorker() {
        this.busy = false;
        this.target = null;
        this.activeCounter = null;
        this.holdingWeapon = "";
        this.playAnim("Idle");
    }
}