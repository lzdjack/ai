#!/usr/bin/env python3
"""生成全部 PC 页面（reference/src/v5/pc-*.html）。
用法：python3 scripts/gen-pages.py   然后用 scripts/render.sh 出图（见 docs/03-出图流程.md）
外壳（顶栏 + Dock + 工单列表）全部来自定稿主界面，新页面只写中间内容。
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from pages_pc import PAGES  # noqa: E402
from shell_pc import page, board_page  # noqa: E402

ME = '#FFC9A8,#F08F7A);color:#5A2414">林<'
AV = {"王某": '#7FB2FF,#4C7DF0);color:#fff">王<'}  # 换成别的登录人（如测试人视角）
for name, (title, sel, body, *me) in PAGES.items():
    html = board_page(title, *body) if sel is None else page(title, sel, body)
    if me:
        html = html.replace(ME, AV[me[0]], 1)
    (OUT / f"pc-{name}.html").write_text(html, encoding="utf-8")
    print("→", OUT / f"pc-{name}.html")
