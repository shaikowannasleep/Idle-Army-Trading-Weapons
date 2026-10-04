import {
    _decorator,
    Component,
    Node,
    Vec3,
    tween,
    Camera,
    UITransform,
    Sprite,
    SpriteFrame,
    Layers
} from 'cc';

import { SoundManager } from './SoundManager';

const { ccclass, property } = _decorator;

@ccclass('CoinFlyFX')
export class CoinFlyFX extends Component {

    public static Instance: CoinFlyFX | null = null;

    @property(Camera)
    public mainCamera: Camera = null!;

    @property(Node)
    public targetUINode: Node = null!;

    @property(SpriteFrame)
    public coinSpriteFrame: SpriteFrame | null = null!;

    @property([Node])
    public coinPool: Node[] = [];

    @property
    public coinSize: number = 38;

    @property
    public spinSpeed: number = 0.22;

    onLoad() {
        CoinFlyFX.Instance = this;
        this.node.layer = Layers.Enum.UI_2D;

        if (this.coinPool.length === 0) {
            this.coinPool = this.node.children.filter(c => c.name.startsWith('Coin_'));
        }

        for (const coin of this.coinPool) {
            if (coin && coin.isValid) coin.active = false;
        }
    }

    /**
     * Play 2.5D coin flying effect from 3D world position to top-right UI
     */
    public playFly(fromWorldPos: Vec3, coinCount: number = 5, onEachCoin?: () => void, onComplete?: () => void) {
        const cam = this.mainCamera;
        const targetNode = this.targetUINode;
        const canvasNode = this.node.parent;

        if (!cam || !canvasNode) {
            console.warn("⚠️ [CoinFlyFX] Missing camera or canvas for coin fly!");
            if (onComplete) onComplete();
            return;
        }

        // 1. Calculate Start UI Position from 3D World Pos
        const startUIPos = new Vec3();
        const spawnWorldPos = fromWorldPos.clone().add3f(0, 0.8, 0);
        cam.convertToUINode(spawnWorldPos, canvasNode, startUIPos);

        // 2. Calculate Target UI Position accurately in Canvas space
        const targetUIPos = new Vec3();
        if (targetNode && targetNode.isValid) {
            const canvasTransform = canvasNode.getComponent(UITransform);
            if (canvasTransform) {
                canvasTransform.convertToNodeSpaceAR(targetNode.worldPosition, targetUIPos);
            } else {
                targetUIPos.set(targetNode.position);
            }
        } else {
            targetUIPos.set(504, 905, 0);
        }

        console.log(`🪙 [CoinFlyFX 2.5D] Flying ${coinCount} coins: Start(${startUIPos.x.toFixed(1)}, ${startUIPos.y.toFixed(1)}) -> Target(${targetUIPos.x.toFixed(1)}, ${targetUIPos.y.toFixed(1)})`);

        const count = Math.min(coinCount, Math.max(1, this.coinPool.length > 0 ? this.coinPool.length : coinCount));
        let completedCount = 0;

        for (let i = 0; i < count; i++) {
            if (i >= this.coinPool.length || !this.coinPool[i] || !this.coinPool[i].isValid) continue;
            const coinNode = this.coinPool[i];

            coinNode.active = true;
            coinNode.setPosition(startUIPos);
            coinNode.setScale(new Vec3(0, 0, 0));

            let uiTransform = coinNode.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.setContentSize(this.coinSize, this.coinSize);
            }

            let sp = coinNode.getComponent(Sprite);
            if (sp) {
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                if (!sp.spriteFrame && this.coinSpriteFrame && this.coinSpriteFrame.isValid) {
                    sp.spriteFrame = this.coinSpriteFrame;
                }
            }

            // Scatter offset for natural explosion burst
            const angle = (Math.PI * 2 / count) * i + (Math.random() * 0.4 - 0.2);
            const radius = 30 + Math.random() * 35;
            const scatterPos = new Vec3(
                startUIPos.x + Math.cos(angle) * radius,
                startUIPos.y + Math.sin(angle) * radius,
                0
            );

            // Arc control point for curved flight path
            const midX = (scatterPos.x + targetUIPos.x) * 0.5 + (Math.random() * 80 - 40);
            const midY = (scatterPos.y + targetUIPos.y) * 0.5 + 70 + Math.random() * 50;
            const controlPoint = new Vec3(midX, midY, 0);

            const delay = i * 0.05;

            // 2.5D Coin Spin Loop (scaleX flips smoothly to fake 3D rotation)
            const spinAnim = { scaleX: 1.0 };
            const spinTween = tween(spinAnim)
                .to(this.spinSpeed * 0.5, { scaleX: 0.15 }, {
                    onUpdate: () => {
                        if (coinNode && coinNode.isValid) {
                            const curScale = coinNode.scale;
                            coinNode.setScale(new Vec3(spinAnim.scaleX * Math.abs(curScale.y), curScale.y, curScale.z));
                        }
                    }
                })
                .to(this.spinSpeed * 0.5, { scaleX: 1.0 }, {
                    onUpdate: () => {
                        if (coinNode && coinNode.isValid) {
                            const curScale = coinNode.scale;
                            coinNode.setScale(new Vec3(spinAnim.scaleX * Math.abs(curScale.y), curScale.y, curScale.z));
                        }
                    }
                })
                .union()
                .repeatForever();

            // Phase 1: Burst scatter pop out
            tween(coinNode)
                .delay(delay)
                .call(() => spinTween.start())
                .to(0.16, { scale: new Vec3(1.15, 1.15, 1.15), position: scatterPos }, { easing: 'quadOut' })
                .to(0.06, { scale: new Vec3(1.0, 1.0, 1.0) })
                // Phase 2: Curved bezier flight to UI target
                .to(0.38, {
                    scale: new Vec3(0.85, 0.85, 0.85),
                    position: targetUIPos
                }, {
                    easing: 'sineIn',
                    onUpdate: (target: Node, ratio: number) => {
                        if (!coinNode || !coinNode.isValid) return;
                        const t = ratio;
                        const invT = 1 - t;
                        const bx = invT * invT * scatterPos.x + 2 * invT * t * controlPoint.x + t * t * targetUIPos.x;
                        const by = invT * invT * scatterPos.y + 2 * invT * t * controlPoint.y + t * t * targetUIPos.y;
                        coinNode.setPosition(bx, by, 0);
                    }
                })
                .call(() => {
                    spinTween.stop();

                    // Arrival punch scale on Coin UI panel
                    if (targetNode && targetNode.isValid) {
                        tween(targetNode)
                            .to(0.06, { scale: new Vec3(1.22, 1.22, 1.22) }, { easing: 'quadOut' })
                            .to(0.1, { scale: new Vec3(1.0, 1.0, 1.0) }, { easing: 'quadIn' })
                            .start();
                    }

                    SoundManager.Instance?.playCoinReceive();

                    if (onEachCoin) onEachCoin();

                    if (coinNode && coinNode.isValid) {
                        coinNode.active = false;
                        coinNode.setScale(new Vec3(1, 1, 1));
                    }

                    completedCount++;
                    if (completedCount >= count) {
                        if (onComplete) onComplete();
                    }
                })
                .start();
        }
    }
}
