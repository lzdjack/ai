#!/usr/bin/env python3
"""剪贴板口令/邀请链接智能识别与 Deep Link 拦截设计图（预览确认版）：
1. reference/src/v5/pc-clipboard-invite.html  (1440×900)  → PC-剪贴板识别邀请
2. reference/src/v5/m-clipboard-invite.html   (1440×1000) → 移动端-剪贴板识别邀请

用法：python3 scripts/gen-clipboard-invite.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status, tabbar, row  # noqa: E402


def I(n, s=16, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'


# =====================================================================
# 1. PC-剪贴板识别邀请（1440×900，叠加在 pc-ai.html 工作台之上）
# =====================================================================
pc_base = (OUT / "pc-ai.html").read_text(encoding="utf-8")

PC_MODAL_CSS = '''<style>
.clip-modal{
  position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
  width:524px;border-radius:var(--r-panel);padding:22px 26px 22px;
  background:var(--glass-overlay);border:1px solid var(--stroke);
  backdrop-filter:var(--blur-panel);-webkit-backdrop-filter:var(--blur-panel);
  box-shadow:var(--shadow-float);z-index:var(--z-drawer);
  display:flex;flex-direction:column;gap:12px
}
.clip-src{
  border-radius:13px;padding:10px 12px;background:var(--well);
  border:1px dashed color-mix(in srgb,var(--blue) 38%,var(--border-ctl));
  display:flex;flex-direction:column;gap:5px
}
.clip-org{
  border-radius:15px;padding:13px 15px;
  background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));
  border:1px solid color-mix(in srgb,var(--blue) 26%,transparent)
}
.clip-ft{
  position:fixed;left:50%;bottom:24px;transform:translateX(-50%);
  z-index:var(--z-drawer)
}
.clip-pill{
  display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 14px;
  border-radius:var(--r-full);font-size:12px;font-weight:600;color:var(--text-2)
}
</style>'''

PC_MODAL_HTML = f'''{PC_MODAL_CSS}
<div class="cc-scrim"></div>
<div class="clip-modal" role="dialog" aria-label="检测到剪贴板中的团队邀请">
  <div class="row g8">
    <span class="tag tg-b" style="height:22px">{I("link",12,2.2)}检测到剪贴板团队邀请</span>
    <span class="tag tg-g" style="height:22px">{I("check",12,2.6)}已通过口令校验 · 防重拦截</span>
    <span class="grow"></span>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>

  <div class="row g12" style="margin-top:2px">
    <img src="logo.svg" width="52" height="52" alt="" style="flex:none">
    <div class="col grow" style="min-width:0;gap:3px">
      <div style="font-size:18px;font-weight:800;line-height:1.25">识别到「星辰研发中心」团队邀请</div>
      <div class="f12 t2" style="line-height:1.45">切回云匠时自动识别复制的链接与口令，无需跳外链浏览器或重头注册</div>
    </div>
  </div>

  <div class="clip-src">
    <div class="row f11">
      <span class="w6" style="color:var(--ink-blue);display:inline-flex;align-items:center;gap:5px">{I("copy",12)}从系统剪贴板识别（微信 / 飞书复制文案）</span>
      <span class="grow"></span>
      <span class="t3">确认或忽略后不再重复提示</span>
    </div>
    <div class="f12 mono t2" style="line-height:1.5;word-break:break-all">
      林某邀请你加入云匠「星辰研发中心·OKR 产研」：<span style="color:var(--ink-blue);font-weight:600">https://cc.intra/join/9f2a4c8d</span> · 口令 <span style="color:var(--text);font-weight:700">#CC-8K4P-9M2X-Q7R5#</span>
    </div>
  </div>

  <div class="clip-org">
    <div class="row g10">
      <span class="ic-box" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("users",18,2.2)}</span>
      <div class="col grow" style="min-width:0">
        <div class="row g6"><span class="f15 w7">星辰研发中心</span><span class="tag tg-b" style="height:18px;font-size:10.5px">企业空间</span></div>
        <div class="f11 t3" style="margin-top:2px">发起人：林某 · 一次性口令有效期剩余 23 小时</div>
      </div>
    </div>
    <div class="col g6" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hair)">
      <div class="row f12"><span class="t3" style="width:86px;flex:none">预设主部门</span><span class="w6">OKR 产研</span></div>
      <div class="row f12"><span class="t3" style="width:86px;flex:none">预设角色</span><span class="w6">研发成员（可审核分配给我的工单）</span></div>
      <div class="row f12"><span class="t3" style="width:86px;flex:none">自动继承</span><span class="w6" style="color:var(--ink-green)">OKR(可改) · 审批(只读) · 共享连接器 · 3 项 Skills</span></div>
    </div>
  </div>

  <div class="row g8 f11 t2" style="padding:8px 11px;border-radius:11px;background:var(--well);border:1px solid var(--hair);line-height:1.5">
    {I("layers",14,st="color:var(--ink-blue);flex:none")}
    <span>当前已登录 <b style="color:var(--text)">alex@company.com</b>，确认即入驻，之后点头像切换空间；若未登录则直达「设密并加入」页。</span>
  </div>

  <div class="col g8" style="margin-top:2px">
    <button class="cc-btn cc-btn-lg cc-btn-pri" style="width:100%">{I("check",15,2.6)}确认加入「星辰研发中心 · OKR 产研」</button>
    <button class="cc-btn cc-btn-md cc-btn-glass" style="width:100%">忽略本次，不再重复识别此口令</button>
  </div>
</div>
<div class="clip-ft"><span class="glass clip-pill">{I("shield",13,st="color:var(--ink-green)")}支持 Deep Link (<span class="mono">cloudcraft://join</span>) 直唤，或复制链接回云匠自动拦截 · 校验后方显空间详情</span></div>
'''

pc_clipboard = pc_base.replace(
    "<title>全局 AI 助手</title>",
    "<title>剪贴板识别团队邀请 · PC</title>",
    1,
).replace(
    '</div>\n<script src="../v3/shots.js">',
    PC_MODAL_HTML + '</div>\n<script src="../v3/shots.js">',
    1,
)
if PC_MODAL_HTML not in pc_clipboard:
    pc_clipboard = pc_base.replace('<script src="../v3/shots.js">', PC_MODAL_HTML + '<script src="../v3/shots.js">', 1)


# =====================================================================
# 2. 移动端-剪贴板识别邀请（3 屏 1440×1000）
# =====================================================================
M_CLIP_CSS = '''
.aura{position:absolute;border-radius:50%;background:conic-gradient(from 210deg,#4F8BFF,#9B5CFF,#FF5FA8,#FFB14A,#4FD1FF,#4F8BFF);filter:blur(65px);opacity:.34}
html.dark .aura{opacity:.44}
.pad2{position:absolute;left:18px;right:18px}
.inp{height:var(--m-input-h);border-radius:var(--r-lg);background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;gap:10px;padding:0 14px;font-size:14.5px;color:var(--text)}
.inp.focus{background:var(--glass-2);border-color:var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo)}
.inp.ro{background:color-mix(in srgb,var(--text) 3.5%,transparent);border-color:var(--hair)}
.lab{font-size:12px;font-weight:600;color:var(--text-2);margin:0 0 6px 2px;display:flex;align-items:center;gap:6px}
.dots{letter-spacing:3px;font-size:15px}
.bigbtn{width:100%;height:var(--m-btn-h);border-radius:15px;border:0;font-size:15.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px}
.pri{background:var(--btn-pri-bg);color:#fff;box-shadow:0 12px 26px -10px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}
.sec{background:var(--fill);color:var(--text)}
.ios-hint{
  position:absolute;left:16px;right:16px;top:62px;z-index:calc(var(--z-drawer) + 1);
  border-radius:16px;padding:9px 12px;background:var(--glass-overlay);
  border:1px solid var(--stroke);backdrop-filter:var(--blur-panel);-webkit-backdrop-filter:var(--blur-panel);
  box-shadow:var(--shadow-float);display:flex;align-items:center;gap:9px
}
.ws-pill{
  display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;
  border-radius:15px;background:var(--glass-2);border:1px solid var(--border-ctl);
  font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap
}
.ws-pop{
  position:relative;border-radius:18px;padding:8px;margin-top:8px;
  background:var(--glass-overlay);border:1px solid var(--stroke);
  box-shadow:var(--shadow-float)
}
'''

MAIL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
LOCK = I("lock", 17)
EYE = I("eye", 17, st="color:var(--text-3)")
DOTS = '<span class="dots grow">••••••••••</span>'


def phone_m(inner, extra=""):
    return f'<div class="phone"><div class="scr">{status}{inner}{extra}<div class="home"></div></div></div>'


# P1：已登录个人空间，从微信/飞书复制邀请后切回云匠，自动拦截弹出 Sheet
mp1_bg = f'''<div class="pad" style="padding-top:4px;opacity:.55">
  <div class="row"><div class="grow"><div class="cap">个人工作空间</div><div class="lgt">工单</div></div><span class="me">A</span></div>
  <div class="search glass">{I("search",17)}<span>搜索工单或改动...</span></div>
  <div class="stats"><div class="stat glass on"><b>0</b><span>待我审核</span></div><div class="stat glass"><b>1</b><span>进行中</span></div><div class="stat glass"><b>0</b><span>已完成</span></div></div>
  <div class="gh">我的个人单<span>1</span></div>
  <div class="grp glass">{row("A","#7FB2FF,#4C7DF0","blue","演示项目：表单校验遗漏","t","Bot 修复中 · 54%",prog=54,on=True)}</div>
</div>'''

mp1_overlay = f'''<div class="scrim"></div>
<div class="ios-hint">
  <span style="width:28px;height:28px;border-radius:9px;background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--ink-green);display:flex;align-items:center;justify-content:center;flex:none">{I("shield",15,2.2)}</span>
  <div class="col grow" style="min-width:0">
    <span class="f12 w7">无感 Pattern 探测命中邀请特征</span>
    <span class="f11 t3 ell">iOS 16+ 仅命中规则才读，不骚扰系统「粘贴」弹窗</span>
  </div>
</div>
<div class="sheet" style="padding:10px 18px 28px">
  <div class="grab"></div>
  <div class="row g8">
    <span class="tag tg-b" style="height:22px">{I("link",12,2.2)}剪贴板识别邀请</span>
    <span class="tag tg-g" style="height:22px">23h 有效</span>
    <span class="grow"></span>
    <span class="f13 t3 w6" style="padding:4px 2px">忽略</span>
  </div>
  <div style="font-size:18px;font-weight:800;margin-top:8px">检测到「星辰研发中心」团队邀请</div>
  <div class="f12 t2" style="margin-top:3px;line-height:1.45">同事 <b>林某</b> 邀请你加入，确认即同步项目环境、权限与 Skills。</div>

  <div class="flat2" style="margin-top:10px;padding:9px 11px">
    <div class="row f11 t3" style="margin-bottom:3px"><span>识别来源：微信/飞书复制</span><span class="grow"></span><span class="mono">#CC-8K4P-9M2X-Q7R5#</span></div>
    <div class="f12 mono ell" style="color:var(--ink-blue);font-weight:600">https://cc.intra/join/9f2a4c8d</div>
  </div>

  <div class="card2" style="margin-top:10px;padding:11px 13px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--blue) 26%,transparent)">
    <div class="row g8">
      <span style="width:32px;height:32px;border-radius:9px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF);color:#fff;display:flex;align-items:center;justify-content:center;flex:none">{I("users",16,2.2)}</span>
      <div class="col grow" style="min-width:0">
        <div class="row g6"><span class="f14 w7">星辰研发中心</span><span class="tag tg-b" style="height:17px;font-size:10px">企业空间</span></div>
        <span class="f11 t3">主部门：OKR 产研 · 角色：研发成员</span>
      </div>
    </div>
    <div class="f11 w6" style="margin-top:8px;padding-top:7px;border-top:1px solid var(--hair);color:var(--ink-green)">继承：OKR(可改) · 审批(只读) · 共享连接器 · 3 Skills</div>
  </div>

  <button class="bigbtn pri" style="margin-top:12px">{I("check",16,2.6)}确认加入团队空间</button>
  <button class="bigbtn sec" style="margin-top:8px;height:42px;font-size:14px">忽略本次，不再重复识别此口令</button>
  <div class="f11 t3" style="text-align:center;margin-top:8px">保留原有个人空间（可用空间 ≥ 2 自动解锁顶栏切换）</div>
</div>'''
mp1 = phone_m(mp1_bg, mp1_overlay)


# P2：未登录新成员复制邀请链接打开 App → 自动跳过找入口直达设密加入页
mp2 = phone_m(f'''<div class="aura" style="width:140px;height:140px;left:125px;top:60px"></div>
<div class="pad2" style="top:54px">
  <div class="row" style="min-height:var(--m-nav-h)">
    <span class="tag tg-b" style="height:22px">{I("link",12,2.2)}剪贴板自动识别邀请</span>
    <span class="grow"></span>
    <span class="f13 lnk w6" style="min-height:var(--m-touch);display:inline-flex;align-items:center">去登录</span>
  </div>
  <div style="margin-top:8px;display:flex;flex-direction:column;align-items:center;text-align:center">
    <img src="logo.svg" width="64" height="64" alt="" style="position:relative">
    <div style="font-size:20px;font-weight:800;margin-top:4px">设密并直接加入团队</div>
    <div class="f12 t2" style="margin-top:3px">已从剪贴板识别邀请，免找入口直接入驻</div>
  </div>

  <div class="card2" style="margin-top:14px;padding:11px 13px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--blue) 26%,transparent)">
    <div class="row g10">
      <span class="av2" style="width:34px;height:34px;font-size:12px;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林某</span>
      <div class="col grow" style="min-width:0">
        <span class="f13 w7 ell">林某 邀请你加入「星辰研发中心」</span>
        <span class="f11 t2">OKR 产研 · 研发成员 · 继承默认环境</span>
      </div>
    </div>
  </div>

  <div style="margin-top:14px">
    <div class="lab">分配邮箱<span class="tag tg-g" style="height:17px;font-size:10px;margin-left:auto">已锁定</span></div>
    <div class="inp ro">{MAIL}<span class="grow">alex@company.com</span></div>
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
<div class="pad2" style="bottom:40px">
  <button class="bigbtn pri">{I("check",16,2.6)}设密并加入「OKR 产研」</button>
  <div class="f12 t3" style="text-align:center;margin-top:10px">已有账号？<span class="lnk w6">登录后直接确认加入 ›</span></div>
</div>''')


# P3：确认加入后直入工作台，≥2 空间自动出现切换胶囊 + 剪贴板口令已消费不重弹
mp3_inner = f'''<div class="pad" style="padding-top:4px">
  <div class="row g8">
    <div class="ws-pill">
      <span style="width:18px;height:18px;border-radius:5px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800">星</span>
      <span>星辰研发中心</span>
      {I("chevd",13,st="color:var(--text-3)")}
    </div>
    <span class="tag tg-b" style="height:22px">2 空间</span>
    <span class="grow"></span>
    <span class="me">A</span>
  </div>

  <div class="ws-pop">
    <div class="row f11 t3" style="padding:2px 8px 6px"><span>切换工作空间（≥ 2 个空间自动显露）</span></div>
    <div class="row g8" style="padding:8px 10px;border-radius:12px;background:color-mix(in srgb,var(--blue) 12%,transparent)">
      <span style="width:26px;height:26px;border-radius:8px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">星</span>
      <div class="col grow"><span class="f13 w7">星辰研发中心</span><span class="f11 t3">OKR 产研 · 企业空间</span></div>
      <span style="color:var(--ink-blue)">{I("check",15,2.6)}</span>
    </div>
    <div class="row g8" style="padding:8px 10px;border-radius:12px;margin-top:2px">
      <span style="width:26px;height:26px;border-radius:8px;background:var(--fill);color:var(--text-2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">个</span>
      <div class="col grow"><span class="f13 w6">alex 的个人空间</span><span class="f11 t3">Personal · 原私有单保留</span></div>
    </div>
  </div>

  <div class="gh" style="padding-top:12px">OKR 产研 · 待处理<span>2</span><em>免配置开修</em></div>
  <div class="grp glass">
    {row("王芳","#7FB2FF,#4C7DF0","blue","审批中心：点击分组卡住","t","审核通过 · 等发测试",on=True)}
    {row("陈晨","#FFD27F,#F0A23C","orange","进度条切换周期不刷新","j","验证中 · 78%",prog=78)}
  </div>

  <div class="card2" style="margin-top:12px;padding:10px 12px;background:color-mix(in srgb,var(--green) 8%,var(--glass-2));border-color:color-mix(in srgb,var(--green) 26%,transparent)">
    <div class="row g8">
      <span style="color:var(--ink-green)">{I("check",14,2.8)}</span>
      <span class="f12 w6 grow" style="color:var(--ink-green)">已消费并清除口令 #CC-8K4P-9M2X-Q7R5#</span>
    </div>
    <div class="f11 t2" style="margin-top:3px;line-height:1.45">本地已记录消费状态，后续切换前后台不再重复弹出邀请识别卡。</div>
  </div>
</div>
{tabbar("chat", 1)}'''
mp3 = phone_m(mp3_inner)

m_clipboard = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>移动端 · 剪贴板识别邀请</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="m.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{M_CLIP_CSS}</style></head><body><div class="board">
<div class="col3">{mp1}<div class="lbl">复制切回无感识别<em>Pattern 探测命中即弹确认卡</em></div></div>
<div class="col3">{mp2}<div class="lbl">未登录直达设密<em>免找入口 · 自动带入预填信息</em></div></div>
<div class="col3">{mp3}<div class="lbl">入驻激活多空间切换<em>≥2 空间露胶囊 · 已消费防重弹</em></div></div>
</div><script src="../v3/shots.js"></script><script src="icons.js"></script></body></html>'''


(OUT / "pc-clipboard-invite.html").write_text(pc_clipboard, encoding="utf-8")
(OUT / "m-clipboard-invite.html").write_text(m_clipboard, encoding="utf-8")
print("→", OUT / "pc-clipboard-invite.html")
print("→", OUT / "m-clipboard-invite.html")
