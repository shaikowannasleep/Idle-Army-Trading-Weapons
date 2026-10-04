# Blender headless: FBX (Cocos assets) -> GLB with relinked textures.
# Usage: Blender -b -P tools/convert_fbx.py -- <assetsDir> <outDir> [previewDir]
import bpy, sys, os, math

argv = sys.argv[sys.argv.index('--') + 1:]
A, OUT = argv[0], argv[1]
PREV = argv[2] if len(argv) > 2 else None
U = A + '/_unused/resources/asset/Map'

TEX = {
    'palette': U + '/Textures/base.png',
    'face': U + '/Characters/Staff/Main_Face_512.png',
    'citizensA': A + '/_unused/Newtex/base1.png',
    'citizensB': U + '/Characters/Customers/Customers_Male/Textures/TT_citizens_B.tga',
    'proto': U + '/map/Texture/Texture_Map 1-2.png',
    'map21': U + '/map/Texture/map21.png',
    'chest': A + '/resources/asset/Map/Model/Hop mo khoa/Textures/Hop mo khoa may sx.png',
}

# image-name substring -> texture key
IMG_RULES = [
    ('Palettes', 'palette'), ('Main_Face', 'face'), ('TT_citizens_A', 'citizensA'),
    ('TT_citizens_B', 'citizensB'), ('Texture_Map', 'proto'), ('1.png', 'map21'), ('Hop mo khoa', 'chest'),
]

JOBS = [
    ('boss',     A + '/resources/asset/Map/Enemy/FBX/Monster 1.fbx', None),
    ('staff',    A + '/resources/asset/Map/Characters/Staff/Staff.fbx', None),
    ('customer', A + '/resources/asset/Map/Characters/Customers/Customers_Male/Default/Customer 1.fbx', None),
    ('map',      A + '/folder/2-1.001.fbx', 'map21'),
    ('machine4', A + '/resources/asset/Map/Machine/Machine_4.fbx', 'proto'),
    ('machine2', A + '/resources/asset/Map/Machine/Machine_2.fbx', 'proto'),
    ('slot2',    A + '/resources/asset/Map/Machine/MachineSlot_2.fbx', 'proto'),
    ('chest',    A + '/resources/asset/Map/Model/Hop mo khoa/FBX/Hop mo khoa.fbx', 'chest'),
    ('coin',     A + '/_unused/resources/asset/Map/Coin/FBX/Coin.fbx', 'palette'),
]

_img_cache = {}
def load_img(key):
    if key not in _img_cache:
        img = bpy.data.images.load(TEX[key], check_existing=True)
        img.name = key
        _img_cache[key] = img
    return _img_cache[key]

def tex_key_for(mat, fallback):
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                nm = n.image.name + ' ' + n.image.filepath
                for sub, key in IMG_RULES:
                    if sub in nm:
                        return key
    return fallback

def rebuild_material(mat, key):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.75
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    if key:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = load_img(key)
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])

def preview(name):
    if not PREV:
        return
    sc = bpy.context.scene
    objs = [o for o in sc.objects if o.type == 'MESH' and o.visible_get()]
    if not objs:
        return
    import mathutils
    mn = mathutils.Vector((1e9,) * 3); mx = -mn
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
    ctr = (mn + mx) / 2; r = (mx - mn).length
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.location = ctr + mathutils.Vector((r * 0.9, -r * 1.1, r * 0.7))
    d = ctr - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'TEXTURE'
    sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x = sc.render.resolution_y = 384
    sc.render.filepath = os.path.join(PREV, name + '.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)

for name, path, fallback in JOBS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _img_cache.clear()
    bpy.ops.import_scene.fbx(filepath=path)
    for m in list(bpy.data.materials):
        rebuild_material(m, tex_key_for(m, fallback))
    # Drop rest-pose clips, give clips clean names
    for a in list(bpy.data.actions):
        if a.name.lower().endswith('a pose'):
            bpy.data.actions.remove(a); continue
        a.name = a.name.split('|')[-1].replace('Boss 1_', '')
        a.use_fake_user = True
    for i in list(bpy.data.images):
        if i.users == 0 or (i.size[0] == 0 and i.name not in TEX):
            bpy.data.images.remove(i)
    if bpy.context.scene.frame_end:
        bpy.context.scene.frame_set(1)
    preview(name)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, name + '.glb'), export_format='GLB',
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
        export_optimize_animation_size=True, export_skins=True, export_apply=False,
        export_yup=True, export_image_format='AUTO', export_cameras=False, export_lights=False)
    print('EXPORTED', name)
