# FutFox — Logo Guidelines

## 1. The logo
- **Idea:** a fox in a bandit mask, the sly one who finds the cheap way to finish an SBC. The eyes glow lime, the
  colour of a full chemistry link.
- **Versions:** horizontal (primary) · stacked · symbol only · wordmark only.
- **Masters:** `brand/logo/*.svg`. Rebuild them with `python3 build.py ../fonts/Inter-Bold.ttf`; never edit by hand.
  Exports (PNG sizes, one-colour, favicon, web icons) are in `brand/logo/export/`.

| File | Use on |
|---|---|
| `futfox-horizontal.svg`, `futfox-stacked.svg` | dark backgrounds (default) |
| `futfox-horizontal-light.svg`, `futfox-stacked-light.svg` | white or light backgrounds |
| `futfox-horizontal-white.svg`, `futfox-symbol-white.svg` | photos and one-colour dark use |
| `futfox-horizontal-black.svg`, `futfox-symbol-black.svg` | one-colour print, fax, engraving |
| `futfox-symbol.svg` | the symbol at 32 px and up |
| `futfox-symbol-small.svg` | 24 px and below (ear cut-outs removed so they don't fill in) |
| `futfox-app-icon.svg` | app, store and avatar tiles |

## 2. Clear space
Keep a clear zone of **one eye width** around the logo on every side. One eye width is 54/256 of the symbol's height
(about a fifth). The zone scales with the logo.

## 3. Minimum size
| Version | Screen | Print |
|---|---|---|
| Horizontal | 120 px wide | 30 mm wide |
| Stacked | 64 px wide | 18 mm wide |
| Symbol | 16 px (use `futfox-symbol-small.svg`) | 6 mm |

## 4. Colour
| Name | HEX | RGB | CMYK (approx.) | Role |
|---|---|---|---|---|
| Fox Violet | #8B5CF6 | 139 92 246 | 43 63 0 4 | the fox, "FOX", primary buttons |
| Chem Lime | #C6FF3D | 198 255 61 | 22 0 76 0 | the eyes, focus rings, chemistry |
| Night | #0E0B1F | 14 11 31 | 55 65 0 88 | backgrounds, "FUT" on light |
| White | #FFFFFF | 255 255 255 | 0 0 0 0 | "FUT" on dark, text |

The lime is close to neon and won't print true in CMYK; ask the printer for a spot match. The CMYK values are
converted from the screen colours, not proofed.

**Approved pairs:** full colour on Night · full colour (light version) on white · white on Night or Fox Violet ·
black on white.

**Why these colours:** FUT.GG uses orange on black, FUTGenie gold on black, FUTBIN blue. Violet and lime are free in
the category. Orange is also MetaMask's and Firefox's fox colour, so the fox stays violet.

## 5. Typography
- Wordmark: **FutFox** in Inter Bold, mixed case, tracking −1 %, one colour (white on dark, Night on light), outlined
  in the masters. It matches the extension panel's header. Always use the files; never retype it.
- UI and website: Inter (400/600/700), with `system-ui` as the fallback. Inter uses the SIL Open Font Licence, so it's
  free for logos and the web.

## 6. Don'ts
Don't stretch or squash it, rotate it, or add outlines, shadows or gradients. Don't recolour the fox (no orange fox).
Don't make the eyes any colour but lime, or the background colour in one-colour use. Don't put the white
wordmark on a light background (use the `-light` files). Don't use the symbol with ear cut-outs below 24 px.

## 7. Legal
- FutFox is not affiliated with EA. Don't pair the logo with EA marks, the FUT card shape or EA fonts. Use
  "EA SPORTS FC 27" only to describe what the tool works with.
- No trademark search has been done. Run one (EUIPO, USPTO, WIPO Global Brand Database) before publishing.
  "FUT FOOTBALL ULTIMATE TEAM" is an EA trademark filing, so "FUT" in the name carries some risk.
- Domains: futfox.gg and futfox.io looked unregistered on 25 Oct 2026. futfox.com was registered on 20 Oct 2026.
