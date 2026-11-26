"""PC 定稿外壳：顶栏、Dock 菜单、工单列表。所有 PC 页面共用。"""

def I(name, s=16, w=None, style=""):
    """图标占位，icons.js 会替换成 SVG。"""
    return f'<i data-i="{name}" data-s="{s}"' + (f' data-w="{w}"' if w else "") + (f' style="{style}"' if style else "") + "></i>"


LOGO = '''<span class="lg"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7.2L3.6 12 8 16.8"/><path d="M16 7.2l4.4 4.8-4.4 4.8" opacity=".6"/><path d="M9.6 12.3l1.8 1.8 3.2-4"/></svg><svg class="spk" width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z"/></svg></span>'''

SV = 'width="24" height="24" viewBox="0 0 24 24"'
DOCK_ICONS = {
    "ai": f'<svg {SV} fill="#fff"><path d="M10 3l1.9 5.6 5.6 1.9-5.6 1.9L10 18l-1.9-5.6L2.5 10.5l5.6-1.9z"/><path d="M18 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" opacity=".8"/></svg>',
    "chat": '<svg width="30" height="30" viewBox="0 0 24 24"><defs><linearGradient id="cb1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6CC4FF"/><stop offset="1" stop-color="#1673FF"/></linearGradient></defs><path d="M15 9.6c3.4 0 6.1 2.2 6.1 4.9 0 1.4-.7 2.6-1.8 3.5l.5 2.5-2.9-1.4c-.6.2-1.2.3-1.9.3-3.4 0-6.1-2.2-6.1-4.9s2.7-4.9 6.1-4.9z" fill="#B9DBFF"/><path d="M9.6 3.2c-4 0-7.2 2.6-7.2 5.8 0 1.7.9 3.2 2.3 4.2l-.6 3 3.5-1.7c.6.2 1.3.2 2 .2 4 0 7.2-2.6 7.2-5.8S13.6 3.2 9.6 3.2z" fill="url(#cb1)"/><circle cx="6.8" cy="9" r="1" fill="#fff"/><circle cx="9.6" cy="9" r="1" fill="#fff"/><circle cx="12.4" cy="9" r="1" fill="#fff"/></svg>',
    "pub": f'<svg {SV}><path d="M12 2.6l8.4 4.7L12 12 3.6 7.3z" fill="#FFE2A8"/><path d="M3.6 7.3L12 12v9.4l-8.4-4.7z" fill="#fff" opacity=".95"/><path d="M20.4 7.3L12 12v9.4l8.4-4.7z" fill="#fff" opacity=".7"/><path d="M7.8 4.9l8.4 4.7v3.2" stroke="#FF8A00" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/></svg>',
    "rb": f'<svg {SV} fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.8 4.8v4.4h4.4"/><path d="M4.2 9.2A8.3 8.3 0 1 1 3.9 13.6"/><path d="M12 8v4.2l2.7 1.7"/></svg>',
    "sk": f'<svg {SV}><path d="M12 13.2l8.6-4.4L12 4.4 3.4 8.8z" fill="#fff"/><path d="M3.4 12.6L12 17l8.6-4.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><path d="M3.4 16.2L12 20.6l8.6-4.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/></svg>',
    "mkt": f'<svg {SV}><rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2" fill="#fff"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2" fill="#fff" opacity=".82"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2" fill="#fff" opacity=".82"/><path d="M16.9 13.2l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#fff"/></svg>',
    "set": f'<svg {SV}><defs><linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#D9DCE3"/></linearGradient></defs><path d="M12 1.8l1.6 2.4 2.8-.7.5 2.9 2.8.9-.9 2.8 2.2 1.9-2.2 1.9.9 2.8-2.8.9-.5 2.9-2.8-.7L12 22.2l-1.6-2.4-2.8.7-.5-2.9-2.8-.9.9-2.8-2.2-1.9 2.2-1.9-.9-2.8 2.8-.9.5-2.9 2.8.7z" fill="url(#gr1)"/><circle cx="12" cy="12" r="5.2" fill="#8D919B"/><circle cx="12" cy="12" r="2.6" fill="#E9EBF0"/></svg>',
}


def dock(sel, has_rb=True):
    def it(k, badge=""):
        b = f"<b>{badge}</b>" if badge else ""
        return f'<span class="dki{" on" if k == sel else ""}"><span class="ap ap-{k}">{DOCK_ICONS[k]}</span>{b}</span>'
    rb_item = it("rb") if has_rb else ""
    return ('<nav class="dockv glass" aria-label="主菜单">' + it("ai") + '<span class="dsep"></span>'
            + it("chat", "4") + it("pub", "1") + rb_item + it("sk") + '<span class="grow"></span>'
            + it("mkt") + it("set") + "</nav>")


def make_topbar(ws_pill="", right_extra=None):
    pills = (
        f'<span class="pill glass tpill">{I("bot",13)}3 个 Bot 在线</span>'
        '<span class="pill glass tpill"><span class="dot" style="width:7px;height:7px;background:var(--green)"></span>Jira · 2 分钟前</span>'
        '<span class="pill glass tpill" style="color:var(--ink-orange)"><span class="dot" style="width:7px;height:7px;background:var(--orange)"></span>Tita 采集失败 · 重试中</span>'
    ) if right_extra is None else right_extra
    return f'''<div class="tbar">
  <div class="br">{LOGO}<span class="tt"><b>云匠</b><em>CloudCraft</em></span>{ws_pill}</div>
  <div class="grow row" style="justify-content:center"><div class="glass tsearch">{I("search",15)}<span class="f13 grow">搜索工单、MR、发布记录</span><span class="kbd" style="border-color:var(--hair)">⌘F</span></div></div>
  <div class="tright">
    {pills}
    <span class="av" style="width:34px;height:34px;font-size:13px;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
  </div>
</div>'''


TOPBAR = make_topbar()

# 工单数据：id, 头像名, 渐变, 状态色, 标题, 来源, 说明, 右侧, 说明颜色, 进度
TICKETS = [
    ("等你决定", None, [
        ("20871", "王芳", "#7FB2FF,#4C7DF0", "blue", "点击分组后界面卡住", "t", "第 2 轮交付 · 验证 3/4", "8 分钟", "", None),
        ("20855", "陈晨", "#FFC38A,#F08A5D", "orange", "进度条切换周期不刷新", "j", "验证受阻：账号进不去页面", "dot", "", None),
    ]),
    ("Bot 在问你", None, [
        ("20862", "李娜", "#F5A3C7,#D96BA0", "orange", "考勤部门筛选失效", "t", "复现用哪个角色？", "dot-o", "orange", None),
    ]),
    ("Bot 修复中", None, [
        ("20840", "赵磊", "#8FD8C9,#3FAE9A", "teal", "考勤导出部门名乱码", "t", "浏览器验证中 · 84%", "", "", 84),
        ("20833", "周婷", "#C3A8FF,#8E6BEA", "teal", "看板拖拽后回弹", "j", "复现中 · 还有 1 张", "", "", 30),
    ]),
    ("待原平台确认", None, [
        ("20790", "孙浩", "#9EDB9A,#4FB06A", "green", "审批单撤回后状态错乱", "t", "已通过 · 去 Tita 点「已完成」", "", "", None),
    ]),
    ("需要处理", "red", [
        ("3320", "OKR", "#C7CBD4,#9298A6", "red", "OKR-3320 已收单", "j", "无法确定真人修复人", "", "red", None),
    ]),
]


def avatar(nm, gr, st, size=34, fs=11):
    return f'<span class="av10" style="width:{size}px;height:{size}px;font-size:{fs}px;background:linear-gradient(150deg,{gr})">{nm}<i style="background:var(--{st})"></i></span>'


def trow(t, on=False, right_override=None):
    tid, nm, gr, st, title, src, sub, right, subc, prog = t
    r = right_override if right_override is not None else right
    if r == "dot":
        rr = '<span class="ud10"></span>'
    elif r == "dot-o":
        rr = '<span class="ud10" style="background:var(--orange)"></span>'
    elif r:
        rr = f'<span class="tm10">{r}</span>'
    else:
        rr = ""
    sc = f' style="color:var(--ink-{subc})"' if subc else ""
    pg = f'<span class="pg10"><i style="width:{prog}%"></i></span>' if prog else ""
    return (f'<div class="r10{" on" if on else ""}">{avatar(nm, gr, st)}<div class="grow" style="min-width:0">'
            f'<div class="row g6"><span class="t10 ell grow">{title}</span>{rr}</div>'
            f'<div class="row g6" style="margin-top:3px"><span class="sc10 sc-{src}">{"Tita" if src == "t" else "Jira"}</span><span class="d10 ell"{sc}>{sub}</span></div>{pg}</div></div>')


def ticket_list(sel="20871"):
    h = ['<section class="glass pn" style="width:300px;flex:none;padding:16px 10px 10px">',
         f'<div class="row g8" style="padding:0 8px 2px"><span class="f18 w7">工单</span><span class="f13 t3">8</span><span style="width:24px;height:24px;border-radius:7px;background:var(--btn-pri-bg);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none" title="手动新建工单">{I("plus",13,2.6)}</span><span class="grow"></span><div class="cc-seg cc-seg-xs"><span class="on">我的</span><span>全部</span></div></div>']
    for g, cls, rows in TICKETS:
        h.append(f'<div class="g10h{" " + cls if cls else ""}">{g}<span>{len(rows)}</span></div>')
        h += [trow(t, t[0] == sel, "" if t[0] == sel and t[7].startswith("dot") else None) for t in rows]
    h.append("</section>")
    return "".join(h)


def ticket_head(tabs_on="对话", title="审批中心：发起审批时点击分组，界面卡住", tid="TK-20871", meta=None, pill=('p-blue', '待我审核 · 第 2 轮'), src="TITA", extra_right=""):
    meta = meta or f'{tid} · <span style="color:var(--ink-red);font-weight:700">P1</span> · 审批 / 发起审批 · 修复人 林某 · 执行 Bot-01'
    tabs = [("对话", ""), ("代码改动", "3"), ("证据", "4"), ("执行日志", ""), ("发布", "")]
    th = "".join(f'<span{" class=\"on\"" if n == tabs_on else ""}>{n}{(" <b>" + c + "</b>") if c else ""}</span>' for n, c in tabs)
    return f'''<header class="thead">
  <div class="row g12"><span class="appic ic-{src.lower()}" style="width:40px;height:40px;font-size:11px">{src}</span>
    <div class="col grow" style="min-width:0"><h1 class="ell">{title}</h1><div class="f12 t3" style="margin-top:2px">{meta}</div></div>
    <span class="pill {pill[0]}" style="flex:none">{pill[1]}</span></div>
  <div class="row g10" style="margin-top:10px"><div class="tab2">{th}</div><span class="grow"></span>{extra_right}<span class="f12 lnk">打开 {"Jira" if src=="JIRA" else "Tita"} 原单 ↗</span></div>
</header>'''


def composer(tid="TK-20871", ph="问这张单，或让 Bot 再做点什么…"):
    return f'''<div class="cmpwrap"><div class="cmp">
  <span class="aitag"><span class="aid">{I("spark",13)}</span><span class="f13 w7">本单 AI</span><span class="f12 t3 mono">{tid}</span></span>
  <span class="f14 t3 grow ell">{ph}</span>{I("paperclip",17,style="color:var(--text-3)")}<span class="snd">{I("arrowup",17,2.4)}</span></div></div>'''


def page(title, sel, body):
    body, _, overlay = body.partition("<!--OVERLAY-->")
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
</head><body><div class="root">
{TOPBAR}
<div class="panels">{body}</div>
{dock(sel)}
{overlay}
</div>
<script src="../v3/shots.js"></script><script src="icons.js"></script>
</body></html>'''


def board_page(title, body, style=""):
    """展示板：不带顶栏和 Dock，几块面板并排（边界状态等）。"""
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{style}</style>
</head><body><div class="root">
{body}
</div>
<script src="../v3/shots.js"></script><script src="icons.js"></script>
</body></html>'''
