//[cite: 1, 2, 3, 4, 5, 6]

// 1. QueueSlotData.ts
import { _decorator, Component } from 'cc';
import { UnitController } from './UnitController';
const { ccclass, property } = _decorator;

@ccclass('QueueSlotData')
export class QueueSlotData extends Component {
    @property
    public slotID: number = 0;
    
    public npc: UnitController | null = null;
}