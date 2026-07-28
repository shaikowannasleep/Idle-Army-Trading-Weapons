import {
    _decorator,
    Component,
    Label,
    Prefab,
    instantiate,
    Node
} from 'cc';

import { UnitController } from './UnitController';

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

    // Gán node cha chứa các vị trí con (đặt tên 1,2,3... theo thứ tự trong Hierarchy).
    // Danh sách vị trí được lấy tự động từ children, không cần kéo từng node vào mảng.
    @property(Node)
    queueSlotParent: Node = null!;

    @property(Node)
    attackSlotParent: Node = null!;

    public queuePositions: Node[] = [];

    public attackSlots: Node[] = [];

    // Vị trí cố định của Staff khi phục vụ khách.
    @property(Node)
    staffCounter: Node = null!;

    // Node cha chứa các vị trí NPC đứng ở quầy, song song 1-1 với Queue Positions
    // (NPC ở ô hàng thứ mấy thì bước sang đúng vị trí thứ đó, không phải đi xa tới 1 điểm chung).
    @property(Node)
    npcCounterParent: Node = null!;

    public npcCounterPositions: Node[] = [];

    public coins = 0;

    //0 locked
    //1 pistol
    //2 AK
    //3 Store
    public unlockLevel = 1;

    public activeUnits: UnitController[] = [];

    onLoad() {

        GameManager.Instance = this;

        if (this.queueSlotParent)
            this.queuePositions = this.queueSlotParent.children.slice();

        if (this.attackSlotParent)
            this.attackSlots = this.attackSlotParent.children.slice();

        if (this.npcCounterParent)
            this.npcCounterPositions = this.npcCounterParent.children.slice();

    }

    start() {

        this.updateCoinUI();

        for (let i = 0; i < 4; i++) {

            this.scheduleOnce(() => {

                this.trySpawnNPC();

            }, i * 0.35);

        }

    }

    updateCoinUI() {

        if (this.coinLabel)
            this.coinLabel.string = this.coins.toString();

    }

    addCoin(amount: number) {

        this.coins += amount;

        this.updateCoinUI();

    }

    spendCoin(amount: number): boolean {

        if (this.coins < amount)
            return false;

        this.coins -= amount;

        this.updateCoinUI();

        return true;

    }

    registerUnit(unit: UnitController) {

        if (this.activeUnits.indexOf(unit) == -1)
            this.activeUnits.push(unit);

        this.refreshQueue();

    }

    removeUnit(unit: UnitController) {

        let index = this.activeUnits.indexOf(unit);

        if (index != -1)
            this.activeUnits.splice(index, 1);

        this.refreshQueue();

    }

    // Queue chỉ quản lý NPC đang đi vào hàng hoặc đang đứng trong hàng.
    // Một khi Player gọi phục vụ, NPC đổi state và rời khỏi danh sách này ngay.
    getQueueUnits() {

        return this.activeUnits.filter(u =>

            u.state == "walking" ||
            u.state == "queue"

        );

    }

    // Chỉ gọi khi: spawn NPC, NPC rời queue, NPC chết. Không gọi trong update/tween callback.
    refreshQueue() {

        const queue = this.getQueueUnits();

        queue.forEach((u, i) => u.refreshQueue(i));

    }

    trySpawnNPC() {

        let queue = this.getQueueUnits();

        if (queue.length >= 4)
            return;

        if (this.activeUnits.length >= 8)
            return;

        let npc = instantiate(this.unitPrefab);

        npc.parent = this.node.parent;

        npc.setWorldPosition(this.spawnPoint.worldPosition);

    }

    //---------------------------------------

    public unlockAK() {

        if (this.unlockLevel >= 2)
            return;

        if (!this.spendCoin(50))
            return;

        this.unlockLevel = 2;

        console.log("AK unlocked");

    }

    public unlockStore() {

        if (this.unlockLevel >= 3)
            return;

        if (!this.spendCoin(150))
            return;

        this.unlockLevel = 3;

        console.log("Store unlocked");

    }

}
