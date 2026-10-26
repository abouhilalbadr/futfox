#!/bin/sh
# Screenshots the real panel (store/screens/capture.html) at each step for the website.
# Needs Google Chrome. Writes store/screens/step-1.png … step-5.png and gallery.png at 2x.
# Headless Chrome won't go narrower than 500 px, so each shot is taken 500 px wide and cropped to its
# right edge. The panel is never narrower than the window (up to 520 px), so panel shots keep all 500 px.
set -eu
cd "$(dirname "$0")/.."
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
page="file://$(pwd)/store/screens/capture.html"
shot() {
  out="$(pwd)/store/screens/step-$1.png"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --allow-file-access-from-files --virtual-time-budget=6000 --window-size="500,$3" \
    --screenshot="$out" "$page#step-$1" >/dev/null 2>&1
  sips -c $(($3 * 2)) $(($2 * 2)) --cropOffset 0 $(((500 - $2) * 2)) "$out" >/dev/null
  echo "store/screens/step-$1.png"
}
# step, width, height (CSS px)
shot 1 300 150
shot 2 500 470
shot 3 500 360
shot 4 500 640
shot 5 500 330
# The Gallery set page (store/screens/gallery.html), the panel's full 500 px width.
out="$(pwd)/store/screens/gallery.png"
"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --allow-file-access-from-files --virtual-time-budget=6000 --window-size=500,1040 \
  --screenshot="$out" "file://$(pwd)/store/screens/gallery.html" >/dev/null 2>&1
echo "store/screens/gallery.png"
