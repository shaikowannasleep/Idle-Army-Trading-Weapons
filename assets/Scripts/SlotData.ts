import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SlotData')
export class SlotData extends Component {
    public isOccupied: boolean = false;
}