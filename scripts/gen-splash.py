#!/usr/bin/env python3
"""生成闪屏：reference/src/v5/splash-pc.html（1440×900）和 splash-m.html（3 台手机，1440×1000）。
用法：python3 scripts/gen-splash.py
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status  # noqa: E402

HEAD = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{t}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="{css}">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{style}</style></head><body>'''

COMMON = '''
.aura{position:absolute;border-radius:50%;background:conic-gradient(from 210deg,#4F8BFF,#9B5CFF,#FF5FA8,#FFB14A,#4FD1FF,#4F8BFF);filter:blur(70px);opacity:.42}
html.dark .aura{opacity:.5}
.ring{position:absolute;border-radius:50%;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)}
.nm{font-family:"Hiragino Sans GB","PingFang SC",sans-serif;font-weight:600;letter-spacing:3.2px;color:var(--text)}
.sub{font-family:"Optima","Avenir Next",sans-serif;letter-spacing:3.6px;text-transform:uppercase;font-weight:700;background:linear-gradient(90deg,#2563EB,#6D28D9);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
html.dark .sub{background:linear-gradient(90deg,#7DD3FC,#C4B5FD);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.bar{border-radius:3px;background:color-mix(in srgb,var(--text) 9%,transparent);overflow:hidden}
.bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#4F8BFF,#9B5CFF 60%,#FF5FA8)}
.st{display:inline-flex;align-items:center;gap:8px;color:var(--text-2)}
.st .d{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px color-mix(in srgb,var(--green) 22%,transparent)}
.spin{width:14px;height:14px;border-radius:50%;border:2px solid color-mix(in srgb,var(--text) 15%,transparent);border-top-color:var(--blue);flex:none}
'''

# ---------------- PC ----------------
pc_style = COMMON + '''
.root{display:block;background:var(--wall)}
.stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ic{width:200px;height:200px;position:relative;z-index:2}
.foot{position:absolute;left:0;right:0;bottom:36px;display:flex;justify-content:center;gap:26px;font-size:12.5px}
.ver{position:absolute;right:30px;top:26px;font-size:12px;color:var(--text-3)}
.chip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 13px;border-radius:15px;font-size:12.5px;color:var(--text-2);box-shadow:none!important}
'''
pc = HEAD.format(t="闪屏 · PC", css="pc.css", style=pc_style) + '''<div class="root">
  <div class="ring" style="width:520px;height:520px;left:460px;top:62px"></div>
  <div class="ring" style="width:760px;height:760px;left:340px;top:-58px"></div>
  <div class="ring" style="width:1000px;height:1000px;left:220px;top:-178px"></div>
  <div class="aura" style="width:360px;height:360px;left:540px;top:142px"></div>
  <span class="ver">v1.0 · 一期</span>
  <div class="stage">
    <img class="ic" src="logo.svg" alt="">
    <div class="nm" style="font-size:42px;margin-top:6px">云匠</div>
    <div class="sub" style="font-size:16px;margin-top:8px">CloudCraft</div>
    <div class="bar" style="width:260px;height:5px;margin-top:46px"><i style="width:68%"></i></div>
    <div class="st" style="font-size:13.5px;margin-top:14px"><span class="spin"></span>正在同步待办 · 已连接公司内网服务器</div>
  </div>
  <div class="foot">
    <span class="chip glass"><span class="st"><span class="d"></span>3 个 Bot 在线</span></span>
    <span class="chip glass">关掉电脑，Bot 也会继续修</span>
  </div>
</div></body></html>'''

# ---------------- 移动端 ----------------
m_style = COMMON + '''
.mid{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center}
.stp{display:flex;align-items:center;gap:10px;font-size:14px;height:30px}
.ok{width:20px;height:20px;border-radius:50%;background:var(--green);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.wt{width:20px;height:20px;border-radius:50%;background:var(--fill);flex:none}
.sk{height:10px;border-radius:5px;background:color-mix(in srgb,var(--text) 8%,transparent)}
'''


def phone(inner):
    return f'<div class="phone"><div class="scr">{status}{inner}<div class="home"></div></div></div>'


p1 = phone('''
<div class="ring" style="width:300px;height:300px;left:34px;top:192px"></div>
<div class="ring" style="width:440px;height:440px;left:-36px;top:122px"></div>
<div class="aura" style="width:200px;height:200px;left:84px;top:242px"></div>
<div class="mid" style="top:262px"><img src="logo.svg" width="160" height="160" style="position:relative" alt="">
<div class="nm" style="font-size:28px;margin-top:2px">云匠</div><div class="sub" style="font-size:12.5px;margin-top:6px">CloudCraft</div></div>
<div class="mid" style="bottom:56px"><div class="f12 t3">关掉电脑，Bot 也会继续修</div></div>''')

p2 = phone('''
<div class="aura" style="width:170px;height:170px;left:99px;top:150px"></div>
<div class="mid" style="top:156px"><img src="logo.svg" width="130" height="130" style="position:relative" alt="">
<div class="nm" style="font-size:24px">云匠</div>
<div class="bar" style="width:180px;height:4px;margin-top:26px"><i style="width:72%"></i></div></div>
<div class="mid" style="top:420px"><div class="col" style="gap:4px;width:250px">
  <div class="stp"><span class="ok">✓</span>已登录 · 公司账号</div>
  <div class="stp"><span class="ok">✓</span>已连接工作台（外网访问）</div>
  <div class="stp"><span class="spin" style="width:20px;height:20px;border-width:2.5px"></span>同步待办…</div>
  <div class="stp t3"><span class="wt"></span>3 个 Bot 在线状态</div>
</div></div>
<div class="mid" style="bottom:56px"><div class="f12 t3">连不上时停在这一步，并说明是哪一项没通</div></div>''')

p3 = phone('''
<div class="aura" style="width:150px;height:150px;left:109px;top:160px"></div>
<div class="mid" style="top:170px"><img src="logo.svg" width="110" height="110" style="position:relative" alt="">
<div class="st" style="font-size:14px;margin-top:14px"><span class="spin"></span>正在打开工单</div></div>
<div style="position:absolute;left:18px;right:18px;top:350px;border-radius:22px;padding:16px" class="glass">
  <div class="row g8"><span class="sc" style="height:17px;padding:0 5px;border-radius:5px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;background:color-mix(in srgb,var(--blue) 13%,transparent);color:var(--ink-blue)">Tita</span><span class="mono f12 t3">TK-20871</span><span class="grow"></span><span class="tag" style="height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 13%,transparent)">待我审核</span></div>
  <div style="font-size:16px;font-weight:700;margin-top:10px">发起审批时点击分组，界面卡住</div>
  <div class="f13 t3" style="margin-top:4px">第 2 轮交付 · 验证 3/4 · Bot-01</div>
  <div class="row g8" style="margin-top:14px"><div class="sk" style="flex:1;height:64px;border-radius:10px"></div><div class="sk" style="flex:1;height:64px;border-radius:10px"></div></div>
  <div class="sk" style="width:70%;margin-top:12px"></div><div class="sk" style="width:46%;margin-top:8px"></div>
</div>
<div class="mid" style="bottom:56px"><div class="f12 t3" style="text-align:center;line-height:1.6">从通知进入 · 登录后直接回到这张单<br>换了账号或没有权限时，不显示工单内容</div></div>''')

m = HEAD.format(t="闪屏 · 移动端", css="m.css", style=m_style) + f'''<div class="board">
<div class="col3">{p1}<div class="lbl">启动<em>图标 + 名称</em></div></div>
<div class="col3">{p2}<div class="lbl">首次加载<em>登录、连接、同步分步显示</em></div></div>
<div class="col3">{p3}<div class="lbl">从通知打开<em>直接回到那张工单</em></div></div>
</div></body></html>'''

(OUT / "splash-pc.html").write_text(pc, encoding="utf-8")
(OUT / "splash-m.html").write_text(m, encoding="utf-8")
print("ok")
