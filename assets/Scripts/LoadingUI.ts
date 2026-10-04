import {
    _decorator,
    Component,
    Node,
    Vec3,
    tween,
    Camera,
    UITransform,
    Label
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('LoadingUI')
export class LoadingUI extends Component {

    public static Instance: LoadingUI | null = null;

    @property(Camera)
    public mainCamera: Camera = null!;

    @property(Node)
    public bgNode: Node = null!;

    @property(Node)
    public spinnerIcon: Node = null!;

    @property(Label)
    public statusLabel: Label = null!;

    @property(UITransform)
    public barFillTransform: UITransform = null!;

    @property
    public spinSpeed: number = 0.7;

    @property
    public defaultStatusText: string = "Reloading...";

    @property
    public maxBarWidth: number = 116;

    private isShowing = false;
    private spinnerTween: any = null;
    private progressTween: any = null;
    private targetWorldPos: Vec3 = new Vec3();

    onLoad() {
        LoadingUI.Instance = this;
        this.node.active = false;
    }

    /**
     * Show loading UI at specific world position for given duration
     */
    public show(worldPos: Vec3, duration: number = 1.2, text: string = "Reloading...", onComplete?: () => void) {
        this.targetWorldPos.set(worldPos);
        this.node.active = true;
        this.isShowing = true;

        if (this.statusLabel && this.statusLabel.isValid) {
            this.statusLabel.string = text;
        }

        // Pop in with smooth spring scale
        this.node.setScale(new Vec3(0, 0, 0));
        tween(this.node)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        // 360 degree rotating spinner icon
        if (this.spinnerIcon && this.spinnerIcon.isValid) {
            if (this.spinnerTween) this.spinnerTween.stop();
            this.spinnerIcon.eulerAngles = new Vec3(0, 0, 0);
            this.spinnerTween = tween(this.spinnerIcon)
                .by(this.spinSpeed, { eulerAngles: new Vec3(0, 0, -360) })
                .repeatForever()
                .start();
        }

        // Reset progress bar width
        if (this.barFillTransform && this.barFillTransform.node && this.barFillTransform.node.isValid) {
            this.barFillTransform.setContentSize(0, 12);
        }

        // Master duration & progress fill tween (100% guaranteed to finish and call onComplete)
        const targetWidth = this.maxBarWidth;
        const fillObj = { width: 0 };
        if (this.progressTween) this.progressTween.stop();

        this.progressTween = tween(fillObj)
            .to(duration, { width: targetWidth }, {
                onUpdate: () => {
                    if (this.barFillTransform && this.barFillTransform.node && this.barFillTransform.node.isValid) {
                        this.barFillTransform.setContentSize(fillObj.width, 12);
                    }
                }
            })
            .call(() => {
                this.hide();
                if (onComplete) onComplete();
            })
            .start();

        this.updatePosition();
    }

    /**
     * Hide loading UI with smooth fade out
     */
    public hide() {
        if (!this.isShowing) return;
        this.isShowing = false;

        if (this.spinnerTween) {
            this.spinnerTween.stop();
            this.spinnerTween = null;
        }
        if (this.progressTween) {
            this.progressTween.stop();
            this.progressTween = null;
        }

        tween(this.node)
            .to(0.15, { scale: new Vec3(0, 0, 0) }, { easing: 'backIn' })
            .call(() => {
                if (this.node && this.node.isValid) {
                    this.node.active = false;
                }
            })
            .start();
    }

    lateUpdate() {
        if (this.isShowing) {
            this.updatePosition();
        }
    }

    private updatePosition() {
        if (!this.mainCamera) return;
        const parentNode = this.node.parent;
        if (!parentNode) return;

        const uiPos = new Vec3();
        this.mainCamera.convertToUINode(this.targetWorldPos, parentNode, uiPos);
        this.node.setPosition(uiPos.x, uiPos.y, 0);
    }
}
