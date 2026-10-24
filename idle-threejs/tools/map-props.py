# Cuts the Test00 map (map.glb) into reusable props -> src/assets/models/props.glb (one centred, grounded node each).
# Usage: /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/map-props.py
import bpy, mathutils, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load_clusters():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    bpy.ops.import_scene.gltf(filepath=ROOT+'/src/assets/models/map.glb')
    meshes=[o for o in bpy.data.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
    parts=[p for p in bpy.data.objects if p.type=='MESH']
    B={}
    for p in parts:
        vs=[p.matrix_world@v.co for v in p.data.vertices]
        B[p.name]=(mathutils.Vector([min(v[i] for v in vs) for i in range(3)]), mathutils.Vector([max(v[i] for v in vs) for i in range(3)]))
    ground=[p for p in parts if (B[p.name][1]-B[p.name][0]).x>15]
    small=[p for p in parts if p not in ground]
    par={p.name:p.name for p in small}
    def f(a):
        while par[a]!=a: a=par[a]
        return a
    for i,a in enumerate(small):
        for b in small[i+1:]:
            A=B[a.name];C=B[b.name]
            if all(A[0][k]-0.05<=C[1][k] and C[0][k]-0.05<=A[1][k] for k in range(3)): par[f(a.name)]=f(b.name)
    cl={}
    for p in small: cl.setdefault(f(p.name),[]).append(p)
    out=[]
    for ps in cl.values():
        mn=mathutils.Vector([min(B[p.name][0][i] for p in ps) for i in range(3)]); mx=mathutils.Vector([max(B[p.name][1][i] for p in ps) for i in range(3)])
        out.append((ps,(mn+mx)/2,mx-mn,mn))
    return ground,out
def join(ps,name):
    bpy.ops.object.select_all(action='DESELECT')
    for p in ps: p.select_set(True)
    bpy.context.view_layer.objects.active=ps[0]
    if len(ps)>1: bpy.ops.object.join()
    o=bpy.context.view_layer.objects.active; o.name=name
    return o
def find(clusters,x,y):
    return min(clusters,key=lambda c:(c[1].x-x)**2+(c[1].y-y)**2)
import os
PICK = {  # name: centre (x, y) of the cluster in map space
    'tree_a': (-7.1, 17.2), 'tree_b': (7.1, 16.0), 'tree_pair': (5.7, -19.5), 'tree_bush': (-4.5, -16.1),
    'log': (-4.1, 14.8), 'log_cut': (-1.9, 0.2), 'stump': (-6.9, 0.2), 'stump_mush': (2.7, -7.7),
    'grass': (3.3, 14.7), 'rock': (-4.7, 30.3), 'stake': (-4.1, 7.2), 'fence': (4.9, 7.0),
    'tent': (5.9, -3.3), 'campfire': (0.7, -0.2),
}
ground, cls = load_clusters()
keep = []
for name, (x, y) in PICK.items():
    ps, ctr, size, mn = find(cls, x, y)
    o = join(ps, name)
    for v in o.data.vertices: v.co -= mathutils.Vector((ctr.x, ctr.y, mn.z))  # bottom-centre origin
    o.location = (0, 0, 0)
    keep.append(o)
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o)
bpy.ops.export_scene.gltf(filepath=ROOT + '/src/assets/models/props.glb', export_format='GLB', export_yup=True, export_apply=True)
print('PROPS', [(o.name, tuple(round(d, 2) for d in o.dimensions)) for o in keep])
