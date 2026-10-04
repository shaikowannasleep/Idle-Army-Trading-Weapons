import {
    _decorator,
    Component,
    Node,
    Vec3,
    tween,
    Camera,
    Label
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('TutorialHand')
export class TutorialHand extends Component {

    public static Instance: TutorialHand | null = null;

    @property(Camera)
    public mainCamera: Camera = null!;

    @property(Node)
    public hookBannerNode: Node = null!;

    @property(Label)
    public hookLabel: Label = null!;

    @property(Node)
    public handNode: Node = null!;

    @property(Node)
    public rippleNode: Node = null!;

    @property
    public defaultHookText: string = "✨ TAP TO OPEN BLIND BOX!";

    @property
    public tapSpeed: number = 0.38;

    private targetNode: Node | null = null;
    private targetWorldPos: Vec3 = new Vec3();
    private isShowing = false;
    private animTween: any = null;
    private rippleTween: any = null;
    private bannerTween: any = null;

    onLoad() {
        TutorialHand.Instance = this;
        this.node.active = false;
    }

    /**
     * Point at target node or world position with zoom/scale pulse animation and custom hook text
     */
    public show(target: Node | Vec3, hookText: string = '✨ TAP TO OPEN BLIND BOX!') {
        let targetName = "Vec3Pos";
        if (target instanceof Node) {
            if (!target.isValid) return;
            this.targetNode = target;
            this.targetWorldPos.set(target.worldPosition);
            targetName = target.name;
        } else {
            this.targetNode = null;
            this.targetWorldPos.set(target);
        }

        if (this.hookLabel && this.hookLabel.isValid) {
            this.hookLabel.string = hookText;
        }

        this.node.active = true;
        this.isShowing = true;
        this.updatePosition();

        const curPos = this.node.position;
        console.log(`👉 [TutorialHand] show() on [${targetName}] | UIPos: (${curPos.x.toFixed(1)}, ${curPos.y.toFixed(1)})`);

        // Floating hook banner bounce & gentle pulse
        if (this.hookBannerNode && this.hookBannerNode.isValid) {
            if (this.bannerTween) this.bannerTween.stop();
            this.hookBannerNode.setScale(new Vec3(0, 0, 0));
            this.bannerTween = tween(this.hookBannerNode)
                .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .then(
                    tween(this.hookBannerNode)
                        .to(0.5, { scale: new Vec3(1.08, 1.08, 1.08), position: new Vec3(0, 66, 0) }, { easing: 'sineInOut' })
                        .to(0.5, { scale: new Vec3(1.0, 1.0, 1.0), position: new Vec3(0, 58, 0) }, { easing: 'sineInOut' })
                        .union()
                        .repeatForever()
                )
                .start();
        }

        // Scale & tap bounce loop for hand pointer
        if (this.animTween) this.animTween.stop();
        if (this.handNode && this.handNode.isValid) {
            this.handNode.setScale(new Vec3(1, 1, 1));
            this.animTween = tween(this.handNode)
                .to(this.tapSpeed, { scale: new Vec3(0.75, 0.75, 0.75), position: new Vec3(15, -15, 0) }, { easing: 'sineOut' })
                .to(this.tapSpeed, { scale: new Vec3(1.22, 1.22, 1.22), position: new Vec3(35, -35, 0) }, { easing: 'sineIn' })
                .union()
                .repeatForever()
                .start();
        }

        // Ripple pulse loop
        if (this.rippleNode && this.rippleNode.isValid) {
            if (this.rippleTween) this.rippleTween.stop();
            this.rippleNode.setScale(new Vec3(0.3, 0.3, 0.3));
            this.rippleTween = tween(this.rippleNode)
                .to(0.76, { scale: new Vec3(1.6, 1.6, 1.6) })
                .call(() => {
                    if (this.rippleNode && this.rippleNode.isValid) {
                        this.rippleNode.setScale(new Vec3(0.3, 0.3, 0.3));
                    }
                })
                .union()
                .repeatForever()
                .start();
        }
    }

    /**
     * Hide tutorial hand
     */
    public hide() {
        if (!this.isShowing) return;
        this.isShowing = false;
        this.targetNode = null;

        if (this.animTween) {
            this.animTween.stop();
            this.animTween = null;
        }
        if (this.rippleTween) {
            this.rippleTween.stop();
            this.rippleTween = null;
        }
        if (this.bannerTween) {
            this.bannerTween.stop();
            this.bannerTween = null;
        }

        tween(this.node)
            .to(0.15, { scale: new Vec3(0, 0, 0) })
            .call(() => {
                if (this.node && this.node.isValid) {
                    this.node.active = false;
                    this.node.setScale(new Vec3(1, 1, 1));
                }
            })
            .start();
    }

    lateUpdate() {
        if (this.isShowing) {
            if (this.targetNode && this.targetNode.isValid) {
                if (!this.targetNode.active) {
                    this.hide();
                    return;
                }
                this.targetWorldPos.set(this.targetNode.worldPosition);
            }
            this.updatePosition();
        }
    }

    private updatePosition() {
        if (!this.mainCamera) return;
        const parentNode = this.node.parent;
        if (!parentNode) return;

        const uiPos = new Vec3();
        const pointWorldPos = this.targetWorldPos.clone().add3f(0, 0.6, 0);
        this.mainCamera.convertToUINode(pointWorldPos, parentNode, uiPos);
        this.node.setPosition(uiPos.x, uiPos.y, 0);
    }
}
