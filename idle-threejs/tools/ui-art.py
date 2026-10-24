# Generates the zombie-survival UI art (rusted steel plates, hazard cards, blood splat) + the weapon grunge texture.
# Usage: python3 tools/ui-art.py  -> src/assets/ui/zombie/*.webp, src/assets/ui/weapon_grunge.webp (deterministic)
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

rng = np.random.default_rng(11)
OUT = 'src/assets/ui/zombie/'

def noise(w, h, scale, blur):
    n = Image.fromarray((rng.random((max(1, h // scale), max(1, w // scale))) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(n.filter(ImageFilter.GaussianBlur(blur))).astype(np.float32) / 255

def steel(w, h, base=(58, 62, 66), rust=0.5):
    """Brushed dark steel with rust blooms and scratches, RGB float array 0..1."""
    brushed = np.repeat(rng.random((h, 1)), w, 1) * 0.5 + rng.random((h, w)) * 0.5
    brushed = np.asarray(Image.fromarray((brushed * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(1))).astype(np.float32) / 255
    img = np.array(base, np.float32)[None, None] / 255 * (0.82 + 0.3 * brushed[..., None])
    r = np.clip((noise(w, h, 24, 8) * 0.6 + noise(w, h, 6, 2) * 0.4 - (1 - rust * 0.5)) * 3.2, 0, 1)[..., None]
    img = img * (1 - r) + np.array([0.42, 0.22, 0.1]) * (0.7 + 0.5 * noise(w, h, 3, 1)[..., None]) * r
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(int(w * h / 2400)):
        x, y = rng.integers(0, w), rng.integers(0, h)
        l, a = rng.integers(6, 40), rng.uniform(-0.5, 0.5)
        d.line([(x, y), (x + l * np.cos(a), y + l * np.sin(a))], fill=(98, 100, 98), width=1)
    return np.asarray(im).astype(np.float32) / 255

def bevel(img, b):
    """Raised edge: light top-left, dark bottom-right, b px wide."""
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
    k = np.clip(1 - edge / b, 0, 1)[..., None]
    light = ((xx + yy) < (w + h) / 2)[..., None]
    img = np.where(light, img + k * 0.28, img - k * 0.35)
    outline = (edge < 2)[..., None]
    return np.where(outline, 0.05, img)

def rivets(im, pts, r):
    d = ImageDraw.Draw(im)
    for x, y in pts:
        d.ellipse([x - r, y - r + 1, x + r, y + r + 1], fill=(15, 15, 15))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(120, 118, 110))
        d.ellipse([x - r * 0.5, y - r * 0.6, x + r * 0.2, y], fill=(200, 196, 185))

def splat(size, n, seed_r=(6, 40), drips=True):
    """Blood alpha mask: blobs + satellite droplets + drips."""
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    c = size / 2
    for _ in range(n):
        a, dist = rng.uniform(0, 6.28), abs(rng.normal(0, size * 0.16))
        r = rng.uniform(*seed_r) * max(0.25, 1 - dist / (size * 0.45))
        x, y = c + np.cos(a) * dist, c + np.sin(a) * dist
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        if drips and rng.random() < 0.2:
            d.rectangle([x - r * 0.25, y, x + r * 0.25, y + rng.uniform(10, size * 0.25)], fill=255)
    return m.filter(ImageFilter.GaussianBlur(1.2))

def blood_rgba(mask):
    a = np.asarray(mask).astype(np.float32) / 255
    w = noise(mask.width, mask.height, 4, 1.5)
    rgb = np.stack([0.45 + 0.2 * w, 0.03 + 0.03 * w, 0.03 + 0.02 * w], -1)
    return Image.fromarray((np.dstack([rgb, a * 0.92]) * 255).astype(np.uint8), 'RGBA')

def save(arr_or_im, name, **kw):
    im = arr_or_im if isinstance(arr_or_im, Image.Image) else Image.fromarray((np.clip(arr_or_im, 0, 1) * 255).astype(np.uint8))
    im.save(name, quality=90, **kw)
    return im

# 1) plate: 9-slice frame for pills, buttons and panels (slice = 28px)
w, h = 256, 112
plate = Image.fromarray((np.clip(bevel(steel(w, h), 10), 0, 1) * 255).astype(np.uint8))
rivets(plate, [(16, 16), (w - 16, 16), (16, h - 16), (w - 16, h - 16)], 5)
save(plate, OUT + 'plate.webp')

# 2) card: hazard stripe header, recessed art window, blood smear
w, h = 320, 440
card = bevel(steel(w, h, (48, 54, 52), rust=0.65), 12)
yy, xx = np.mgrid[0:h, 0:w]
band = (yy > 22) & (yy < 58) & (xx > 14) & (xx < w - 14)
stripe = ((xx + yy) // 22) % 2 == 0
card[band & stripe] = [0.95, 0.72, 0.1]
card[band & ~stripe] = [0.08, 0.08, 0.07]
card[band] *= (0.75 + 0.35 * noise(w, h, 5, 1.5))[band][..., None]  # worn paint
cx, cy, R = w / 2, 150, 92
dist = np.hypot(xx - cx, yy - cy)
card[dist < R] = card[dist < R] * 0.35 + np.array([0.03, 0.06, 0.04])
ring = (dist >= R) & (dist < R + 5)
card[ring] = [0.2, 0.22, 0.2]
im = save(card, '/tmp/card.png')
rivets(im, [(26, 80), (w - 26, 80), (26, h - 26), (w - 26, h - 26)], 6)
sp = blood_rgba(splat(220, 50, (4, 26))).rotate(rng.uniform(0, 360))
im.paste(sp, (w - 170, h - 170), sp)
sp2 = blood_rgba(splat(120, 25, (3, 14))).rotate(40)
im.paste(sp2, (-30, 70), sp2)
save(im, OUT + 'card.webp')

# 3) big splat behind the level-up title
save(blood_rgba(splat(512, 140, (8, 60))), OUT + 'splat.webp', lossless=False)

# 4) weapon grunge: neutral grey (multiplied with vertex colours), brushed + edge wear + scratches
g = steel(256, 256, (200, 200, 200), rust=0.0).mean(-1)
wear = np.clip((noise(256, 256, 8, 2) - 0.62) * 5, 0, 1)
g = np.clip(g * (1 - 0.12 * wear) + 0.12 * wear * 1.2, 0, 1)
save(np.dstack([g, g, g]), 'src/assets/ui/weapon_grunge.webp')
for f in ['plate', 'card', 'splat']:
    im = Image.open(OUT + f + '.webp')
    assert im.size[0] > 100, f
print('ok')
