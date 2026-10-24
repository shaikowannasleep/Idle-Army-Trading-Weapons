import './ui/style.css';
import { Engine } from './core/Engine';
import { loadAssets } from './core/assets';
import { Audio } from './core/Audio';
import { Input } from './core/Input';
import { Hud } from './ui/Hud';
import { Game } from './game/Game';
import { DevTools } from './core/DevTools';
import { PlayableAdsSDK, PlayableEvent } from './tracking/PlayableAdsSDK';
import { Arcade } from './arcade/Arcade';

async function boot(): Promise<void> {
  const sdk = PlayableAdsSDK.instance;
  sdk.logEvent(PlayableEvent.LOADING);

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const hud = new Hud(ui);
  const engine = new Engine(canvas);
  const audio = new Audio();
  if (Engine.params.get('audio') === '0') audio.disabled = true;
  const input = new Input(canvas, ui);

  let assetP = 0;
  let audioP = 0;
  const progress = () => hud.setLoading(assetP * 0.85 + audioP * 0.15);
  const [assets] = await Promise.all([
    loadAssets(engine.renderer, (p) => {
      assetP = p;
      progress();
    }),
    audio.preload().then(() => {
      audioP = 1;
      progress();
    }),
  ]);

  // the arcade (3 mini games) is the default; ?game=armory or a bare ?capture keeps the original idle game
  const g = Engine.params.get('game');
  if (g ? g !== 'armory' : !Engine.params.has('capture')) return bootArcade(engine, assets, audio, hud, input, sdk);

  const game = new Game(engine, assets, audio, hud, input);
  await game.warmup();
  sdk.logEvent(PlayableEvent.LOADED);

  sdk.init((hidden) => {
    engine.setHidden(hidden);
    audio.suspend(hidden);
  });
  game.reset();
  if (Engine.params.has('capture')) {
    // tools/trailer.mjs steps the sim by hand so every video frame is deterministic
    (window as unknown as Record<string, unknown>).__step = (dt: number) => {
      game.update(dt);
      engine.renderer.shadowMap.needsUpdate = true;
      engine.renderer.render(engine.scene, engine.camera);
      // DOM/CSS animations run on the wall clock: advance them by the same dt
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = Number(a.currentTime ?? 0) + dt * 1000;
      }
    };
  } else engine.start((dt) => game.update(dt));
  hud.setLoading(1);
  hud.hideLoading();
  new DevTools(engine, game);
  sdk.gameReady();
  sdk.logEvent(PlayableEvent.DISPLAYED);

  // perf probe for tools/perf.mjs
  (window as unknown as Record<string, unknown>).__perf = () => ({
    frameMs: engine.frameMs,
    dpr: engine.pixelRatio,
    calls: engine.renderer.info.render.calls,
    tris: engine.renderer.info.render.triangles,
    geos: engine.renderer.info.memory.geometries,
    textures: engine.renderer.info.memory.textures,
  });
  (window as unknown as Record<string, unknown>).__game = game.debugApi();
  (window as unknown as Record<string, unknown>).__ready = true;
}

async function bootArcade(engine: Engine, assets: Awaited<ReturnType<typeof loadAssets>>, audio: Audio, hud: Hud, input: Input, sdk: PlayableAdsSDK): Promise<void> {
  input.enabled = false;
  hud.root.classList.add('arcade-boot');
  const arcade = new Arcade(engine, assets, audio, document.getElementById('ui') as HTMLElement);
  await arcade.warmup();
  sdk.logEvent(PlayableEvent.LOADED);
  sdk.init((hidden) => {
    engine.setHidden(hidden);
    audio.suspend(hidden);
  });
  const w = window as unknown as Record<string, unknown>;
  if (Engine.params.has('capture')) {
    arcade.capture = true;
    w.__step = (dt: number) => {
      arcade.update(dt);
      engine.renderer.shadowMap.needsUpdate = true;
      engine.renderer.render(engine.scene, engine.camera);
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = Number(a.currentTime ?? 0) + dt * 1000;
      }
    };
  } else engine.start((dt) => arcade.update(dt));
  hud.setLoading(1);
  hud.hideLoading();
  sdk.gameReady();
  sdk.logEvent(PlayableEvent.DISPLAYED);
  w.__perf = () => ({
    frameMs: engine.frameMs,
    dpr: engine.pixelRatio,
    calls: engine.renderer.info.render.calls,
    tris: engine.renderer.info.render.triangles,
    geos: engine.renderer.info.memory.geometries,
    textures: engine.renderer.info.memory.textures,
  });
  w.__arcade = arcade.debugApi();
  w.__ready = true;
}

boot().catch((e) => {
  console.error(e);
  const ui = document.getElementById('ui');
  if (ui) ui.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:auto 0 20px;text-align:center;color:#f88">${String(e)}</div>`);
});
