#!/bin/sh
# Copies the icons, font, share image and step screenshots into the website folder.
# The copies are generated (git-ignored); run this before every site deploy.
set -eu
cd "$(dirname "$0")/.."
site=store/futfox-site
rm -rf "$site/assets"
mkdir -p "$site/assets/fonts" "$site/assets/steps"
web=brand/logo/export
cp "$web/favicon.ico" "$web/favicon.svg" "$web/apple-touch-icon.png" "$web/icon-192.png" "$web/icon-512.png" \
  "$web/maskable-512.png" "$site/assets/"
cat > "$site/assets/site.webmanifest" <<'JSON'
{
  "name": "FutFox",
  "short_name": "FutFox",
  "icons": [
    { "src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/assets/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "theme_color": "#0E0B1F",
  "background_color": "#0E0B1F",
  "display": "standalone"
}
JSON
cp store/promo/og.png "$site/assets/og.png"
# Latin-only subset of Inter keeps the font around 100 KB.
python3 -m fontTools.subset brand/fonts/Inter-Variable.woff2 --flavor=woff2 --layout-features='*' \
  --unicodes='U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+00D7' \
  --output-file="$site/assets/fonts/inter-latin.woff2"
# Screenshots of the real panel, made by scripts/capture-screens.sh.
cp store/screens/step-*.png "$site/assets/steps/"
echo "Site assets ready in $site"
