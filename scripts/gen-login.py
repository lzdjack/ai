#!/usr/bin/env python3
"""生成登录与注册页：
- reference/src/v5/login-pc.html（1440×900）：PC 独立邮箱登录
- reference/src/v5/register-pc.html（1440×900）：PC 独立邮箱注册（带 6 位邮箱验证码）
- reference/src/v5/login-m.html（4 屏，1880×1000）：邮箱登录 / 邮箱注册 / 密码错误 / 登录过期回到原工单
账号体系（用户 2026-11-24 定）：云匠拥有独立注册与登录（邮箱 + 密码，注册带邮箱验证码；私有部署支持开关开放/仅邀请注册）；
GitLab / GitHub / Jira / Tita 等外部工具登录后通过「连接器 + 触发器」接入。
用法：python3 scripts/gen-login.py
"""
import pathlib
import sys

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
.sub{font-family:"Optima","Avenir Next",sans-serif;letter-spacing:3.2px;text-transform:uppercase;font-weight:700;background:linear-gradient(90deg,#3B6FE8,#7C4DDB);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:.88}
html.dark .sub{background:var(--brand-grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:.92}
.pri{background:var(--btn-pri-bg);color:#fff;box-shadow:0 12px 26px -10px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}
.sec{background:var(--fill);color:var(--text)}
.ib{border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
.ib-b{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue)}
.hr{height:1px;background:var(--hair)}
.lnk{color:var(--ink-blue);font-weight:600}
.pill{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 12px;border-radius:var(--r-full);font-size:12px;font-weight:600;color:var(--text-2);box-shadow:none!important}
.lab{font-size:12px;font-weight:600;color:var(--text-2);margin:0 0 6px 2px}
.inp{height:var(--ctl-lg);border-radius:var(--r-lg);background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;gap:10px;padding:0 14px;font-size:14px;color:var(--text)}
.inp>i,.inp>svg{color:var(--text-3);flex:none}
.inp.focus{background:var(--glass-2);border-color:var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo)}
.inp.ro{background:transparent;border-color:var(--hair)}
.dots{letter-spacing:3px;font-size:15px}
.bd{width:18px;height:18px;border-radius:5px;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}
.bd-in{background:linear-gradient(155deg,#3B8BFF,#1D6FE0)}
.bd-up{background:linear-gradient(155deg,#A86BFF,#6D3DF0)}
.inp.err{background:color-mix(in srgb,var(--red) 7%,var(--glass-2));border-color:var(--red);box-shadow:0 0 0 3px var(--error-halo)}
.errt{display:flex;align-items:center;gap:6px;color:var(--ink-red);font-size:12.5px;font-weight:600;margin:8px 0 0 2px}
.ck{width:18px;height:18px;border-radius:5px;background:var(--btn-pri-bg);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none;position:relative}
.cbtn{height:28px;padding:0 10px;border-radius:var(--r-sm);background:var(--glass-2);border:1px solid var(--border-ctl);font-size:12px;font-weight:600;color:var(--ink-blue);display:inline-flex;align-items:center;white-space:nowrap;position:relative}
.cbtn.sent{color:var(--text-3)}
'''

MAIL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
SHIELD = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/></svg>'
PLUG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/></svg>'
IN_IC = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>'
UP_IC = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>'
USER = '<i data-i="user" data-s="17"></i>'
LOCK = '<i data-i="lock" data-s="17"></i>'
EYE = '<i data-i="eye" data-s="17" style="color:var(--text-3)"></i>'
DOTS = '<span class="dots grow">••••••••••</span>'
CHECK = '<i data-i="check" data-s="14" data-w="3"></i>'


def seg(sel):
    a = ' class="on"' if sel == 'in' else ''
    b = ' class="on"' if sel == 'up' else ''
    return f'<div class="cc-seg cc-seg-lg" style="width:100%;display:flex"><span{a} style="flex:1"><b class="bd bd-in">{IN_IC}</b>登录</span><span{b} style="flex:1"><b class="bd bd-up">{UP_IC}</b>注册</span></div>'


# ---------------- PC ----------------
pc_style = COMMON + '''
.root{display:block;background:var(--wall)}
.card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:var(--r-panel);display:flex;flex-direction:column;z-index:2}
.btnL{height:44px;border-radius:var(--r-lg);border:0;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px;width:100%}
.ft{position:absolute;left:0;right:0;bottom:34px;display:flex;justify-content:center}
.ver{position:absolute;right:30px;top:26px;font-size:12px;color:var(--text-3)}
'''

pc_login_card = f'''<div class="card glass" style="width:430px;padding:34px 38px 28px;align-items:stretch">
  <div style="display:flex;flex-direction:column;align-items:center">
    <img src="logo.svg" width="96" height="96" alt="" style="margin:-8px 0 -4px">
    <div class="nm" style="font-size:26px">云匠</div>
    <div class="sub" style="font-size:12px;margin-top:6px">CloudCraft</div>
  </div>
  <div style="margin-top:24px">{seg('in')}</div>
  <div style="margin-top:18px"><div class="lab">邮箱</div><div class="inp">{MAIL}<span class="grow">lin.x@company.com</span></div></div>
  <div style="margin-top:14px"><div class="lab">密码</div><div class="inp focus">{LOCK}{DOTS}{EYE}</div></div>
  <div class="row m-act-row" style="margin-top:8px;font-size:13px"><span class="ck">{CHECK}</span><span class="t2" style="margin-left:7px">记住我</span><span class="grow"></span><span class="lnk" style="min-height:var(--m-touch);display:inline-flex;align-items:center">忘记密码？</span></div>
  <button class="btnL pri" style="margin-top:20px">登录</button>
  <div class="f12 t3" style="margin-top:12px;text-align:center">私有部署可在设置中切换「开放注册 / 仅邀请注册」</div>
</div>'''

pc_register_card = f'''<div class="card glass" style="width:430px;padding:34px 38px 28px;align-items:stretch">
  <div style="display:flex;flex-direction:column;align-items:center">
    <img src="logo.svg" width="96" height="96" alt="" style="margin:-8px 0 -4px">
    <div class="nm" style="font-size:26px">云匠</div>
    <div class="sub" style="font-size:12px;margin-top:6px">CloudCraft</div>
  </div>
  <div style="margin-top:24px">{seg('up')}</div>
  <div style="margin-top:16px"><div class="lab">邮箱</div><div class="inp">{MAIL}<span class="grow">alex@studio.dev</span></div></div>
  <div style="margin-top:12px"><div class="lab">邮箱验证码</div><div class="inp focus">{SHIELD}<span class="grow mono" style="letter-spacing:2px;font-weight:600">482 910</span><span class="cbtn sent">58s 后重发</span></div></div>
  <div style="display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:12px">
    <div><div class="lab">昵称</div><div class="inp">{USER}<span class="grow">Alex</span></div></div>
    <div><div class="lab">设置密码</div><div class="inp">{LOCK}<span class="grow t3" style="font-size:13px">8 位以上字母数字</span></div></div>
  </div>
  <button class="btnL pri" style="margin-top:18px">创建云匠账号</button>
  <div class="f12 t3" style="margin-top:12px;text-align:center">注册即同意服务条款与隐私政策</div>
</div>'''


def pc_wrap(title, card_html, foot_text):
    return HEAD.format(t=title, css="pc.css", style=pc_style) + f'''<div class="root">
  <div class="ring" style="width:620px;height:620px;left:410px;top:140px"></div>
  <div class="ring" style="width:900px;height:900px;left:270px;top:0"></div>
  <div class="aura" style="width:420px;height:420px;left:510px;top:240px"></div>
  <span class="ver">v1.0 · 一期</span>
  {card_html}
  <div class="ft"><span class="pill glass">{PLUG}{foot_text}</span></div>
</div>''' + TAIL


pc_login = pc_wrap("登录 · PC", pc_login_card, "GitLab · GitHub · Jira · Tita 登录后通过「连接器」接入")
pc_register = pc_wrap("注册 · PC", pc_register_card, "注册后即可建项目，通过「连接器 + 触发器」自动开工")

# ---------------- 移动端 ----------------
m_style = COMMON + '''
.board{width:1880px;gap:44px}
.mid{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center}
.pad{position:absolute;left:22px;right:22px}
.ctx{border-radius:20px;padding:14px 16px}
.inp{height:var(--m-input-h);font-size:14.5px}
.cc-seg-lg{height:var(--m-seg-h)}
.ck{width:22px;height:22px;border-radius:6px}.ck::before{content:"";position:absolute;inset:-11px}
.cbtn::before{content:"";position:absolute;inset:-8px -4px;min-height:var(--m-touch)}
.m-act-row{min-height:var(--m-touch)}
'''


def phone(inner):
    return f'<div class="phone"><div class="scr">{status}{inner}<div class="home"></div></div></div>'


head_logo = '''<div class="aura" style="width:130px;height:130px;left:129px;top:88px"></div>
<div class="mid" style="top:84px"><img src="logo.svg" width="108" height="108" style="position:relative" alt="">
<div class="nm" style="font-size:24px">云匠</div><div class="sub" style="font-size:11.5px;margin-top:5px">CloudCraft</div></div>'''

# 1 邮箱登录
p1 = phone(f'''{head_logo}
<div class="pad" style="top:280px">{seg('in')}
  <div style="margin-top:18px"><div class="lab">邮箱</div><div class="inp">{MAIL}<span class="grow">lin.x@company.com</span></div></div>
  <div style="margin-top:14px"><div class="lab">密码</div><div class="inp focus">{LOCK}{DOTS}{EYE}</div></div>
  <div class="row m-act-row" style="margin-top:8px;font-size:13px"><span class="ck">{CHECK}</span><span class="t2" style="margin-left:7px">记住我</span><span class="grow"></span><span class="lnk" style="min-height:var(--m-touch);display:inline-flex;align-items:center">忘记密码？</span></div>
</div>
<div class="pad" style="bottom:56px"><button class="bigbtn pri">登录</button>
<div class="f12 t3" style="text-align:center;margin-top:11px">GitLab / Jira / Tita 登录后通过连接器接入</div></div>
''')

# 2 邮箱注册
p2 = phone(f'''{head_logo}
<div class="pad" style="top:280px">{seg('up')}
  <div style="margin-top:16px"><div class="lab">邮箱</div><div class="inp">{MAIL}<span class="grow">alex@studio.dev</span></div></div>
  <div style="margin-top:12px"><div class="lab">邮箱验证码</div><div class="inp focus">{SHIELD}<span class="grow mono" style="letter-spacing:2px;font-weight:600">482 910</span><span class="cbtn sent">58s</span></div></div>
  <div style="margin-top:12px"><div class="lab">设置密码</div><div class="inp">{LOCK}<span class="grow t3" style="font-size:13.5px">8 位以上字母与数字</span>{EYE}</div></div>
</div>
<div class="pad" style="bottom:56px"><button class="bigbtn pri">创建云匠账号</button>
<div class="f12 t3" style="text-align:center;margin-top:11px">注册即同意服务条款与隐私政策</div></div>
''')

# 3 登录密码错误
p3 = phone(f'''{head_logo}
<div class="pad" style="top:280px">{seg('in')}
  <div style="margin-top:18px"><div class="lab">邮箱</div><div class="inp">{MAIL}<span class="grow">lin.x@company.com</span></div></div>
  <div style="margin-top:14px"><div class="lab">密码</div><div class="inp err">{LOCK}{DOTS}{EYE}</div>
  <div class="errt"><i data-i="alert" data-s="14"></i>邮箱或密码不对，请检查后重试</div></div>
  <div class="row m-act-row" style="margin-top:8px;font-size:13px"><span class="ck">{CHECK}</span><span class="t2" style="margin-left:7px">记住我</span><span class="grow"></span><span class="lnk" style="min-height:var(--m-touch);display:inline-flex;align-items:center">忘记密码？</span></div>
</div>
<div class="pad" style="bottom:56px"><button class="bigbtn pri">登录</button>
<div class="f12 t3" style="text-align:center;margin-top:11px">忘记密码可通过注册邮箱重置</div></div>
''')

# 4 登录过期（从通知进入）
p4 = phone(f'''
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
  <div class="inp ro">{MAIL}<span class="grow">lin.x@company.com</span><span class="f13 lnk">换账号</span></div>
  <div class="inp focus" style="margin-top:12px">{LOCK}{DOTS}{EYE}</div>
</div>
<div class="pad" style="bottom:88px"><button class="bigbtn pri">登录并打开工单</button>
<div class="f12 t3" style="text-align:center;margin-top:11px">换成无权账号登录时，不显示工单内容</div></div>
<div class="mid" style="bottom:28px"><div class="f13 lnk" style="min-height:var(--m-touch);display:inline-flex;align-items:center;padding:0 12px">先去首页</div></div>''')

m = HEAD.format(t="登录与注册 · 移动端", css="m.css", style=m_style) + f'''<div class="board">
<div class="col3">{p1}<div class="lbl">邮箱登录<em>顶部分段切换登录 / 注册</em></div></div>
<div class="col3">{p2}<div class="lbl">邮箱注册<em>邮箱 + 6 位验证码 + 密码</em></div></div>
<div class="col3">{p3}<div class="lbl">密码错误<em>就地红框提示</em></div></div>
<div class="col3">{p4}<div class="lbl">登录过期<em>重新登录后回到原工单</em></div></div>
</div>''' + TAIL

(OUT / "login-pc.html").write_text(pc_login, encoding="utf-8")
(OUT / "register-pc.html").write_text(pc_register, encoding="utf-8")
(OUT / "login-m.html").write_text(m, encoding="utf-8")
print("ok: login-pc.html, register-pc.html, login-m.html")
