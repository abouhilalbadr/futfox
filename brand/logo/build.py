"""FutFox logo masters: the Bandit fox, built from snapped angles, plus lockups.

Run: python3 build.py ../fonts/Inter-Bold.ttf
"""
import math
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

VIOLET, LIME, NIGHT, WHITE = "#8B5CF6", "#C6FF3D", "#0E0B1F", "#FFFFFF"
DY = 16  # optical centring: the head sits slightly above the canvas centre


def walk(start, steps):
    """Follow (angle in degrees, length) steps; angles are measured in screen space (y down)."""
    pts = [start]
    x, y = start
    for ang, length in steps:
        x += length * math.cos(math.radians(ang))
        y += length * math.sin(math.radians(ang))
        pts.append((x, y))
    return pts


def mirror(pts):
    return [(256 - x, y) for x, y in pts]


def poly(pts):
    return "M" + "L".join(f"{x:.2f} {y + DY:.2f}" for x, y in pts) + "Z"


# Left half of the head, from the brow notch down to the snout, every edge on a 15° grid.
left = walk((128, 86), [(210, 30.5), (240, 76), (105, 95), (120, 55.6), (30, 57.3), (15, 41.2)])
snout_y = left[-1][1] + (128 - left[-1][0])  # last edge at 45° to the centre line
left.append((128, snout_y))
head = left[:-1] + [(128, snout_y)] + list(reversed(mirror(left[1:-1])))

eye = [(56, 124), (110.1, 138.5), (105.4, 155.9), (68.7, 146.1)]
ear = [(66, 38), (86.5, 73.5), (51, 94)]
# Shrink the ear cut-out about its centre so the ear rim stays solid at small sizes.
cx, cy = sum(p[0] for p in ear) / 3, sum(p[1] for p in ear) / 3
ear = [(cx + (x - cx) * 0.72, cy + (y - cy) * 0.72) for x, y in ear]

HEAD, EARS, EYES = poly(head), poly(ear) + poly(mirror(ear)), poly(eye) + poly(mirror(eye))


def svg(view, body, title="FutFox logo"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}"><title>{title}</title>{body}</svg>\n'


def fox(fill, eyes=None, small=False):
    holes = EYES if small else EARS + EYES
    glow = f'<path fill="{eyes}" d="{EYES}"/>' if eyes else ""
    return glow + f'<path fill="{fill}" fill-rule="evenodd" d="{HEAD}{holes}"/>'


font = TTFont(sys.argv[1])
gs, cmap = font.getGlyphSet(), font.getBestCmap()
CAP, UPM = font["OS/2"].sCapHeight, font["head"].unitsPerEm


def wordmark(text, cap_px, x0, baseline, track=-0.01):
    """Outlined text; returns (first-three-letters path, rest path, right edge)."""
    scale = cap_px / CAP
    pens = [SVGPathPen(gs), SVGPathPen(gs)]
    x = x0
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pens[0 if i < 3 else 1], (scale, 0, 0, -scale, x, baseline)))
        x += gs[g].width * scale + track * UPM * scale
    return pens[0].getCommands(), pens[1].getCommands(), x - track * UPM * scale


def word(paths, fut, fox_colour=None):
    a, b = paths
    return f'<path fill="{fut}" d="{a}"/><path fill="{fox_colour or fut}" d="{b}"/>'


files = {}
# Symbol
files["futfox-symbol.svg"] = svg("0 0 256 256", fox(VIOLET, LIME))
files["futfox-symbol-black.svg"] = svg("0 0 256 256", fox("#000000"))
files["futfox-symbol-white.svg"] = svg("0 0 256 256", fox(WHITE))
# Small-size cut: no ear holes, they close up below 24 px.
files["futfox-symbol-small.svg"] = svg("0 0 256 256", fox(VIOLET, LIME, small=True))
files["futfox-app-icon.svg"] = svg(
    "0 0 256 256", f'<rect width="256" height="256" rx="56" fill="{NIGHT}"/>'
    f'<g transform="translate(36 36) scale(0.71875)">{fox(VIOLET, LIME)}</g>')

# Horizontal lockup: cap height 84 (a third of the symbol), gap of one eye-width (~56 units).
*word_h, end_h = wordmark("FutFox", 100, 296, 124 + 50)
w_h = math.ceil(end_h)
for name, sym, txt, accent in [("", fox(VIOLET, LIME), WHITE, None), ("-light", fox(VIOLET, LIME), NIGHT, None),
                               ("-black", fox("#000000"), "#000000", None), ("-white", fox(WHITE), WHITE, None)]:
    files[f"futfox-horizontal{name}.svg"] = svg(f"0 0 {w_h} 256", sym + word(word_h, txt, accent))
files["futfox-horizontal-on-dark.svg"] = svg(
    f"-40 -40 {w_h + 80} 336", f'<rect x="-40" y="-40" width="{w_h + 80}" height="336" rx="40" fill="{NIGHT}"/>'
    + fox(VIOLET, LIME) + word(word_h, WHITE))

# Stacked lockup: wordmark centred under the symbol.
*_, probe_end = wordmark("FutFox", 80, 0, 0)
wm_w = probe_end
w_s = math.ceil(max(256, wm_w))
x0 = (w_s - wm_w) / 2
*word_s, _ = wordmark("FutFox", 80, x0, 256 + 36 + 80)
sym_off = (w_s - 256) / 2
for name, sym, txt, accent in [("", fox(VIOLET, LIME), WHITE, None), ("-light", fox(VIOLET, LIME), NIGHT, None),
                               ("-black", fox("#000000"), "#000000", None)]:
    files[f"futfox-stacked{name}.svg"] = svg(
        f"0 0 {w_s} 376", f'<g transform="translate({sym_off:.2f} 0)">{sym}</g>' + word(word_s, txt, accent))

# Wordmark only
*word_o, end_o = wordmark("FutFox", 84, 0, 84)
files["futfox-wordmark.svg"] = svg(f"0 0 {math.ceil(end_o)} 84", word(word_o, WHITE))
files["futfox-wordmark-black.svg"] = svg(f"0 0 {math.ceil(end_o)} 84", word(word_o, "#000000"))

for name, body in files.items():
    open(name, "w").write(body)
print("wrote", len(files), "files; snout at", round(snout_y + DY, 1), "x-extent", round(left[4][0], 1))
