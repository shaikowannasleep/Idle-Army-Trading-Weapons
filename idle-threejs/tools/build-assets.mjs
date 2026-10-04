// Optimizes Blender-exported GLBs (raw/) into runtime assets (public/assets/models)
// and copies the reused audio / UI images from the Cocos project.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, resample, reorder, weld, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.resolve(ROOT, '../assets');
const OUT = path.join(ROOT, 'src/assets');

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const DROP_NODES = { customer: ['Icosphere'] };

for (const file of fs.readdirSync(path.join(ROOT, 'raw')).filter((f) => f.endsWith('.glb'))) {
  const name = file.replace('.glb', '');
  const doc = await io.read(path.join(ROOT, 'raw', file));
  for (const n of doc.getRoot().listNodes()) {
    if ((DROP_NODES[name] || []).includes(n.getName())) n.dispose();
  }
  // No position quantization: runtime code builds extra weapons in the rifle's bind space.
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    resample(),
    reorder({ encoder: MeshoptEncoder }),
    // lossless WebP keeps palette atlases exact while shrinking them ~40%
    textureCompress({ encoder: sharp, targetFormat: 'webp', lossless: true, effort: 100 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(path.join(OUT, 'models', file), doc);
  const r = doc.getRoot();
  console.log(name.padEnd(9), (fs.statSync(path.join(OUT, 'models', file)).size / 1024).toFixed(0) + 'KB',
    'anims:', r.listAnimations().map((a) => a.getName()).join(','),
    '| meshes:', r.listMeshes().map((m) => m.getName()).join(','));
}

const copy = (src, dst) => fs.copyFileSync(path.join(ASSETS, src), path.join(OUT, dst));
for (const s of ['coin', 'death', 'sound-receive-coin', 'click1', 'Coin_Tip', 'gun1', 'bgM', 'finish_order'])
  copy(`folder/sound/${s}.mp3`, `sfx/${s}.mp3`);
const UI = {
  'resources/asset/UI/Coin.png': 'coin.png',
  'resources/asset/UI/hand1.png': 'hand.png',
  'resources/asset/UI/Reward_Back_Shine.png': 'shine.png',
  'Newtex/logo.png': 'logo.png',
  '_unused/resources/asset/UI/2.png': 'icon_pistol.png',
  '_unused/resources/asset/UI/3.png': 'icon_rifle.png',
  '_unused/resources/asset/UI/Upgrade.png': 'upgrade.png',
  '_unused/resources/asset/Par/Smoke/cloud_2x2_hard_softshadow.png': 'smoke.png',
};
for (const [s, d] of Object.entries(UI)) copy(s, `ui/${d}`);

// Character skin atlases (same UV layout): civilian A, soldier camo. Civilian B ships inside customer.glb.
import { execFileSync } from 'node:child_process';
const SKINS = {
  '_unused/resources/asset/Map/Characters/Customers/Customers_Male/Textures/TT_Soldiers_texture_A.tga': 'skin_soldier.webp',
  '_unused/Newtex/base1.png': 'skin_civilianA.webp',
};
for (const [s, d] of Object.entries(SKINS)) {
  // sharp cannot read TGA: go through a temporary PNG via macOS sips
  const tmp = path.join(OUT, 'ui', d + '.tmp.png');
  execFileSync('sips', ['-s', 'format', 'png', path.join(ASSETS, s), '--out', tmp], { stdio: 'ignore' });
  await sharp(tmp).webp({ quality: 90, effort: 6 }).toFile(path.join(OUT, 'ui', d));
  fs.unlinkSync(tmp);
}
console.log('assets done');
