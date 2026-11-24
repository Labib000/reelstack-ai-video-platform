"""
Builds every ReelStack brand asset from the source logo.

    python3 brand/build_brand.py        (run from client/)

Source: brand/source/reelstack-logo.png (2172x724 RGBA, transparent, white
"Reel" for dark backgrounds). Outputs go to public/ and public/brand/.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand/source/reelstack-logo.png"
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"

INK = (10, 10, 10)            # "Reel" in light mode
BG_DARK = (9, 9, 11)          # --background (dark)
BRAND_RED = (247, 30, 37)

ICON_BOX = (289, 230, 624, 521)   # the play-screen mark
TEXT_X0 = 650                      # wordmark text starts right of the mark


def clean(im: Image.Image) -> Image.Image:
    """Drop near-invisible pixels (the faint ghost tagline under the text)."""
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < 12 else v)
    return Image.merge("RGBA", (r, g, b, a))


def trim(im: Image.Image, pad: int) -> Image.Image:
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    return im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))


def recolor_light_text(im: Image.Image) -> Image.Image:
    """White "Reel" -> ink, so the wordmark reads on light backgrounds."""
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(TEXT_X0, w):
            r, g, b, a = px[x, y]
            # Near-white or grey (anti-aliased edge) pixels: low saturation.
            if a and max(r, g, b) - min(r, g, b) < 40:
                px[x, y] = (*INK, a)
    return out


def at_height(im: Image.Image, height: int) -> Image.Image:
    width = round(im.width * height / im.height)
    return im.resize((width, height), Image.LANCZOS)


def square(im: Image.Image, size: int, pad_ratio: float, bg=None) -> Image.Image:
    """The mark centred on a square canvas, `pad_ratio` of the side as margin."""
    canvas = Image.new("RGBA", (size, size), (*bg, 255) if bg else (0, 0, 0, 0))
    inner = round(size * (1 - 2 * pad_ratio))
    scale = inner / max(im.size)
    mark = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return canvas


def og_image(wordmark: Image.Image) -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGBA", (w, h), (*BG_DARK, 255))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((250, 140, 950, 500), fill=(*BRAND_RED, 90))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    mark = at_height(wordmark, 170)
    img.alpha_composite(mark, ((w - mark.width) // 2, (h - mark.height) // 2 - 20))
    return img.convert("RGB")


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    src = clean(Image.open(SRC).convert("RGBA"))

    icon = trim(src.crop(ICON_BOX), 0)
    word_dark = trim(src, 6)
    # Recolour on the untrimmed image, where TEXT_X0 is measured.
    word_light = trim(recolor_light_text(src), 6)

    for name, im in (("wordmark-dark", word_dark), ("wordmark-light", word_light)):
        for scale, height in (("", 64), ("@3x", 96)):
            out = at_height(im, height)
            out.save(BRAND / f"{name}{scale}.png", optimize=True)
            out.save(BRAND / f"{name}{scale}.webp", quality=92, method=6)

    icon_hi = square(icon, 512, 0.06)
    icon_hi.save(BRAND / "mark-512.png", optimize=True)

    ico_sizes = [16, 32, 48]
    square(icon, 256, 0.02).save(PUBLIC / "favicon.ico", sizes=[(s, s) for s in ico_sizes])
    square(icon, 180, 0.14, BG_DARK).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    square(icon, 192, 0.1, BG_DARK).save(PUBLIC / "icon-192.png", optimize=True)
    square(icon, 512, 0.1, BG_DARK).save(PUBLIC / "icon-512.png", optimize=True)
    # Maskable: launchers crop to a circle, so keep the mark in the 80% safe zone.
    square(icon, 512, 0.2, BG_DARK).save(PUBLIC / "icon-maskable-512.png", optimize=True)

    og_image(word_dark).save(PUBLIC / "og-image.png", optimize=True)
    print("brand assets written to", PUBLIC)


if __name__ == "__main__":
    main()
