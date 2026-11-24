#!/usr/bin/env bash
# 用无头 Chrome 把本地 HTML 渲染成 PNG（亮色 + 暗色各一张）
# 用法：scripts/render.sh <html> "<查询参数，可为空>" <输出前缀> [宽=1440] [高=900]
set -euo pipefail
HTML="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
QS="${2:-}"; OUT="$3"; W="${4:-1440}"; H="${5:-900}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="${TMPDIR:-/tmp}/ui-render-profile"
mkdir -p "$(dirname "$OUT")"
for m in light dark; do
  name="亮色"; [ "$m" = dark ] && name="暗色"
  url="file://$HTML?${QS:+$QS&}mode=$m"
  "$CHROME" --headless=new --user-data-dir="$PROFILE" --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size="$W,$H" --virtual-time-budget=8000 \
    --screenshot="$OUT-$name.png" "$url" 2>/dev/null
  echo "→ $OUT-$name.png"
done
