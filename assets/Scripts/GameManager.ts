import {
    _decorator,
    Component,
    Label,
    Prefab,
    instantiate,
    Node,
    input,
    Input,
    EventTouch,
    Vec3,
    tween,
    find
} from 'cc';

import { UnitController } from './UnitController';
import { QueueSlotData } from './QueueSlotData';
import { CounterSlotData } from './CounterSlotData';
import { SlotData } from './SlotData';
import super_html_playable from '../folder/super_html_playable';
import { SoundManager } from './SoundManager';
import { PlayableAdsFlowManager } from './Tracking/PlayableAdsFlowManager';
import { TutorialHand } from './TutorialHand';
import { CoinFlyFX } from './CoinFlyFX';
import { BossController } from './BossController';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {

    public static Instance: GameManager;

    @property(Label)
    coinLabel: Label = null!;

    @property(Prefab)
    unitPrefab: Prefab = null!;

    @property(Node)
    spawnPoint: Node = null!;

    @property(Node)
    mainCameraNode: Node = null!;

    @property(Node)
    blockInputNode: Node = null!;

    @property(Node)
    boxPistol: Node = null!;
    @property(Node)
    itemPistol: Node = null!;
    @property(Node)
    handPosPistol: Node = null!;

    @property(Node)
    boxAK: Node = null!;
    @property(Node)
    itemAK: Node = null!;
    @property(Node)
    handPosAK: Node = null!;

    @property(Node)
    boxTool: Node = null!;
    @property(Node)
    handPosTool: Node = null!;

    @property([QueueSlotData])
    public queueSlots: QueueSlotData[] = [];

    @property([CounterSlotData])
    public counterSlots: CounterSlotData[] = [];

    @property([SlotData])
    public attackSlots: SlotData[] = [];

    @property([Node])
    public thoughtBubbles: Node[] = [];

    @property
    public maxNPCs: number = 4;

    public coins = 0;
    public unlockLevel = 0;
    public activeUnits: UnitController[] = [];
    public countCharDone = 0;

    private totalSpawnedNPCs = 0;
    private arrivedNPCCount = 0;
    private hasShownInitialHand = false;
    private isInputBlocked = true;

    // Camera positions
    private readonly defaultCamPos = new Vec3(0.5, 15.9, 13.7);
    private readonly defaultCamEuler = new Vec3(-35.0, 0, 0);
    private readonly bossFocusCamPos = new Vec3(0, 9.2, -4.0);
    private readonly bossFocusCamEuler = new Vec3(-28.0, 0, 0);

    onLoad() {
        GameManager.Instance = this;
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onTouchStart(event: EventTouch) {
        if (this.isInputBlocked) return;
    }

    onTouchEnd(event: EventTouch) {
        if (this.isInputBlocked) return;

        // Tap 1: Open Box 1 (Pistol)
        if (this.unlockLevel < 1) {
            this.unlockLevel = 1;
            if (this.boxPistol) this.boxPistol.active = false;
            if (this.itemPistol) this.itemPistol.active = true;
            TutorialHand.Instance?.hide();
            SoundManager.Instance?.playBGM();
            SoundManager.Instance?.playClick();
            PlayableAdsFlowManager.instance.trackClick(true, 1);
            console.log("🔓 [GameManager] Unlocked Pistol Rack! Staff begins serving customers");
            return;
        }

        // Tap 2: Open Box 2 (AK)
        if (this.unlockLevel === 1 && this.boxAK && this.boxAK.active) {
            this.unlockAK();
            PlayableAdsFlowManager.instance.trackClick(true, 1);
            return;
        }

        // Tap 3: Open Box 3 (Store CTA)
        if (this.unlockLevel >= 2 && this.boxTool && this.boxTool.active) {
            this.openBoxTool();
            PlayableAdsFlowManager.instance.trackClick(true, 1);
            return;
        }

        if (this.unlockLevel >= 3) {
            SoundManager.Instance?.playClick();
            PlayableAdsFlowManager.instance.stopAdsWhilePlaying();
            return;
        }

        PlayableAdsFlowManager.instance.trackClick(false, 0);
    }

    start() {
        this.updateCoinUI();

        // 1. Resolve Camera & Block Input initially
        if (!this.mainCameraNode) {
            this.mainCameraNode = find('scene/Main Camera') || find('Main Camera')!;
        }
        if (!this.blockInputNode) {
            this.blockInputNode = find('UICanvas/Canvas/BlockInputNode') || find('Canvas/BlockInputNode')!;
        }

        // 2. Hide Box AK and Box Tool initially
        if (this.boxAK) this.boxAK.active = false;
        if (this.boxTool) this.boxTool.active = false;
        if (this.itemPistol) this.itemPistol.active = false;
        if (this.itemAK) this.itemAK.active = false;

        this.resolveSlotsIfNeeded();
        this.setBlockInput(true);
        this.playBossSpawnCameraCinematic();

        // 3. Stagger initial 4 NPC spawns smoothly
        console.log("🎮 [GameManager] Game start - Staggering 4 initial NPC spawns...");
        for (let i = 0; i < this.maxNPCs; i++) {
            this.scheduleOnce(() => {
                this.trySpawnNPC();
            }, 1.2 + i * 0.35);
        }

        // Safety fallback: Unblock input after 5.0s
        this.scheduleOnce(() => {
            if (this.isInputBlocked) {
                console.log("⏰ [GameManager] Fallback timer: Unblocking input & showing tutorial hand");
                this.onAllInitialNPCsReady();
            }
        }, 5.0);
    }

    private resolveSlotsIfNeeded() {
        if (!this.queueSlots || this.queueSlots.length === 0) {
            const queueNode = find('scene/list position/Queue Slot') || find('list position/Queue Slot');
            if (queueNode) {
                this.queueSlots = queueNode.getComponentsInChildren(QueueSlotData);
            }
        }

        if (!this.attackSlots || this.attackSlots.length === 0) {
            const atkNode = find('scene/list position/AttackPoint') || find('list position/AttackPoint');
            if (atkNode) {
                this.attackSlots = atkNode.getComponentsInChildren(SlotData);
            }
        }
        console.log(`📍 [GameManager] Resolved ${this.queueSlots.length} QueueSlots & ${this.attackSlots.length} AttackSlots.`);
    }

    private playBossSpawnCameraCinematic() {
        if (!this.mainCameraNode) return;

        this.mainCameraNode.setPosition(this.bossFocusCamPos);
        this.mainCameraNode.setRotationFromEuler(this.bossFocusCamEuler.x, this.bossFocusCamEuler.y, this.bossFocusCamEuler.z);

        console.log("🎬 [GameManager] Cinematic Camera focusing on Boss Spawn...");

        this.scheduleOnce(() => {
            if (!this.mainCameraNode || !this.mainCameraNode.isValid) return;

            console.log("🎬 [GameManager] Transitioning Camera smoothly to gameplay overview...");
            tween(this.mainCameraNode)
                .to(1.0, {
                    position: this.defaultCamPos,
                    eulerAngles: this.defaultCamEuler
                }, { easing: 'cubicOut' })
                .call(() => {
                    this.scheduleOnce(() => {
                        BossController.Instance?.showHPBar();
                    }, 0.5);
                })
                .start();
        }, 2.3);
    }

    public setBlockInput(blocked: boolean) {
        this.isInputBlocked = blocked;
        if (this.blockInputNode && this.blockInputNode.isValid) {
            this.blockInputNode.active = blocked;
        }
        console.log(`🔒 [GameManager] Touch Input ${blocked ? 'BLOCKED' : 'UNBLOCKED'}`);
    }

    public onNPCArrivedQueue(unit: UnitController) {
        this.arrivedNPCCount++;
        console.log(`🚶 [GameManager] NPC arrived at queue destination (${this.arrivedNPCCount}/4)`);

        if (this.arrivedNPCCount >= this.maxNPCs) {
            this.onAllInitialNPCsReady();
        }
    }

    private onAllInitialNPCsReady() {
        if (this.hasShownInitialHand || this.unlockLevel >= 1) return;
        this.setBlockInput(false);
        this.showInitialTutorialHand();
    }

    private showInitialTutorialHand() {
        if (this.hasShownInitialHand || this.unlockLevel >= 1) return;
        this.hasShownInitialHand = true;

        const target = this.handPosPistol || this.boxPistol;
        console.log("👉 [GameManager] Calling TutorialHand.show() on Pistol Box:", target ? target.name : "null");
        if (target) {
            TutorialHand.Instance?.show(target, "✨ TAP TO OPEN BLIND BOX!");
        }
    }

    private trySpawnNPC() {
        if (this.totalSpawnedNPCs >= this.maxNPCs || this.activeUnits.length >= this.maxNPCs) {
            return;
        }

        if (!this.queueSlots || this.queueSlots.length === 0) {
            this.resolveSlotsIfNeeded();
        }

        const freeSlot = this.queueSlots.find(s => s.npc === null);
        if (!freeSlot) return;

        this.totalSpawnedNPCs++;
        const unitNode = instantiate(this.unitPrefab);
        unitNode.parent = this.node.parent;
        unitNode.setWorldPosition(this.spawnPoint.worldPosition);

        const ctrl = unitNode.getComponent(UnitController)!;
        ctrl.queueSlot = freeSlot;
        freeSlot.npc = ctrl;
        console.log(`👤 [GameManager] Spawned NPC (${this.totalSpawnedNPCs}/${this.maxNPCs})`);
    }

    public registerUnit(unit: UnitController) {
        this.activeUnits.push(unit);
    }

    public removeUnit(unit: UnitController) {
        const index = this.activeUnits.indexOf(unit);
        if (index > -1) {
            this.activeUnits.splice(index, 1);
        }
    }

    public claimAttackSlot(unit: UnitController): SlotData | null {
        if (!this.attackSlots || this.attackSlots.length === 0) {
            this.resolveSlotsIfNeeded();
        }

        const slot = this.attackSlots.find(s => !s.assignedUnit && !s.occupied);
        if (slot) {
            slot.occupied = true;
            slot.assignedUnit = unit;
            return slot;
        }
        return null;
    }

    public releaseAttackSlot(unit: UnitController) {
        const slot = this.attackSlots.find(s => s.assignedUnit === unit);
        if (slot) {
            slot.occupied = false;
            slot.assignedUnit = null;
        }
    }

    public advanceQueue() {
        for (let i = 0; i < this.queueSlots.length - 1; i++) {
            const current = this.queueSlots[i];
            const next = this.queueSlots[i + 1];

            if (current.npc === null && next.npc !== null && next.npc.state === "queue") {
                const movingNPC = next.npc;
                next.npc = null;
                current.npc = movingNPC;
                movingNPC.queueSlot = current;
                movingNPC.moveTo(current.node.worldPosition, 0.4);
            }
        }
    }

    public addCoin(amount: number, fromWorldPos?: Vec3) {
        this.coins += amount;
        this.updateCoinUI();

        if (fromWorldPos) {
            CoinFlyFX.Instance?.playFly(fromWorldPos, 3);
        }
    }

    public showThoughtBubble(unit: UnitController, weaponType: string) {
        const slotIdx = this.activeUnits.indexOf(unit);
        const idx = slotIdx >= 0 && slotIdx < this.thoughtBubbles.length ? slotIdx : 0;
        const bubble = this.thoughtBubbles[idx];
        if (!bubble) return;

        bubble.active = true;
        bubble.setScale(new Vec3(0, 0, 0));
        const iconPistol = bubble.getChildByName("Icon_Pistol");
        const iconAK = bubble.getChildByName("Icon_AK");
        if (iconPistol) iconPistol.active = (weaponType === "Pistol");
        if (iconAK) iconAK.active = (weaponType === "AK");

        tween(bubble)
            .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    public hideThoughtBubble(unit: UnitController) {
        const slotIdx = this.activeUnits.indexOf(unit);
        const idx = slotIdx >= 0 && slotIdx < this.thoughtBubbles.length ? slotIdx : 0;
        const bubble = this.thoughtBubbles[idx];
        if (!bubble || !bubble.active) return;

        tween(bubble)
            .to(0.15, { scale: new Vec3(0, 0, 0) })
            .call(() => {
                if (bubble && bubble.isValid) {
                    bubble.active = false;
                }
            })
            .start();
    }

    public updateCoinUI() {
        if (this.coinLabel) {
            this.coinLabel.string = this.coins.toString();
        }
    }

    /**
     * Called whenever a customer receives weapon and advances to combat
     */
    public onCustomerServed() {
        this.countCharDone++;
        console.log(`📦 [GameManager] Customer served! (Total: ${this.countCharDone})`);

        // After 2 customers served: Drop Box 2 (AK Box) with scale spring
        if (this.countCharDone === 2 && this.unlockLevel < 2 && this.boxAK) {
            this.boxAK.active = true;
            this.boxAK.setScale(new Vec3(0, 0, 0));
            tween(this.boxAK)
                .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .call(() => {
                    const akTarget = this.handPosAK || this.boxAK;
                    TutorialHand.Instance?.show(akTarget, "🔥 UNBOX POWERFUL AK-47!");
                })
                .start();
        }
        // After 4 customers served: Drop Box 3 (Mystery Box)
        else if (this.countCharDone >= 4 && this.unlockLevel >= 2 && this.boxTool) {
            this.boxTool.active = true;
            this.boxTool.setScale(new Vec3(0, 0, 0));
            tween(this.boxTool)
                .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .call(() => {
                    const toolTarget = this.handPosTool || this.boxTool;
                    TutorialHand.Instance?.show(toolTarget, "🎁 CLAIM MYSTERY REWARD!");
                })
                .start();
        }
    }

    private unlockAK() {
        this.unlockLevel = 2;
        if (this.boxAK) this.boxAK.active = false;
        if (this.itemAK) this.itemAK.active = true;
        TutorialHand.Instance?.hide();
        SoundManager.Instance?.playClick();
        console.log("🔓 [GameManager] Unlocked AK-47 Rack! Hiding tutorial hand");
    }

    private openBoxTool() {
        if (this.boxTool) this.boxTool.active = false;
        TutorialHand.Instance?.hide();
        super_html_playable.game_end();
        SoundManager.Instance?.playClick();
        PlayableAdsFlowManager.instance.stopAdsWhilePlaying();
    }
}