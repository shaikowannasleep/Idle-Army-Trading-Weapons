// 2. CounterSlotData.ts
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CounterSlotData')
export class CounterSlotData extends Component {
    @property
    public slotID: number = 0;

    @property(Node)
    public staffPos: Node = null!;

    @property(Node)
    public npcPos: Node = null!;
}