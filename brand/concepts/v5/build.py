"""Round 3: fox mascot concepts. Writes black symbols, colour tiles and lockups."""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen


def poly(pts):
    return "M" + "L".join(f"{x} {y}" for x, y in pts) + "Z"


def mirror(pts):
    return [(256 - x, y) for x, y in pts]


# Each concept: outline, and the holes (eyes and inner ears) that light up in colour.
CONCEPTS = {}

# A: bandit mask. Tall ears, cheek tufts, a short snout point: the sly deal-finder.
mask = [(128, 86), (156, 74), (206, 6), (222, 100), (250, 148), (200, 176), (160, 186), (128, 222),
        (96, 186), (56, 176), (6, 148), (34, 100), (50, 6), (100, 74)]
ear = [(56, 36), (88, 76), (50, 92)]
eye = [(56, 124), (110, 138), (106, 156), (68, 148)]
CONCEPTS["a"] = (poly(mask), poly(ear) + poly(mirror(ear)), poly(eye) + poly(mirror(eye)))

# B: profile facing right. Tall ear, long slim snout, a fluffy cheek ruff instead of a neck.
prof = [(100, 8), (142, 80), (178, 92), (248, 132), (240, 148), (180, 156), (198, 196), (152, 184),
        (146, 236), (112, 200), (64, 228), (52, 150), (70, 80)]
CONCEPTS["b"] = (poly(prof), poly([(100, 42), (124, 82), (86, 90)]), poly([(152, 108), (192, 120), (160, 128)]))

# C: front head with a wink; whisker lines mark the white cheeks.
head = [(36, 6), (98, 72), (158, 72), (220, 6), (228, 108), (248, 148), (192, 166), (128, 240),
        (64, 166), (8, 148), (28, 108)]
ear = [(44, 36), (78, 74), (42, 90)]
muzzle = [(78, 156), (118, 182), (116, 194), (76, 168)]
wink = "M146 142C158 120 188 118 204 130L198 142C186 134 166 136 156 150Z"
CONCEPTS["c"] = (poly(head), poly(ear) + poly(mirror(ear)) + poly(muzzle) + poly(mirror(muzzle)),
                 poly([(58, 116), (110, 128), (106, 146), (68, 140)]) + wink)

PALETTES = {
    "violet": {"bg": "#0E0B1F", "fox": "#8B5CF6", "glow": "#C6FF3D", "word": "#FFFFFF"},
    "magenta": {"bg": "#0B0F1A", "fox": "#FF2E7E", "glow": "#2EE6FF", "word": "#FFFFFF"},
}

font = TTFont(sys.argv[1])
gs, cmap = font.getGlyphSet(), font.getBestCmap()
cap = font["OS/2"].sCapHeight
upm = font["head"].unitsPerEm


def wordmark(text, cap_px, x0, baseline, track):
    scale = cap_px / cap
    pen = SVGPathPen(gs)
    x = x0
    for ch in text:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += gs[g].width * scale + track * upm * scale
    return pen.getCommands(), x - track * upm * scale


word, end = wordmark("FUTCRAFT", 76, 284, 128 + 38, 0.06)
W = int(end + 12)

for k, (outline, holes, eyes) in CONCEPTS.items():
    cut = f'<path fill-rule="evenodd" d="{outline}{holes}{eyes}"/>'
    open(f"{k}-symbol.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">{cut}</svg>\n')
    open(f"{k}-lockup.svg", "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 256">{cut}<path d="{word}"/></svg>\n')
    for name, p in PALETTES.items():
        art = (f'<path fill="{p["glow"]}" d="{eyes}"/>'
               f'<path fill="{p["fox"]}" fill-rule="evenodd" d="{outline}{holes}{eyes}"/>')
        open(f"{k}-{name}.svg", "w").write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="{p["bg"]}"/>'
            f'<g transform="translate(36 36) scale(0.71875)">{art}</g></svg>\n')
        open(f"{k}-lockup-{name}.svg", "w").write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-36 -36 {W + 72} 328"><rect x="-36" y="-36" width="{W + 72}" height="328" rx="36" fill="{p["bg"]}"/>'
            f'{art}<path fill="{p["word"]}" d="{word}"/></svg>\n')
print("ok", W)
