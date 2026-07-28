import {
    _decorator,
    Component,
    Vec3,
    Quat,
    Tween,
    tween,
    SkeletalAnimation
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('MovableActor')
export class MovableActor extends Component {

    @property(SkeletalAnimation)
    anim: SkeletalAnimation = null!;

    private currentAnim: string = "";

    private moveTween: Tween<any> = null;

    private static _lookQuat: Quat = new Quat();

    playAnim(name: string) {

        if (!this.anim) return;

        if (this.currentAnim == name) return;

        this.currentAnim = name;

        this.anim.crossFade(name, 0.15);

    }

    // Quay quanh trục Y để nhìn về target. Controller gọi khi cần, moveTo() không tự gọi.
    lookAtTarget(target: Vec3) {

        const pos = this.node.worldPosition;

        const dx = target.x - pos.x;
        const dz = target.z - pos.z;

        if (dx * dx + dz * dz < 0.0001) return;

        const angle = Math.atan2(dx, dz) * 180 / Math.PI;

        Quat.fromEuler(MovableActor._lookQuat, 0, angle, 0);

        this.node.setWorldRotation(MovableActor._lookQuat);

    }

    // Chỉ làm đúng 1 việc: dừng tween cũ, tween đến target, gọi callback. Không rotation.
    moveTo(target: Vec3, duration: number, onComplete?: () => void) {

        if (this.moveTween) {
            this.moveTween.stop();
            this.moveTween = null;
        }

        this.playAnim("Move");

        this.moveTween = tween(this.node)
            .to(duration, { worldPosition: target })
            .call(() => {

                this.moveTween = null;

                this.playAnim("Idle");

                if (onComplete) onComplete();

            })
            .start();

    }

}
