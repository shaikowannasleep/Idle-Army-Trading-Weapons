import { _decorator, Component, ProgressBar, Camera, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WorldHPBar')
export class WorldHPBar extends Component {
    @property(Node)
    targetPoint: Node = null!;

    @property(Camera)
    mainCamera: Camera = null!;

    private progressBar: ProgressBar = null!;
    private _uiPos: Vec3 = new Vec3();

    start() {
        this.progressBar = this.getComponent(ProgressBar)!;
    }

    update(dt: number) {

    }

    // Update the HP bar fill amount
    public updateHP(currentHP: number, maxHP: number) {
        if (this.progressBar) {
            this.progressBar.progress = Math.max(0, currentHP / maxHP);
        }
    }
}