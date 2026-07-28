import {
    _decorator,
    Node
} from 'cc';

import { GameManager } from './GameManager';
import { UnitController } from './UnitController';
import { MovableActor } from './MovableActor';

const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends MovableActor {

    @property(Node)
    pistolRack: Node = null!;

    @property(Node)
    akRack: Node = null!;

    private target: UnitController = null;

    private holdingWeapon = "";

    private busy = false;

    update() {

        if (this.busy)
            return;

        this.findCustomer();

    }

    //------------------------------------------------
    // Chỉ chọn đúng NPC đang đứng đầu hàng (queueIndex 0) và đã tới nơi (state == "queue").

    findCustomer() {

        const list = GameManager.Instance.activeUnits.filter(u =>

            u.state == "queue" && u.queueIndex == 0

        );

        if (list.length == 0)
            return;

        this.target = list[0];

        this.busy = true;

        // Ra lệnh cho NPC tự di chuyển, Player không setPosition/tween NPC.
        this.target.moveToCounter(() => {

            this.scheduleOnce(() => {

                this.askCustomer();

            }, 0.3);

        });

        this.moveToCounter();

    }

    //------------------------------------------------

    moveToCounter() {

        this.moveTo(GameManager.Instance.staffCounter.worldPosition, 0.45, () => {

            if (this.target)
                this.lookAtTarget(this.target.node.worldPosition);

        });

    }

    //------------------------------------------------

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

    //------------------------------------------------

    moveToRack() {

        const rack =

            this.target.desiredWeapon == "AK"

                ? this.akRack

                : this.pistolRack;

        this.moveTo(rack.worldPosition, 0.45, () => {

            this.playAnim("Craft");

            this.scheduleOnce(() => {

                this.finishCraft();

            }, 1.2);

        });

    }

    //------------------------------------------------

    finishCraft() {

        this.holdingWeapon =

            this.target.desiredWeapon;

        this.moveDeliver();

    }

    //------------------------------------------------

    moveDeliver() {

        this.moveTo(GameManager.Instance.staffCounter.worldPosition, 0.45, () => {

            if (this.target)
                this.lookAtTarget(this.target.node.worldPosition);

            this.scheduleOnce(() => {

                this.deliver();

            }, 0.25);

        });

    }

    //------------------------------------------------

    deliver() {

        if (!this.target) {

            this.resetWorker();

            return;

        }

        this.target.receiveWeapon(

            this.holdingWeapon

        );

        this.resetWorker();

    }

    //------------------------------------------------

    resetWorker() {

        this.busy = false;

        this.target = null;

        this.holdingWeapon = "";

        this.playAnim("Idle");

    }

}
