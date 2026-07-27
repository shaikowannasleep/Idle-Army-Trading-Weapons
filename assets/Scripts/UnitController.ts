import { _decorator, Component, Node, Vec3, tween } from 'cc';
import { GameManager } from './GameManager';
import { BossController } from './BossController';
import { SlotData } from './SlotData'; // Thêm dòng import này
const { ccclass, property } = _decorator;

@ccclass('UnitController')
export class UnitController extends Component {
    public state: string = 'walking_in';
    public desiredWeapon: string = 'Pistol';
    
    private hp: number = 60;
    private attackCooldown: number = 0;
    public assignedSlotNode: Node = null;

    update(dt: number) {
        // Tự động tìm vị trí trong hàng đợi
        if (this.state === 'walking_in' || this.state === 'waiting') {
            this.updateQueuePosition();
        }

        // Logic bắn quái
        if (this.state === 'attacking') {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                let dmg = (this.desiredWeapon === 'AK') ? 8 : 2;
                BossController.Instance.takeDamage(dmg);
                this.attackCooldown = (this.desiredWeapon === 'AK') ? 0.16 : 0.5; // Tốc độ bắn
            }
        }
    }

    updateQueuePosition() {
        let queuedUnits = GameManager.Instance.activeUnits.filter(u => 
            u.state === 'walking_in' || u.state === 'waiting' || u.state === 'being_asked' || u.state === 'waiting_weapon'
        );
        let myIndex = queuedUnits.indexOf(this);
        
        if (myIndex !== -1 && myIndex < GameManager.Instance.queuePositions.length) {
            let targetPos = GameManager.Instance.queuePositions[myIndex].position;
            // Dùng lerp để di chuyển mượt mà về vị trí xếp hàng
            Vec3.lerp(this.node.position, this.node.position, targetPos, 0.1);
            this.node.setPosition(this.node.position);
            
            if (Vec3.distance(this.node.position, targetPos) < 1.0 && this.state === 'walking_in') {
                this.state = 'waiting';
            }
        }
    }

    receiveWeapon(weaponType: string) {
        this.state = 'leveling_up';
        this.desiredWeapon = weaponType;
        
        // Cộng tiền cho Player
        let reward = (weaponType === 'AK') ? 30 : 10;
        GameManager.Instance.addCoin(reward);

        // Chạy VFX thăng cấp ở đây, sau đó gọi hàm moveToAttackSlot
        this.scheduleOnce(this.moveToAttackSlot, 1.0); // Giả lập chờ 1 giây nâng cấp
    }

    moveToAttackSlot() {
        this.state = 'moving_to_attack';
        
        // Tìm Slot chưa có người đứng
        for (let slot of GameManager.Instance.attackSlots) {
            let slotData = slot.getComponent(SlotData); // Ép kiểu an toàn bằng class SlotData
            if (slotData && !slotData.isOccupied) {
                this.assignedSlotNode = slot;
                slotData.isOccupied = true; // TypeScript sẽ nhận diện được biến này
                break;
            }
        }

        if (this.assignedSlotNode) {
            tween(this.node.position)
                .to(1.0, this.assignedSlotNode.position)
                .call(() => { this.state = 'attacking'; })
                .start();
        }
    }

    takeDamage(amount: number) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        // Xóa khỏi danh sách quản lý
        let index = GameManager.Instance.activeUnits.indexOf(this);
        if (index !== -1) GameManager.Instance.activeUnits.splice(index, 1);
        
        // Giải phóng Slot
        if (this.assignedSlotNode) {
            let slotData = this.assignedSlotNode.getComponent(SlotData);
            if (slotData) {
                slotData.isOccupied = false;
            }
        }

        BossController.Instance.healOnKill();
        this.node.destroy();
    }
}