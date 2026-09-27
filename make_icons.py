from PIL import Image, ImageDraw
import os

os.makedirs("public/icons", exist_ok=True)

def gradient(size):
    img = Image.new("RGB", (size, size))
    px = img.load()
    c1 = (255, 107, 157)
    c2 = (139, 92, 246)
    c3 = (34, 211, 238)
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            if t < 0.5:
                t2 = t / 0.5
                r = int(c1[0] + (c2[0] - c1[0]) * t2)
                g = int(c1[1] + (c2[1] - c1[1]) * t2)
                b = int(c1[2] + (c2[2] - c1[2]) * t2)
            else:
                t2 = (t - 0.5) / 0.5
                r = int(c2[0] + (c3[0] - c2[0]) * t2)
                g = int(c2[1] + (c3[1] - c2[1]) * t2)
                b = int(c2[2] + (c3[2] - c2[2]) * t2)
            px[x, y] = (r, g, b)
    return img

def make_icon(size, pad_ratio=0.0, filename=None):
    img = gradient(size)
    draw = ImageDraw.Draw(img)
    pad = int(size * pad_ratio)
    inner = size - 2 * pad
    cx, cy = size // 2, size // 2
    # camera shutter shape: rounded square with a circle cutout ring
    r = int(inner * 0.32)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255), width=max(4, size // 40))
    r2 = int(inner * 0.14)
    draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=(255, 255, 255))
    # small "timer" tick top right
    tr = int(inner * 0.07)
    tx, ty = cx + int(inner * 0.30), cy - int(inner * 0.30)
    draw.ellipse([tx - tr, ty - tr, tx + tr, ty + tr], fill=(255, 255, 255))
    if filename:
        img.save(filename)
    return img

make_icon(192, 0.0, "public/icons/icon-192.png")
make_icon(512, 0.0, "public/icons/icon-512.png")
make_icon(512, 0.18, "public/icons/icon-maskable-512.png")
make_icon(180, 0.08, "public/icons/apple-touch-icon.png")
print("icons done")
