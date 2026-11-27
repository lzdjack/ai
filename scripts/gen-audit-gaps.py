#!/usr/bin/env python3
"""全链路终审补齐 7 张高清设计板（T-08b / T-13 / T-14 / T-15 / 操作记录回滚）：
1. reference/src/v5/pc-ws-switch.html        (1440×900)  → PC-头像菜单-切换空间与升级团队
2. reference/src/v5/pc-invite-expired.html   (1440×900)  → PC-邀请失效与切号
3. reference/src/v5/pc-project-workflow.html (1440×900)  → PC-设置-项目-流程模板
4. reference/src/v5/pc-operation-log.html    (1440×900)  → PC-设置-操作记录与数据回滚
5. reference/src/v5/pc-edge-extra.html       (1440×900)  → PC-工作台-边界补全
6. reference/src/v5/pc-plugin-runtime.html   (1440×900)  → PC-插件运行态规范
7. reference/src/v5/m-runtime-extra.html     (1440×1000) → 移动端-运行态与异常补齐

用法：python3 scripts/gen-audit-gaps.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))

from shell_pc import I, dock, make_topbar, ticket_list, ticket_head, board_page  # noqa: E402
from pages_pc import p_empty, set_left, p_ai  # noqa: E402
from shell_m import status, tabbar, av  # noqa: E402


def pc_shell(title, sel, body, topbar_html=None, overlay=""):
    tb = topbar_html or make_topbar()
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
</head><body><div class="root">
{tb}
<div class="panels">{body}</div>
{dock(sel)}
{overlay}
</div>
<script src="../v3/shots.js"></script><script src="icons.js"></script>
</body></html>'''


# =====================================================================
# 1. PC-头像菜单-切换空间与升级团队（T-13：多空间 >=2 时露出 + 原地升级团队）
# =====================================================================
def build_ws_switch():
    """空间切换收进头像菜单：顶栏不放单独的空间胶囊，头像右下角小角标表示当前空间；
    点头像弹出菜单，「升级为团队」在菜单里就地展开。背景是正常工作台，不压暗。"""
    from pages_pc import p_working
    bell = f'<span class="pill glass tpill" style="width:34px;height:34px;padding:0;justify-content:center;position:relative">{I("bell",15,2.0)}<span style="position:absolute;top:6px;right:7px;width:7px;height:7px;border-radius:50%;background:var(--red);box-shadow:0 0 0 1.5px var(--glass-2)"></span></span>'
    right_tb = (
        f'<span class="pill glass tpill">{I("bot",13)}1 个 Bot 在线</span>'
        '<span class="pill glass tpill"><span class="dot" style="width:7px;height:7px;background:var(--green)"></span>GitLab · 正常</span>'
        + bell
    )
    tb = make_topbar(right_extra=right_tb)
    av_old = 'color:#5A2414">林</span>'
    assert tb.count(av_old) == 1
    tb = tb.replace(av_old, 'color:#5A2414;position:relative;overflow:visible;box-shadow:0 0 0 2px var(--glass-2),0 0 0 5px var(--focus-ring)">林<i class="wsb">' + I("user",10,2.6) + '</i></span>')
    body = p_working()

    def ws_item(ic, grad, name, sub, right, on=False):
        st = "background:color-mix(in srgb,var(--blue) 12%,transparent)" if on else ""
        return (f'<div class="row g10" style="padding:8px 10px;border-radius:12px;{st}">'
                f'<span class="ic-box" style="width:30px;height:30px;border-radius:9px;background:linear-gradient(155deg,{grad});font-size:12px">{ic}</span>'
                f'<div class="col grow" style="min-width:0"><span class="f13 w7 ell">{name}</span><span class="f11 t3 ell">{sub}</span></div>{right}</div>')

    def keep(ic, color, text):
        return f'<div class="row g8 f12 t2" style="align-items:flex-start;line-height:1.5">{I(ic,13,2.4,f"color:{color};flex:none;margin-top:2px")}<span>{text}</span></div>'

    def mi(ic, text, color="var(--text)"):
        return f'<div class="row g10" style="padding:8px 10px;border-radius:10px;color:{color}">{I(ic,15,2.2)}<span class="f13 w6 grow">{text}</span></div>'

    overlay = f'''<style>
.wsb{{position:absolute;right:-4px;bottom:-4px;width:17px;height:17px;border-radius:5px;font-style:normal;font-size:9.5px;font-weight:700;color:#fff;
  display:flex;align-items:center;justify-content:center;background:linear-gradient(155deg,#A5B4FC,#6366F1);box-shadow:0 0 0 2px var(--glass-2)}}
.wspop{{position:absolute;right:22px;top:66px;width:380px;z-index:var(--z-popover);padding:8px;border-radius:18px;
  background:var(--glass-elev);border:1px solid var(--stroke);box-shadow:0 24px 48px -16px rgba(15,30,70,.42),0 2px 6px rgba(15,30,70,.08);
  backdrop-filter:blur(28px) saturate(1.6);-webkit-backdrop-filter:blur(28px) saturate(1.6)}}
html.dark .wspop{{box-shadow:0 24px 48px -12px rgba(0,0,0,.7)}}
.wsup{{margin:6px 2px 2px;padding:14px;border-radius:14px;background:var(--well);border:1px solid var(--hair);display:flex;flex-direction:column;gap:10px}}
.wsdv{{height:1px;background:var(--hair);margin:6px 8px}}
</style>
<div class="wspop">
  <div class="row g10" style="padding:8px 10px 6px">
    <span class="av" style="width:38px;height:38px;font-size:14px;flex:none;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
    <div class="col grow" style="min-width:0"><span class="f14 w7">林某</span><span class="f12 t3 mono ell">lin@company.com</span></div>
  </div>
  <div class="wsdv"></div>
  <div class="f11 t3 w7" style="padding:4px 10px 6px">工作空间</div>
  {ws_item(I("user",15,2.4), "#A5B4FC,#6366F1", "林某的个人工作台", "个人 · 3 个项目 · 本机执行器", I("check",15,2.6,"color:var(--ink-blue)"), on=True)}
  {ws_item("星", "#5AA0FF,#1F6FFF", "星辰研发中心", "团队 · 24 人 · 你是成员", '<span class="tag tg-o">2 张待审</span>')}
  <div class="wsup">
    <div class="row g8">{I("users",15,2.2,"color:var(--ink-blue)")}<span class="f13 w7 grow">把个人工作台升级为团队</span><span class="cc-close" style="width:24px;height:24px">{I("x",12,2.4)}</span></div>
    <div class="cc-field">
      <div class="cc-field-hd"><span>团队名称</span><span class="cc-field-hint">之后可以改</span></div>
      <div class="cc-input cc-input-sm is-focus" style="background:var(--glass-2)"><span class="grow w6">云匠开源协同组</span></div>
    </div>
    <div class="col g6">
      {keep("check", "var(--ink-green)", "3 个项目、流程模板和 4 条 Skills 原样保留，进行中的工单不受影响")}
      {keep("check", "var(--ink-green)", "已接入的连接器可以选择是否给成员共用")}
      {keep("lock", "var(--text-3)", "你的个人账号和令牌仍然只有你能用，成员不会继承")}
    </div>
    <label class="row g8 f12 t2"><span class="cc-checkbox is-checked">{I("check",11,3)}</span>升级后生成一条邀请链接（24 小时有效，不用发邮件）</label>
    <div class="row g8" style="margin-top:2px"><span class="grow"></span><button class="cc-btn cc-btn-sm cc-btn-sec">取消</button><button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.6)}升级为团队</button></div>
  </div>
  {mi("link", "输入邀请口令加入别的团队", "var(--ink-blue)")}
  <div class="wsdv"></div>
  {mi("user", "我的账号")}
  {mi("ext", "退出登录", "var(--text-2)")}
</div>'''
    return pc_shell("头像菜单 · 切换空间与升级团队 · 云匠", "chat", body, tb, overlay)


# =====================================================================
# 2. PC-邀请失效与切号（T-13：失效 / 错号 / admin-handoff / 冷启动改密）
# =====================================================================
def build_invite_expired():
    css = '''
.eb{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px;width:100%;height:100%}
.et{display:flex;flex-direction:column;gap:8px;min-height:0}
.el{display:flex;align-items:baseline;gap:10px;padding:0 4px}
.el .no{width:22px;height:22px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}
.el b{font-size:15px}.el em{font-style:normal;font-size:12.5px;color:var(--text-3)}
.ep{flex:1;min-height:0;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 36px;text-align:center}
'''
    def tile(no, name, when, body):
        return f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div><section class="glass ep">{body}</section></div>'

    t1 = tile(1, "邀请链接 / 口令已失效或已被使用", "超过 24h 有效期、已被撤回或达到使用次数", f'''
  <span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(160deg,#FF8A7A,#E0281E)">{I("alert",24,2.2)}</span>
  <div class="f18 w7" style="margin-top:12px">这个邀请已经失效</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.6">口令 <span class="mono">#CC-8K4P-9M2X-Q7R5#</span> 已于 14:20 过期或被其他账号使用。<br>为保安全，系统不泄露原空间成员信息。</div>
  <div class="row g10" style="margin-top:16px"><button class="cc-btn cc-btn-md cc-btn-sec">返回我的工作台</button><button class="cc-btn cc-btn-md cc-btn-pri">联系邀请人重发 24h 新口令</button></div>''')

    t2 = tile(2, "当前账号邮箱与受邀邮箱不一致", "邀请指定了邮箱，就必须用这个邮箱加入", f'''
  <span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(160deg,#FFC54D,#FF7A00)">{I("users",24,2.2)}</span>
  <div class="f18 w7" style="margin-top:12px">请切换为受邀邮箱后再加入</div>
  <div class="card col g6" style="margin-top:12px;padding:10px 14px;width:430px;text-align:left">
    <div class="row f12"><span class="t3" style="width:92px">当前已登录</span><span class="mono w6">zhang@personal.com</span><span class="tag tg-r" style="margin-left:auto">不匹配</span></div>
    <div class="row f12"><span class="t3" style="width:92px">本邀请指定邮箱</span><span class="mono w6" style="color:var(--ink-green)">zhang@company.com</span></div>
  </div>
  <div class="row g10" style="margin-top:14px"><button class="cc-btn cc-btn-md cc-btn-sec">取消并留在此账号</button><button class="cc-btn cc-btn-md cc-btn-pri">退出并用 zhang@company.com 登录</button></div>''')

    t3 = tile(3, "Web 管理后台安全交接中间确认页", "从桌面端跳到网页管理后台，免登录且令牌只用一次", f'''
  <span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(155deg,#3478F6,#5B21B6)">{I("shield",24,2.2)}</span>
  <div class="f18 w7" style="margin-top:12px">确认进入「星辰研发中心」企业管理后台？</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.6">你正从桌面端进入管理后台，不需要重新登录。<br>确认后即可进入，这次的跳转链接随即失效。</div>
  <div class="row g10" style="margin-top:16px"><button class="cc-btn cc-btn-md cc-btn-sec">取消返回</button><button class="cc-btn cc-btn-md cc-btn-pri">{I("check",14,2.6)}确认进入管理后台</button></div>''')

    t4 = tile(4, "私有部署冷启动 · 首位超管强制改密拦截态", "首位管理员登录后只能先改密码，改完才能做别的", f'''
  <span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(155deg,#A855F7,#6366F1)">{I("key",24,2.2)}</span>
  <div class="f18 w7" style="margin-top:12px">首次启动请先重置管理员初始密码</div>
  <div class="f13 t2" style="margin-top:4px">当前为私有部署冷启动强制保护状态，改密完成前拦截所有业务与邀请操作。</div>
  <div class="col g8" style="margin-top:12px;width:360px;text-align:left">
    <div class="cc-input cc-input-md is-focus"><span class="t3 mono grow">••••••••••••（输入 ≥10 位新强密码）</span></div>
    <div class="cc-input cc-input-md"><span class="t3 mono grow">••••••••••••（再次确认新密码）</span></div>
  </div>
  <button class="cc-btn cc-btn-md cc-btn-pri" style="margin-top:12px;width:360px;justify-content:center">保存新密码并初始化工作台</button>''')

    return board_page("邀请失效、切号与安全交接 · 境界态", f'<div class="eb">{t1}{t2}{t3}{t4}</div>', css)


# =====================================================================
# 3. PC-设置-项目-流程模板（T-08b：React Flow 式自由画布 + 节点级 Skills）
# =====================================================================
def build_project_workflow():
    """流程模板：React Flow 式自由画布。节点是一块块独立卡片，阶段（修复 / 交付）只是节点上的属性，
    不画区域框——以后加阶段、加节点、加分支都不用改版式。画布可拖动节点、缩放；点连线上的 ＋ 选节点类型插入新节点。
    出厂模板执行段只有 1 个 AI 节点（06 §5「内置模板的执行段默认只有一个 AI 节点」）。"""
    KIND = {  # 渐变, 图标, 类型名, 类型字色
        "sys": ("#A3ACBB,#69717F", "server", "系统", "var(--text-2)"),
        "ai": ("#C58BFF,#6A3DF0", "spark", "AI 步骤", "var(--ink-purple)"),
        "ver": ("#4FD6E6,#16A3C0", "shield", "机器检查", "var(--ink-teal)"),
        "rev": ("#FFC15A,#F08A00", "review", "人工确认", "var(--ink-orange)"),
        "test": ("#5AA0FF,#1F6FFF", "git", "人工确认", "var(--ink-orange)"),
        "rel": ("#5EDB7A,#28B04F", "rocket", "发布", "var(--ink-green)"),
    }
    STAGE = {"修复": "var(--purple)", "交付": "var(--blue)"}
    NW, NH = 230, 116
    # (序号, 类型, 阶段, 标题, 说明, 标签, x, y) —— 蛇形排布：第一行向右，第二行向左
    NODES = [
        (1, "sys", "修复", "准备环境", "拉代码 · 装依赖 · 打开测试环境", [("tg-n", "逐仓库")], 70, 96),
        (2, "ai", "修复", "AI 修复", "读单 → 复现 → 定位 → 改码", [("tg-p", "3 个 Skills"), ("tg-n", "交了复现才能改码")], 350, 96),
        (3, "ver", "修复", "修后检查", "构建 · 单测 · 回放工单步骤", [("tg-n", "后端仓库跳过回放"), ("tg-p", "1 个 Skill")], 630, 96),
        (4, "rev", "交付", "代码审查", "按改动风险分 L0–L2", [("tg-o", "审核人逐文件看")], 630, 452),
        (5, "test", "交付", "发测试与复测", "合入测试分支 → 发测试 → 复测", [("tg-n", "逐仓库"), ("tg-o", "提单人复测")], 350, 452),
        (6, "rel", "交付", "合主干与发正式", "修复人合主干 · 有权限的人发正式", [("tg-r", "必须真人")], 70, 452),
    ]
    SEL = 2
    P = {n[0]: (n[6], n[7]) for n in NODES}

    def tg(cls, t, h=20, fs=11):
        return f'<span class="tag {cls}" style="height:{h}px;font-size:{fs}px;padding:0 7px;white-space:nowrap">{t}</span>'

    def ibox(kind, s=34, r=10, ic=16):
        g, icn = KIND[kind][0], KIND[kind][1]
        return f'<span class="ic-box" style="width:{s}px;height:{s}px;border-radius:{r}px;background:linear-gradient(155deg,{g});flex:none">{I(icn,ic,2.2)}</span>'

    def hdl(side, off="50%"):
        pos = {"l": f"left:-6px;top:{off};margin-top:-5px", "r": f"right:-6px;top:{off};margin-top:-5px",
               "t": f"top:-6px;left:{off};margin-left:-5px", "b": f"bottom:-6px;left:{off};margin-left:-5px"}[side]
        return f'<span class="fh" style="{pos}"></span>'

    def node(i, kind, stage, title, sub, tags, x, y, handles):
        _, _, tname, tcol = KIND[kind]
        on = i == SEL
        bar = ""
        if on:
            bar = (f'<div class="ftb" style="left:8px;top:-44px">'
                   f'<span>{I("copy",14,2.2)}</span><span>{I("play",14,2.2)}</span><span style="color:var(--ink-red)">{I("x",14,2.4)}</span>'
                   f'<i></i><span>{I("more",14,2.2)}</span></div>')
        return f'''<div class="wnd{" on" if on else ""}" style="left:{x}px;top:{y}px;width:{NW}px;height:{NH}px">{bar}
  <div class="row g8">{ibox(kind, 28, 8, 14)}<span class="f11 w7" style="color:{tcol}">{tname}</span><span class="grow"></span>
    <span class="row g4 f11 t3"><i style="width:7px;height:7px;border-radius:50%;background:{STAGE[stage]}"></i>{stage}</span><span class="f11 w7 t3 mono" style="margin-left:4px">#{i}</span></div>
  <div class="col" style="gap:2px;min-width:0"><span class="f15 w7 ell">{title}</span><span class="f12 t3 ell">{sub}</span></div>
  <div class="row g4" style="overflow:hidden">{"".join(tg(c, t, 19, 10.5) for c, t in tags)}</div>
  {"".join(hdl(*h) if isinstance(h, tuple) else hdl(h) for h in handles)}
</div>'''

    HANDLES = {1: ["r"], 2: ["l", "r", "b", ("t", "82%")], 3: ["l", "b", ("t", "22%")], 4: ["t", "l", ("t", "30%")], 5: ["r", "l", "t"], 6: ["r"]}
    nodes_html = "".join(node(*n, HANDLES[n[0]]) for n in NODES)

    def cx(i, f=.5):
        return P[i][0] + NW * f

    def cy(i, f=.5):
        return P[i][1] + NH * f

    A = 'stroke="var(--edge)" stroke-width="1.8" fill="none" marker-end="url(#fa)"'
    O = 'stroke="var(--orange)" stroke-width="1.9" stroke-dasharray="6 4" fill="none" marker-end="url(#fo)"'
    r1, r2 = cy(1), cy(4)
    edges = (
        f'<path d="M{P[1][0]+NW+6} {r1} L{P[2][0]-7} {r1}" {A}/>'
        f'<path d="M{P[2][0]+NW+6} {r1} L{P[3][0]-7} {r1}" stroke="var(--focus-ring)" stroke-width="2.4" fill="none" marker-end="url(#fb)"/>'
        f'<path d="M{cx(3)} {P[3][1]+NH+6} L{cx(3)} {P[4][1]-8}" {A}/>'
        f'<path d="M{P[4][0]-6} {r2} L{P[5][0]+NW+7} {r2}" {A}/>'
        f'<path d="M{P[5][0]-6} {r2} L{P[6][0]+NW+7} {r2}" {A}/>'
        # 没过回到 2：5 ↑ 2、4 ↖ 2、3 ⌒ 2
        f'<path d="M{cx(5)} {P[5][1]-6} L{cx(5)} {P[2][1]+NH+9}" {O}/>'
        f'<path d="M{cx(4,.3)} {P[4][1]-6} C {cx(4,.3)} {P[4][1]-70}, {cx(2,.78)} {P[2][1]+NH+70}, {cx(2,.78)} {P[2][1]+NH+9}" {O}/>'
        f'<path d="M{cx(3,.22)} {P[3][1]-6} C {cx(3,.22)} {P[3][1]-58}, {cx(2,.82)} {P[2][1]-58}, {cx(2,.82)} {P[2][1]-9}" {O}/>'
    )
    mid23 = (P[2][0] + NW + P[3][0]) / 2
    canvas = f'''<div class="fc">
  <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible">
    <defs>
      <marker id="fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--edge)"/></marker>
      <marker id="fb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--focus-ring)"/></marker>
      <marker id="fo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--orange)"/></marker>
    </defs>{edges}
  </svg>
  <span class="tag tg-o" style="position:absolute;right:calc(100% - {cx(5)-12}px);top:{(P[2][1]+NH+P[5][1])/2-11}px;height:22px;font-size:11px;background:var(--glass-elev);box-shadow:var(--shadow-ctl)">没过回到 2</span>
  <span class="fplus open" style="left:{mid23-12}px;top:{r1-12}px">{I("plus",13,2.6)}</span>
  <div class="fadd" style="left:{mid23-104}px;top:{r1+22}px">
    <div class="f11 w6 t3" style="padding:4px 8px 6px">在 #2 和 #3 之间插入</div>
    {"".join(f'<div class="fai{" on" if k == "ver" else ""}">{ico}<div class="col" style="min-width:0"><span class="f13 w6">{t}</span><span class="f11 t3 ell">{d}</span></div></div>' for k, ico, t, d in [
        ("ai", ibox("ai", 26, 8, 13), "AI 步骤", "让 AI 按要求干活"),
        ("ver", ibox("ver", 26, 8, 13), "机器检查", "跑构建、测试或脚本"),
        ("rev", ibox("rev", 26, 8, 13), "人工确认", "停下来等人点通过"),
        ("pkg", f'<span class="ic-box" style="width:26px;height:26px;border-radius:8px;background:var(--glass-2);border:1px solid var(--hair);flex:none;color:var(--text-2)">{I("pkg",14,2.2)}</span>', "插件步骤", "用已装插件提供的步骤"),
    ])}
  </div>
  {nodes_html}

  <div class="fpn" style="right:14px;top:14px;padding:6px 12px;gap:14px">
    <span class="row g6 f11 t3"><svg width="18" height="8"><path d="M1 4H17" stroke="var(--edge)" stroke-width="1.8"/></svg>下一步</span>
    <span class="row g6 f11 t3"><svg width="18" height="8"><path d="M1 4H17" stroke="var(--orange)" stroke-width="1.9" stroke-dasharray="4 3"/></svg>没过回到</span>
    <span style="width:1px;height:16px;background:var(--hair)"></span>
    <span class="row g4 f12 w6 t2">{I("layers",13,2.2)}自动排版</span>
  </div>

  <div class="fctl" style="left:14px;bottom:14px">
    <span>{I("plus",14,2.4)}</span><span><b style="font-size:16px;line-height:1">−</b></span><span>{I("expand",13,2.2)}</span><span>{I("lock",13,2.2)}</span>
  </div>
  <span class="f11 t3 mono" style="position:absolute;left:58px;bottom:18px">90%</span>
  <div class="fpn" style="right:14px;bottom:14px;width:168px;height:104px;padding:7px;display:block">
    <div style="position:relative;width:100%;height:100%;border-radius:8px;background:var(--well)">
      {"".join(f'<span style="position:absolute;left:{12+(x-70)*0.16:.0f}px;top:{10+(y-96)*0.15:.0f}px;width:{NW*0.16:.0f}px;height:{NH*0.15:.0f}px;border-radius:3px;background:{"var(--btn-pri-bg)" if i == SEL else "color-mix(in srgb,var(--text) 24%,transparent)"}"></span>' for i, *_r, x, y in [(n[0], n[6], n[7]) for n in NODES])}
      <span style="position:absolute;left:4px;top:4px;right:4px;bottom:4px;border-radius:5px;border:1.5px solid var(--focus-ring);background:color-mix(in srgb,var(--blue) 6%,transparent)"></span>
    </div>
  </div>
</div>'''

    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead">
  <div class="row g10">
    <div class="col grow" style="min-width:0">
      <div class="row g6 f12 t3"><span class="lnk w6 row g4">{I("chevl",13,2.4)}项目 · OKR</span><span>/</span><span>流程模板</span></div>
      <div class="row g10" style="margin-top:3px"><h1>标准前端修 Bug</h1>{tg("tg-n","v3 在用",22,11.5)}{tg("tg-o",I("edit",11,2.4)+"1 处没发布",22,11.5)}</div>
    </div>
    <button class="cc-btn cc-btn-sm cc-btn-glass">{I("refresh",13,2.2)}换模板</button>
    <button class="cc-btn cc-btn-sm cc-btn-glass">{I("history",13,2.2)}历史版本</button>
    <button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.6)}发布 v4</button>
  </div>
</header>
<div class="col grow" style="padding:12px 16px 16px;min-height:0">{canvas}</div></main>'''

    def ms(n, t, last=False):
        return (f'<span class="row g4"><span class="wfm">{n}</span><span class="f12 w6">{t}</span></span>'
                + ("" if last else f'<span class="t3">{I("chevr",11,2.2)}</span>'))

    def sk(on, name, mode, tok):
        cb = f'<span class="cbx on">{I("check",11,3)}</span>' if on else '<span class="cbx"></span>'
        md = f'<span class="tag {"tg-p" if mode=="替换同名" else "tg-n"}" style="height:18px;font-size:10.5px;padding:0 6px">{mode}</span>' if mode else ""
        return f'<div class="row g8 f12{"" if on else " t3"}" style="min-height:26px">{cb}<span class="{"w6 " if on else ""}grow ell">{name}</span>{md}<span class="f11 t3 mono">{tok}</span></div>'

    right = f'''<aside class="glass pn" style="width:328px;flex:none;padding:16px;display:flex;flex-direction:column;gap:14px">
  <div class="row g10">
    {ibox("ai", 38, 11, 18)}
    <div class="col grow" style="min-width:0"><span class="f16 w7">#2 · AI 修复</span><span class="f12 t3">AI 步骤</span></div>
    <span class="cc-select cc-select-xs" style="width:92px"><i style="width:7px;height:7px;border-radius:50%;background:var(--purple);flex:none"></i><span class="cc-sel-val">修复</span><span class="cc-sel-caret">{I("chevd",11)}</span></span>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>进度条上显示</span><span class="cc-field-hint">只是里程碑，不拆成多步</span></div>
    <div class="row g6" style="flex-wrap:wrap">{ms(1,"读单")}{ms(2,"复现")}{ms(3,"定位")}{ms(4,"改码", True)}</div>
  </div>
  <div class="row g10" style="padding:10px 12px;border-radius:12px;background:var(--well);border:1px solid var(--hair)">
    <div class="col grow" style="min-width:0"><span class="f13 w6">交了复现证据才能改代码</span><span class="f11 t3">没复现出来时 Bot 会停下来问人</span></div>
    <span class="cc-switch on"></span>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>这一步挂的 Skills</span><span class="lnk f12 w6">+ 选 Skill</span></div>
    <div class="col g4" style="padding:6px 10px;border-radius:12px;background:var(--well);border:1px solid var(--hair)">
      {sk(True, "最小改动 v2", "叠加", "180t")}
      {sk(True, "禁止弱化断言", "叠加", "90t")}
      {sk(True, "页面交互回归 v1", "替换同名", "320t")}
      {sk(False, "后端 SQL 索引审查", "", "未挂")}
    </div>
    <div class="f11 t3" style="line-height:1.5">只在这一步加载，离开就卸掉。冲突时：安全红线 &gt; 本轮人工要求 &gt; 这一步 &gt; 项目 &gt; 部门</div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>补充要求</span></div>
    <div class="cc-input" style="height:auto;min-height:54px;align-items:flex-start;padding:8px 10px;font-size:12px;line-height:1.55;color:var(--text-2)">切换分组后要确认控制台没有新增报错；导出文件名要合法。</div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>能用的工具</span><span class="cc-field-hint">改代码要先过上面的关卡</span></div>
    <div class="row g6" style="flex-wrap:wrap">{tg("tg-b","读代码")}{tg("tg-b","浏览器操作")}{tg("tg-b","保存证据")}{tg("tg-b","改代码")}{tg("tg-g","提交交付")}</div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>和上一步的关系</span></div>
    <div class="cc-seg cc-seg-xs" style="width:100%;display:flex"><span class="on" style="flex:1">接着上一步继续</span><span style="flex:1">单独开始</span></div>
  </div>
  <span class="grow"></span>
  <div class="row g8 f11 t2" style="padding:9px 11px;border-radius:11px;background:var(--well);border:1px solid var(--hair);line-height:1.5;align-items:flex-start">
    {I("clock",13,2.2,"color:var(--text-3);flex:none;margin-top:2px")}
    <span>发布后从<b>下一轮修复</b>开始用；正在修的 2 张单继续用 v3。</span>
  </div>
</aside>'''

    css = '''<style>
:root{--edge:color-mix(in srgb,var(--text) 38%,transparent)}
.wfm{width:16px;height:16px;border-radius:50%;background:var(--fill);color:var(--text-2);font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.fc{position:relative;flex:1;min-height:0;border-radius:16px;border:1px solid var(--hair);overflow:hidden;
  background:radial-gradient(color-mix(in srgb,var(--text) 15%,transparent) 1.1px,transparent 1.2px) 0 0/20px 20px,var(--well)}
.wnd{position:absolute;display:flex;flex-direction:column;justify-content:space-between;padding:11px 13px 12px;border-radius:16px;
  background:var(--glass-2);border:1px solid var(--stroke);box-shadow:0 1px 2px rgba(15,30,70,.06),0 8px 20px -10px rgba(15,30,70,.22)}
html.dark .wnd{box-shadow:0 10px 24px -12px rgba(0,0,0,.7)}
.wnd.on{border-color:var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo),0 12px 26px -12px rgba(15,30,70,.3)}
.fh{position:absolute;width:10px;height:10px;border-radius:50%;background:var(--glass-2);border:2px solid var(--edge)}
.wnd.on .fh{border-color:var(--focus-ring)}
.ftb{position:absolute;display:flex;align-items:center;gap:2px;padding:4px;border-radius:11px;background:var(--glass-elev);border:1px solid var(--stroke);box-shadow:var(--shadow-ctl)}
.ftb span{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--text-2)}
.ftb i{width:1px;height:16px;background:var(--hair);margin:0 2px}
.fplus{position:absolute;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:var(--btn-pri-bg);box-shadow:0 0 0 3px var(--focus-halo);z-index:2}
.fpn{position:absolute;display:flex;align-items:center;gap:6px;border-radius:13px;background:var(--glass-elev);border:1px solid var(--stroke);box-shadow:var(--shadow-ctl);z-index:3}
.fplus.open{transform:rotate(45deg);box-shadow:0 0 0 4px var(--focus-halo)}
.fadd{position:absolute;width:208px;padding:6px;border-radius:14px;background:var(--glass-elev);border:1px solid var(--stroke);box-shadow:var(--shadow-dialog);z-index:6;backdrop-filter:blur(24px)}
.fai{display:flex;align-items:center;gap:10px;height:46px;padding:0 8px;border-radius:10px}
.fai.on{background:color-mix(in srgb,var(--blue) 10%,transparent)}
.fctl{position:absolute;display:flex;flex-direction:column;border-radius:11px;overflow:hidden;background:var(--glass-elev);border:1px solid var(--stroke);box-shadow:var(--shadow-ctl);z-index:3}
.fctl span{width:32px;height:30px;display:flex;align-items:center;justify-content:center;color:var(--text-2)}
.fctl span+span{border-top:1px solid var(--hair)}
</style>'''
    return pc_shell("项目流程模板 · 云匠", "set", css + main + right)


# =====================================================================
# 3b. PC-设置-操作记录与数据回滚（三轨分治 · 真只追加 + 安全还原）
# =====================================================================
def build_operation_log():
    bg_main = f'''<main class="glass pn grow" style="min-width:0;opacity:.72">
<header class="thead">
  <div class="row g10">
    <div class="col grow">
      <div class="row g10"><h1>连接器</h1><span class="tag tg-g">已连通 5</span></div>
      <div class="f12 t3" style="margin-top:2px">管理代码源、工单源和发布平台的接入</div>
    </div>
    <button class="cc-btn cc-btn-sm cc-btn-glass is-focus" style="border-color:var(--focus-ring);color:var(--ink-blue)">{I("history",13,2.2)}操作记录 · 可恢复 3</button>
  </div>
</header>
<div class="col g12 grow" style="padding:16px 22px">
  <div class="card flat" style="padding:14px 16px"><div class="f13 w7">已启用代码源 / 工单源连接器（4）</div><div class="f12 t3" style="margin-top:4px">GitLab 主仓（正常） · Jira 产研（正常） · Tita 工单（令牌待续）</div></div>
  <div class="row g10" style="margin-top:auto;padding:9px 14px;border-radius:12px;background:var(--glass-elev);border:1px solid var(--stroke)">
    <span class="dt" style="width:7px;height:7px;border-radius:50%;background:var(--orange)"></span>
    <span class="f12 t2 grow">刚才删除了连接器 <span class="w6">GitLab 审批仓</span>，30 天内可以恢复</span>
    <span class="lnk f12 w7">撤销 ›</span>
  </div>
</div></main>'''

    def op_row(seq, kind_tag, kind_cls, title, sub, hint, hint_cls="t3", on=False):
        st = "background:color-mix(in srgb,var(--blue) 12%,var(--glass-2));border-color:var(--focus-ring);box-shadow:0 0 0 2px var(--focus-halo)" if on else "background:var(--well);border-color:var(--hair)"
        return f'''<div class="col g4" style="padding:10px 12px;border-radius:12px;border:1px solid;{st}">
  <div class="row g6"><span class="mono f10 t3 w7">#{seq}</span><span class="tag {kind_cls}" style="height:17px;font-size:9.5px;padding:0 5px">{kind_tag}</span><span class="f12 w7 grow ell">{title}</span></div>
  <div class="f11 t2 ell">{sub}</div>
  <div class="f10 {hint_cls} ell">{hint}</div>
</div>'''

    def diff_kv(k, before_v, cur_v, warn=False, mono=False):
        cur_style = "color:var(--ink-red)" if warn else "color:var(--text-2)"
        mc = "mono" if mono else ""
        return f'''<div style="display:grid;grid-template-columns:100px 1fr 1fr;gap:8px;padding:7px 10px;border-top:1px solid var(--hair);font-size:11.5px;align-items:center">
  <span class="t3">{k}</span>
  <span class="{mc}" style="color:var(--ink-green);background:color-mix(in srgb,var(--green) 8%,transparent);padding:2px 6px;border-radius:6px">{before_v}</span>
  <span style="{cur_style};background:var(--well);padding:2px 6px;border-radius:6px">{cur_v}</span>
</div>'''

    drawer = f'''<style>.stepn{{width:18px;height:18px;border-radius:50%;flex:none;background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue);font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}}</style><div class="scrim"></div>
<aside class="cc-drawer" style="top:64px;height:calc(100% - 76px);width:780px;z-index:var(--z-drawer)">
  <div class="cc-drawer-hd">
    <span class="ic-box" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(155deg,#6CC4FF,#1673FF)">{I("history",18,2.2)}</span>
    <div class="col grow">
      <div class="row g8"><span class="f17 w7">操作记录与数据恢复</span><span class="tag tg-b">项目 · OKR</span></div>
      <div class="f12 t3" style="margin-top:2px">删掉的配置 30 天内可以恢复 · 流程模板和 Skills 可以切回旧版本 · 换令牌、已合入的 MR 只能查看，不能撤回</div>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:10px;padding:12px 18px">
    <div class="row g8">
      <span class="cc-seg cc-seg-xs"><span class="on">全部变更记录</span><span>已删除 · 可恢复 (3)</span></span>
      <span class="cc-select cc-select-xs" style="width:auto;flex:none"><span class="cc-sel-val">授权范围</span><span class="cc-sel-caret">{I("chevd",11)}</span></span>
      <span class="cc-select cc-select-xs" style="width:auto;flex:none"><span class="cc-sel-val">全部来源</span><span class="cc-sel-caret">{I("chevd",11)}</span></span>
      <span class="grow"></span>
      <span class="f11 t3">删除保留 30 天 · 记录保留 180 天</span>
    </div>
    <div class="row g12 grow" style="min-height:0;align-items:stretch">
      <div class="col g8" style="width:302px;flex:none">
        <div class="f11 t3 w7" style="padding:0 4px">今天</div>
        {op_row("1842", "已删除", "tg-r", "连接器 · GitLab 审批仓", "陈某 · PC · 12 分钟前", "在回收站 · 可以完整恢复", "t2", on=True)}
        {op_row("1840", "改版本", "tg-p", "流程模板 · 标准前端 v3 → v4", "林某 · 通过 AI 助手 · 38 分钟前", "可以切回 v3 · 下一轮修复生效")}
        {op_row("1837", "已修改", "tg-b", "环境 · staging 超时 10 → 5 分钟", "林某 · PC · 2 小时前", "可以改回修改前的值")}
        <div class="f11 t3 w7" style="padding:6px 4px 0">昨天</div>
        {op_row("1831", "仅记录", "tg-n", "GitLab 换令牌 · MR !318 合入", "林某 · PC · 19:10", "已在外部生效 · 只能查看，不能撤回")}
        {op_row("1826", "改版本", "tg-p", "Skill · 页面交互回归 v1 → v2", "陈某 · PC · 16:42", "可以切回 v1")}
        <div class="row g6 f11 lnk w6" style="justify-content:center;margin-top:auto;padding:6px 0 2px">查看更早的记录 {I("chevd",11,2.4)}</div>
      </div>
      <div class="col g10 grow" style="min-width:0">
        <div class="card" style="padding:12px 14px;gap:6px">
          <div class="row g8">
            <span class="tag tg-r">已删除</span>
            <span class="f14 w7 grow">连接器 · GitLab 审批仓</span>
            <span class="tag tg-g">可以恢复</span>
          </div>
          <div class="f11 t3">陈某在 Mac-Work 上删除 · 12 分钟前 · 删除时保留了访问令牌</div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div style="display:grid;grid-template-columns:100px 1fr 1fr;gap:8px;padding:8px 10px;background:var(--well);font-size:11px;font-weight:700;color:var(--text-3)">
            <span>内容</span><span>恢复后</span><span>现在</span>
          </div>
          {diff_kv("状态", "正常使用", "在回收站 · 剩 29 天", warn=True)}
          {diff_kv("地址", "gitlab.tita.work/approve", "—", mono=True)}
          {diff_kv("使用范围", "全空间共用 · 代码源", "—")}
          {diff_kv("访问令牌", "有效 · 恢复后自动重连", "已冻结")}
          {diff_kv("关联触发器", "2 条 · 一起恢复", "已暂停")}
        </div>
        <div class="card" style="padding:14px 16px;gap:12px;display:flex;flex-direction:column">
          <div class="f12 w7">恢复时会一起做</div>
          <div class="row g8 f12 t2"><span class="stepn">1</span><span class="grow">把连接器配置放回原处，名字和地址不变</span></div>
          <div class="row g8 f12 t2"><span class="stepn">2</span><span class="grow">用原来的访问令牌重新连接 GitLab，并检查能否拉代码</span></div>
          <div class="row g8 f12 t2"><span class="stepn">3</span><span class="grow">重新启用 2 条触发器，之后收到的单照常处理</span></div>
          <div class="row g8 f12 t2"><span class="stepn">4</span><span class="grow">恢复完成后通知删除它的陈某</span></div>
        </div>
        <div class="card" style="padding:10px 12px;gap:6px;margin-top:auto;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--blue) 24%,transparent)">
          <div class="row g6">{I("shield",14,2.2,"color:var(--ink-blue)")}<span class="f12 w7" style="color:var(--ink-blue)">恢复前请留意</span></div>
          <div class="f11 t2" style="line-height:1.58">
            • 需要同时有「恢复记录」和这个连接器的编辑权限；如果别人刚改过它，会提示你刷新后再确认。<br>
            • 删除时选了「令牌已泄露，立即作废」的，恢复后要重新填写令牌。高风险配置只能由人确认恢复，AI 助手不能代为操作。
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <span class="f11 t3 grow">只显示你有权限查看的记录 · 恢复本身也会记一条记录</span>
    <button class="cc-btn cc-btn-md cc-btn-glass">取消</button>
    <button class="cc-btn cc-btn-md cc-btn-pri">{I("history",14,2.4)}恢复此条记录</button>
  </div>
</aside>'''
    return pc_shell("操作记录与数据回滚 · 云匠", "set", set_left("连接器") + bg_main, overlay=drawer)


# =====================================================================
# 4. PC-工作台-边界补全（T-14：Hard Gate 2x失败 / 我来接手 / no_code_fix / 提问消歧）
# =====================================================================
def build_edge_extra():
    css = '''
.eb{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px;width:100%;height:100%}
.et{display:flex;flex-direction:column;gap:8px;min-height:0}
.el{display:flex;align-items:baseline;gap:8px;padding:0 4px;white-space:nowrap}
.el .no{width:22px;height:22px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}
.el b{font-size:14.5px;white-space:nowrap}.el em{font-style:normal;font-size:12px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis}
.ep{flex:1;min-height:0;border-radius:22px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
'''
    def tile(no, name, when, body):
        return f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div><section class="glass ep">{body}</section></div>'

    t1 = tile(1, "机审门禁连续 2 次失败 · 不能进入审核", "转为需要协助，也可以填写理由后放行", f'''
  <div class="row g8"><span class="tag tg-r">机审门禁未通过（3 次尝试均失败）</span><span class="mono f12 t3 grow">TK-20855 · 第 2 轮</span><span class="tag tg-o">禁止入审</span></div>
  <div class="log" style="padding:10px 12px;border-radius:10px;background:var(--terminal-bg);color:#E5E7EB;font-size:11.5px;line-height:1.55">
    <div class="ln"><span class="ts" style="color:#9CA3AF">尝试#3</span><span style="color:#FCA5A5">[FAIL]</span> typecheck src/utils/export.ts:42 · string | undefined mismatch</div>
    <div class="ln"><span class="ts" style="color:#9CA3AF">策略</span><span style="color:#7DD3FC">[GATE]</span> verify_strategy=browser_dist_replace · entry_js_replaced=true</div>
  </div>
  <div class="card" style="padding:9px 12px;gap:6px;background:color-mix(in srgb,var(--orange) 8%,var(--glass-2));border-color:color-mix(in srgb,var(--orange) 30%,transparent)">
    <div class="f12 w7" style="color:var(--ink-orange)">填写理由后放行（会升为高风险，必须在电脑上逐行审）</div>
    <div class="f12 t2">如属已有历史类型债可填写理由豁免进入审核：<span class="mono">「仅修复兼容层，历史 DTO 类型另单追踪」</span></div>
  </div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec">查看 Diff 与 3 次报错</button><span class="grow"></span><button class="cc-btn cc-btn-sm cc-btn-glass">填写理由审计豁免</button><button class="cc-btn cc-btn-sm cc-btn-pri">补充提示让 Bot 继续修</button></div>''')

    t2 = tile(2, "我来接手 · 本地改完照样过门禁", "接手后 Bot 不会再改这条分支 · 提交后可选从哪一步继续（默认机审门禁）", f'''
  <div class="row g8"><span class="tag tg-b">你已接手</span><span class="mono f12 t3 grow">fix/TK-20840</span><span class="tag tg-g">Bot 已释放</span></div>
  <div class="card" style="padding:9px 12px;gap:4px">
    <div class="f13 w7">在本地继续修改，提交后照样走门禁检查</div>
    <div class="f12 t2" style="line-height:1.5">① <span class="mono">git fetch && git checkout fix/TK-20840</span>（保留 Bot 半成品 <span class="mono">7c2e1a9</span>）<br>② 推送后选择从哪一步继续——默认从机审门禁和风险分级开始，也可以选其他步骤。</div>
  </div>
  <div class="row g8"><span class="f11 w6 t2">提交后接入节点：</span><div class="cc-select cc-select-xs grow"><span class="cc-sel-val">4 · 结构化交付与硬门禁</span><span class="cc-sel-sub">默认 · 下拉含全部节点</span><span class="cc-sel-caret">{I("chevd",12)}</span></div></div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec">放弃接手，退回 AI 重跑</button><span class="grow"></span><button class="cc-btn cc-btn-sm cc-btn-glass">本地预览</button><button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.5)}提交人工交付</button></div>''')

    t3 = tile(3, "不需要改代码时直接结单", "没有改动的分支不会进入审核和发布", f'''
  <div class="row g8"><span class="tag tg-p">AI 诊断结论 · 无需改代码</span><span class="mono f12 t3 grow">TK-20901 · 没有代码改动</span><span class="tag tg-n">发布已阻断</span></div>
  <div class="card" style="padding:10px 12px;gap:6px">
    <div class="f13 w7">根因判定：测试环境第三方回调域名未加入配置白名单</div>
    <div class="f12 t2" style="line-height:1.55">Bot 已复现并保存 2 份请求抓包证据，确认源码逻辑正确。按安全策略：<b>已自动禁用「合入测试/主分支」与「发版」后续节点</b>，避免空包上生产。</div>
  </div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec">提供新线索重查</button><span class="grow"></span><button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.5)}确认不用改代码，关闭工单</button></div>''')

    t4 = tile(4, "Bot 提问时的选项 + 单独的账号输入框", "填的密码和 Cookie 不会出现在对话里", f'''
  <div class="card" style="padding:10px 12px;gap:6px;background:color-mix(in srgb,var(--orange) 9%,var(--glass-2));border-color:color-mix(in srgb,var(--orange) 34%,transparent)">
    <div class="row g8"><span class="tag tg-o">需要重新登录 · 单独输入</span><span class="f12 w6 grow">管理员测试账号登录态过期</span></div>
    <div class="f11 t2">这里填的 Cookie 或密码会加密保存，<b>不会出现在对话记录里，也不会发给 AI</b>。</div>
    <div class="row g8"><div class="cc-input cc-input-sm grow"><span class="mono f11 t3">Cookie：session_id=••••••••••••</span></div><button class="cc-btn cc-btn-xs cc-btn-pri">更新并恢复</button></div>
  </div>
  <div style="margin-top:auto;padding:8px 10px;border-radius:14px;background:var(--glass-2);border:1px solid var(--focus-ring)">
    <div class="row g6 f11" style="margin-bottom:6px;color:var(--ink-orange);font-weight:600"><span>正在等待你回答提问 #Q-204</span><span class="grow"></span><span class="lnk">切为「顺便问本单 AI（不恢复 Bot）」</span></div>
    <div class="row g8"><span class="aitag" style="height:26px"><span class="aid">{I("spark",11)}</span><span class="f11 w7">答复 #Q-204</span></span><span class="f12 t3 grow">输入答案并立即继续执行…</span><span class="snd" style="width:28px;height:28px">{I("arrowup",14,2.4)}</span></div>
  </div>''')

    return board_page("工作台高频边界与逃生出口补全 · 云匠", f'<div class="eb">{t1}{t2}{t3}{t4}</div>', css)


# =====================================================================
# 5. PC-插件运行态规范（T-15：停用只读 / 5s 超时 / Dock >4 & Topbar >2 折叠 / 升级）
# =====================================================================
def build_plugin_runtime():
    """插件运行态四格：每格都是真实界面的一角，状态放回它实际出现的位置。"""
    from shell_pc import DOCK_ICONS
    css = p_empty()[1] + '''
.eb>.et{min-width:0}
.eb .ep{min-width:0}
.eb .thead{padding:12px 18px 10px}
.eb .thead h1{font-size:16px}
.ep.v{flex-direction:column}
.ep.rel{position:relative}
/* 顶栏一角 */
.mtb{height:50px;flex:none;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--hair)}
.mtb .tsearch{height:30px;width:auto;flex:1;min-width:0;border-radius:9px;padding:0 10px;gap:7px;color:var(--text-3)}
.mtb .tpill{height:28px;font-size:11.5px;padding:0 10px}
.wd{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:var(--r-full);font-size:11.5px;font-weight:600;background:var(--glass-2);border:1px solid var(--stroke);color:var(--text-2);white-space:nowrap}
.wd i{flex:none}
.bel{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;flex:none;background:var(--glass-2);border:1px solid var(--stroke);color:var(--text-2)}
.bel>b{position:absolute;top:4px;right:5px;width:7px;height:7px;border-radius:50%;background:var(--red);box-shadow:0 0 0 1.5px var(--glass-2)}
.bel.on{background:color-mix(in srgb,var(--blue) 14%,var(--glass-2));border-color:var(--focus-ring);color:var(--ink-blue);box-shadow:0 0 0 3px var(--focus-halo)}
/* Dock 一角 */
.mdk{width:76px;flex:none;border-right:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;gap:9px;padding:12px 0;position:relative;overflow:hidden;
  -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 34px);mask-image:linear-gradient(180deg,transparent 0,#000 34px)}
.mdk .dki{width:40px;height:40px}
.mdk .ap{width:38px;height:38px;border-radius:11px}
.mdk .ap svg{width:21px;height:21px}
.ap-pl{color:#fff}
.ap-pl i{position:relative;filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.18))}
.ap-fold{background:color-mix(in srgb,var(--glass-2) 70%,transparent);border:1px solid var(--stroke);display:grid!important;grid-template-columns:1fr 1fr;gap:3px;padding:7px;backdrop-filter:blur(12px)}
.ap-fold{grid-template-rows:1fr 1fr}
.ap-fold span{display:block;width:100%;height:100%;border-radius:4px}
.fold-n{position:absolute;bottom:-3px;right:-5px;height:16px;padding:0 5px;border-radius:8px;background:var(--text);color:var(--bg,#fff);font-size:10px;font-weight:700;display:flex;align-items:center;z-index:3}
html.dark .fold-n{color:#111}
html:not(.dark) .fold-n{color:#fff}
/* 弹层 */
.pop{position:absolute;z-index:5;border-radius:16px;background:var(--glass-elev);border:1px solid var(--stroke);box-shadow:var(--shadow-pop,0 18px 40px -12px rgba(15,30,70,.35));backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6)}
.fgrid{display:grid;grid-template-columns:repeat(3,72px);gap:10px 6px;padding:4px 2px 2px}
.fgrid .it{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11.5px;color:var(--text-2);font-weight:600}
.fgrid .it .ap{transform:none;width:44px;height:44px}
.fgrid .slot{width:44px;height:44px;border-radius:12px;border:1.5px dashed var(--hair)}
/* 淡化背景 */
.fade{opacity:.5;pointer-events:none}
.r10.mini{padding:8px 10px;gap:9px}
.r10.mini .av10{width:28px;height:28px;font-size:9.5px}
/* 通知 */
.nt{display:flex;gap:10px;padding:9px 12px;border-radius:12px;flex:none}
.nt+.nt{margin-top:2px}
.nt>.ap{width:30px;height:30px;border-radius:9px;transform:none;flex:none}
.nt>.ap svg{width:18px;height:18px}
.nt>.ap.ap-pl i svg{width:16px;height:16px}
.nt.gone{opacity:.45}
.nt.gone .t{text-decoration:line-through}
/* 表格 */
.rt{display:grid;grid-template-columns:62px 1fr 96px 30px;gap:10px;align-items:center;padding:7px 12px;font-size:12px}
.rt+.rt{border-top:1px solid var(--hair)}
.rt.h{font-size:11px;font-weight:700;color:var(--text-3);background:var(--well);border-radius:10px 10px 0 0}
.gray{filter:grayscale(1);opacity:.55}
'''

    def tile(no, name, when, inner, cls=""):
        return (f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div>'
                f'<section class="glass ep {cls}">{inner}</section></div>')

    def ibox(bg, ic, size=52, color="#fff"):
        return f'<span class="ic-box" style="width:{size}px;height:{size}px;border-radius:{size*0.3:.0f}px;background:{bg};color:{color}">{I(ic, int(size*0.46), 2)}</span>'

    def plug(ic, grad):
        return f'<span class="ap ap-pl" style="background:linear-gradient(160deg,{grad})">{I(ic, 20, 2.2)}</span>'

    P_GRAY = ("filter", "#7DD3FC,#3B82F6 55%,#2563EB")   # 灰度放量
    P_TOKEN = ("zap", "#F9A8D4,#EC4899 55%,#DB2777")     # Token 费用
    P_QA = ("list", "#5EEAD4,#14B8A6 55%,#0F766E")       # 质量周报
    P_DUTY = ("clock", "#A5B4FC,#6366F1 55%,#4F46E5")    # 值班表
    P_PERF = ("monitor", "#FCD34D,#F59E0B 55%,#D97706")  # 绩效大盘

    def mini_topbar(widgets, bell_on=False):
        return f'''<div class="mtb">
  <div class="glass tsearch" style="-webkit-mask-image:linear-gradient(90deg,transparent,#000 40px);mask-image:linear-gradient(90deg,transparent,#000 40px)">{I("search",13)}<span class="f12 grow ell">搜索工单、MR、发布记录</span></div>
  <span class="pill glass tpill">{I("bot",12)}3 个 Bot 在线</span>
  {widgets}
  <span class="bel{" on" if bell_on else ""}">{I("bell",14,2.0)}<b></b></span>
  <span class="av" style="width:30px;height:30px;font-size:12px;flex:none;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
</div>'''

    WIDGETS = (f'<span class="wd">{I("zap",12,2.2,"color:#DB2777")}今日费用 ¥36.4</span>'
               f'<span class="wd">{I("filter",12,2.2,"color:var(--ink-blue)")}灰度 30%</span>'
               f'<span class="wd" style="padding:0 8px;color:var(--text-3)">+2{I("chevd",11)}</span>')

    def mini_rows():
        rows = [("王芳", "#7FB2FF,#4C7DF0", "blue", "点击分组后界面卡住", "第 2 轮交付 · 验证 3/4"),
                ("陈晨", "#FFC38A,#F08A5D", "orange", "进度条切换周期不刷新", "验证受阻：账号进不去页面"),
                ("李娜", "#F5A3C7,#D96BA0", "orange", "考勤部门筛选失效", "复现用哪个角色？"),
                ("赵磊", "#8FD8C9,#3FAE9A", "teal", "考勤导出部门名乱码", "浏览器验证中 · 84%"),
                ("周婷", "#C3A8FF,#8E6BEA", "teal", "看板拖拽后回弹", "复现中 · 还有 1 张")]
        return "".join(
            f'<div class="r10 mini"><span class="av10" style="background:linear-gradient(150deg,{g})">{n}<i style="background:var(--{s})"></i></span>'
            f'<div class="grow" style="min-width:0"><div class="f12 w7 ell">{t}</div><div class="f11 t3 ell" style="margin-top:2px">{d}</div></div></div>'
            for n, g, s, t, d in rows)

    # ---------- 1 插件标签页超时 ----------
    tabs = [("对话", ""), ("代码改动", "3"), ("证据", "4"), ("执行日志", ""), ("发布", ""), ("灰度看板", "")]
    th = "".join(f'<span{" class=\"on\"" if n == "灰度看板" else ""}>{n}{(" <b>" + c + "</b>") if c else ""}</span>' for n, c in tabs)
    t1 = f'''<header class="thead"><div class="row g10"><span class="appic ic-tita" style="width:32px;height:32px;font-size:9px;border-radius:9px">TITA</span>
<div class="col grow" style="min-width:0"><h1 class="ell">审批中心：发起审批时点击分组，界面卡住</h1><div class="f12 t3 ell" style="margin-top:1px">TK-20871 · 修复人 林某 · 第 2 轮</div></div>
<span class="pill p-blue" style="flex:none">待我审核 · 第 2 轮</span></div>
<div class="row g10" style="margin-top:8px"><div class="tab2">{th}</div></div></header>
<div class="col grow" style="align-items:center;justify-content:center;text-align:center;padding:0 36px">
  {ibox("color-mix(in srgb,var(--orange) 16%,transparent)","alert",52,"var(--ink-orange)")}
  <div class="eh">灰度看板暂时打不开</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.6">5 秒没有响应，已自动重试 1 次。<br>只影响这个标签页，对话、审核和发布照常可用。</div>
  <div class="row g8" style="margin-top:16px"><button class="cc-btn cc-btn-sm cc-btn-pri">{I("refresh",13,2.4)}重试</button><button class="cc-btn cc-btn-sm cc-btn-sec">回到对话</button></div>
  <div class="row g6 f12 t3" style="margin-top:16px">{I("filter",12,2.2)}灰度放量 v1.2 · 插件提供</div>
</div>'''

    # ---------- 2 入口数量上限：Dock 文件夹 + 顶栏小胶囊 ----------
    def dk(cls_or_html, badge="", on=False):
        b = f"<b>{badge}</b>" if badge else ""
        return f'<span class="dki{" on" if on else ""}">{cls_or_html}{b}</span>'
    fold = ('<span class="ap ap-fold">'
            f'<span style="background:linear-gradient(160deg,{P_DUTY[1]})"></span>'
            f'<span style="background:linear-gradient(160deg,{P_PERF[1]})"></span>'
            '<span style="background:var(--fill)"></span><span style="background:var(--fill)"></span></span>'
            '<span class="fold-n">+2</span>')
    dock_col = ('<div class="mdk">'
                + dk(f'<span class="ap ap-rb">{DOCK_ICONS["rb"]}</span>')
                + dk(f'<span class="ap ap-sk">{DOCK_ICONS["sk"]}</span>')
                + dk(plug(*P_GRAY)) + dk(plug(*P_TOKEN)) + dk(plug(*P_QA))
                + dk(fold, on=True) + '</div>')
    t2 = mini_topbar(WIDGETS) + f'''<div class="row grow" style="min-height:0;align-items:stretch">
  {dock_col}
  <div class="col grow fade" style="padding:10px 8px;min-width:0">
    <div class="row g8" style="padding:0 8px 4px"><span class="f15 w7">工单</span><span class="f12 t3">8</span></div>
    {mini_rows()}
  </div>
</div>
<div class="pop" style="left:96px;top:176px;width:262px;padding:12px 12px 10px">
  <div class="row g6" style="padding:0 4px 8px"><span class="f13 w7 grow">更多插件</span><span class="f11 t3">2</span></div>
  <div class="fgrid">
    <div class="it">{plug(*P_DUTY)}值班表</div>
    <div class="it">{plug(*P_PERF)}绩效大盘</div>
    <div class="it"><span class="slot"></span><span class="t3" style="font-weight:500">空位</span></div>
  </div>
  <div class="f11 t3" style="margin-top:8px;padding:7px 4px 0;border-top:1px solid var(--hair)">拖到 Dock 上就能放到外面，外面最多 4 个</div>
</div>'''

    # ---------- 3 插件操作要人确认 + 通知 ----------
    t3 = mini_topbar(WIDGETS, bell_on=True) + f'''<div class="row grow" style="min-height:0;align-items:stretch">
  <div class="col grow fade" style="padding:10px 8px;min-width:0">{mini_rows()}</div>
</div>
<div class="pop" style="right:12px;top:58px;width:400px;padding:12px 10px 8px;display:flex;flex-direction:column">
  <div class="row g8" style="padding:0 4px 8px"><span class="f15 w7 grow">通知</span><span class="cc-seg cc-seg-xs"><span class="on">全部 6</span><span>待我处理 2</span></span></div>
  <div class="nt" style="background:color-mix(in srgb,var(--red) 8%,transparent)">
    <span class="ap ap-pub">{DOCK_ICONS["pub"]}</span>
    <div class="col grow" style="min-width:0"><div class="row g6"><span class="f12 w7 grow ell">okr-web 正式发布失败</span><span class="f11 t3">2 分钟前</span></div>
      <div class="row g6" style="margin-top:3px"><span class="f11 t2 grow ell">打包上传失败，正式环境还是 2.17.4</span><span class="tag tg-r">免打扰也提醒</span></div></div>
  </div>
  <div class="nt" style="background:var(--glass-2);border:1px solid color-mix(in srgb,var(--purple) 34%,transparent)">
    {plug(*P_GRAY)}
    <div class="col grow" style="min-width:0"><div class="row g6"><span class="f12 w7 grow ell">灰度放量想把 okr-web 从 30% 调到 50%</span></div>
      <div class="row g6" style="margin-top:4px"><span class="f11 t3 grow">确认时按最新数据再核对一次</span><button class="cc-btn cc-btn-xs cc-btn-sec">不同意</button><button class="cc-btn cc-btn-xs cc-btn-pri">确认调整</button></div></div>
  </div>
  <div class="nt">
    <span class="ap ap-chat">{DOCK_ICONS["chat"]}</span>
    <div class="col grow" style="min-width:0"><div class="row g6"><span class="f12 w7 grow">Bot 在问你 · 3 条</span>{I("chevr",13,style="color:var(--text-3)")}</div>
      <div class="f11 t3" style="margin-top:2px">5 分钟内的同类提醒合成了一条</div></div>
  </div>
  <div class="nt gone">
    <span class="ap ap-chat">{DOCK_ICONS["chat"]}</span>
    <div class="col grow" style="min-width:0"><div class="f12 w7 t">TK-20855 等你审核</div>
      <div class="f11 t3" style="margin-top:2px">陈晨已经审核过，这条自动移除</div></div>
  </div>
</div>'''

    # ---------- 4 插件停用后：历史只读 ----------
    def mkrow(icon_html, name, sub, tag, on=False):
        st = ("background:color-mix(in srgb,var(--blue) 12%,var(--glass-2));border:1px solid var(--focus-ring)" if on
              else "border:1px solid transparent")
        return (f'<div class="row g8" style="padding:7px 8px;border-radius:12px;{st}">{icon_html}'
                f'<div class="col grow" style="min-width:0"><span class="f12 w7 ell">{name}</span><span class="f11 t3 ell">{sub}</span></div>{tag}</div>')

    def sq(grad, ic, gray=False):
        return f'<span class="ic-box{" gray" if gray else ""}" style="width:28px;height:28px;border-radius:8px;background:linear-gradient(160deg,{grad})">{I(ic,14,2.2)}</span>'

    rb_grad = "#FF8A7A,#FF453A 55%,#E0281E"
    left4 = f'''<div class="ml" style="width:200px"><div class="hd"><b class="grow">插件市场</b></div>
<div class="cc-seg cc-seg-xs" style="margin:0 4px 8px;display:flex"><span style="flex:1">全部</span><span class="on" style="flex:1">已安装 5</span></div>
<div class="col g2">
{mkrow(sq(rb_grad,"history",True), "紧急回滚", "官方 · Apollo", '<span class="tag tg-n">已停用</span>', on=True)}
{mkrow(sq(P_GRAY[1],"filter"), "灰度放量", "官方 · v1.2", '<span class="tag tg-g">启用</span>')}
{mkrow(sq(P_TOKEN[1],"zap"), "Token 费用", "官方 · v0.9", '<span class="tag tg-g">启用</span>')}
{mkrow(sq(P_QA[1],"list"), "质量周报", "企业自定义", '<span class="tag tg-g">启用</span>')}
</div><span class="grow"></span></div>'''
    def rrow(no, app, ver, who, when):
        return (f'<div class="rt"><span class="mono w7">{no}</span><span class="col" style="min-width:0"><span class="w6 ell">{app} · 回读通过</span><span class="mono f11 t3">{ver}</span></span>'
                f'<span class="col"><span class="t2">{who}</span><span class="f11 t3">{when}</span></span><span class="lnk w6" style="justify-self:end">查看</span></div>')
    t4 = left4 + f'''<div class="col grow" style="min-width:0;padding:14px 18px 14px 16px;gap:10px">
  <div class="row g10">
    <span class="ic-box gray" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(160deg,{rb_grad})">{I("history",20,2.2)}</span>
    <div class="col grow" style="min-width:0"><div class="row g8"><span class="f15 w7">紧急回滚（Apollo）</span><span class="tag tg-n">已停用</span></div>
      <div class="f11 t3" style="margin-top:2px">林某 11-21 停用 · 只有管理员能重新启用</div></div>
    <span class="cc-switch"></span>
  </div>
  <div class="row g8" style="padding:9px 12px;border-radius:12px;background:var(--well);border:1px solid var(--hair)">
    {I("lock",14,2.2,"color:var(--text-3)")}<span class="f12 t2 grow">Dock 里的回滚图标和工单里的回滚按钮已经收起，以前的回滚记录都还在，只能查看。</span>
  </div>
  <div class="card" style="padding:0;overflow:hidden;gap:0">
    <div class="rt h"><span>编号</span><span>应用和版本</span><span>谁回滚的</span><span></span></div>
    {rrow("RB-091", "okr-web", "3.8.2 → 3.8.1", "林某", "11-18 19:42")}
    {rrow("RB-087", "approval-web", "2.4.1 → 2.4.0", "陈晨", "11-12 21:05")}
    {rrow("RB-080", "okr-web", "3.7.0 → 3.6.4", "林某", "11-03 18:30")}
  </div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-locked">{I("lock",12,2.2)}再次回滚（插件已停用）</button><span class="grow"></span><span class="lnk f12 w6">导出记录</span></div>
</div>'''

    body = ('<div class="eb">'
            + tile(1, "插件页面没响应", "只影响插件自己的标签页，修单和发布照常可用", t1, "v")
            + tile(2, "插件入口超出上限自动收起", "Dock 外面最多 4 个插件，顶栏最多 2 个小胶囊", t2, "v rel")
            + tile(3, "插件发起的操作要人确认", "同类通知 5 分钟内合并，已处理的自动移除", t3, "v rel")
            + tile(4, "插件停用后，历史记录只能查看", "收起入口，不删记录", t4)
            + '</div>')
    return board_page("插件运行状态 · 云匠", body, css)


# =====================================================================
# 6. 移动端-运行态与异常补齐（T-15：3 屏，1440×1000）
# =====================================================================
def build_mobile_runtime():
    """移动端运行态三屏：与其他移动端板同一套导航、工单头和底部操作区。"""
    def phone_wrap(inner, sheet=""):
        return f'<div class="phone"><div class="scr">{status}{inner}{sheet}<div class="home"></div></div></div>'

    def nav(back, title, right=""):
        r = right or '<span aria-hidden="true"></span>'
        return (f'<div class="nav"><span class="bk">{I("chevr",20,style="transform:rotate(180deg)")}{back}</span>'
                f'<span style="text-align:center;font-weight:600;font-size:15px">{title}</span>{r}</div>')

    def seg(items, on):
        return '<div class="cc-m-seg" style="margin-top:12px">' + "".join(
            f'<span{" class=\"on\"" if i == on else ""} style="padding:0 4px">{t}</span>' for i, t in enumerate(items)) + "</div>"

    def thead(title, tags, tabs, tab):
        return f'''<div class="pad" style="padding-top:2px">
  <div class="row g12" style="align-items:flex-start"><span class="appic ic-tita" style="width:40px;height:40px;border-radius:11px;font-size:11px;font-weight:800">TITA</span>
  <div class="grow" style="min-width:0"><div style="font-size:17px;font-weight:700;line-height:1.3" class="ell">{title}</div><div class="row g6" style="margin-top:5px">{tags}</div></div></div>
  {seg(tabs, tab)}
</div>'''

    def tg(text, c):
        return f'<span class="tg" style="color:var(--ink-{c});background:color-mix(in srgb,var(--{c}) 12%,transparent)">{text}</span>'

    more = f'<span class="nb2 glass">{I("more",18)}</span>'
    TABS = ["对话", "改动 7", "证据 4", "日志", "发布"]

    # 屏 1：第一次发测试时，就地补填个人发布账号
    def step(state, name, right):
        ic = (f'<span class="ck" style="background:var(--btn-ok-bg)">{I("check",11,3)}</span>' if state == "ok"
              else '<span class="ck" style="background:var(--fill);color:var(--text-3)"></span>')
        return f'<div class="row g10" style="padding:9px 0;border-top:1px solid var(--hair)">{ic}<span class="f13 w6 grow">{name}</span><span class="f11 t3">{right}</span></div>'
    bg1 = f'''{nav("工单", "TK-20871", more)}{thead("发起审批时点击分组，界面卡住", tg("审核通过 · 第 2 轮", "green"), TABS, 4)}
<div class="pad">
  <div class="card2" style="margin-top:12px;padding:12px 14px">
    <div class="row g8"><span class="f13 w7 grow">第 2 轮 → 测试环境</span><span class="tag tg-n">还没发布</span></div>
    <div class="row g8 f12 t2" style="margin-top:8px"><span class="mono">2.17.4</span><span class="t3">→</span><span class="mono w7" style="color:var(--ink-blue)">2.18.0-fix.2</span></div>
  </div>
  <div class="card2" style="margin-top:10px;padding:4px 14px">
    {step("ok", "合入测试分支", "MR !318 已合入")}{step("", "打包上传", "等待")}{step("", "发布到测试", "等待")}{step("", "核对生效", "等待")}{step("", "通知测试人", "等待")}
  </div>
</div>'''
    sh1 = f'''<div class="scrim"></div>
<div class="sheet">
  <div class="grab"></div>
  <div class="row g10">
    <span class="ii" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(160deg,#FFC15A,#F08A00);color:#fff;display:flex;align-items:center;justify-content:center;flex:none">{I("key",18,2.2)}</span>
    <div class="col grow" style="min-width:0"><div class="f16 w7">先填你的发布账号</div><div class="f12 t3">发布要用你本人的账号，只填一次</div></div>
    <span class="f13 t3">取消</span>
  </div>
  <div class="flb" style="margin-top:14px">账号</div>
  <div class="cc-m-input"><span class="mono grow">lin.x</span></div>
  <div class="flb" style="margin-top:10px">密码或令牌</div>
  <div class="cc-m-input is-focus"><span class="mono grow">••••••••••••</span>{I("eye",16,style="color:var(--text-3)")}</div>
  <div class="row g6 f12 t3" style="margin-top:10px;align-items:flex-start;line-height:1.5">{I("lock",13,2.2,"flex:none;margin-top:2px")}<span>加密保存，只有你能用，管理员也看不到</span></div>
  <button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;margin-top:14px">{I("check",16,2.6)}保存并发布到测试</button>
</div>'''
    p1 = phone_wrap(bg1, sh1)

    # 屏 2：无权查看
    p2 = phone_wrap(f'''{nav("工单", "工单详情")}
<div class="pad" style="display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:150px">
  <span class="ii" style="width:64px;height:64px;border-radius:19px;background:linear-gradient(160deg,#FF8A7A,#E0281E);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px -10px rgba(224,40,30,.5)">{I("lock",28,2.2)}</span>
  <div style="font-size:20px;font-weight:700;margin-top:18px">当前账号无权查看这张工单</div>
  <div class="f13 t2" style="margin-top:8px;line-height:1.6">可能换了账号登录，或项目权限已被撤销。<br>工单内容不会显示。</div>
  <div class="grp glass" style="width:100%;margin-top:22px;padding:12px 14px;text-align:left">
    <div class="f12 t3">当前登录</div>
    <div class="row g10" style="margin-top:6px">{av("林","#FFC9A8,#F08F7A","green",30)}<span class="mono f13 w6 grow">lin@personal.com</span><span class="lnk f13 w6">切换账号</span></div>
  </div>
  <div class="f12 t3" style="margin-top:12px;line-height:1.5">工单列表、搜索和 AI 助手里也查不到这张单。<br>需要权限请联系管理员或项目负责人。</div>
  <button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;width:100%;margin-top:22px">回到我的工单</button>
</div>''')

    # 屏 3：L2 高危改动 · 手机上默认不能快速通过
    def fl(name, add, dele, seen):
        mark = (f'<span class="ck" style="background:var(--btn-ok-bg);width:16px;height:16px">{I("check",10,3)}</span>' if seen
                else '<span class="ck" style="background:var(--fill);width:16px;height:16px"></span>')
        return (f'<div class="row g8" style="padding:7px 0;border-top:1px solid var(--hair)">{mark}<span class="mono f12 grow ell">{name}</span>'
                f'<span class="mono f11" style="color:var(--ink-green)">+{add}</span><span class="mono f11" style="color:var(--ink-red)">−{dele}</span></div>')
    p3 = phone_wrap(f'''{nav("工单", "TK-20871", more)}{thead("发起审批时点击分组，界面卡住", tg("P1", "red") + tg("待我审核 · 第 2 轮", "blue"), TABS, 0)}
<div class="pad">
  <div class="cc-m-l2-lock" style="margin-top:12px;flex-direction:column;align-items:stretch;gap:6px">
    <div class="row g8">{I("shield",16,2.2)}<span class="f14 w7">改到了权限相关代码</span></div>
    <div class="f12 t2" style="line-height:1.5">这一轮改了 <span class="mono">auth/</span> 下 7 个文件，手机上不能一键通过。看完全部改动后才能通过，或者发到电脑上逐行审。</div>
  </div>
  <div class="card2" style="margin-top:10px;padding:10px 14px 4px">
    <div class="row g8" style="padding-bottom:6px"><span class="f13 w7 grow">改动文件</span><span class="f12 t3">已看 3 / 7</span></div>
    {fl("auth/guard.ts", 18, 6, True)}{fl("auth/roles.ts", 9, 2, True)}{fl("auth/session.ts", 4, 1, True)}{fl("approval/GroupPicker.tsx", 38, 12, False)}
    <div class="row g6 f12 lnk w6" style="padding:8px 0;border-top:1px solid var(--hair);justify-content:center">还有 3 个文件 {I("chevd",12,2.4)}</div>
  </div>
  <div class="row g8" style="margin-top:10px;padding:11px 14px;border-radius:14px;background:var(--well);border:1px solid var(--hair)">{I("monitor",15,2.2,"color:var(--ink-blue)")}<span class="f13 w6 grow">发到电脑上逐行审</span><span class="lnk f13 w6">发送 ›</span></div>
</div>
<div class="dock2 glass">
  <div class="row g12">
    <button class="abtn a-red" style="flex:1;height:44px;justify-content:center;border-radius:14px">{I("undo",15)}打回</button>
    <button class="cc-m-btn-locked bigbtn" style="flex:1.6;height:44px;font-size:13.5px;white-space:nowrap">{I("lock",14)}看完 7 个文件后可通过</button>
  </div>
</div>''')

    cols = (
        f'<div class="col3">{p1}<div class="lbl">第一次发布时补填账号<em>只填一次，只有本人能用</em></div></div>'
        f'<div class="col3">{p2}<div class="lbl">无权查看<em>不显示工单内容，可切换账号</em></div></div>'
        f'<div class="col3">{p3}<div class="lbl">改到权限代码时<em>看完全部改动才能通过</em></div></div>'
    )
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>移动端 · 运行态与异常补齐</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="m.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
</head><body><div class="board">{cols}</div>
<script src="../v3/shots.js"></script><script src="icons.js"></script></body></html>'''


FILES = {
    "pc-ws-switch.html": build_ws_switch(),
    "pc-invite-expired.html": build_invite_expired(),
    "pc-project-workflow.html": build_project_workflow(),
    "pc-operation-log.html": build_operation_log(),
    "pc-edge-extra.html": build_edge_extra(),
    "pc-plugin-runtime.html": build_plugin_runtime(),
    "m-runtime-extra.html": build_mobile_runtime(),
}

for fn, html in FILES.items():
    p = OUT / fn
    p.write_text(html, encoding="utf-8")
    print("→", p)
