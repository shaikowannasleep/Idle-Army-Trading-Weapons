import { _decorator, Component, ProgressBar, Camera, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WorldHPBar')
export class WorldHPBar extends Component {
    @property(Node) 
    targetPoint: Node = null!; // Kéo thả cục Cube trắng (HpPoint) vào đây

    @property(Camera) 
    mainCamera: Camera = null!; 

    private progressBar: ProgressBar = null!;
    private _uiPos: Vec3 = new Vec3(); // Biến tạm để lưu tọa độ 2D, tránh rác bộ nhớ

    start() {
        this.progressBar = this.getComponent(ProgressBar)!;
               this.mainCamera.convertToUINode(
            this.targetPoint.worldPosition, // Tọa độ 3D gốc
            this.node.parent,               // Node cha chứa thanh máu (để lấy hệ trục local)
            this._uiPos                     // Lưu kết quả vào biến _uiPos
        );
        
        // Gán tọa độ 2D vừa quy đổi cho thanh máu
        this.node.setPosition(this._uiPos);
    }

    update(dt: number) {
        // Nếu thiếu Camera, thiếu Cục Cube, hoặc thanh máu không nằm trong UI, thì dừng lại
        if (!this.mainCamera || !this.targetPoint || !this.node.parent) return;

        
        this.mainCamera.convertToUINode(
            this.targetPoint.worldPosition, // Tọa độ 3D gốc
            this.node.parent,               // Node cha chứa thanh máu (để lấy hệ trục local)
            this._uiPos                     // Lưu kết quả vào biến _uiPos
        );

        // Gán tọa độ 2D vừa quy đổi cho thanh máu
        this.node.setPosition(this._uiPos);
    }

    // Hàm gọi để update máu (từ BossController)
    public updateHP(currentHP: number, maxHP: number) {
        if (this.progressBar) {
            this.progressBar.progress = Math.max(0, currentHP / maxHP);
        }
    }
}