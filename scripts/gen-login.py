#!/usr/bin/env python3
"""生成登录页：
- reference/src/v5/login-pc.html（1440×900）
- reference/src/v5/login-m.html（4 屏，1880×1000）：Jira 登录 / GitLab 密码错误 / 登录过期 / 无权查看
账号体系（用户 2026-11-20 定）：只有登录。账号是管理员事先建好的 Jira 和公司 GitLab 账号，
在表单里直接输账号密码，工作台不另设密码、不保存密码。
用法：python3 scripts/gen-login.py
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status  # noqa: E402

HEAD = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{t}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="{css}">
<script>(function(){{var q=new URLSearchParams(location.search);var h=document.documentElement;if(q.get('mode')==='dark')h.classList.add('dark');h.classList.add('s-'+(q.get('s')||'def'))}})()</script>
<style>{style}</style></head><body>'''
TAIL = '<script src="icons.js"></script></body></html>'

COMMON = '''
.aura{position:absolute;border-radius:50%;background:conic-gradient(from 210deg,#4F8BFF,#9B5CFF,#FF5FA8,#FFB14A,#4FD1FF,#4F8BFF);filter:blur(70px);opacity:.36}
html.dark .aura{opacity:.46}
.ring{position:absolute;border-radius:50%;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)}
.nm{font-family:"Hiragino Sans GB","PingFang SC",sans-serif;font-weight:600;letter-spacing:2.8px;color:var(--text)}
.sub{font-family:"Optima","Avenir Next",sans-serif;letter-spacing:3.2px;text-transform:uppercase;font-weight:700;background:linear-gradient(90deg,#2563EB,#6D28D9);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
html.dark .sub{background:linear-gradient(90deg,#7DD3FC,#C4B5FD);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pri{background:var(--blue);color:#fff;box-shadow:0 12px 26px -10px color-mix(in srgb,var(--blue) 85%,transparent)}
.sec{background:var(--fill);color:var(--text)}
.av3{border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex:none;background:linear-gradient(150deg,#FFB14A,#FF5FA8)}
.ib{border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
.ib-o{background:color-mix(in srgb,var(--orange) 16%,transparent);color:var(--orange)}
.ib-b{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--blue)}
.ib-r{background:color-mix(in srgb,var(--red) 14%,transparent);color:var(--red)}
.ib-g{background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)}
.hr{height:1px;background:var(--hair)}
.lnk{color:var(--blue);font-weight:600}
.pill{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 13px;border-radius:15px;font-size:12.5px;color:var(--text-2);box-shadow:none!important}
.lab{font-size:12px;color:var(--text-3);margin:0 0 6px 2px}
.inp{height:46px;border-radius:13px;background:var(--fill);display:flex;align-items:center;gap:10px;padding:0 14px;font-size:14.5px;color:var(--text)}
.inp>i{color:var(--text-3)}
.inp .ph{color:var(--text-3)}
.inp.focus{background:var(--glass-2);box-shadow:0 0 0 2px var(--blue),0 0 0 5px color-mix(in srgb,var(--blue) 18%,transparent)}
.inp.ro{background:transparent;box-shadow:inset 0 0 0 1px var(--hair)}
.dots{letter-spacing:3px;font-size:15px}
.okt{display:inline-flex;align-items:center;gap:4px;color:var(--green);font-size:12.5px;font-weight:600;white-space:nowrap}
.seg2{display:flex;padding:3px;border-radius:12px;background:var(--fill)}
.seg2 span{flex:1;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:13.5px;font-weight:600;color:var(--text-2)}
.seg2 span.on{color:var(--text);background:#fff;box-shadow:0 2px 8px -2px rgba(20,30,70,.18)}
html.dark .seg2 span.on{background:rgba(255,255,255,.14)}
.bd{width:18px;height:18px;border-radius:5px;font-size:10.5px;font-weight:800;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}
.bd-j{background:#2684FF}.bd-g{background:#FC6D26}
.inp.err{background:color-mix(in srgb,var(--red) 7%,transparent);box-shadow:0 0 0 1.5px var(--red)}
.errt{display:flex;align-items:center;gap:6px;color:var(--red);font-size:12.5px;margin:8px 0 0 2px}
.ck{width:17px;height:17px;border-radius:5px;background:var(--blue);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}
.chk{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;font-size:13px;background:var(--fill);color:var(--text-2)}
.chk.on{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--blue);font-weight:600}
.sn{width:20px;height:20px;border-radius:50%;background:var(--text);color:var(--bg,#fff);font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
html:not(.dark) .sn{color:#fff}html.dark .sn{color:#111}
.sn.ok{background:var(--green);color:#fff}
.sh{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;margin-bottom:10px}
.vs2 .it{display:flex;gap:12px;align-items:flex-start;padding-bottom:16px;position:relative}
.vs2 .it:not(:last-child)::after{content:"";position:absolute;left:9.5px;top:24px;bottom:2px;width:1px;background:var(--hair)}
.wt{width:20px;height:20px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--text) 25%,transparent);flex:none}
'''

USER = '<i data-i="user" data-s="17"></i>'
LOCK = '<i data-i="lock" data-s="17"></i>'
EYE = '<i data-i="eye" data-s="17" style="color:var(--text-3)"></i>'
DOTS = '<span class="dots grow">••••••••••</span>'
CHECK = '<i data-i="check" data-s="14" data-w="3"></i>'


def seg(sel):
    j = ' class="on"' if sel == 'j' else ''
    g = ' class="on"' if sel == 'g' else ''
    return f'<div class="seg2" style="width:100%"><span{j}><b class="bd bd-j">J</b>Jira 账号</span><span{g}><b class="bd bd-g">G</b>GitLab 账号</span></div>'


# ---------------- PC ----------------
pc_style = COMMON + '''
.root{display:block;background:var(--wall)}
.card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:30px;display:none;flex-direction:column;z-index:2}
.btnL{height:48px;border-radius:15px;border:0;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px;width:100%}
.ft{position:absolute;left:0;right:0;bottom:34px;display:flex;justify-content:center}
.ver{position:absolute;right:30px;top:26px;font-size:12px;color:var(--text-3)}
html .v-login{display:flex}
'''

pc_login = f'''<div class="card glass v-login" style="width:430px;padding:34px 38px 28px;align-items:stretch">
  <div style="display:flex;flex-direction:column;align-items:center">
    <img src="logo.svg" width="96" height="96" alt="" style="margin:-8px 0 -4px">
    <div class="nm" style="font-size:26px">云匠</div>
    <div class="sub" style="font-size:12px;margin-top:6px">CloudCraft</div>
  </div>
  <div style="margin-top:24px">{seg('j')}</div>
  <div style="margin-top:18px"><div class="lab">Jira 账号</div><div class="inp">{USER}<span class="grow">chenyu</span></div></div>
  <div style="margin-top:14px"><div class="lab">Jira 密码</div><div class="inp focus">{LOCK}{DOTS}{EYE}</div></div>
  <div class="row" style="margin-top:14px;font-size:13px"><span class="ck">{CHECK}</span><span class="t2" style="margin-left:7px">记住我</span><span class="grow"></span><span class="lnk">忘记密码？</span></div>
  <button class="btnL pri" style="margin-top:20px">登录</button>
  <div class="f12 t3" style="margin-top:12px;text-align:center">账号由管理员事先建好，工作台不保存你的密码</div>
</div>'''

pc = HEAD.format(t="登录 · PC", css="pc.css", style=pc_style) + f'''<div class="root">
  <div class="ring" style="width:620px;height:620px;left:410px;top:140px"></div>
  <div class="ring" style="width:900px;height:900px;left:270px;top:0"></div>
  <div class="aura" style="width:420px;height:420px;left:510px;top:240px"></div>
  <span class="ver">v1.0 · 一期</span>
  {pc_login}
  <div class="ft"><span class="pill glass"><i data-i="server" data-s="14"></i>Bot 在公司内网服务器上全天候工作</span></div>
</div>''' + TAIL

# ---------------- 移动端 ----------------
m_style = COMMON + '''
.board{width:1880px;gap:44px}

.mid{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center}
.pad{position:absolute;left:22px;right:22px}
.ctx{border-radius:20px;padding:14px 16px}
.nav{position:absolute;left:18px;right:18px;top:58px;display:flex;align-items:center;font-size:15px}
.inp{height:48px}
'''


def phone(inner):
    return f'<div class="phone"><div class="scr">{status}{inner}<div class="home"></div></div></div>'


head_logo = '''<div class="aura" style="width:130px;height:130px;left:129px;top:92px"></div>
<div class="mid" style="top:90px"><img src="logo.svg" width="112" height="112" style="position:relative" alt="">
<div class="nm" style="font-size:24px">云匠</div><div class="sub" style="font-size:11.5px;margin-top:5px">CloudCraft</div></div>'''

# 1 Jira 登录
p1 = phone(f'''{head_logo}
<div class="pad" style="top:290px">{seg('j')}
  <div style="margin-top:18px"><div class="lab">Jira 账号</div><div class="inp">{USER}<span class="grow">chenyu</span></div></div>
  <div style="margin-top:14px"><div class="lab">Jira 密码</div><div class="inp focus">{LOCK}{DOTS}{EYE}</div></div>
  <div class="row" style="margin-top:14px;font-size:13px"><span class="ck">{CHECK}</span><span class="t2" style="margin-left:7px">记住我</span><span class="grow"></span><span class="lnk">忘记密码？</span></div>
</div>
<div class="pad" style="bottom:60px"><button class="bigbtn pri">登录</button>
<div class="f12 t3" style="text-align:center;margin-top:11px">账号由管理员事先建好，工作台不保存密码</div></div>
''')

# 2 GitLab 登录 · 密码错误
p2 = phone(f'''{head_logo}
<div class="pad" style="top:290px">{seg('g')}
  <div style="margin-top:18px"><div class="lab">GitLab 账号</div><div class="inp">{USER}<span class="grow">chenyu</span></div></div>
  <div style="margin-top:14px"><div class="lab">GitLab 密码</div><div class="inp err">{LOCK}{DOTS}{EYE}</div>
  <div class="errt"><i data-i="alert" data-s="14"></i>账号或密码不对，请检查后重试</div></div>
  <div class="row" style="margin-top:14px;font-size:13px"><span class="ck">{CHECK}</span><span class="t2" style="margin-left:7px">记住我</span><span class="grow"></span><span class="lnk">忘记密码？</span></div>
</div>
<div class="pad" style="bottom:60px"><button class="bigbtn pri">登录</button>
<div class="f12 t3" style="text-align:center;margin-top:11px">账号由管理员事先建好，工作台不保存密码</div></div>
''')

# 5 登录过期（从通知进入）
p5 = phone(f'''
<div class="aura" style="width:110px;height:110px;left:139px;top:96px"></div>
<div class="mid" style="top:96px"><img src="logo.svg" width="96" height="96" style="position:relative" alt="">
<div style="font-size:22px;font-weight:800;margin-top:4px">登录已过期</div>
<div class="f14 t2" style="margin-top:6px">重新登录后，直接回到刚才的工单</div></div>
<div class="pad ctx glass" style="top:292px">
  <div class="row g12"><span class="ib ib-b" style="width:36px;height:36px"><i data-i="bell" data-s="17"></i></span>
  <div class="grow"><div class="f12 t3">你点开的通知</div><div class="row g6" style="margin-top:3px"><span class="mono f14" style="font-weight:600">TK-20871</span><span class="f13 t2">待你审核</span></div></div>
  <i data-i="lock" data-s="16" style="color:var(--text-3)"></i></div>
  <div class="f12 t3" style="margin-top:9px">登录前不显示工单内容</div>
</div>
<div class="pad" style="top:430px">
  <div class="inp ro"><b class="bd bd-j">J</b><span class="grow">chenyu</span><span class="f13 lnk">换账号</span></div>
  <div class="inp focus" style="margin-top:12px">{LOCK}{DOTS}{EYE}</div>
</div>
<div class="pad" style="bottom:88px"><button class="bigbtn pri">登录并打开工单</button>
<div class="f12 t3" style="text-align:center;margin-top:11px">换成别的账号登录时，不会打开这张单</div></div>
<div class="mid" style="bottom:38px"><div class="f13 lnk">先去首页</div></div>''')

# 6 无权查看
p6 = phone('''
<div class="mid" style="top:170px"><span class="ib ib-r" style="width:76px;height:76px"><i data-i="lock" data-s="34" data-w="2"></i></span>
<div style="font-size:22px;font-weight:800;margin-top:20px">当前账号无权查看这张工单</div>
<div class="f14 t2" style="margin-top:10px;text-align:center;line-height:1.65;padding:0 30px">可能换了账号登录，或你的项目权限已被撤销。<br>工单内容不会显示。</div></div>
<div class="pad ctx glass" style="top:430px">
  <div class="row g12"><span class="av3" style="width:38px;height:38px;font-size:12px">陈宇</span>
  <div class="grow"><div class="f12 t3">当前登录</div><div class="row g6" style="margin-top:3px"><b class="bd bd-j">J</b><span class="f15" style="font-weight:600">chenyu</span></div></div>
  <span class="f13 lnk">换个账号</span></div>
  <div class="hr" style="margin:12px 0"></div>
  <div class="row g8 f13 t2"><i data-i="msgq" data-s="15" style="color:var(--text-3)"></i>需要权限请联系项目管理员</div>
</div>
<div class="pad" style="bottom:88px"><button class="bigbtn sec">回到首页</button></div>''')

m = HEAD.format(t="登录 · 移动端", css="m.css", style=m_style) + f'''<div class="board">
<div class="col3">{p1}<div class="lbl">登录 · Jira<em>账号密码直接输</em></div></div>
<div class="col3">{p2}<div class="lbl">登录 · GitLab<em>密码不对时就地提示</em></div></div>
<div class="col3">{p5}<div class="lbl">登录过期<em>登录后回到原工单</em></div></div>
<div class="col3">{p6}<div class="lbl">无权查看<em>换了账号或权限已撤销</em></div></div>
</div>''' + TAIL

(OUT / "login-pc.html").write_text(pc, encoding="utf-8")
(OUT / "login-m.html").write_text(m, encoding="utf-8")
print("ok")
