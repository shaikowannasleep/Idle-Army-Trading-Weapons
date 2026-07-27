import { _decorator, Component, Node, Vec3, tween } from 'cc';
import { GameManager } from './GameManager';
import { UnitController } from './UnitController';
const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    private state: string = 'idle';
    private targetUnit: UnitController = null;
    private heldWeapon: string = null;

    @property(Node) counterPos: Node = null;
    @property(Node) pistolRackPos: Node = null;
    @property(Node) akRackPos: Node = null;

    update(dt: number) {
        if (GameManager.Instance.unlockLevel === 0) return;

        if (this.state === 'idle') {
            this.findNextCustomer();
        }
    }

    findNextCustomer() {
        let queuedUnits = GameManager.Instance.activeUnits.filter(u => u.state === 'waiting');
        if (queuedUnits.length > 0) {
            this.targetUnit = queuedUnits[0];
            this.targetUnit.state = 'being_asked';
            this.state = 'moving_to_ask';
            
            this.moveTo(this.counterPos.position, 'asking', 1.0); // Tốn 1s để hỏi
        }
    }

    moveTo(targetPos: Vec3, nextState: string, actionDelay: number) {
        tween(this.node.position)
            .to(0.5, targetPos) // Di chuyển mất 0.5s
            .call(() => {
                // Tới nơi thì chạy thanh loading (chờ actionDelay giây)
                this.scheduleOnce(() => {
                    this.state = nextState;
                    this.handleNextState();
                }, actionDelay);
            })
            .start();
    }

    handleNextState() {
        if (this.state === 'asking') {
            // Xác định súng khách muốn dựa trên unlockLevel
            let weaponToCraft = (GameManager.Instance.unlockLevel >= 2) ? 'AK' : 'Pistol';
            this.targetUnit.desiredWeapon = weaponToCraft;
            this.targetUnit.state = 'waiting_weapon';
            
            let rackPos = (weaponToCraft === 'AK') ? this.akRackPos.position : this.pistolRackPos.position;
            this.state = 'moving_to_rack';
            this.moveTo(rackPos, 'crafting', 1.5); // Tốn 1.5s để chế súng
            
        } else if (this.state === 'crafting') {
            this.heldWeapon = this.targetUnit.desiredWeapon;
            this.state = 'moving_to_deliver';
            this.moveTo(this.counterPos.position, 'delivering', 0.2);
            
        } else if (this.state === 'delivering') {
            this.targetUnit.receiveWeapon(this.heldWeapon);
            this.heldWeapon = null;
            this.targetUnit = null;
            this.state = 'idle'; // Quay lại từ đầu vòng lặp
        }
    }
}