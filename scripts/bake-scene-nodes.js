/**
 * 🛠️ STANDALONE SCENE BAKER SCRIPT (scripts/bake-scene-nodes.js)
 * 
 * Khởi tạo tĩnh 100% các node hiệu ứng và UI bong bóng suy nghĩ (ThoughtBubble)
 * trực tiếp vào `assets/scene.scene` với 0 GC runtime.
 */

const fs = require('fs');
const path = require('path');

const SCENE_PATH = path.resolve(__dirname, '../assets/scene.scene');
console.log('🚀 [SceneBaker] Loading scene:', SCENE_PATH);
const sceneData = JSON.parse(fs.readFileSync(SCENE_PATH, 'utf8'));

// Find Canvas Node & GameManager
let canvasNodeIdx = -1;
let gameManagerCompIdx = -1;

sceneData.forEach((item, idx) => {
    if (!item) return;
    if (item.__type__ === 'cc.Node' && item._name === 'Canvas') {
        canvasNodeIdx = idx;
    }
    if (item.__type__ === 'b77cb2NmOtCAbi0ADeiWnJ6' || (item.__type__ && item.__type__.includes('GameManager'))) {
        gameManagerCompIdx = idx;
    }
});

console.log(`📍 Canvas: [${canvasNodeIdx}], GameManager: [${gameManagerCompIdx}]`);

function addNode(name, parentIdx, pos = { x: 0, y: 0, z: 0 }, rot = { x: 0, y: 0, z: 0, w: 1 }, scale = { x: 1, y: 1, z: 1 }, layer = 33554432) {
    const nodeIdx = sceneData.length;
    const nodeObj = {
        "__type__": "cc.Node",
        "_name": name,
        "_objFlags": 0,
        "_parent": { "__id__": parentIdx },
        "_children": [],
        "_active": false,
        "_components": [],
        "_prefab": null,
        "_lpos": { "__type__": "cc.Vec3", "x": pos.x, "y": pos.y, "z": pos.z },
        "_lrot": { "__type__": "cc.Quat", "x": rot.x, "y": rot.y, "z": rot.z, "w": rot.w },
        "_lscale": { "__type__": "cc.Vec3", "x": scale.x, "y": scale.y, "z": scale.z },
        "_mobility": 0,
        "_layer": layer,
        "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 }
    };
    sceneData.push(nodeObj);
    sceneData[parentIdx]._children.push({ "__id__": nodeIdx });
    return nodeIdx;
}

function addUITransform(nodeIdx, width = 100, height = 100) {
    const compIdx = sceneData.length;
    const compObj = {
        "__type__": "cc.UITransform",
        "_name": "",
        "_objFlags": 0,
        "node": { "__id__": nodeIdx },
        "_enabled": true,
        "__prefab": null,
        "_contentSize": { "__type__": "cc.Size", "width": width, "height": height },
        "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 }
    };
    sceneData.push(compObj);
    sceneData[nodeIdx]._components.push({ "__id__": compIdx });
    return compIdx;
}

function addSprite(nodeIdx, spriteFrameUuid) {
    const compIdx = sceneData.length;
    const compObj = {
        "__type__": "cc.Sprite",
        "_name": "",
        "_objFlags": 0,
        "node": { "__id__": nodeIdx },
        "_enabled": true,
        "__prefab": null,
        "_customMaterial": null,
        "_srcBlendFactor": 2,
        "_dstBlendFactor": 4,
        "_color": { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 },
        "_spriteFrame": spriteFrameUuid ? { "__uuid__": spriteFrameUuid, "__expectedType__": "cc.SpriteFrame" } : null,
        "_type": 0,
        "_sizeMode": 1,
        "_fillType": 0,
        "_fillCenter": { "__type__": "cc.Vec2", "x": 0, "y": 0 },
        "_fillStart": 0,
        "_fillRange": 0,
        "_isTrimmed": true,
        "_useGrayscale": false
    };
    sceneData.push(compObj);
    sceneData[nodeIdx]._components.push({ "__id__": compIdx });
    return compIdx;
}

// 1. Re-create / verify ThoughtBubbleContainer
let bubbleContainerIdx = sceneData.findIndex(item => item && item.__type__ === 'cc.Node' && item._name === 'ThoughtBubbleContainer');
if (bubbleContainerIdx === -1) {
    bubbleContainerIdx = addNode('ThoughtBubbleContainer', canvasNodeIdx, { x: 0, y: 0, z: 0 }, undefined, undefined, 33554432);
    addUITransform(bubbleContainerIdx, 1080, 1920);
    sceneData[bubbleContainerIdx]._active = true;
} else {
    sceneData[bubbleContainerIdx]._active = true;
    sceneData[bubbleContainerIdx]._children = [];
}

const chatboxSpriteUuid = 'c12cb816-fcab-438d-af4b-bf6453f62071@6c48a';
const pistolIconUuid = '1d4a8775-3eeb-44ab-825d-34eafc1283ec@6c48a';
const akIconUuid = '713822ed-edd5-4243-b08a-0ab28c640d1c@6c48a';

const thoughtBubbleNodeIds = [];

// Estimated 2D UI offsets for 4 queue positions
const bubbleOffsets = [
    { x: -260, y: -20 },
    { x: -90, y: -20 },
    { x: 80, y: -20 },
    { x: 250, y: -20 }
];

for (let i = 0; i < 4; i++) {
    const bubbleName = `ThoughtBubble_${i}`;
    const bubbleIdx = addNode(bubbleName, bubbleContainerIdx, bubbleOffsets[i], undefined, undefined, 33554432);
    addUITransform(bubbleIdx, 85, 75);
    addSprite(bubbleIdx, chatboxSpriteUuid);

    // Pistol Icon
    const pIconIdx = addNode('Icon_Pistol', bubbleIdx, { x: 0, y: 8, z: 0 }, undefined, { x: 0.65, y: 0.65, z: 1 }, 33554432);
    addUITransform(pIconIdx, 55, 55);
    addSprite(pIconIdx, pistolIconUuid);
    sceneData[pIconIdx]._active = true;

    // AK Icon
    const akIconIdx = addNode('Icon_AK', bubbleIdx, { x: 0, y: 8, z: 0 }, undefined, { x: 0.65, y: 0.65, z: 1 }, 33554432);
    addUITransform(akIconIdx, 55, 55);
    addSprite(akIconIdx, akIconUuid);
    sceneData[akIconIdx]._active = false;

    sceneData[bubbleIdx]._active = false; // hidden until order taken
    thoughtBubbleNodeIds.push({ "__id__": bubbleIdx });
    console.log(`💬 Baked [${bubbleName}] at index ${bubbleIdx}`);
}

// Link thoughtBubbles array in GameManager
if (gameManagerCompIdx !== -1) {
    sceneData[gameManagerCompIdx].thoughtBubbles = thoughtBubbleNodeIds;
    console.log(`🔗 Linked ${thoughtBubbleNodeIds.length} ThoughtBubbles to GameManager!`);
}

fs.writeFileSync(SCENE_PATH, JSON.stringify(sceneData, null, 2));
console.log('✅ [SceneBaker] Successfully updated scene with ThoughtBubbles & Icons!');
