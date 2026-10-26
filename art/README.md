# FutFox panel art

Icons the panel shows that the Web App doesn't provide. League logos and club badges come from
EA's own servers at runtime and need no file here.

After adding or replacing a file, run `node scripts/build-art.mjs` and reload the extension.
PNG, SVG or WebP (animated WebP plays, as on `set/holographics.webp`), square, at least 64 × 64.
The files here are WebP to keep the extension light; a logo of about 100 × 100 shrinks to a quarter
of its PNG size with no visible change:
`cwebp -q 90 -alpha_q 100 -m 6 logo.png -o logo.webp`. The tables name `.png`, but any of the three
formats works under the same name.

| File | Shown on | Without it |
| --- | --- | --- |
| `sbc.png` | SBC tab | No icon |
| `gallery.png` | Gallery tab | `token.png` |
| `token.png` | Gallery Token rewards in a set's grades | The Web App's generic token |
| `category/<name>.png` | A category with no single league, such as `rarities.png` or `leagues.png` | The category's first letter |
| `set/<name>.png` | A set with no club or league, such as `holographics.png` or `totw.png` | The set's first letter |

`<name>` is the category or set name in lower case, without accents, with every run of other
characters replaced by `-`: "Ultimate Scream" → `ultimate-scream.png`, "TOTW" → `totw.png`,
"Logroño United" → `logrono-united.png`.
