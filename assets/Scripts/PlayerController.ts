import {
    _decorator,
    Node,
    Vec3
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

    @property(Node)
    posInteract: Node = null!;

    private target: UnitController | null = null;
    private activeCounter: CounterSlotData | null = null;

    private holdingWeapon = "";
    private busy = false;
    private lastServedIndex = -1;

    start() {
        this.playAnim("Idle");
    }
    update() {
        if (this.busy) return;
        if (GameManager.Instance.unlockLevel < 1) return;
        this.findCustomer();
    }

    private isAtInteractPos(): boolean {

    return Vec3.distance(
        this.node.worldPosition,
        this.posInteract.worldPosition
    ) < 0.05;

}
    findCustomer() {

    const slots = GameManager.Instance.queueSlots;

    for (let offset = 1; offset <= slots.length; offset++) {

        const i = (this.lastServedIndex + offset) % slots.length;

        const slot = slots[i];

        if (!slot.npc || slot.npc.state != "queue")
            continue;

        this.lastServedIndex = i;
        this.target = slot.npc;
        this.busy = true;

        this.activeCounter =
            GameManager.Instance.counterSlots.find(
                c => c.slotID === slot.slotID
            ) || null;

            
        if (this.isAtInteractPos()) {

            this.lookAtTarget(this.target.node.worldPosition);

            this.target.lookAtTarget(this.node.worldPosition);

            this.scheduleOnce(() => {

                this.askCustomer();

            }, 0.5);

        }
   
        else {

            this.lookAtTarget(this.posInteract.worldPosition);

            this.moveTo(
                this.posInteract.worldPosition,
                1,
                () => {

                    this.lookAtTarget(this.target!.node.worldPosition);

                    this.target!.lookAtTarget(this.node.worldPosition);

                    this.scheduleOnce(() => {

                        this.askCustomer();

                    }, 0.5);

                }
            );

        }

        break;

    }

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
         this.lookAtTarget(rack.worldPosition);   
        this.moveTo(rack.worldPosition, 1, () => {
        this.playAnim("Manufacture");
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
               const targetPos = this.posInteract.worldPosition;
         if (this.target) {
                this.lookAtTarget(this.target.node.worldPosition);
                        }
        this.moveTo(targetPos,0.75, () => {
           
            this.scheduleOnce(() => {
                this.deliver();
            }, 0.2);
        });
    }

    deliver() {
        if (!this.target) {
            this.resetWorker();
            return;
        }
        this.playAnim("Manufacture");
        this.scheduleOnce(() => {
               this.target.receiveWeapon(this.holdingWeapon);
        this.resetWorker();
            }, 1);
        
    }

    resetWorker() {
        this.busy = false;
        this.target = null;
        this.activeCounter = null;
        this.holdingWeapon = "";
        this.playAnim("Idle");
    }
}