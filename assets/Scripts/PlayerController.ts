import {
    _decorator,
    Node,
    Vec3
} from 'cc';

import { GameManager } from './GameManager';
import { UnitController } from './UnitController';
import { MovableActor } from './MovableActor';
import { LoadingUI } from './LoadingUI';
import { SoundManager } from './SoundManager';

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
    private holdingWeapon = "";
    private busy = false;
    private lastServedIndex = -1;

    start() {
        this.playAnim("Idle");
    }

    update() {
        if (this.busy) return;
        if (!GameManager.Instance || GameManager.Instance.unlockLevel < 1) return;
        this.findCustomer();
    }

    private isAtInteractPos(): boolean {
        return Vec3.distance(
            this.node.worldPosition,
            this.posInteract.worldPosition
        ) < 0.08;
    }

    findCustomer() {
        const slots = GameManager.Instance.queueSlots;
        if (!slots || slots.length === 0) return;

        for (let offset = 1; offset <= slots.length; offset++) {
            const i = (this.lastServedIndex + offset) % slots.length;
            const slot = slots[i];

            if (!slot.npc || slot.npc.state !== "queue")
                continue;

            this.lastServedIndex = i;
            this.target = slot.npc;
            this.busy = true;

            if (this.isAtInteractPos()) {
                this.lookAtTarget(this.target.node.worldPosition);
                this.target.lookAtTarget(this.node.worldPosition);
                this.scheduleOnce(() => {
                    this.askCustomer();
                }, 0.2);
            } else {
                this.lookAtTarget(this.posInteract.worldPosition);
                this.moveTo(
                    this.posInteract.worldPosition,
                    0.8,
                    () => {
                        if (this.target && this.target.isValid) {
                            this.lookAtTarget(this.target.node.worldPosition);
                            this.target.lookAtTarget(this.node.worldPosition);
                        }
                        this.scheduleOnce(() => {
                            this.askCustomer();
                        }, 0.2);
                    }
                );
            }
            break;
        }
    }

    /**
     * Phase 1: Staff takes order at counter (2.0s), plays finish_order sound, customer shows thought bubble
     */
    askCustomer() {
        if (!this.target || !this.target.isValid) {
            this.resetWorker();
            return;
        }

        const weaponType = GameManager.Instance.unlockLevel >= 2 ? "AK" : "Pistol";
        this.target.desiredWeapon = weaponType;

        this.playAnim("Manufacture");
        const counterPos = this.posInteract.worldPosition.clone().add3f(0, 1.8, 0);
        const animDur = 2.0;

        console.log(`📋 [Staff] Taking customer order for [${weaponType}] | Duration: ${animDur}s`);

        let finished = false;
        const onOrderComplete = () => {
            if (finished) return;
            finished = true;
            SoundManager.Instance?.playFinishOrder();

            if (this.target && this.target.isValid) {
                this.target.showThoughtBubble(weaponType);
            }
            this.moveToRack();
        };

        if (LoadingUI.Instance) {
            LoadingUI.Instance.show(counterPos, animDur, "Taking Order...", onOrderComplete);
        } else {
            this.scheduleOnce(onOrderComplete, animDur);
        }

        // Safety fallback
        this.scheduleOnce(onOrderComplete, animDur + 0.15);
    }

    /**
     * Phase 2: Staff moves to rack and crafts weapon (2.0s), plays finish_order sound, gets weapon
     */
    moveToRack() {
        if (!this.target || !this.target.isValid) {
            this.resetWorker();
            return;
        }

        const isAK = this.target.desiredWeapon === "AK";
        const rack = isAK ? this.akRack : this.pistolRack;
        if (!rack) {
            this.resetWorker();
            return;
        }

        this.lookAtTarget(rack.worldPosition);
        this.moveTo(rack.worldPosition, 0.8, () => {
            this.playAnim("Manufacture");

            const animDur = 2.0;
            const loadPos = rack.worldPosition.clone().add3f(0, 1.8, 0);
            const text = isAK ? "Crafting AK-47..." : "Crafting Pistol...";

            console.log(`🔨 [Staff] Crafting [${this.target!.desiredWeapon}] at rack | Duration: ${animDur}s`);

            let finished = false;
            const onCraftComplete = () => {
                if (finished) return;
                finished = true;
                SoundManager.Instance?.playFinishOrder();
                this.finishCraft();
            };

            if (LoadingUI.Instance) {
                LoadingUI.Instance.show(loadPos, animDur, text, onCraftComplete);
            } else {
                this.scheduleOnce(onCraftComplete, animDur);
            }

            // Safety fallback
            this.scheduleOnce(onCraftComplete, animDur + 0.15);
        });
    }

    finishCraft() {
        this.holdingWeapon = this.target ? this.target.desiredWeapon : "Pistol";
        console.log(`✅ [Staff] Craft finished! Holding [${this.holdingWeapon}] -> Moving to deliver`);
        this.moveDeliver();
    }

    /**
     * Phase 3: Staff moves back to customer, delivers weapon, customer transforms and runs to attack Boss
     */
    moveDeliver() {
        const targetPos = this.posInteract.worldPosition;
        if (this.target && this.target.isValid) {
            this.lookAtTarget(this.target.node.worldPosition);
        }
        this.moveTo(targetPos, 0.75, () => {
            this.deliver();
        });
    }

    deliver() {
        if (!this.target || !this.target.isValid) {
            this.resetWorker();
            return;
        }

        console.log(`📦 [Staff] Delivering weapon [${this.holdingWeapon}] to customer`);

        if (this.target && this.target.isValid) {
            this.target.receiveWeapon(this.holdingWeapon);
        }

        GameManager.Instance?.onCustomerServed();
        this.resetWorker();
    }

    resetWorker() {
        this.busy = false;
        this.target = null;
        this.holdingWeapon = "";
        this.playAnim("Idle");
        console.log("🔄 [Staff] Finished interaction -> Worker reset to Idle");
    }
}