#!/usr/bin/env python3
"""生成第一次使用的步骤器（开工准备向导）：reference/src/v5/onboard-pc.html（1440×900）。
第一次登录进来，一步步把项目的前置条件填完（和设置里的「开工准备」是同一份数据），最后 Bot 实测一遍再开工。
用法：python3 scripts/gen-onboard.py
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))

STYLE = '''
.root{display:block;background:var(--wall)}
.top{position:absolute;left:32px;right:32px;top:22px;display:flex;align-items:center;gap:12px}
.wz{position:absolute;left:120px;right:120px;top:80px;bottom:36px;border-radius:30px;display:flex;overflow:hidden}
.sl{width:300px;flex:none;padding:30px 26px 24px;border-right:1px solid var(--hair);background:color-mix(in srgb,var(--text) 2.5%,transparent);display:flex;flex-direction:column}
.st2{display:flex;gap:14px;position:relative;padding-bottom:22px}
.st2:not(:last-child)::after{content:"";position:absolute;left:12.5px;top:30px;bottom:4px;width:1.5px;background:var(--hair)}
.st2.done::after{background:color-mix(in srgb,var(--green) 55%,transparent)}
.sc2{width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:800}
.done .sc2{background:var(--green);color:#fff}
.cur .sc2{background:var(--blue);color:#fff;box-shadow:0 0 0 5px color-mix(in srgb,var(--blue) 20%,transparent)}
.todo .sc2{border:1.5px solid color-mix(in srgb,var(--text) 22%,transparent);color:var(--text-3)}
.st2 b{display:block;font-size:14px;font-weight:600;line-height:26px}
.todo b{color:var(--text-2);font-weight:500}
.cur b{color:var(--blue);font-weight:700}
.st2 em{display:block;font-style:normal;font-size:12px;color:var(--text-3);margin-top:-1px}
.done em{color:var(--text-2)}
.skip .sc2{background:var(--fill);color:var(--text-3)}
.skip b{color:var(--text-2);font-weight:500}
.st2.skip::after{background:color-mix(in srgb,var(--green) 55%,transparent)}
.fm{flex:1;min-width:0;display:flex;flex-direction:column}
.fb{flex:1;padding:30px 40px 0;min-height:0;overflow:hidden}
.ff{display:flex;align-items:center;gap:12px;padding:16px 40px;border-top:1px solid var(--hair)}
.lab{font-size:13.5px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.lab span{font-weight:400;font-size:12px;color:var(--text-3)}
.inp{height:44px;border-radius:12px;background:var(--fill);display:flex;align-items:center;gap:10px;padding:0 13px;font-size:14px;color:var(--text);min-width:0}
.inp>i{color:var(--text-3)}
.inp.focus{background:var(--glass-2);box-shadow:0 0 0 2px var(--blue),0 0 0 5px color-mix(in srgb,var(--blue) 18%,transparent)}
.dots{letter-spacing:3px;font-size:15px}
.okt{display:inline-flex;align-items:center;gap:5px;color:var(--green);font-size:12.5px;font-weight:600;white-space:nowrap}
.ing{display:inline-flex;align-items:center;gap:7px;color:var(--blue);font-size:12.5px;font-weight:600;white-space:nowrap}
.spin{width:13px;height:13px;border-radius:50%;border:2px solid color-mix(in srgb,var(--blue) 25%,transparent);border-top-color:var(--blue);flex:none}
.rt{display:grid;grid-template-columns:140px 1fr 160px 128px 116px;gap:8px 10px;align-items:center}
.au{background:transparent;box-shadow:inset 0 0 0 1px var(--hair)}
.aut{flex:none;font-size:11px;font-weight:600;color:var(--purple);background:color-mix(in srgb,var(--purple) 12%,transparent);height:20px;padding:0 6px;border-radius:6px;display:inline-flex;align-items:center}
.cr{gap:8px;padding:0 10px;font-size:13px}
.crt{flex:none;height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--text-2)}
.cr-x{box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--orange) 70%,transparent);color:var(--orange)}
.wnt{color:var(--orange);font-size:12.5px;font-weight:600;white-space:nowrap}
.pm{font-size:13px;gap:7px;padding:0 10px}
.pm-e{color:var(--green)}.pm-e>i{color:var(--green)}
.pm-v{color:var(--blue)}.pm-v>i{color:var(--blue)}
.pm-l{color:var(--text-3);background:transparent;box-shadow:inset 0 0 0 1px var(--hair)}
.menu{position:absolute;right:0;top:44px;width:290px;z-index:5;border-radius:14px;padding:6px;background:var(--glass-2);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);border:1px solid var(--stroke);box-shadow:0 24px 50px -16px rgba(10,20,60,.45)}
html:not(.dark) .menu{background:rgba(255,255,255,.96)}html.dark .menu{background:rgba(44,46,60,.96)}
.mi{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:10px}
.mi>i:first-child{margin-top:2px;color:var(--text-2)}
.mi.on{background:color-mix(in srgb,var(--blue) 10%,transparent)}
.mi b{display:block;font-size:13.5px}.mi em{display:block;font-style:normal;font-size:12px;color:var(--text-3);margin-top:2px}
.rt .inp{height:38px}
.rsel{font-weight:600;font-size:13.5px;padding:0 10px 0 12px}
.rh{font-size:12px;color:var(--text-3);padding:0 2px 6px}
.rl{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
.envs{display:grid;grid-template-columns:1fr 1fr 1fr 120px;gap:10px}
.env{border-radius:14px;padding:11px 13px;background:var(--fill);border:1.5px solid transparent;min-width:0}
.env b{font-size:14px}
.env.on{background:var(--glass-2);border-color:var(--blue);box-shadow:0 6px 16px -10px color-mix(in srgb,var(--blue) 70%,transparent)}
.env.add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;color:var(--text-3);background:transparent;border:1.5px dashed color-mix(in srgb,var(--text) 18%,transparent)}
.ta{border-radius:12px;background:var(--fill);padding:11px 13px;font-size:14px;line-height:1.6;color:var(--text);min-height:48px}
.bigb{height:44px;border-radius:13px;border:0;font-size:14.5px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 20px;white-space:nowrap}
.pri{background:var(--blue);color:#fff;box-shadow:0 10px 22px -10px color-mix(in srgb,var(--blue) 85%,transparent)}
.secb{background:var(--fill);color:var(--text)}
.note{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--text-2);line-height:1.55;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--blue) 7%,transparent)}
.pbar{height:4px;border-radius:2px;background:var(--fill);overflow:hidden}
.pbar i{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,#4F8BFF,#9B5CFF)}
'''

CHECK = '<i data-i="check" data-s="14" data-w="3"></i>'
# (名称, 未完成时说明, 完成后摘要)
STEPS = [
    ("选择项目", "要准备哪个项目", "OKR"),
    ("代码仓库", "Bot 改哪些代码、怎么构建", "3 个仓库 · 构建通过"),
    ("环境与账号", "测试、线上各自的地址和账号", "3 个环境 · 7 个账号"),
    ("工单来源", "Jira / Tita 收哪些单", "Jira OKR · Tita OKR"),
    ("Skills", "编码和验证规则", "3 个 Skills"),
    ("发布配置", "可选，之后再填也行", "已跳过，之后再填"),
    ("检查并开工", "Bot 把条件实际跑一遍", ""),
]
SKIPPED = {6}


def sidebar(cur):
    out = []
    for i, (t, todo, done) in enumerate(STEPS, 1):
        if i < cur and i in SKIPPED:
            out.append(f'<div class="st2 skip"><span class="sc2">–</span><div><b>{t}</b><em>{done}</em></div></div>')
        elif i < cur:
            out.append(f'<div class="st2 done"><span class="sc2">{CHECK}</span><div><b>{t}</b><em>{done}</em></div></div>')
        elif i == cur:
            out.append(f'<div class="st2 cur"><span class="sc2">{i}</span><div><b>{t}</b><em>{todo}</em></div></div>')
        else:
            out.append(f'<div class="st2 todo"><span class="sc2">{i}</span><div><b>{t}</b><em>{todo}</em></div></div>')
    return "".join(out)


OKS = '<span class="okt">' + CHECK + '登录成功</span>'
ING = '<span class="ing"><span class="spin"></span>正在试登录…</span>'
PERM = {
    "edit": '<div class="inp pm pm-e"><i data-i="edit" data-s="15"></i><span class="grow">可以修改</span><i data-i="chevd" data-s="14"></i></div>',
    "view": '<div class="inp pm pm-v"><i data-i="eye" data-s="15"></i><span class="grow">只能查看</span><i data-i="chevd" data-s="14"></i></div>',
    "lock": '<div class="inp pm pm-l"><i data-i="lock" data-s="15"></i><span class="grow">只能查看</span></div>',
}
TYPE = {"t": '<span class="tag tg-n">测试号</span>', "pt": '<span class="tag tg-b">线上测试号</span>', "u": '<span class="tag tg-o">真实用户</span>'}
MENU = '''<div class="menu"><div class="mi"><i data-i="eye" data-s="16"></i><div class="grow"><b>只能查看</b><em>只打开页面看，不点保存、提交、删除</em></div></div>
<div class="mi on"><i data-i="edit" data-s="16"></i><div class="grow"><b>可以修改</b><em>能新增、编辑这个账号下的数据</em></div><i data-i="check" data-s="15" data-w="3" style="color:var(--blue)"></i></div></div>'''

EXP = '<span class="wnt">已过期 · 去更新</span>'
# (角色, 账号, 类型, 权限, Bot 实测, 聚焦, 菜单, 凭证: pw=密码 / ck:日期=Cookie 有效期 / exp=Cookie 过期)
ACC = {
    "test": [("普通员工", "emp_test01", "t", "edit", OKS, False, False, "pw"), ("普通员工", "李娜 · 研发部", "t", "edit", OKS, False, False, "ck:11-27"),
             ("部门负责人", "dept_lead02", "t", "edit", OKS, False, False, "pw"), ("OKR 管理员", "okr_admin", "t", "edit", ING, True, False, "pw")],
    "prod": [("普通员工", "qa_prod01", "pt", "edit", OKS, False, False, "pw"), ("OKR 管理员", "", "pt", "view", EXP, False, False, "exp"),
             ("普通员工", "王敏 · 示范科技", "u", "view", OKS, False, False, "ck:11-23")],
}


def acct(a, c, f):
    if c == "pw":
        return f'<div class="inp{" focus" if f else ""}"><i data-i="user" data-s="15"></i><span class="grow ell">{a}</span></div>'
    if not a:
        return '<div class="inp au"><i data-i="user" data-s="15"></i><span class="grow ell t3">更新 Cookie 后识别</span></div>'
    return f'<div class="inp au"><i data-i="user" data-s="15"></i><span class="grow ell">{a}</span><span class="aut">Bot 识别</span></div>'


def cred(c):
    if c == "pw":
        return '<div class="inp cr"><span class="crt">密码</span><span class="dots grow">••••••</span></div>'
    if c == "exp":
        return '<div class="inp cr cr-x"><span class="crt">Cookie</span><span class="grow">已过期</span></div>'
    return f'<div class="inp cr"><span class="crt">Cookie</span><span class="grow ell">至 {c[3:]}</span></div>'



def rows(env):
    out = []
    for r, a, t, pm, st, f, menu, c in ACC[env]:
        out.append(f'''<div class="inp rsel"><span class="grow ell">{r}</span><i data-i="chevd" data-s="14"></i></div>
{acct(a, c, f)}
{cred(c)}
<div style="position:relative">{PERM[pm]}{MENU if menu else ''}</div>
<div>{st}</div>''')
    return "".join(out)


ENVS = [("test", "测试环境", "tg-b", "测试", "test.tita.work/okr", "版本 2.31.0 · 4 个账号"),
        ("dev", "联调环境", "tg-b", "测试", "dev.tita.work/okr", "版本 2.32.0-beta · 2 个账号"),
        ("prod", "正式环境", "tg-o", "线上", "www.tita.com/okr", "版本 2.30.4 · 3 个账号")]
HINT = {
    "test": ("测试环境的账号", "数量不限，同一角色可填多个 · 填 Cookie 不用填账号名，Bot 登录后自己识别是谁 · 加密保存"),
    "prod": ("正式环境的账号", "Bot 按每个账号的数据权限操作 · 填 Cookie 不用填账号名，Bot 登录后识别 · 过期会提醒你更新"),
}


def body(env):
    cards = "".join(f'''<div class="env{' on' if k == env else ''}"><div class="row g6"><b>{n}</b><span class="tag {tg}">{tt}</span><span class="grow"></span><span class="okt">{CHECK}能打开</span></div>
            <div class="mono f12 t2 ell" style="margin-top:6px">{u}</div><div class="f12 t3" style="margin-top:3px">{m}</div></div>''' for k, n, tg, tt, u, m in ENVS)
    l1, h1 = HINT[env]
    return f'''
      <div style="margin-top:20px">
        <div class="lab">环境<span>数量不限，开发联调、测试、线上都可以加</span></div>
        <div class="envs">{cards}<div class="env add"><i data-i="plus" data-s="18"></i>添加环境</div></div>
        <div class="note" style="margin-top:10px;padding:8px 12px"><i data-i="git" data-s="15" style="color:var(--blue);margin-top:1px"></i><span><b>哪种单去哪个环境：</b>测试提的 Bug 去工单写的测试环境；线上工单去正式环境，按账号的数据权限操作；修完都在测试环境验证</span></div>
      </div>

      <div style="margin-top:20px">
        <div class="lab">{l1}<span>{h1}</span></div>
        <div class="rt"><div class="rh">角色</div><div class="rh">账号</div><div class="rh">密码 / Cookie</div><div class="rh">数据权限</div><div class="rh">Bot 实测</div>{rows(env)}</div>
        <div class="row g16" style="margin-top:10px"><span class="f13 lnk grow">+ 添加账号</span>
          <span class="row g6 f12 t3"><i data-i="eye" data-s="14" style="color:var(--blue)"></i><b class="t2">只能查看</b>只看页面，不点保存、提交、删除</span>
          <span class="row g6 f12 t3"><i data-i="edit" data-s="14" style="color:var(--green)"></i><b class="t2">可以修改</b>能新增、编辑这个账号的数据</span></div>
      </div>

      <div class="note" style="margin-top:18px;background:var(--fill)"><i data-i="msgq" data-s="15" style="color:var(--text-3);margin-top:1px"></i><span><b>工单里的账号和数据：</b>测试数据不在这里填，由每张工单自己提供。工单里写的账号必须是这里登记过的才会用来登录；没登记的 Bot 不登录，会在那张单里提醒你先登记。</span></div>'''


def page(cur, title, sub, inner, nxt=None, skip=True, prev=True, foot=None):
    t = STEPS[cur - 1][0]
    done = cur - 1
    pct = round(done / len(STEPS) * 100)
    if foot is None:
        foot = (('<button class="bigb secb"><i data-i="chevl" data-s="16" data-w="2.4"></i>上一步</button>' if prev else '')
                + '<span class="grow"></span>'
                + ('<span class="f13 t3" style="margin-right:6px">这一步先跳过</span>' if skip else '')
                + f'<button class="bigb pri">下一步：{nxt}<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>第一次使用 · {t}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body><div class="root">
<div class="top">
  <img src="logo.svg" width="40" height="40" alt="" style="margin:-4px">
  <span class="tt"><b>云匠</b><em>CloudCraft</em></span>
  <span class="grow"></span>
  <span class="f13 t2">稍后再填，先进入工作台 ›</span>
</div>
<div class="wz glass">
  <aside class="sl">
    <div class="f12 t3">第一次使用</div>
    <div style="font-size:21px;font-weight:800;margin-top:4px">把项目准备好</div>
    <div class="f12 t2" style="margin-top:6px;line-height:1.55">填完后 Bot 会实际跑一遍检查，<br>都通过才开始接单</div>
    <div style="margin-top:28px">{sidebar(cur)}</div>
    <div class="grow"></div>
    <div class="row f12 t3" style="margin-bottom:8px"><span class="grow">第 {cur} 步，共 {len(STEPS)} 步</span><span>已完成 {done} 步</span></div>
    <div class="pbar"><i style="width:{pct}%"></i></div>
  </aside>
  <section class="fm">
    <div class="fb">
      <div class="row g10">
        <div class="grow"><div class="f12" style="color:var(--blue);font-weight:700">第 {cur} 步 · {t}</div>
          <div style="font-size:24px;font-weight:800;margin-top:6px">{title}</div>
          <div class="f13 t2" style="margin-top:6px">{sub}</div></div>
        <span class="chip2" style="align-self:flex-start"><i data-i="spark" data-s="13" style="color:var(--purple)"></i>不知道填什么？问 AI</span>
      </div>
{inner}
    </div>
    <div class="ff">{foot}</div>
  </section>
</div>
</div><script src="icons.js"></script></body></html>'''


def build(env):
    return page(3, "Bot 在哪儿复现、用谁的身份登录", "工单在哪个环境发现的，Bot 就去哪个环境、用那里的账号复现；修完都在测试环境复测", body(env), "工单来源")


from onboard_steps import STEP_PAGES  # noqa: E402  其余 6 步

(OUT / "onboard-pc.html").write_text(build("test"), encoding="utf-8")
(OUT / "onboard-pc-prod.html").write_text(build("prod"), encoding="utf-8")
for n, html in STEP_PAGES(page, CHECK).items():
    (OUT / f"onboard-pc-{n}.html").write_text(html, encoding="utf-8")

# 管理员第一次用、AI 还没接：最前面多一步「连接 AI」（其他人看不到这一步）
from onboard_steps import ai_step  # noqa: E402
STEPS = [("连接 AI", "全公司接一次，只有管理员看到", "")] + STEPS
SKIPPED = {i + 1 for i in SKIPPED}
(OUT / "onboard-pc-0-ai.html").write_text(ai_step(page, CHECK), encoding="utf-8")
print("ok")
