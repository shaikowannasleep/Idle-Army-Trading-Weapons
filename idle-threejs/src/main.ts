import './ui/style.css';
import { Engine } from './core/Engine';
import { loadAssets } from './core/assets';
import { Audio } from './core/Audio';
import { Input } from './core/Input';
import { Hud } from './ui/Hud';
import { Game } from './game/Game';
import { DevTools } from './core/DevTools';
import { PlayableAdsSDK, PlayableEvent } from './tracking/PlayableAdsSDK';

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

  const game = new Game(engine, assets, audio, hud, input);
  await game.warmup();
  sdk.logEvent(PlayableEvent.LOADED);

  sdk.init((hidden) => {
    engine.setHidden(hidden);
    audio.suspend(hidden);
  });
  game.reset();
  engine.start((dt) => game.update(dt));
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

boot().catch((e) => {
  console.error(e);
  const ui = document.getElementById('ui');
  if (ui) ui.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:auto 0 20px;text-align:center;color:#f88">${String(e)}</div>`);
});
