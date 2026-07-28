import { _decorator, Component, ProgressBar, Camera, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WorldHPBar')
export class WorldHPBar extends Component {
    private mainCamera: Camera = null!;
    private progressBar: ProgressBar = null!;

    start() {
        // Lấy Component ProgressBar đã gắn cùng Node
        this.progressBar = this.getComponent(ProgressBar)!;

        // Tự động tìm Main Camera của môi trường 3D
        const cameraNode = director.getScene()?.getChildByName('Main Camera');
        if (cameraNode) {
            this.mainCamera = cameraNode.getComponent(Camera)!;
        }
    }

    update(dt: number) {
        // Kỹ thuật Billboard: Ép thanh máu luôn song song với màn hình
        if (this.mainCamera) {
            this.node.setWorldRotation(this.mainCamera.node.worldRotation);
        }
    }

    // Hàm gọi để update máu (từ BossController hoặc UnitController)
    public updateHP(currentHP: number, maxHP: number) {
        if (this.progressBar) {
            this.progressBar.progress = Math.max(0, currentHP / maxHP);
        }
    }
}