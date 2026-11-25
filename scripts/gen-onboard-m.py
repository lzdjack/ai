#!/usr/bin/env python3
"""第一次使用的步骤器 · 移动端：reference/src/v5/onboard-m.html（4 台手机，1880×1000）。
精简 4 步：步骤概览（4 步）/ 第 3 步环境与账号 / 添加账号（Cookie）/ 第 4 步 AI 体检并开工。
用法：python3 scripts/gen-onboard-m.py
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status  # noqa: E402


def I(n, s=16, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'


CHECK = I("check", 13, 3)
STYLE = '''
.board{width:1880px;gap:44px}
.top2{position:absolute;left:0;right:0;top:54px;padding:0 18px}
.bot2{position:absolute;left:16px;right:16px;bottom:30px;display:flex;gap:12px;align-items:center;z-index:var(--z-dock)}
.bot2 .bigbtn{width:auto;margin:0}
.pri{background:var(--btn-pri-bg);color:#fff;box-shadow:0 10px 22px -10px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}
.mbtn-sec{background:var(--fill);color:var(--text)}
.kk{font-size:12px;color:var(--ink-blue);font-weight:700}
.h1{font-size:24px;font-weight:800;margin-top:4px}
.pbar{height:4px;border-radius:2px;background:var(--well);overflow:hidden}
.pbar i{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,var(--blue),var(--purple))}
.st3{display:flex;gap:12px;align-items:center;min-height:var(--m-row-h);padding:10px 14px;border-top:1px solid var(--hair)}
.st3:first-child{border-top:0}
.sc3{width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}
.s-done .sc3{background:var(--btn-ok-bg);color:#fff}
.s-cur .sc3{background:var(--btn-pri-bg);color:#fff;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 20%,transparent)}
.s-todo .sc3{border:1.5px solid var(--border-ctl-hover);color:var(--text-3)}
.st3 b{display:block;font-size:15px;font-weight:600}
.s-cur b{color:var(--ink-blue)}
.s-todo b{color:var(--text-2);font-weight:500}
.st3 em{display:block;font-style:normal;font-size:12px;color:var(--text-3);margin-top:2px}
.lst{border-radius:18px;overflow:hidden}
.ech{display:flex;gap:8px;overflow:hidden}
.ec{flex:none;height:36px;padding:0 12px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:13px;background:var(--fill);color:var(--text-2);position:relative}
.ec::before{content:"";position:absolute;inset:-4px 0;min-height:var(--m-touch)}
.ec.on{background:var(--btn-pri-bg);color:#fff;font-weight:600}
.ac{border-radius:16px;padding:12px 14px}
.chp{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 7px;border-radius:7px;font-size:11.5px;font-weight:600;white-space:nowrap}
.c-n{background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--text-2)}
.c-e{background:color-mix(in srgb,var(--green) 15%,transparent);color:var(--ink-green)}
.c-v{background:color-mix(in srgb,var(--blue) 13%,transparent);color:var(--ink-blue)}
.c-p{background:color-mix(in srgb,var(--purple) 12%,transparent);color:var(--ink-purple)}
.c-o{background:color-mix(in srgb,var(--orange) 15%,transparent);color:var(--ink-orange)}
.okt{display:inline-flex;align-items:center;gap:4px;color:var(--ink-green);font-size:12px;font-weight:600;white-space:nowrap}
.ing{display:inline-flex;align-items:center;gap:6px;color:var(--ink-blue);font-size:12px;font-weight:600;white-space:nowrap}
.spin{width:12px;height:12px;border-radius:50%;border:2px solid color-mix(in srgb,var(--blue) 25%,transparent);border-top-color:var(--ink-blue);flex:none}
.sg{display:flex;height:var(--m-seg-h);align-items:center;padding:3px;border-radius:var(--r-lg);background:var(--well);border:1px solid var(--hair);gap:2px}
.sg span{flex:1;height:100%;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:13px;font-weight:500;color:var(--text-2)}
.sg span.on{background:var(--seg-thumb);color:var(--text);font-weight:600;box-shadow:var(--shadow-seg)}
.sel2{display:flex;align-items:center;justify-content:space-between;height:var(--m-input-h);border-radius:12px;background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);padding:0 13px;font-size:14.5px;font-weight:600}
.ckk{border-radius:12px;background:var(--glass-2);border:1px solid var(--focus-ring);padding:10px 12px;font-size:12px;line-height:1.5;color:var(--text-2);word-break:break-all;box-shadow:0 0 0 3px var(--focus-halo)}
.ck3{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;font-size:11px;font-weight:800}
.rw{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--hair);font-size:13px}
.rw:first-child{border-top:0}
.mwhy{border-radius:14px;padding:12px 14px;margin-top:14px;background:color-mix(in srgb,var(--purple) 8%,var(--fill));border:1px solid color-mix(in srgb,var(--purple) 20%,transparent);font-size:12px;line-height:1.55;color:var(--text-2)}
'''


def phone(inner, extra=""):
    return f'<div class="phone"><div class="scr">{status}{inner}{extra}<div class="home"></div></div></div>'


# 1 步骤概览（精简 4 步）
steps = [
    ("done", "连接器与鉴权", "GitLab · GitHub · 本机 · Jira"),
    ("done", "授权项目与代码", "2 可修改 · 2 仅查看（AI 自动推测）"),
    ("cur", "环境与账号", "复现入口与数据权限 · 可跳过"),
    ("todo", "AI 体检并开工", "试拉取构建、试登录后开工"),
]
sl = "".join(f'<div class="st3 s-{k}"><span class="sc3">{CHECK if k == "done" else i + 1}</span><div class="grow"><b>{t}</b><em>{d}</em></div>'
             + (I("chevr", 16, st="color:var(--text-3)") if k != "todo" else '') + '</div>' for i, (k, t, d) in enumerate(steps))
p1 = phone(f'''
<div class="top2">
  <div class="row"><span class="f12 t3 grow">第一次使用</span><span class="f13 t2">稍后再填</span></div>
  <div class="h1">接入工具与权限</div>
  <div class="f13 t2" style="margin-top:5px;line-height:1.5">只填 AI 猜不出的鉴权与权限边界，分支、构建和找项目由 AI 自动推测。</div>
  <div class="row f12 t3" style="margin:14px 0 6px"><span class="grow">第 3 步，共 4 步</span><span>已完成 2 步</span></div>
  <div class="pbar"><i style="width:50%"></i></div>
  <div class="lst glass" style="margin-top:14px">{sl}</div>
  <div class="mwhy"><div class="row g6" style="font-weight:700;color:var(--text);margin-bottom:4px">{I("spark",13,st="color:var(--ink-purple)")}内置规则直接生效</div>自定义 Skills、发布回滚、主题与费用检测插件之后在设置和插件市场按需启用，不挡开工。</div>
</div>
<div class="bot2"><button class="bigbtn pri" style="flex:1">继续：环境与账号{I("chevr",16,2.4)}</button></div>''')

# 2 第 3 步 · 环境与账号
def acc(role, name, cred, perm, st, auto=False):
    nm = f'{name}<span class="chp c-p" style="margin-left:6px">Bot 识别</span>' if auto else name
    return f'''<div class="ac glass"><div class="row g8"><b class="f14">{role}</b><span class="grow"></span>{st}</div>
<div class="row g6" style="margin-top:5px"><span class="f13 t2 ell" style="display:inline-flex;align-items:center">{nm}</span></div>
<div class="row g6" style="margin-top:8px">{cred}{perm}</div></div>'''
PW = '<span class="chp c-n">密码</span>'
EDIT = f'<span class="chp c-e">{I("edit",11)}可以修改</span>'
OKS = f'<span class="okt">{CHECK}登录成功</span>'
p2 = phone(f'''
<div class="top2">
  <div class="row" style="min-height:var(--m-nav-h)"><span class="row g4 lnk f15" style="min-height:var(--m-touch)">{I("chevr",18,st="transform:rotate(180deg)")}步骤</span><span class="grow"></span><span class="f13 t3">3 / 4</span></div>
  <div class="kk" style="margin-top:10px">第 3 步 · 环境与账号</div>
  <div class="ttl" style="font-size:20px;margin-top:4px">Bot 在哪儿复现、用谁登录</div>
  <div class="ech" style="margin-top:14px"><span class="ec on">测试环境 · 4</span><span class="ec">联调环境 · 2</span><span class="ec">正式 · 3</span><span class="ec">{I("plus",14)}</span></div>
  <div class="row g6 f12 t3" style="margin-top:9px"><span class="mono">test.tita.work/okr</span><span class="okt">{CHECK}能打开 · 2.31.0</span></div>
  <div class="col g8" style="margin-top:12px">
    {acc("普通员工", "emp_test01", PW, EDIT, OKS)}
    {acc("普通员工", "李娜 · 研发部", '<span class="chp c-n">Cookie · 至 11-27</span>', EDIT, OKS, True)}
    {acc("OKR 管理员", "okr_admin", PW, EDIT, '<span class="ing"><span class="spin"></span>正在试登录</span>')}
  </div>
  <div class="row" style="margin-top:4px;min-height:var(--m-touch)"><span class="f14 lnk" style="min-height:var(--m-touch);display:inline-flex;align-items:center">+ 添加账号</span><span class="grow"></span><span class="f12 t3">纯代码单可先跳过 ›</span></div>
</div>
<div class="bot2"><button class="bigbtn mbtn-sec" style="width:96px">上一步</button><button class="bigbtn pri" style="flex:1">下一步：AI 体检</button></div>''')

# 3 添加账号（Cookie）
sheet = f'''<div class="scrim"></div><div class="sheet">
  <div class="grab"></div>
  <div class="row g8"><span class="ttl grow">添加账号 · 正式环境</span><span class="f13 t3">取消</span></div>
  <div class="flb">角色</div>
  <div class="cc-m-select"><span class="cc-sel-val">普通员工</span><span class="cc-sel-sp"></span><span class="cc-sel-caret">{I("chevd",14)}</span></div>
  <div class="flb">登录方式</div>
  <div class="sg"><span>密码</span><span class="on">Cookie</span></div>
  <div class="flb">粘贴 Cookie</div>
  <div class="ckk mono">SESSION=6f2c9a…e81b; tita_uid=8820…; tita_tenant=shifan; Path=/; Expires=Sun, 23 Nov 2026</div>
  <div class="f12 t3" style="margin:7px 2px 0;line-height:1.5">不用填账号名，Bot 登录后自动识别是谁；Cookie 过期会提醒你更新</div>
  <div class="flb">数据权限</div>
  <div class="sg"><span class="on">{I("eye",13)}只能查看</span><span>{I("edit",13)}可以修改</span></div>
  <div class="f12 t3" style="margin:7px 2px 0">只看页面，不点保存、提交、删除</div>
  <button class="bigbtn pri" style="margin-top:16px">保存并让 Bot 试登录</button>
</div>'''
p3 = phone(f'''
<div class="top2"><div class="kk" style="margin-top:10px">第 3 步 · 环境与账号</div><div class="ttl" style="font-size:20px;margin-top:4px">Bot 在哪儿复现、用谁登录</div>
<div class="ech" style="margin-top:14px"><span class="ec">测试环境 · 4</span><span class="ec">联调环境 · 2</span><span class="ec on">正式 · 3</span></div></div>''', sheet)

# 4 第 4 步 · AI 体检并开工
def rw(st, t, r):
    bg = {"ok": "var(--btn-ok-bg)", "wn": "color-mix(in srgb,var(--orange) 18%,transparent)", "sk": "var(--fill)"}[st]
    fg = {"ok": "#fff", "wn": "var(--ink-orange)", "sk": "var(--text-2)"}[st]
    g = {"ok": CHECK, "wn": "!", "sk": "–"}[st]
    rc = {"ok": "var(--text-3)", "wn": "var(--ink-orange)", "sk": "var(--text-3)"}[st]
    return f'<div class="rw"><span class="ck3" style="background:{bg};color:{fg}">{g}</span><span class="grow">{t}</span><span class="f12" style="color:{rc}">{r}</span></div>'
p4 = phone(f'''
<div class="top2">
  <div class="row" style="min-height:var(--m-nav-h)"><span class="row g4 lnk f15" style="min-height:var(--m-touch)">{I("chevr",18,st="transform:rotate(180deg)")}步骤</span><span class="grow"></span><span class="f13 t3">4 / 4</span></div>
  <div class="kk" style="margin-top:8px">第 4 步 · AI 体检并开工</div>
  <div class="row g12" style="margin-top:10px;padding:12px 14px;border-radius:18px;background:color-mix(in srgb,var(--green) 12%,var(--glass-2));border:1px solid color-mix(in srgb,var(--green) 30%,transparent)">
    <span class="ck3" style="width:38px;height:38px;background:var(--btn-ok-bg)">{I("check",19,3)}</span>
    <div class="grow"><div class="f16 w7">可以开工了</div><div class="f12 t2" style="margin-top:2px">Bot-02 自动探测与体检 · 3 分 52 秒</div></div></div>
  <div class="glass" style="border-radius:18px;padding:4px 14px;margin-top:10px">
    {rw("ok", "AI 引擎已连通", "Pi · gpt-6.2-sol")}
    {rw("ok", "连接器鉴权（4 个）", "全部通过")}
    {rw("ok", "可修改仓（2）推测构建", "通过")}
    {rw("ok", "仅查看仓（2）只读隔离", "宿主机禁写")}
    {rw("ok", "仓库规范 + 内置 Skills", "已自动生效")}
    {rw("ok", "环境与账号（6 个）", "登录成功")}
    {rw("wn", "OKR 管理员 Cookie 过期", "用到时提醒")}
    {rw("sk", "发布回滚 / 主题 / 费用插件", "按需市场装")}
  </div>
  <div class="f12 t2" style="margin-top:10px;line-height:1.5">开工后 Jira 已收的 2 张单马上开始，AI 自动找对应项目；之后在「设置 → 连接器 / 项目」随时改。</div>
</div>
<div class="bot2"><button class="bigbtn pri" style="flex:1">开始使用，进入工作台</button></div>''')

html = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>第一次使用 · 移动端</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="m.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body><div class="board">
<div class="col3">{p1}<div class="lbl">步骤概览（4 步）<em>只填鉴权与权限边界</em></div></div>
<div class="col3">{p2}<div class="lbl">环境与账号<em>按环境切换，可先跳过</em></div></div>
<div class="col3">{p3}<div class="lbl">添加账号<em>密码或 Cookie · 数据权限</em></div></div>
<div class="col3">{p4}<div class="lbl">AI 体检并开工<em>自动推测并实测</em></div></div>
</div><script src="icons.js"></script></body></html>'''
(OUT / "onboard-m.html").write_text(html, encoding="utf-8")
print("ok: 4-step onboard-m generated")
