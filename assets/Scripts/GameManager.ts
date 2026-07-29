import {
    _decorator,
    Component,
    Label,
    Prefab,
    instantiate,
    Node,
    input,
    Input,
    EventTouch
} from 'cc';

import { UnitController } from './UnitController';
import { QueueSlotData } from './QueueSlotData';
import { CounterSlotData } from './CounterSlotData';
import { SlotData } from './SlotData';
import super_html_playable from '../folder/super_html_playable';

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
    boxPistol: Node = null!;
       @property(Node)
    itemPistol: Node = null!;

        @property(Node)
    boxAK: Node = null!;
       @property(Node)
    itemAK: Node = null!;


    @property([QueueSlotData])
    public queueSlots: QueueSlotData[] = [];

    @property([CounterSlotData])
    public counterSlots: CounterSlotData[] = [];

    @property([SlotData])
    public attackSlots: SlotData[] = [];

    public coins = 0;
    public unlockLevel = 0;
    public activeUnits: UnitController[] = [];

    
     
    onLoad() {
        GameManager.Instance = this;
        super_html_playable.set_google_play_url("https://play.google.com/store/apps/details?id=com.unimob.idle.army");
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
         input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onTouchStart(event: EventTouch) {
        const pos = event.getUILocation();
        console.log(`[Touch] Cham man hinh tai: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
        
    
    }
    onTouchEnd(event: EventTouch) { 
        if (this.unlockLevel < 1) {
            this.unlockLevel = 1;
            this.boxPistol.active = false;
            this.itemPistol.active = true;
            return;
        }
        
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
        if (this.coins < amount) return false;
        this.coins -= amount;
        this.updateCoinUI();
        return true;
        
    }

    registerUnit(unit: UnitController) {
        if (this.activeUnits.indexOf(unit) == -1)
            this.activeUnits.push(unit);
    }

    removeUnit(unit: UnitController) {
        let index = this.activeUnits.indexOf(unit);
        if (index != -1)
            this.activeUnits.splice(index, 1);
    }

    findEmptyQueueSlot(): QueueSlotData | null {
        for (let i = 0; i < this.queueSlots.length; i++) {
            if (!this.queueSlots[i].npc) {
                return this.queueSlots[i];
            }
        }
        return null;
    }

    trySpawnNPC() {
        if (this.activeUnits.length >= 8) return;

        let emptySlot = this.findEmptyQueueSlot();
        if (!emptySlot) return; 

        let npcNode = instantiate(this.unitPrefab);
        npcNode.parent = this.node.parent;
        npcNode.setWorldPosition(this.spawnPoint.worldPosition);

        let npc = npcNode.getComponent(UnitController);
        if (npc) {
            emptySlot.npc = npc;
            npc.queueSlot = emptySlot;
        }
    }

    public unlockAK() {
        if (this.unlockLevel >= 2) return;
        if (!this.spendCoin(50)) return;
        this.unlockLevel = 2;
    }

    public unlockStore() {
        if (this.unlockLevel >= 3) return;
        this.unlockLevel = 3;
        super_html_playable.game_end();
        super_html_playable.download();
    }
}