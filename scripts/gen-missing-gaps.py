#!/usr/bin/env python3
"""补齐 UI 全链路审计发现的 6 张缺失高保真设计图（亮色 + 暗色）：
1. reference/src/v5/reset-pwd-pc.html       (1440×900)  → PC-重置密码
2. reference/src/v5/join-invite-pc.html     (1440×900)  → PC-邀请加入
3. reference/src/v5/m-auth-extra.html       (1440×1000) → 移动端-重设密码与邀请
4. reference/src/v5/onboard-pc-3-acct.html  (1440×900)  → PC-步骤器-3-添加账号
5. reference/src/v5/onboard-pc-4-log.html   (1440×900)  → PC-步骤器-4-体检完整日志
6. reference/src/v5/pc-fullpreview.html     (1440×900)  → PC-完整文件与证据预览

用法：python3 scripts/gen-missing-gaps.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status  # noqa: E402


def I(n, s=16, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'


HEAD = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{t}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="{css}">
<script>(function(){{var q=new URLSearchParams(location.search);var h=document.documentElement;if(q.get('mode')==='dark')h.classList.add('dark');h.classList.add('s-'+(q.get('s')||'def'))}})()</script>
<style>{style}</style></head><body>'''
TAIL = '<script src="icons.js"></script></body></html>'

COMMON = '''
.aura{position:absolute;border-radius:50%;background:conic-gradient(from 210deg,#4F8BFF,#9B5CFF,#FF5FA8,#FFB14A,#4FD1FF,#4F8BFF);filter:blur(70px);opacity:.36}
html.dark .aura{opacity:.46}
.ring{position:absolute;border-radius:50%;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)}
.nm{font-family:"Hiragino Sans GB","PingFang SC",sans-serif;font-weight:600;letter-spacing:2.4px;color:var(--text)}
.sub{font-family:"Optima","Avenir Next",sans-serif;letter-spacing:3.2px;text-transform:uppercase;font-weight:700;background:linear-gradient(90deg,#3B6FE8,#7C4DDB);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:.88}
html.dark .sub{background:var(--brand-grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:.92}
.pri{background:var(--btn-pri-bg);color:#fff;box-shadow:0 12px 26px -10px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}
.sec{background:var(--fill);color:var(--text)}
.lnk{color:var(--ink-blue);font-weight:600}
.pill{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 13px;border-radius:var(--r-full);font-size:12px;font-weight:600;color:var(--text-2);box-shadow:none!important}
.lab{font-size:12px;font-weight:600;color:var(--text-2);margin:0 0 6px 2px;display:flex;align-items:center;gap:6px}
.inp{height:var(--ctl-lg);border-radius:var(--r-lg);background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;gap:10px;padding:0 14px;font-size:14px;color:var(--text)}
.inp>i,.inp>svg{color:var(--text-3);flex:none}
.inp.focus{background:var(--glass-2);border-color:var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo)}
.inp.ro{background:color-mix(in srgb,var(--text) 3.5%,transparent);border-color:var(--hair)}
.dots{letter-spacing:3px;font-size:15px}
.cbtn{height:28px;padding:0 10px;border-radius:var(--r-sm);background:var(--glass-2);border:1px solid var(--border-ctl);font-size:12px;font-weight:600;color:var(--ink-blue);display:inline-flex;align-items:center;white-space:nowrap;position:relative}
.cbtn.sent{color:var(--text-3)}
.ctxbox{border-radius:16px;padding:12px 14px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border:1px solid color-mix(in srgb,var(--blue) 22%,transparent)}
'''

PC_STYLE = COMMON + '''
.root{display:block;background:var(--wall)}
.card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:var(--r-panel);display:flex;flex-direction:column;z-index:2}
.btnL{height:44px;border-radius:var(--r-lg);border:0;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px;width:100%}
.ft{position:absolute;left:0;right:0;bottom:30px;display:flex;justify-content:center}
.ver{position:absolute;right:30px;top:26px;font-size:12px;color:var(--text-3)}
'''

MAIL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
SHIELD = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/></svg>'
PLUG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/></svg>'
LOCK = I("lock", 17)
EYE = I("eye", 17, st="color:var(--text-3)")
DOTS = '<span class="dots grow">••••••••••</span>'


def pc_wrap(title, card_html, foot_text):
    return HEAD.format(t=title, css="pc.css", style=PC_STYLE) + f'''<div class="root">
  <div class="ring" style="width:620px;height:620px;left:410px;top:140px"></div>
  <div class="ring" style="width:900px;height:900px;left:270px;top:0"></div>
  <div class="aura" style="width:420px;height:420px;left:510px;top:240px"></div>
  <span class="ver">v1.0 · 一期</span>
  {card_html}
  <div class="ft"><span class="pill glass">{PLUG}{foot_text}</span></div>
</div>''' + TAIL


# ============ 1. PC 重置密码 ============
reset_card = f'''<div class="card glass" style="width:450px;padding:28px 36px 26px;align-items:stretch">
  <div class="row" style="margin-bottom:4px">
    <span class="row g4 lnk f13">{I("chevl",15,2.2)}返回登录</span>
    <span class="grow"></span>
    <span class="tag tg-b" style="height:22px;font-size:11px">邮箱验证重设</span>
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;margin-top:2px">
    <img src="logo.svg" width="76" height="76" alt="" style="margin:-4px 0 0">
    <div style="font-size:21px;font-weight:800;margin-top:4px">重置登录密码</div>
    <div class="f13 t2" style="margin-top:4px">验证注册邮箱后设置新密码，重设后自动登录</div>
  </div>
  <div style="margin-top:18px">
    <div class="lab">注册邮箱</div>
    <div class="inp">{MAIL}<span class="grow">lin.x@company.com</span><span class="row g4 f12" style="color:var(--ink-green);font-weight:600">{I("check",13,2.6)}已识别</span></div>
  </div>
  <div style="margin-top:12px">
    <div class="lab">邮箱验证码</div>
    <div class="inp focus">{SHIELD}<span class="grow mono" style="letter-spacing:2px;font-weight:700">482 910</span><span class="cbtn sent">58s 后重发</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
    <div><div class="lab">新密码</div><div class="inp">{LOCK}{DOTS}{EYE}</div></div>
    <div><div class="lab">确认新密码</div><div class="inp">{LOCK}{DOTS}{EYE}</div></div>
  </div>
  <div class="row g6 f12" style="margin-top:9px;color:var(--ink-green);font-weight:600">
    {I("check",13,2.8)}<span>符合 8 位以上字母与数字要求，两次输入一致</span>
  </div>
  <button class="btnL pri" style="margin-top:16px">确认重设密码并登录</button>
  <div class="f12 t3" style="margin-top:11px;text-align:center">重设成功后，其他已登录设备将下线并要求重新验证</div>
</div>'''
reset_pc = pc_wrap("重置密码 · PC", reset_card, "私有部署未配置 SMTP 时，可由管理员在「设置 → 成员与身份」生成一次性重设链接")


# ============ 2. PC 邀请加入（免 SMTP 一次性邀请链接落地页） ============
invite_card = f'''<div class="card glass" style="width:460px;padding:28px 36px 26px;align-items:stretch">
  <div class="row" style="margin-bottom:4px">
    <span class="tag tg-b" style="height:22px;font-size:11px">{I("link",12)}免 SMTP 一次性邀请链接 · 24h 有效</span>
    <span class="grow"></span>
    <span class="f12 lnk">已有账号，去登录 ›</span>
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;margin-top:4px">
    <img src="logo.svg" width="74" height="74" alt="" style="margin:-4px 0 0">
    <div style="font-size:21px;font-weight:800;margin-top:4px">设密并加入工作空间</div>
    <div class="f12 t3 mono" style="margin-top:4px">https://cc.intra/join/9f2a4c8d</div>
  </div>
  <div class="ctxbox" style="margin-top:14px">
    <div class="row g10">
      <span class="av" style="width:36px;height:36px;font-size:14px;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
      <div class="grow" style="min-width:0">
        <div class="f13 w7 ell">林某 邀请你加入「云匠研发工作空间」</div>
        <div class="f12 t2" style="margin-top:2px">工作空间角色：成员（代码审核与发布确认）</div>
      </div>
    </div>
    <div class="row g6" style="margin-top:10px;padding-top:9px;border-top:1px solid color-mix(in srgb,var(--blue) 16%,transparent);flex-wrap:wrap">
      <span class="tag tg-n" style="height:20px;font-size:11px">已预关联 Tita · 林某</span>
      <span class="tag tg-n" style="height:20px;font-size:11px">已预关联 Jira · lin.x</span>
    </div>
  </div>
  <div style="margin-top:14px">
    <div class="lab">登录邮箱<span class="tag tg-g" style="height:18px;font-size:10.5px;margin-left:auto">管理员已分配</span></div>
    <div class="inp ro">{MAIL}<span class="grow">lin.x@company.com</span><span class="f12 t3">昵称：林某</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
    <div><div class="lab">设置登录密码</div><div class="inp focus">{LOCK}{DOTS}{EYE}</div></div>
    <div><div class="lab">确认密码</div><div class="inp">{LOCK}{DOTS}{EYE}</div></div>
  </div>
  <button class="btnL pri" style="margin-top:16px">设密并加入工作空间</button>
  <div class="f12 t3" style="margin-top:11px;text-align:center">此链接仅首次设密有效；如已失效，请联系管理员在设置中重新复制</div>
</div>'''
invite_pc = pc_wrap("邀请加入 · PC", invite_card, "首次设密完成后直接进入第 1 步「连接器与鉴权」，管理员预填项目与工单源自动继承")


# ============ 3. 移动端 重设密码与邀请（3 屏 1440×1000） ============
M_STYLE = COMMON + '''
.mid{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center}
.pad2{position:absolute;left:20px;right:20px}
.inp{height:var(--m-input-h);font-size:14.5px}
.bigbtn{width:100%;height:var(--m-btn-h);border-radius:15px;border:0;font-size:15.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px}
.cbtn::before{content:"";position:absolute;inset:-8px -4px;min-height:var(--m-touch)}
.bk{display:inline-flex;align-items:center;gap:2px;color:var(--ink-blue);font-size:15px;font-weight:500;min-height:var(--m-touch);white-space:nowrap}
'''


def phone(inner):
    return f'<div class="phone"><div class="scr">{status}{inner}<div class="home"></div></div></div>'


mp1 = phone(f'''
<div class="pad2" style="top:54px">
  <div class="row" style="min-height:var(--m-nav-h)">
    <span class="bk">{I("chevl",20)}登录</span>
    <span class="grow"></span>
    <span class="f12 t3">邮箱重置</span>
  </div>
  <div style="margin-top:10px;display:flex;flex-direction:column;align-items:center">
    <img src="logo.svg" width="68" height="68" alt="">
    <div style="font-size:21px;font-weight:800;margin-top:2px">重置登录密码</div>
    <div class="f13 t2" style="margin-top:4px">验证注册邮箱后重设，自动下线旧会话</div>
  </div>
  <div style="margin-top:20px">
    <div class="lab">注册邮箱</div>
    <div class="inp">{MAIL}<span class="grow">lin.x@company.com</span></div>
  </div>
  <div style="margin-top:12px">
    <div class="lab">6 位邮箱验证码</div>
    <div class="inp focus">{SHIELD}<span class="grow mono" style="letter-spacing:2px;font-weight:700">482 910</span><span class="cbtn sent">58s</span></div>
  </div>
  <div style="margin-top:12px">
    <div class="lab">新密码</div>
    <div class="inp">{LOCK}{DOTS}{EYE}</div>
  </div>
  <div style="margin-top:12px">
    <div class="lab">确认新密码</div>
    <div class="inp">{LOCK}{DOTS}{EYE}</div>
  </div>
  <div class="row g6 f12" style="margin-top:10px;color:var(--ink-green);font-weight:600">
    {I("check",13,2.8)}<span>8 位以上字母与数字，两次一致</span>
  </div>
</div>
<div class="pad2" style="bottom:48px">
  <button class="bigbtn pri">确认重设并登录</button>
  <div class="f12 t3" style="text-align:center;margin-top:10px">无邮件服务？可由管理员生成一次性重设链接</div>
</div>''')

mp2 = phone(f'''
<div class="aura" style="width:120px;height:120px;left:134px;top:68px"></div>
<div class="pad2" style="top:54px">
  <div class="row" style="min-height:var(--m-nav-h)">
    <span class="tg" style="height:22px;font-size:11px;color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 12%,transparent)">免 SMTP 一次性邀请</span>
    <span class="grow"></span>
    <span class="f13 lnk" style="min-height:var(--m-touch);display:inline-flex;align-items:center">去登录</span>
  </div>
  <div style="margin-top:6px;display:flex;flex-direction:column;align-items:center">
    <img src="logo.svg" width="68" height="68" alt="" style="position:relative">
    <div style="font-size:21px;font-weight:800;margin-top:2px">设密并加入工作空间</div>
    <div class="f12 t3 mono" style="margin-top:3px">cc.intra/join/9f2a4c8d</div>
  </div>
  <div class="ctxbox" style="margin-top:16px">
    <div class="row g10">
      <span class="av2" style="width:36px;height:36px;font-size:14px;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
      <div class="grow" style="min-width:0">
        <div class="f13 w6 ell">林某 邀请你加入「云匠」</div>
        <div class="f12 t2" style="margin-top:2px">成员 · 已关联 Tita / Jira 身份</div>
      </div>
    </div>
  </div>
  <div style="margin-top:14px">
    <div class="lab">分配邮箱</div>
    <div class="inp ro">{MAIL}<span class="grow">lin.x@company.com</span></div>
  </div>
  <div style="margin-top:12px">
    <div class="lab">设置登录密码</div>
    <div class="inp focus">{LOCK}{DOTS}{EYE}</div>
  </div>
  <div style="margin-top:12px">
    <div class="lab">确认密码</div>
    <div class="inp">{LOCK}{DOTS}{EYE}</div>
  </div>
</div>
<div class="pad2" style="bottom:48px">
  <button class="bigbtn pri">设密并加入工作空间</button>
  <div class="f12 t3" style="text-align:center;margin-top:10px">加入后自动同步管理员已配好的项目权限</div>
</div>''')

mp3 = phone(f'''
<div class="pad2" style="top:54px">
  <div class="row" style="min-height:var(--m-nav-h)">
    <span class="bk">{I("chevl",20)}登录</span>
    <span class="grow"></span>
    <span class="f12 t3">链接失效兜底</span>
  </div>
  <div style="margin-top:46px;display:flex;flex-direction:column;align-items:center;text-align:center">
    <span style="width:68px;height:68px;border-radius:22px;background:color-mix(in srgb,var(--orange) 14%,var(--glass-2));border:1px solid color-mix(in srgb,var(--orange) 35%,transparent);display:flex;align-items:center;justify-content:center;color:var(--ink-orange)">{I("alert",32,2)}</span>
    <div style="font-size:21px;font-weight:800;margin-top:16px">链接已使用或已过期</div>
    <div class="f13 t2" style="margin-top:8px;line-height:1.55;max-width:296px">一次性邀请与重设密码链接仅首次设置有效，超过 24 小时或已绑定邮箱后将自动作废</div>
  </div>
  <div class="glass" style="border-radius:18px;padding:14px 16px;margin-top:26px">
    <div class="row g8 f13 w6">{I("link",15,st="color:var(--ink-blue)")}<span class="mono f12 t2 ell">cc.intra/join/9f2a4c8d</span></div>
    <div class="f12 t2" style="margin-top:10px;line-height:1.6">
      <b style="color:var(--text)">接下来怎么办：</b><br>
      1. 如果你已设置过密码，请直接用邮箱与密码登录；<br>
      2. 若尚未激活，请管理员在 PC 端「设置 → 成员与身份」点击「重新复制一次性链接」。
    </div>
  </div>
</div>
<div class="pad2" style="bottom:48px">
  <button class="bigbtn pri">返回邮箱登录</button>
  <button class="bigbtn sec" style="margin-top:10px">联系工作空间管理员</button>
</div>''')

m_auth_extra = HEAD.format(t="移动端 · 重设密码与邀请", css="m.css", style=M_STYLE) + f'''<div class="board">
<div class="col3">{mp1}<div class="lbl">重置密码<em>邮箱验证码 + 设新密</em></div></div>
<div class="col3">{mp2}<div class="lbl">免 SMTP 邀请加入<em>一次性链接设密进工作空间</em></div></div>
<div class="col3">{mp3}<div class="lbl">链接失效兜底<em>已使用或超 24h 指引重发</em></div></div>
</div>''' + TAIL


# ============ 4. PC-步骤器-3-添加账号（叠加在 onboard-pc-prod.html 上） ============
onboard3_base = (OUT / "onboard-pc-prod.html").read_text(encoding="utf-8")
ACCT_DRW_CSS = '''<style>
.flab{font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.dsel{height:var(--ctl-md);border-radius:var(--r-md);background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);display:flex;align-items:center;gap:8px;padding:0 12px;font-size:13px;font-weight:600;color:var(--text);min-width:0}
.dinp{height:var(--ctl-md);border-radius:var(--r-md);background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;gap:8px;padding:0 12px;font-size:13px;color:var(--text);min-width:0}
.tsec{border-radius:15px;padding:13px 15px;background:var(--fill);display:flex;flex-direction:column;gap:10px}
.permcard{flex:1;border-radius:13px;padding:11px 13px;border:1.5px solid var(--hair);background:var(--glass-2);display:flex;flex-direction:column;gap:5px;min-width:0}
.permcard.on-b{border-color:var(--blue);background:color-mix(in srgb,var(--blue) 9%,var(--glass-2));box-shadow:0 6px 16px -10px color-mix(in srgb,var(--blue) 55%,transparent)}
.ckbox{border-radius:12px;padding:10px 12px;background:var(--glass-2);border:1px solid var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo);font-size:12px;line-height:1.6;color:var(--text);overflow-wrap:anywhere}
</style>'''
ACCT_DRW = f'''{ACCT_DRW_CSS}
<div class="cc-scrim"></div>
<div class="cc-drawer" style="width:580px">
  <div class="cc-drawer-hd">
    <span class="ic-box" style="width:38px;height:38px;border-radius:11px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("user",18)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g8"><span style="font-size:17px;font-weight:800">添加复现账号 / 环境入口</span><span class="cc-tag cc-tag-b">Bot 试登录</span></div>
      <div class="f12 t3 ell" style="margin-top:2px">凭据加密存储，展示与 AI 上下文引用前自动脱敏</div>
    </div>
    <span class="cc-close">{I("x",16,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:13px">
    <div class="tsec">
      <div class="row g10">
        <div class="grow">
          <div class="flab">所属环境<span class="lnk f11" style="margin-left:auto">+ 新增环境入口</span></div>
          <div class="dsel"><span class="tag tg-o" style="height:19px;font-size:10.5px">正式</span><span class="grow ell">正式环境 · www.tita.com/okr</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
        <div style="width:176px;flex:none">
          <div class="flab">对应角色</div>
          <div class="dsel"><span class="grow">普通员工</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
      </div>
    </div>

    <div class="tsec">
      <div class="row">
        <div class="flab" style="margin:0">登录方式与凭据</div>
        <div class="grow"></div>
        <div class="cc-seg cc-seg-sm"><span>账号密码</span><span class="on">Cookie（免填账号名）</span></div>
      </div>
      <div>
        <div class="flab">粘贴浏览器 Cookie<span class="f11 t3" style="font-weight:400">支持 Header 原始串或 JSON</span></div>
        <div class="ckbox mono">SESSION=6f2c9a…e81b; tita_uid=882041; tita_tenant=shifan; Path=/; Expires=Sun, 23 Nov 2026</div>
      </div>
      <div class="row g8 f12 t2" style="padding:8px 10px;border-radius:10px;background:var(--glass-2)">
        {I("spark",14,st="color:var(--ink-purple)")}
        <span class="grow">填 Cookie 不用手动填写姓名，点「试登录」后 Bot 自动识别当前身份并在过期前 3 天提醒续期</span>
      </div>
    </div>

    <div class="tsec">
      <div class="flab" style="margin:0">数据权限<span class="f11 t3" style="font-weight:400">正式环境默认选中「只能查看」，避免误动线上真实数据</span></div>
      <div class="row g10">
        <div class="permcard on-b">
          <div class="row g6"><span style="color:var(--ink-blue)">{I("eye",15)}</span><b class="f13" style="color:var(--ink-blue)">只能查看（推荐）</b><span class="grow"></span><span class="cc-radio is-checked"></span></div>
          <div class="f12 t2" style="line-height:1.5">只看页面与截图复现；交互守卫拦截点击保存、提交、删除，不误阻查询接口。</div>
        </div>
        <div class="permcard">
          <div class="row g6"><span style="color:var(--ink-green)">{I("edit",15)}</span><b class="f13">可以修改</b><span class="grow"></span><span class="cc-radio"></span></div>
          <div class="f12 t3" style="line-height:1.5">允许新增与编辑数据；正式环境仅建议用于已隔离的测试/沙箱账号。</div>
        </div>
      </div>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <button class="cc-btn cc-btn-lg cc-btn-sec">取消</button>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-lg cc-btn-glass">{I("zap",14)}保存前试登录</button>
    <button class="cc-btn cc-btn-lg cc-btn-pri">{I("check",14,2.6)}保存并识别账号</button>
  </div>
</div>'''
onboard_pc_3_acct = onboard3_base.replace("<title>第一次使用 · 环境与账号</title>", "<title>第一次使用 · 添加复现账号</title>", 1).replace(
    '</div><script src="icons.js">', ACCT_DRW + '</div><script src="icons.js">', 1
)


# ============ 5. PC-步骤器-4-体检完整日志（叠加在 onboard-pc-4.html 上） ============
onboard4_base = (OUT / "onboard-pc-4.html").read_text(encoding="utf-8")
CHKLOG_CSS = '''<style>
.strow{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}
.stcard{flex:1;min-width:0;border-radius:12px;padding:9px 10px;background:var(--fill);border:1px solid var(--hair)}
.stcard.wn{background:color-mix(in srgb,var(--orange) 10%,var(--glass-2));border-color:color-mix(in srgb,var(--orange) 36%,transparent)}
.term2{border-radius:14px;background:#121318;border:1px solid rgba(255,255,255,.08);padding:12px 14px;font-family:"SF Mono","Menlo",monospace;font-size:11.5px;line-height:1.78;color:#C8D1E2;overflow:hidden}
.term2 .ln{display:flex;gap:8px;white-space:nowrap}
.term2 .no{width:22px;text-align:right;color:#5D667B;flex:none;user-select:none}
.term2 .ts{color:#6E7891;flex:none}
.term2 .ok{color:#5EEAD4;flex:none}
.term2 .wn{color:#FBBF24;flex:none}
.term2 .dm{color:#7C869E;flex:none}
.term2 .rd{padding:0 5px;border-radius:4px;background:rgba(255,180,60,.16);color:#FCD34D}
</style>'''
CHKLOG_DRW = f'''{CHKLOG_CSS}
<div class="cc-scrim"></div>
<div class="cc-drawer" style="width:680px">
  <div class="cc-drawer-hd">
    <span class="ck3" style="width:38px;height:38px;background:var(--btn-ok-bg)">{I("check",20,3)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g8"><span style="font-size:17px;font-weight:800">AI 自动体检完整日志</span><span class="cc-tag cc-tag-g">必需项全部通过</span></div>
      <div class="f12 t3 mono ell" style="margin-top:2px">Bot-02 · 今天 10:42 · 总耗时 3 分 52 秒 · 凭据已脱敏</div>
    </div>
    <span class="cc-close">{I("x",16,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:12px">
    <div class="strow">
      <div class="stcard"><div class="f11 t3">AI 引擎</div><div class="f13 w7" style="color:var(--ink-green);margin-top:2px">1.2s 通过</div></div>
      <div class="stcard"><div class="f11 t3">连接器</div><div class="f13 w7" style="color:var(--ink-green);margin-top:2px">4 / 4 连通</div></div>
      <div class="stcard"><div class="f11 t3">试构建</div><div class="f13 w7" style="color:var(--ink-green);margin-top:2px">3m18s ✓</div></div>
      <div class="stcard"><div class="f11 t3">只读隔离</div><div class="f13 w7" style="color:var(--ink-green);margin-top:2px">硬禁写 ✓</div></div>
      <div class="stcard wn"><div class="f11" style="color:var(--ink-orange)">环境试登录</div><div class="f13 w7" style="color:var(--ink-orange);margin-top:2px">6/7 · 1 过期</div></div>
    </div>

    <div class="row g8">
      <div class="cc-seg cc-seg-sm"><span class="on">全部日志 (46 行)</span><span>仅警告 (1)</span><span>试构建详情</span></div>
      <span class="grow"></span>
      <span class="f11 t3 row g4">{I("shield",12,st="color:var(--ink-green)")}Cookie / Token 在展示与导出前均已打码</span>
    </div>

    <div class="term2">
      <div class="ln"><span class="no">01</span><span class="ts">10:38:12</span><span class="ok">[PASS]</span><span>ai-engine pi(gpt-6.2-sol) · gateway 200 OK (1.2s)</span></div>
      <div class="ln"><span class="no">08</span><span class="ts">10:38:16</span><span class="ok">[PASS]</span><span>connectors OK: gitlab, github, local(/work/tita), jira</span></div>
      <div class="ln"><span class="no">15</span><span class="ts">10:38:21</span><span class="dm">[EXEC]</span><span>git clone --depth=1 gitlab.tita.work/fe/tita-okr-web</span></div>
      <div class="ln"><span class="no">22</span><span class="ts">10:41:39</span><span class="ok">[PASS]</span><span>pnpm build-prod --no-sourcemap · dist 14.8MB (3m18s)</span></div>
      <div class="ln"><span class="no">29</span><span class="ts">10:41:43</span><span class="ok">[PASS]</span><span>ro-mount tita-ui-kit · chmod a-w verified, push blocked</span></div>
      <div class="ln"><span class="no">36</span><span class="ts">10:41:58</span><span class="ok">[PASS]</span><span>playwright login test.tita.work · 4 accounts signed in</span></div>
      <div class="ln"><span class="no">41</span><span class="ts">10:42:02</span><span class="wn">[WARN]</span><span>login www.tita.com · cookie=<span class="rd">•••REDACTED•••</span> → 401</span></div>
      <div class="ln"><span class="no">42</span><span class="ts">10:42:02</span><span class="dm">[HINT]</span><span class="wn">正式环境「OKR 管理员」Cookie 过期，不挡开工，用到时再提醒</span></div>
      <div class="ln"><span class="no">46</span><span class="ts">10:42:04</span><span class="ok">[DONE]</span><span>preflight summary: 7 passed · 1 non-blocking warning</span></div>
    </div>

    <div class="row g10 f12" style="padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--orange) 10%,transparent);border:1px solid color-mix(in srgb,var(--orange) 28%,transparent)">
      <span style="color:var(--ink-orange);flex:none">{I("alert",15)}</span>
      <span class="grow t2"><b style="color:var(--text)">唯一提醒：</b>正式环境「OKR 管理员」Cookie 过期，若现在用不到正式管理员视角可直接点「关闭并开始使用」。</span>
      <span class="f12 lnk" style="flex:none">去补录 Cookie ›</span>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <button class="cc-btn cc-btn-lg cc-btn-glass">{I("copy",14)}复制脱敏日志</button>
    <button class="cc-btn cc-btn-lg cc-btn-glass">{I("download",14)}导出 .log</button>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-lg cc-btn-sec">{I("refresh",14)}重新体检</button>
    <button class="cc-btn cc-btn-lg cc-btn-pri">关闭并返回开工</button>
  </div>
</div>'''
onboard_pc_4_log = onboard4_base.replace("<title>第一次使用 · AI 体检并开工</title>", "<title>第一次使用 · AI 体检完整日志</title>", 1).replace(
    '</div><script src="icons.js">', CHKLOG_DRW + '</div><script src="icons.js">', 1
)


# ============ 6. PC-完整文件与证据预览（叠加在 pc-code.html 上） ============
code_base = (OUT / "pc-code.html").read_text(encoding="utf-8")
FULLPREV_CSS = '''<style>
.fp-dlg{left:50%;top:50%;width:1090px;height:780px;transform:translate(-50%,-50%);display:flex;flex-direction:column;overflow:hidden;padding:0}
.fp-hd{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--hair);flex:none}
.fp-bd{flex:1;min-height:0;display:flex}
.fp-side{width:244px;flex:none;border-right:1px solid var(--hair);padding:12px 10px;display:flex;flex-direction:column;gap:4px;background:color-mix(in srgb,var(--text) 2%,transparent)}
.fp-nav{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:9px;font-size:12px;color:var(--text-2);white-space:nowrap}
.fp-nav.on{background:color-mix(in srgb,var(--blue) 13%,transparent);color:var(--ink-blue);font-weight:600}
.fp-main{flex:1;min-width:0;display:flex;flex-direction:column}
.fp-code{flex:1;min-height:0;padding:8px 0;font-family:"SF Mono","Menlo",monospace;font-size:12.5px;line-height:1.68;overflow:hidden}
.fp-cl{display:flex;padding:0 16px;white-space:pre}
.fp-cl.add{background:color-mix(in srgb,var(--green) 14%,transparent)}
.fp-cl.del{background:color-mix(in srgb,var(--red) 12%,transparent);opacity:.86}
.fp-cl.hl{background:color-mix(in srgb,var(--blue) 10%,transparent);box-shadow:inset 3px 0 0 var(--blue)}
.fp-n{width:38px;color:var(--text-3);text-align:right;padding-right:12px;user-select:none;flex:none}
.fp-s{width:18px;font-weight:700;flex:none}
.fp-cl.add .fp-s{color:var(--ink-green)}.fp-cl.del .fp-s{color:var(--ink-red)}
.fp-evstrip{border-top:1px solid var(--hair);padding:10px 18px;display:flex;align-items:center;gap:12px;background:color-mix(in srgb,var(--text) 2%,transparent);flex:none}
</style>'''
import html as _html
code_lines = [
    ("01", "", "import { useEffect, useState } from 'react';"),
    ("02", "", "import { fetchGroupMembers } from './api/groups';"),
    ("03", "", "import { createAbortGate } from '../utils/abortable';"),
    ("··", "", "··· 顶部类型定义（第 4–37 行） ···"),
    ("38", "", "export function GroupPicker({ groupId, onSelect }: Props) {"),
    ("39", "", "  const [members, setMembers] = useState<Member[]>([]);"),
    ("40", "", "  const [loading, setLoading] = useState(false);"),
    ("41", "del", "  useEffect(() => {"),
    ("42", "del", "    fetchGroupMembers(groupId).then(res => setMembers(res.items));"),
    ("43", "del", "  }, [groupId]);"),
    ("44", "add", "  useEffect(() => {"),
    ("45", "add", "    const gate = createAbortGate();"),
    ("46", "add", "    setLoading(true);"),
    ("47", "add", "    fetchGroupMembers(groupId, { signal: gate.signal }).then((res) => {"),
    ("48", "hl",  "      if (gate.stale()) return; // 丢弃早先点击分组的过期响应"),
    ("49", "add", "      setMembers(res.items); setLoading(false);"),
    ("50", "add", "    });"),
    ("51", "add", "    return () => gate.abort();"),
    ("52", "add", "  }, [groupId]);"),
    ("53", "", "  return <MemberList members={members} loading={loading} onPick={onSelect} />;"),
    ("54", "", "}"),
    ("··", "", "··· 第 55–115 行未改动 ···"),
    ("116", "", "function MemberList({ members, loading, onPick }: ListProps) {"),
    ("117", "", "  if (loading) return <Spinner label=\"正在同步分组成员\" />;"),
    ("118", "", "  return <ul>{members.map(m => <li key={m.id} onClick={() => onPick(m)}>{m.name}</li>)}</ul>;"),
    ("119", "", "}"),
]
fp_lines_html = "".join(
    f'<div class="fp-cl {cls}"><span class="fp-n">{ln}</span><span class="fp-s">{"+" if cls=="add" else ("−" if cls=="del" else ("•" if cls=="hl" else ""))}</span><span>{_html.escape(txt)}</span></div>'
    for ln, cls, txt in code_lines
)
FULLPREV_DLG = f'''{FULLPREV_CSS}
<div class="scrim"></div>
<div class="dlg fp-dlg">
  <div class="fp-hd">
    <span class="st st-m" style="width:20px;height:20px;border-radius:6px;font-size:11px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center">M</span>
    <span class="mono f14 w7">src/approval/GroupPicker.tsx</span>
    <span class="tag tg-n" style="height:21px;font-size:11px">完整文件 · 184 行</span>
    <span class="f12 num w6" style="color:var(--ink-green)">+18</span>
    <span class="f12 num w6" style="color:var(--ink-red)">−8</span>
    <div class="cc-seg cc-seg-sm" style="margin-left:10px"><span class="on">完整代码文件</span><span>证据大图对照 (4)</span></div>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-sm cc-btn-glass">{I("copy",13)}复制第 48 行引用</button>
    <button class="cc-btn cc-btn-sm cc-btn-danger-solid">{I("undo",13)}附到打回</button>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="fp-bd">
    <div class="fp-side">
      <div class="f11 t3" style="padding:2px 8px 6px;font-weight:700">文件符号与证据</div>
      <div class="fp-nav">{I("file",13)}顶部 Imports (1–37)</div>
      <div class="fp-nav on">{I("code",13)}GroupPicker (38–54)<span class="grow"></span><span class="f11">+18</span></div>
      <div class="fp-nav">{I("layers",13)}MemberList (116–184)</div>
      <div class="grow"></div>
      <div style="border-radius:12px;padding:10px;background:color-mix(in srgb,var(--purple) 9%,var(--glass-2));border:1px solid color-mix(in srgb,var(--purple) 22%,transparent)">
        <div class="row g6 f12 w6" style="color:var(--ink-purple)">{I("spark",13)}第 48 行 · 本单 AI</div>
        <div class="f11 t2" style="margin-top:4px;line-height:1.5">已用 AbortGate 拦截过期请求；注意第 48 行直接 return，若 abort 后未关闭 loading 需确认。</div>
      </div>
    </div>
    <div class="fp-main">
      <div class="fp-code">{fp_lines_html}</div>
      <div class="fp-evstrip">
        <span class="f12 w6 t2" style="flex:none">关联证据原图：</span>
        <div class="row g8" style="padding:5px 10px;border-radius:10px;background:var(--glass-2);border:1px solid var(--hair)">
          <span class="tag tg-r" style="height:19px;font-size:10.5px">复现前</span>
          <span class="f12">切换销售部卡死 · 0:08</span>
          <span class="f11 lnk">放大 ↗</span>
        </div>
        <div class="row g8" style="padding:5px 10px;border-radius:10px;background:var(--glass-2);border:1px solid var(--hair)">
          <span class="tag tg-g" style="height:19px;font-size:10.5px">修复后</span>
          <span class="f12">连续切换 5 组流畅 · 0:18</span>
          <span class="f11 lnk">放大 ↗</span>
        </div>
        <span class="grow"></span>
        <span class="f12 lnk">{I("expand",12)} 切到双图全屏对照</span>
      </div>
    </div>
  </div>
</div>'''
pc_fullpreview = code_base.replace("<title>代码改动 · 云匠</title>", "<title>完整文件与证据预览 · 云匠</title>", 1).replace(
    '</div>\n<script src="../v3/shots.js">', FULLPREV_DLG + '</div>\n<script src="../v3/shots.js">', 1
)
assert FULLPREV_DLG in pc_fullpreview, "Failed to inject FULLPREV_DLG into pc-code.html"


# ============ 7. PC-证据大图对照（同弹窗切到「证据大图对照 (4)」） ============
evid_base = (OUT / "pc-evidence.html").read_text(encoding="utf-8")
EVIDZOOM_CSS = '''<style>
.ez-card{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:10px;border:1px solid transparent}
.ez-card.on{background:color-mix(in srgb,var(--blue) 12%,transparent);border-color:color-mix(in srgb,var(--blue) 35%,transparent)}
.ez-card.warn{background:color-mix(in srgb,var(--orange) 10%,transparent);border-color:color-mix(in srgb,var(--orange) 32%,transparent)}
.ez-split{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 20px 12px}
.ez-pane{display:flex;flex-direction:column;gap:9px;min-width:0;min-height:0}
.ez-frame{flex:1;min-height:0;border-radius:14px;overflow:hidden;border:1.5px solid var(--hair);position:relative;display:flex;flex-direction:column}
.ez-frame.ok{border-color:color-mix(in srgb,var(--green) 55%,transparent);box-shadow:0 12px 28px -16px color-mix(in srgb,var(--green) 55%,transparent)}
.ez-frame .shot{flex:1;min-height:0;border:0;border-radius:0}
.ez-scrubber{border-top:1px solid var(--hair);padding:12px 20px;display:flex;align-items:center;gap:12px;background:color-mix(in srgb,var(--text) 2%,transparent);flex:none}
.ez-track{flex:1;height:6px;border-radius:3px;background:var(--well);position:relative;overflow:visible}
.ez-fill{position:absolute;left:0;top:0;bottom:0;width:44%;border-radius:3px;background:linear-gradient(90deg,var(--blue),var(--green))}
.ez-knob{position:absolute;left:44%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;border:2.5px solid var(--blue);box-shadow:0 2px 8px rgba(0,0,0,.35)}
</style>'''
EVIDZOOM_DLG = f'''{FULLPREV_CSS}{EVIDZOOM_CSS}
<div class="scrim"></div>
<div class="dlg fp-dlg">
  <div class="fp-hd">
    <span class="ic-box" style="width:24px;height:24px;border-radius:7px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("video",13)}</span>
    <span class="mono f14 w7">TK-20871 · 第 2 轮证据大图对照</span>
    <span class="tag tg-n" style="height:21px;font-size:11px">4 项证据 · 2.18.0-fix.2</span>
    <div class="cc-seg cc-seg-sm" style="margin-left:10px"><span>完整代码文件</span><span class="on">证据大图对照 (4)</span></div>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-sm cc-btn-glass">{I("check",13,2.6)}标为已查阅</button>
    <button class="cc-btn cc-btn-sm cc-btn-danger-solid">{I("undo",13)}附到打回</button>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="fp-bd">
    <div class="fp-side" style="gap:6px">
      <div class="f11 t3" style="padding:2px 6px 4px;font-weight:700">本轮全部证据 (4)</div>
      <div class="ez-card"><span class="tag tg-n" style="height:19px;font-size:10px">原单</span><div class="col grow" style="min-width:0"><span class="f12 w6 ell">原单复现截图</span><span class="f11 t3">已查阅 · 销售部</span></div></div>
      <div class="ez-card on"><span class="tag tg-o" style="height:19px;font-size:10px">修前</span><div class="col grow" style="min-width:0"><span class="f12 w6 ell">修前复现 · 0:18</span><span class="f11" style="color:var(--ink-blue)">正在对照（左）</span></div></div>
      <div class="ez-card on"><span class="tag tg-g" style="height:19px;font-size:10px">修后</span><div class="col grow" style="min-width:0"><span class="f12 w6 ell">修后复测 · 0:41</span><span class="f11" style="color:var(--ink-green)">正在对照（右）</span></div></div>
      <div class="ez-card warn"><span class="tag tg-o" style="height:19px;font-size:10px">待确认</span><div class="col grow" style="min-width:0"><span class="f12 w6 ell">管理员未测</span><span class="f11 lnk">缺账号 · 补充 ›</span></div></div>
      <div class="grow"></div>
      <div style="border-radius:12px;padding:10px;background:color-mix(in srgb,var(--purple) 9%,var(--glass-2));border:1px solid color-mix(in srgb,var(--purple) 22%,transparent)">
        <div class="row g6 f12 w6" style="color:var(--ink-purple)">{I("spark",13)}对照结论 · Bot-01</div>
        <div class="f11 t2" style="margin-top:4px;line-height:1.5">普通员工 kq-staff-03 验证 3 步通过；旧请求晚返回已在第 48 行丢弃。</div>
      </div>
    </div>
    <div class="fp-main">
      <div class="row g10" style="padding:10px 20px 0;flex:none">
        <div class="cc-seg cc-seg-xs"><span class="on">修前 vs 修后并排</span><span>单图全屏</span></div>
        <span class="chip2" style="height:26px;font-size:11.5px">{I("user",12)}普通员工 kq-staff-03</span>
        <span class="chip2" style="height:26px;font-size:11.5px">{I("code",12)}<span class="mono">GroupPicker.tsx:48</span></span>
        <span class="grow"></span>
        <span class="f12 lnk">{I("download",13)}下载原图 / 录屏 MP4</span>
      </div>
      <div class="ez-split">
        <div class="ez-pane">
          <div class="row g6"><span class="tag tg-o">修前复现</span><span class="f13 w7">0:18 切「销售部」卡死转圈</span><span class="grow"></span><span class="f11 t3">第 1 轮同一场景</span></div>
          <div class="ez-frame"><div class="shot" data-s="before" data-cap="修前复现 · 0:18 · 请求乱序阻塞"></div></div>
          <div class="row g6 f12 t2" style="padding:8px 11px;border-radius:10px;background:var(--fill)">
            <span style="color:var(--ink-orange);flex:none">{I("alert",14)}</span>
            <span class="ell">研发中心请求晚于销售部返回（+420ms），列表一直转圈无响应</span>
          </div>
        </div>
        <div class="ez-pane">
          <div class="row g6"><span class="tag tg-g">修后复测</span><span class="f13 w7" style="color:var(--ink-green)">0:41 连续切换 3 组流畅</span><span class="grow"></span><span class="f11 w6 lnk">未查阅 · 待确认</span></div>
          <div class="ez-frame ok"><div class="shot" data-s="after" data-cap="修后复测 · 0:41 · 选中何嘉明"></div></div>
          <div class="row g6 f12 t2" style="padding:8px 11px;border-radius:10px;background:color-mix(in srgb,var(--green) 10%,transparent)">
            <span style="color:var(--ink-green);flex:none">{I("check",14,2.6)}</span>
            <span class="ell">AbortGate 丢弃过期响应，切换「产品部 → 销售部」0ms 完成</span>
          </div>
        </div>
      </div>
      <div class="ez-scrubber">
        <span class="ic-box" style="width:28px;height:28px;border-radius:50%;background:var(--btn-pri-bg)">{I("play",12)}</span>
        <span class="mono f12 w6">0:18</span>
        <div class="ez-track"><div class="ez-fill"></div><div class="ez-knob"></div></div>
        <span class="mono f12 t3">0:41</span>
        <span class="tag tg-n mono">1.0x</span>
        <span class="f12 lnk">跳到关联代码 :48 ›</span>
      </div>
    </div>
  </div>
</div>'''
pc_evidzoom = evid_base.replace("<title>证据 · 云匠</title>", "<title>证据大图对照 · 云匠</title>", 1).replace(
    '</div>\n<script src="../v3/shots.js">', EVIDZOOM_DLG + '</div>\n<script src="../v3/shots.js">', 1
)
assert EVIDZOOM_DLG in pc_evidzoom, "Failed to inject EVIDZOOM_DLG into pc-evidence.html"


# ============ 8. 移动端 · 完整文件与证据预览（3 屏 1440×1000） ============
M_PREV_STYLE = '''
.nav{min-height:var(--m-nav-h);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 12px;gap:6px;position:relative;z-index:var(--z-sticky)}
.bk{display:inline-flex;align-items:center;gap:2px;color:var(--ink-blue);font-size:15px;font-weight:500;min-height:var(--m-touch);justify-self:start;white-space:nowrap}
.nav>*:nth-child(3){justify-self:end}
.dock2{position:absolute;left:10px;right:10px;bottom:22px;border-radius:26px;padding:10px;display:flex;flex-direction:column;gap:8px;z-index:var(--z-dock)}
.abtn{height:44px;border-radius:14px;border:0;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;white-space:nowrap}
.a-sec{background:var(--fill);color:var(--text)}
.a-pri{background:var(--btn-pri-bg);color:#fff;box-shadow:0 8px 18px -10px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}
.a-red{background:var(--btn-danger-bg);color:#fff;box-shadow:0 8px 18px -10px color-mix(in srgb,var(--btn-danger-bg) 80%,transparent)}
.kw{color:var(--ink-purple)}.fn{color:var(--ink-blue)}
.shot .tita .tb{width:auto!important;height:auto!important;justify-content:flex-start!important}
.shot .tagx.ok{width:auto!important;height:22px!important;border-radius:6px!important;padding:0 8px!important;white-space:nowrap!important}
'''

def mcl(ln, cls, txt):
    sg = "+" if "add" in cls else ("−" if "del" in cls else ("•" if "sel" in cls else ""))
    return f'<div class="l {cls}"><span class="n">{ln}</span><span class="s">{sg}</span><span class="c">{_html.escape(txt)}</span></div>'

mp_code_rows = "".join([
    '<div class="hk">顶部 Imports（第 1–37 行）</div>',
    mcl("01", "", "import { useEffect, useState } from 'react';"),
    mcl("03", "", "import { createAbortGate } from '../utils/abortable';"),
    '<div class="hk">export function GroupPicker（第 38–54 行）</div>',
    mcl("38", "", "export function GroupPicker({ groupId }: Props) {"),
    mcl("41", "del", "  useEffect(() => {"),
    mcl("42", "del", "    fetchGroupMembers(groupId).then(setMembers);"),
    mcl("43", "del", "  }, [groupId]);"),
    mcl("44", "add", "  useEffect(() => {"),
    mcl("45", "add", "    const gate = createAbortGate();"),
    mcl("47", "add", "    fetchGroupMembers(groupId, gate).then(res => {"),
    mcl("48", "add sel", "      if (gate.stale()) return; // 丢弃过期请求"),
    mcl("49", "add", "      setMembers(res.items); setLoading(false);"),
    mcl("51", "add", "    return () => gate.abort();"),
    mcl("52", "add", "  }, [groupId]);"),
    mcl("53", "", "  return <MemberList members={members} />;"),
    '<div class="hk">function MemberList（第 116–184 行）</div>',
    mcl("116", "", "function MemberList({ members }: ListProps) {"),
])

mv1 = phone(f'''
<div class="nav"><span class="bk">{I("chevl",20)}代码</span><span class="f14 w7 mono ell">GroupPicker.tsx</span><span class="tag tg-n">184 行</span></div>
<div class="pad" style="padding-top:4px">
  <div class="cc-m-seg">
    <span class="on">完整代码文件</span><span>证据大图对照 (4)</span>
  </div>
  <div class="row g6" style="margin-top:8px;overflow:hidden">
    <span class="chip glass" style="height:26px;font-size:11.5px">顶部 Imports</span>
    <span class="chip" style="height:26px;font-size:11.5px;background:var(--btn-pri-bg);color:#fff">GroupPicker :38–54</span>
    <span class="chip glass" style="height:26px;font-size:11.5px">MemberList</span>
  </div>
  <div class="cd" style="margin-top:8px">{mp_code_rows}</div>
  <div class="ains" style="margin-top:8px"><b style="color:var(--ink-purple)">第 48 行 · 本单 AI</b>　已用 AbortGate 拦掉旧响应；确认第 48 行 return 前是否已关闭加载态。</div>
</div>
<div class="dock2 glass">
  <div class="row g8">
    <button class="abtn a-sec" style="flex:1">{I("copy",14)}复制 :48 引用</button>
    <button class="abtn a-red" style="flex:1.1">{I("undo",14)}附到打回</button>
  </div>
</div>''')

mv2 = phone(f'''
<div class="nav"><span class="bk">{I("chevl",20)}证据</span><span class="f15 w7">证据大图对照</span><span class="tag tg-b">2 / 4</span></div>
<div class="pad" style="padding-top:4px">
  <div class="cc-m-seg">
    <span>完整代码文件</span><span class="on">证据大图对照 (4)</span>
  </div>
  <div style="margin-top:10px">
    <div class="row g6" style="margin-bottom:5px"><span class="tag tg-o">修前复现</span><span class="f12 w6 grow">0:18 切销售部卡死转圈</span><span class="f11 t3">第 1 轮</span></div>
    <div class="shot" data-s="before" data-cap="修前复现 · 0:18" style="height:178px;border-radius:14px"></div>
  </div>
  <div style="margin-top:11px">
    <div class="row g6" style="margin-bottom:5px"><span class="tag tg-g">修后复测</span><span class="f12 w6 grow" style="color:var(--ink-green)">0:41 切换 3 组流畅选中何嘉明</span><span class="f11 lnk">未查阅</span></div>
    <div class="shot" data-s="after" data-cap="修后复测 · 0:41" style="height:178px;border-radius:14px;box-shadow:0 0 0 2px var(--green)"></div>
  </div>
  <div class="flat2 row g8" style="margin-top:10px;padding:8px 11px">
    <span class="ic-box" style="width:24px;height:24px;border-radius:50%;background:var(--btn-pri-bg);flex:none">{I("play",11)}</span>
    <span class="mono f11 w6">0:18</span>
    <div style="flex:1;height:5px;border-radius:3px;background:var(--well);position:relative"><i style="display:block;width:46%;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--blue),var(--green))"></i></div>
    <span class="mono f11 t3">0:41</span>
    <span class="f11 lnk" style="flex:none">看代码 :48</span>
  </div>
</div>
<div class="dock2 glass">
  <div class="row g8">
    <button class="abtn a-pri" style="flex:1.15">{I("check",15,2.6)}标为已查阅</button>
    <button class="abtn a-red" style="flex:1">{I("undo",14)}附到打回</button>
  </div>
</div>''')

mv3 = phone(f'''
<div style="position:absolute;inset:0;background:#0C0E16;color:#EEF1F8;padding-top:50px">
  <div class="nav" style="color:#EEF1F8"><span class="bk" style="color:#6CA6FF">{I("chevl",20)}关闭</span><span class="mono f14 w6">fail-2.png</span><span class="tag" style="background:rgba(48,209,88,.18);color:#5BE884">已脱敏</span></div>
  <div class="pad" style="padding-top:10px">
    <div style="border-radius:16px;overflow:hidden;border:1.5px solid rgba(255,69,58,.55);background:#151824;padding:12px">
      <div class="row g6 f11" style="color:#9BA3B8;margin-bottom:8px"><span style="width:8px;height:8px;border-radius:50%;background:#FF5F56"></span><span class="mono ell">test.tita.work/okr/progress?period=2026Q4</span></div>
      <div style="border-radius:12px;background:#1C2030;padding:22px 14px;text-align:center;border:1px solid rgba(255,255,255,.07)">
        <span style="width:44px;height:44px;border-radius:14px;background:rgba(255,69,58,.18);color:#FF6B63;display:inline-flex;align-items:center;justify-content:center">{I("lock",22)}</span>
        <div class="f14 w7" style="margin-top:10px;color:#fff">403 · 当前账号无 OKR 进度权限</div>
        <div class="f12" style="margin-top:5px;color:#9BA3B8">router guard blocked at <span class="mono">guard.ts:88</span></div>
      </div>
      <div class="row g8" style="margin-top:10px;padding:8px 10px;border-radius:10px;background:rgba(255,159,10,.12);color:#FFB340;font-size:11.5px">
        {I("shield",13)}<span>Cookie tita_sid=•••• 已自动打码 · 可双指缩放</span>
      </div>
    </div>
    <div style="border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:11px 13px;margin-top:12px">
      <div class="row f12" style="color:#C8D0E4"><span class="grow">截图来源：OKR-2231 第 2 次尝试</span><span>14:32:48</span></div>
      <div class="f12" style="color:#8F98B0;margin-top:5px;line-height:1.5">普通员工账号缺 <span class="mono">okr.progress.view</span>；同样适用于「大包/回滚」回读原图放大预览。</div>
    </div>
  </div>
  <div class="dock2" style="background:rgba(24,27,38,.88);border:1px solid rgba(255,255,255,.1)">
    <div class="row g8">
      <button class="abtn" style="flex:1;background:rgba(255,255,255,.1);color:#EEF1F8">{I("download",14)}保存原图</button>
      <button class="abtn a-pri" style="flex:1.25">{I("refresh",14)}补账号并重试</button>
    </div>
  </div>
</div>''')

m_preview = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>移动端 · 完整文件与证据预览</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="m.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{M_PREV_STYLE}</style></head><body><div class="board">
<div class="col3">{mv1}<div class="lbl">完整代码文件<em>符号跳转 + 第 48 行 AI 批注</em></div></div>
<div class="col3">{mv2}<div class="lbl">证据大图对照 (4)<em>修前 vs 修后上下对比 + 进度条</em></div></div>
<div class="col3">{mv3}<div class="lbl">失败截图 / 原图灯箱<em>双指缩放 + 脱敏标 + 一键重试</em></div></div>
</div><script src="../v3/shots.js"></script><script src="icons.js"></script></body></html>'''


outputs = {
    "reset-pwd-pc.html": reset_pc,
    "join-invite-pc.html": invite_pc,
    "m-auth-extra.html": m_auth_extra,
    "onboard-pc-3-acct.html": onboard_pc_3_acct,
    "onboard-pc-4-log.html": onboard_pc_4_log,
    "pc-fullpreview.html": pc_fullpreview,
    "pc-evidence-zoom.html": pc_evidzoom,
    "m-preview.html": m_preview,
}

for fname, content in outputs.items():
    (OUT / fname).write_text(content, encoding="utf-8")
    print("ok:", fname)
