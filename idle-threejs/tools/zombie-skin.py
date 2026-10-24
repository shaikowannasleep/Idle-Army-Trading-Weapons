# Repaints the civilian atlas into a zombie skin: rotten green skin, yellow eyes, dirty torn clothes, blood splats.
# Usage: python3 tools/zombie-skin.py  -> src/assets/ui/skin_zombie.webp (deterministic, seed 7)
import numpy as np
from PIL import Image, ImageFilter

src = np.asarray(Image.open('src/assets/ui/skin_civilianA.webp').convert('RGB')).astype(np.float32) / 255
H, W, _ = src.shape
rng = np.random.default_rng(7)
r, g, b = src[..., 0], src[..., 1], src[..., 2]
mx, mn = src.max(-1), src.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-4)
hue = np.where(mx == r, ((g - b) / np.maximum(mx - mn, 1e-4)) % 6, 0) * 60

def blur_noise(scale, sigma):
    n = Image.fromarray((rng.random((H // scale, W // scale)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    return np.asarray(n.filter(ImageFilter.GaussianBlur(sigma))).astype(np.float32) / 255

mottle = blur_noise(16, 6)
grime = blur_noise(8, 3)
lum = src @ np.array([0.3, 0.59, 0.11], np.float32)

skin = (mx == r) & (hue > 8) & (hue < 40) & (sat > 0.25) & (sat < 0.7) & (mx > 0.45)
white = (sat < 0.12) & (mx > 0.85)          # eye whites / teeth
near_eye = np.asarray(Image.fromarray(white.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
iris = near_eye & ~white & (sat > 0.2) & (mx > 0.3)  # irises (next to eye whites) read as glowing red

out = src.copy()
# rotten skin: grey-green ramp keyed on original shading, purple bruise mottling
k = (lum / max(lum[skin].mean(), 1e-3))[..., None] if skin.any() else 1
rot = np.array([0.56, 0.66, 0.42], np.float32) * k
bruise = np.array([0.45, 0.38, 0.45], np.float32) * k
m = np.clip((mottle - 0.55) * 4, 0, 1)[..., None]
out[skin] = (rot * (1 - m) + bruise * m)[skin]
# clothes: desaturate, darken, dirt
clothes = ~skin & ~white
grey = lum[..., None].repeat(3, -1)
out[clothes] = (src * 0.45 + grey * 0.55)[clothes] * (0.62 + 0.25 * grime[clothes])[..., None] + np.array([0.04, 0.035, 0.0])
out[white] = np.array([0.86, 0.82, 0.45])
out[iris & ~skin] = np.array([0.85, 0.08, 0.05])
# blood splats: blurred random blobs, dark red, more on clothes
blood = np.zeros((H, W), np.float32)
for _ in range(90):
    cx, cy, rad = rng.integers(0, W), rng.integers(0, H), rng.integers(3, 16)
    yy, xx = np.ogrid[-cy:H - cy, -cx:W - cx]
    blood = np.maximum(blood, (xx * xx + yy * yy < rad * rad).astype(np.float32) * rng.uniform(0.5, 0.95))
blood = np.asarray(Image.fromarray((blood * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
blood *= np.clip(grime * 1.6, 0, 1)
bc = np.array([0.42, 0.04, 0.03], np.float32)
out = out * (1 - blood[..., None]) + bc * blood[..., None]
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save('src/assets/ui/skin_zombie.webp', quality=88)
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).resize((512, 512)).save('/tmp/zom/skin_zombie.png')
assert skin.mean() > 0.2, f'skin mask too small: {skin.mean():.2f}'
print('skin', round(float(skin.mean()), 3), 'white', round(float(white.mean()), 4), 'iris', round(float(iris.mean()), 4))
