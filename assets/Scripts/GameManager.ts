import { _decorator, Component, Node, Label, Prefab, instantiate, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    public static Instance: GameManager;

    @property(Label) coinLabel: Label = null;
    @property(Prefab) unitPrefab: Prefab = null;
    @property(Node) spawnPoint: Node = null;
    
    // Kéo thả các Node đánh dấu vị trí vào đây trên Editor
    @property([Node]) queuePositions: Node[] = []; 
    @property([Node]) attackSlots: Node[] = [];

    public coins: number = 0;
    public unlockLevel: number = 0;
    public activeUnits: any[] = []; 

    onLoad() {
        if (!GameManager.Instance) {
            GameManager.Instance = this;
        }
    }

    start() {
        // Khởi tạo kiểm tra đẻ NPC mỗi giây
        this.schedule(this.checkAndSpawnNPC, 1.0);
        
    }

    addCoin(amount: number) {
        this.coins += amount;
        if (this.coinLabel) {
            this.coinLabel.string = this.coins.toString();
        }
    }

    checkAndSpawnNPC() {
        // Đếm số người đang ở trong hàng đợi
        let queueCount = this.activeUnits.filter(u => 
            u.state === 'walking_in' || u.state === 'waiting'
        ).length;

        // Giới hạn max 8 unit trên map và max 4 trong hàng đợi
        if (this.activeUnits.length < 8 && queueCount < 4) {
            let newUnit = instantiate(this.unitPrefab);
            newUnit.setParent(this.node.parent); // Đặt vào Scene
            newUnit.setPosition(this.spawnPoint.position);
            
            // Lấy script UnitController và thêm vào danh sách quản lý
            let unitScript = newUnit.getComponent('UnitController');
            if (unitScript) {
                this.activeUnits.push(unitScript);
            }
        }
    }

    // Nút Hộp Vàng sẽ gọi hàm này
    public onUpgradeButtonClicked() {
        if (this.unlockLevel === 0) {
            this.unlockLevel = 1; // Mở Lục
        } else if (this.unlockLevel === 1 && this.coins >= 50) {
            this.coins -= 50;
            this.addCoin(0); // Update UI
            this.unlockLevel = 2; // Mở AK
        } else if (this.unlockLevel === 2 && this.coins >= 150) {
            this.coins -= 150;
            this.addCoin(0);
            this.unlockLevel = 3; // Mở Store
            // Bật UI Store ở đây
        }
    }
}