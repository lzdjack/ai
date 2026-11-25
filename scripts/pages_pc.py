"""PC 各页面内容。每页 = (标题, Dock 选中项, panels 内部 HTML)。"""
from shell_pc import I, avatar, trow, ticket_list, ticket_head, composer, TICKETS

CK = lambda c="green", g="✓": f'<span class="ck" style="background:var(--{c})">{g}</span>'
T = {t[0]: t for _, _, rows in TICKETS for t in rows}


def aside(*cards, w=290):
    return f'<aside class="glass pn" style="width:{w}px;flex:none;padding:16px 14px;gap:12px">{"".join(cards)}</aside>'


def review_row(obj="a3f9c21", note=""):
    return f'''<div class="row g10" style="padding:12px 22px;border-top:1px solid var(--hair)">
  <span class="f12 t3">审核对象 <span class="mono" style="color:var(--text)">{obj}</span> · 第 2 轮{note}</span><span class="grow"></span>
  <button class="abtn a-red" style="height:36px">{I("undo",14)}打回并说明原因</button>
  <button class="abtn a-pri" style="height:36px;padding:0 22px">{I("check",15,2.6)}审核通过 {obj}</button></div>'''


# =====================================================================
# 1. AI 助手（全局）
# =====================================================================
def p_ai():
    sess = [("今天", [("现在有哪些单在等我？", "全局", True), ("用普通员工再测 TK-20855", "TK-20855", False), ("今天 Tita 收单正常吗？", "全局", False)]),
            ("昨天", [("TK-20871 为什么又退回来了", "TK-20871", False), ("本周哪些 Bug 修复失败过", "全局", False), ("把验证 Skill 用到审批项目", "审批项目", False)]),
            ("本周", [("这个 Bug 测试和正式各是什么版本", "TK-20790", False), ("组件发了为什么主站看不到", "大包", False)])]
    left = ['<section class="glass pn" style="width:270px;flex:none;padding:16px 10px 10px">',
            f'<div class="row" style="padding:0 8px 8px"><span class="f18 w7 grow">AI 助手</span><span class="btn2 sm a-sec" style="background:var(--fill)">{I("plus",14,2.2)}新对话</span></div>',
            f'<div class="row g8" style="margin:0 6px;height:32px;padding:0 10px;border-radius:10px;background:var(--fill);color:var(--text-3)">{I("search",14)}<span class="f12">搜索对话</span></div>']
    for g, rows in sess:
        left.append(f'<div class="g10h">{g}</div>')
        for t, ctx, on in rows:
            st = 'background:linear-gradient(180deg,#3B8BFF,#1F6FFF);color:#fff;box-shadow:0 8px 18px -10px rgba(31,111,255,.9)' if on else ''
            cs = 'background:rgba(255,255,255,.22);color:#fff' if on else ''
            left.append(f'<div class="col" style="padding:9px 10px;border-radius:12px;gap:4px;{st}"><span class="f13 w6 ell">{t}</span><span class="row g6"><span class="tag tg-n" style="height:18px;font-size:10.5px;{cs}">{ctx}</span></span></div>')
    left.append("</section>")

    def tk(tid, state, stc, btn="去审核", sec=False):
        t = T[tid]
        return trow(t, right_override="").replace('<span class="d10 ell"', f'<span class="tag tg-{stc}" style="height:17px;font-size:10.5px">{state}</span><span class="d10 ell"', 1).replace('</div></div>', f'</div></div>', 1)[:-12] + f'</div><span class="go{" sec" if sec else ""}" style="align-self:center">{btn}</span></div>'

    main = f'''<main class="glass pn grow" style="min-width:0">
  <div class="row g10" style="padding:14px 22px;border-bottom:1px solid var(--hair)">
    <span class="orb" style="width:30px;height:30px">{I("spark",15,style="color:#fff")}</span>
    <span class="f16 w7">现在有哪些单在等我？</span><span class="grow"></span>
    <span class="chip2" style="height:28px">{I("layers",13)}关联：全局 · 我的工单{I("chevd",12)}</span>
    <span class="chip2" style="height:28px">{I("monitor",13)}手机上可继续</span>
  </div>
  <div class="col g14 grow" style="padding:14px 40px 8px;min-height:0;justify-content:flex-end;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 60px);mask-image:linear-gradient(180deg,transparent 0,#000 60px)">
    <div class="me">哪几张在等我审核？。</div>
    <div class="col g8">
      <div class="row g8"><span class="aid" style="width:22px;height:22px;border-radius:7px">{I("spark",12)}</span><span class="f12 t3">AI 助手 · 查了你名下 8 张工单的最新一轮验证记录</span></div>
      <div class="f14" style="line-height:1.6">有 <b>2 张</b>待你审核。按浏览器验证情况排序，<b style="color:var(--ink-orange)">执行受阻</b>的放在最前：</div>
      <div class="card" style="padding:4px;width:640px">
        {tk("20855","执行受阻","o","处理")}
        {tk("20871","已通过 3/4","g")}
      </div>
      <div class="f12 t3">另有 1 张修复中（结果未知），未计入。<span class="lnk">在工单列表中查看 ›</span></div>
    </div>
    <div class="me">TK-20855 用普通员工再测一次，重点看切换第二个周期。</div>
    <div class="col g8">
      <div class="row g8"><span class="aid" style="width:22px;height:22px;border-radius:7px">{I("spark",12)}</span><span class="f12 t3">AI 助手 · 已代你在 TK-20855 补充条件</span></div>
      <div class="card" style="width:640px;padding:14px 16px">
        <div class="row g8"><span class="sc10 sc-j">Jira</span><span class="f14 w7 grow">进度条切换周期不刷新 · 第 2 轮复测</span><span class="f12 t3">发起人 林某 · 14:26</span></div>
        <div class="f13 t2" style="margin-top:6px">补充条件：<b style="color:var(--text)">普通员工</b> · 重点检查<b style="color:var(--text)">切换到第二个周期</b>后进度条是否刷新</div>
        <div class="row g10" style="margin-top:12px">
          <span class="row g6 f12 w6" style="color:var(--ink-green)">{CK()}已提交给 Bot-02</span><span style="width:28px;height:2px;background:var(--green)"></span>
          <span class="row g6 f12 w6" style="color:var(--ink-teal)"><span class="ck" style="background:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 22%,transparent)">{I("loader",11,2.6)}</span>正在执行 · 浏览器复测</span><span style="width:28px;height:2px;background:var(--hair)"></span>
          <span class="row g6 f12 t3"><span class="ck" style="background:var(--fill)"></span>已有验证结果</span>
          <span class="grow"></span><span class="f12 lnk">在工单中查看 ›</span>
        </div>
      </div>
    </div>
  </div>
  <div style="padding:6px 40px 18px">
    <div class="row g8" style="margin-bottom:10px"><span class="sug">{I("spark",12,style="color:var(--ink-purple)")}本周哪些 Bug 修复失败过？</span><span class="sug">{I("spark",12,style="color:var(--ink-purple)")}今天 Tita 收单正常吗？</span><span class="sug">{I("spark",12,style="color:var(--ink-purple)")}TK-20790 测试和正式各是什么版本</span></div>
    <div class="gbord row g10" style="height:54px;padding:0 7px 0 18px"><span class="f14 t3 grow">问所有工单、发布、收单情况，或让 AI 帮你办…</span>{I("mic",17,style="color:var(--text-3)")}{I("paperclip",17,style="color:var(--text-3)")}<span class="snd ai" style="width:40px;height:40px;border-radius:13px">{I("arrowup",17,2.4)}</span></div>
  </div>
</main>'''

    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">当前关联</div>
  <div class="row g10"><span class="ic-box" style="background:linear-gradient(160deg,#5E8BFF,#B157F0)">{I("layers",16)}</span><div class="grow"><div class="f13 w6">全局 · 我的工单</div><div class="f12 t3">8 张 · 3 个项目</div></div><span class="f12 lnk">切换</span></div>
  <div class="f12 t3" style="margin-top:10px;line-height:1.6">从工单、项目或设置页进入时，这里会显示对应对象。</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">本段对话已执行</div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--green)"></span><i></i></div><div style="padding-bottom:8px"><div class="f13 w6">查询待审核工单</div><div class="f12 t3">只读 · 8 张 · 14:20</div></div></div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 20%,transparent)"></span></div><div><div class="f13 w6">TK-20855 发起复测</div><div class="f12 t3">已提交给 Bot-02 · 执行中</div></div></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">按你的权限办事</div>
  <div class="kv2"><span class="t2">查询</span><span class="f12 t3">直接回答</span></div>
  <div class="kv2"><span class="t2">单项操作</span><span class="f12 t3">对象明确就办</span></div>
  <div class="kv2"><span class="t2">批量审核 · 改规则</span><span class="f12" style="color:var(--ink-orange)">先列影响再确认</span></div>
  <div class="kv2"><span class="t2">可见项目</span><span class="f12 t3">审批 · OKR · 考勤</span></div></div>''')
    return "".join(left) + main + right


# =====================================================================
# 2. 代码改动
# =====================================================================
def code_rows():
    L = lambda n, t, c: (n, t, c)
    K = lambda s: f'<span class="kw">{s}</span>'
    F = lambda s: f'<span class="fn">{s}</span>'
    rows = [
        (L(38, "", f"{K('export function')} {F('GroupPicker')}({{ groups }}: Props) {{"), L(38, "", f"{K('export function')} {F('GroupPicker')}({{ groups }}: Props) {{")),
        (L(39, "", f"  {K('const')} [active, setActive] = {F('useState')}&lt;string&gt;();"), L(39, "", f"  {K('const')} [active, setActive] = {F('useState')}&lt;string&gt;();")),
        (L(40, "", f"  {K('const')} [members, setMembers] = {F('useState')}([]);"), L(40, "", f"  {K('const')} [members, setMembers] = {F('useState')}([]);")),
        (L("", "emp", ""), L(41, "add", f"  {K('const')} reqRef = {F('useRef')}&lt;Abortable&gt;();")),
        (L(41, "", ""), L(42, "", "")),
        (L(42, "", f"  {K('const')} {F('onSelectGroup')} = (id: string) =&gt; {{"), L(43, "", f"  {K('const')} {F('onSelectGroup')} = (id: string) =&gt; {{")),
        (L(43, "", f"    {F('setActive')}(id);"), L(44, "", f"    {F('setActive')}(id);")),
        (L("", "emp", ""), L(45, "add", f"    reqRef.current?.{F('abort')}();")),
        (L(44, "del", f"    {F('fetchMembers')}(id).{F('then')}(list =&gt; {{"), L(46, "add", f"    {K('const')} req = {F('abortable')}({F('fetchMembers')}(id));")),
        (L("", "emp", ""), L(47, "add", "    reqRef.current = req;")),
        (L("", "emp", ""), L(48, "add sel", f"    req.promise.{F('then')}(list =&gt; {{")),
        (L("", "emp", ""), L(49, "add", f"      {K('if')} (req.aborted) {K('return')};")),
        (L(45, "", f"      {F('setMembers')}(list);"), L(50, "", f"      {F('setMembers')}(list);")),
        (L(46, "del", f"      {F('setLoading')}({K('false')});"), L("", "emp", "")),
        (L(47, "", "    });"), L(51, "", "    });")),
        (L(48, "", "  };"), L(52, "", "  };")),
    ]
    return rows


def cl(n, t, c):
    s = "+" if "add" in t else ("−" if "del" in t else "")
    return f'<div class="cl {t}"><span class="n">{n}</span><span class="s">{s}</span><span class="c">{c}</span></div>'


def p_code():
    files = [("m", "GroupPicker.tsx", "src/approval/", "+18", "−8", True, True),
             ("m", "useMembers.ts", "src/approval/hooks/", "+14", "−4", False, False),
             ("a", "abortable.ts", "src/utils/", "+6", "", False, False)]
    ft = [f'<div class="ftree">',
          f'<div class="row g6" style="padding:2px 8px 8px">{I("folder",14,style="color:var(--text-3)")}<span class="f12 w6 grow">tita-approval-web</span><span class="f11 t3">3 个文件</span></div>']
    for st, nm, dirn, a, d, on, seen in files:
        ft.append(f'<div class="frow{" on" if on else ""}"><span class="st st-{st}">{st.upper()}</span><div class="col grow" style="min-width:0;line-height:1.2"><span class="w6 ell">{nm}</span><span class="f11 t3 ell">{dirn}</span></div><span class="f11 num" style="color:var(--ink-green)">{a}</span><span class="f11 num" style="color:var(--ink-red)">{d}</span></div>')
    ft.append(f'''<div class="row g6" style="padding:14px 8px 8px">{I("folder",14,style="color:var(--text-3)")}<span class="f12 w6 grow">tita-ui-kit</span><span class="f11 t3">第 2 个仓库</span></div>
<div class="col g4" style="margin:0 4px;padding:10px;border-radius:10px;background:color-mix(in srgb,var(--orange) 12%,transparent)"><span class="row g6 f12 w6" style="color:var(--ink-orange)">{I("lock",13)}差异未加载</span><span class="f11 t2" style="line-height:1.5">Bot-01 的只读令牌无此仓库权限。缺失范围：1 个提交，文件数未知，不代表没有改动。</span></div>
<span class="grow"></span>
<div class="col g6" style="padding:10px 8px 4px;border-top:1px solid var(--hair)"><div class="row"><span class="f12 t2 grow">已看文件</span><span class="f12 w6">1 / 3</span></div><span class="pg10" style="margin:0"><i style="width:33%;background:var(--blue)"></i></span></div>
</div>''')
    thread = f'''<div style="margin:6px 16px 8px 102px;border-radius:14px;background:var(--glass-2);border:1px solid var(--stroke);box-shadow:0 10px 24px -16px rgba(20,40,100,.5);padding:12px 14px;font-family:var(--font);white-space:normal">
  <div class="row g8"><span class="av" style="width:22px;height:22px;font-size:10px;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span><span class="f13">为什么改这里？旧写法也有 then。</span><span class="grow"></span><span class="f11 t3">选中第 48 行 · 15:02</span></div>
  <div class="row g8" style="margin-top:10px;align-items:flex-start"><span class="aid" style="width:22px;height:22px;border-radius:7px">{I("spark",12)}</span>
    <div class="f13 t2" style="line-height:1.6">旧写法里，先点的分组请求如果晚返回，会把后点分组的成员覆盖掉，就是第 1 轮被打回的现象。这里改成可取消的请求，第 49 行丢弃过期结果。<br>依据：<span class="mono lnk">GroupPicker.tsx:45–49</span> · 修复后录屏 0:12–0:31</div></div>
  <div class="row g8" style="margin-top:10px;padding-left:30px"><span class="btn2 sm a-sec" style="background:var(--fill)">{I("send",13)}把这行和意见发给 Bot</span><span class="btn2 sm a-red">{I("undo",13)}打回时附上</span><span class="grow"></span><span class="f12 t3">追问…</span></div>
</div>'''
    rows = code_rows()
    # 逐行视图：同一改动块里先列删除再列新增
    uni, dels, adds = [], [], []
    def flush():
        uni.extend(dels); uni.extend(adds); dels.clear(); adds.clear()
    for (ln, lt, lc), (rn, rt, rc) in rows:
        if "del" in lt: dels.append((ln, "", "del", lc))
        if "add" in rt: adds.append(("", rn, rt, rc))
        if lt == "" and rt == "":
            flush(); uni.append((ln, rn, "", rc))
    flush()
    def ul(o, n, t, c):
        sg = "+" if "add" in t else ("−" if "del" in t else "")
        return f'<div class="cl {t}"><span class="n">{o}</span><span class="n" style="width:36px">{n}</span><span class="s">{sg}</span><span class="c">{c}</span></div>'
    body = ""
    for r in uni:
        body += ul(*r)
        if r[1] == 49:
            body += thread
    diff = f'''<div class="grow col" style="min-width:0">
  <div class="row g8" style="height:42px;padding:0 14px;border-bottom:1px solid var(--hair)"><span class="st st-m" style="width:16px;height:16px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center">M</span><span class="mono f12 w6">src/approval/GroupPicker.tsx</span><span class="f12 num" style="color:var(--ink-green)">+18</span><span class="f12 num" style="color:var(--ink-red)">−8</span><span class="grow"></span><span class="f12 lnk">查看修复后的完整文件</span><span class="cbx on" style="width:16px;height:16px;border-radius:4px">{I("check",11,3)}</span><span class="f12 t2">已看</span></div>
  <div class="hunk"><span>@@ −38,11 +38,15 @@ export function GroupPicker</span><span class="grow"></span><span>{I("chevd",12)} 展开上方 37 行</span></div>
  <div class="code" style="flex:1;min-height:0;overflow:hidden;padding-top:2px">{body}</div>
  <div class="hunk" style="border-top:1px solid var(--hair)"><span>@@ −112,6 +116,10 @@ function MemberList</span><span class="grow"></span><span>{I("chevd",12)} 展开</span></div>
</div>'''
    main = f'''<main class="glass pn grow" style="min-width:0">
{ticket_head("代码改动")}
<div class="row g10" style="padding:10px 22px;border-bottom:1px solid var(--hair)">
  <span class="chip2" style="height:30px">{I("git",13)}<span class="mono">9c1e07b</span>→<span class="mono" style="color:var(--text)">a3f9c21</span></span>
  <div class="seg" style="padding:2px"><span style="height:26px;font-size:12px">相对基线的全部改动</span><span class="on" style="height:26px;font-size:12px">相对上轮的改动</span></div>
  <div class="seg" style="padding:2px"><span style="height:26px;font-size:12px">并排</span><span class="on" style="height:26px;font-size:12px">逐行</span></div>
  <span class="grow"></span><span class="f12 t3">选中任意一行可以问 AI 或附到打回意见</span><span class="f12 lnk">MR !482 ↗</span>
</div>
<div class="row grow" style="min-height:0;align-items:stretch">{"".join(ft)}{diff}</div>
{review_row()}
</main>'''
    return ticket_list() + main


# =====================================================================
# 3. 证据
# =====================================================================
def p_evidence():
    def media(kind, cap, purpose, pc, seen, extra=""):
        sh = f'<div class="shot" data-s="{kind}" data-cap="{cap}" style="height:200px{extra}"></div>'
        s = '<span class="t3">已查阅</span>' if seen else '<span class="lnk w6">未查阅</span>'
        return f'<div class="col g8" style="flex:1;min-width:0">{sh}<div class="row g6"><span class="tag tg-{pc}">{purpose}</span><span class="f12 ell grow">{cap.split(" · ")[0] if "·" in cap else cap}</span><span class="f12">{s}</span></div></div>'
    miss = f'''<div class="col g8" style="flex:1;min-width:0"><div class="col" style="height:200px;border-radius:14px;border:1.5px dashed color-mix(in srgb,var(--orange) 55%,transparent);background:color-mix(in srgb,var(--orange) 6%,transparent);align-items:center;justify-content:center;gap:6px;color:var(--ink-orange)">{I("alert",22)}<span class="f13 w6">管理员角色未测</span><span class="f12 t2">缺少测试账号，未产生证据</span></div><div class="row g6"><span class="tag tg-o">待确认</span><span class="f12 grow t2">需要你补账号或接受</span><span class="f12 lnk">补充</span></div></div>'''
    steps = [("进入发起审批", "普通员工 kq-staff-03 打开 /approval/start", "g", "通过", "录屏 0:00–0:06"),
             ("点击分组 1 → 2 → 3", "依次点击，每次等成员列表加载完", "g", "通过", "录屏 0:12–0:31"),
             ("切换后仍可选择审批人", "在分组 3 选中「何嘉明」，弹窗可关闭", "g", "通过", "截图 2"),
             ("管理员角色复测", "未执行", "o", "待确认 · 缺账号", "—")]
    tb = "".join(f'<tr><td><div class="row g8">{CK("green" if c=="g" else "orange", "✓" if c=="g" else "!")}<span class="w6">{a}</span></div></td><td class="t2">{b}</td><td><span class="tag tg-{c}">{r}</span></td><td class="{"lnk" if e!="—" else "t3"}">{e}</td></tr>' for a, b, c, r, e in steps)
    main = f'''<main class="glass pn grow" style="min-width:0">
{ticket_head("证据")}
<div class="col g16 grow" style="padding:16px 22px;min-height:0;overflow:hidden">
  <div class="row g8 wrap">
    <span class="f13 w7">第 2 轮</span><span class="chip2" style="height:26px">{I("server",13)}测试环境 · <span class="mono">2.18.0-fix.2</span></span><span class="chip2" style="height:26px">{I("user",13)}普通员工 kq-staff-03</span><span class="chip2" style="height:26px">{I("layers",13)}验证 · 页面交互回归 v1</span>
    <span class="grow"></span><div class="seg" style="padding:2px"><span class="on" style="height:26px;font-size:12px">全部 4</span><span style="height:26px;font-size:12px">原单材料 1</span><span style="height:26px;font-size:12px">修前复现 1</span><span style="height:26px;font-size:12px">修后复测 2</span></div>
  </div>
  <div class="row g14" style="align-items:flex-start">
    {media("before","原单截图","原单材料","n",True)}
    {media("before","修前复现 · 0:18","修前复现","o",True)}
    {media("after","修后复测 · 0:41","修后复测","g",False,";box-shadow:0 0 0 2px var(--green)")}
    {miss}
  </div>
  <div class="card" style="padding:14px 16px 6px">
    <div class="row g8" style="margin-bottom:8px"><span class="sec grow">验证记录</span><span class="f12 t3">计划 4 步 · 实际执行 3 步 · 通过 3 · 待确认 1</span></div>
    <table class="tbl"><thead><tr><th style="width:26%">计划步骤（来自验证 Skill）</th><th>实际执行</th><th style="width:16%">结果</th><th style="width:15%">证据</th></tr></thead><tbody>{tb}</tbody></table>
  </div>
  <div class="row g10 f12 t2" style="padding:0 4px">{I("alert",14,style="color:var(--text-3)")}只有构建成功、没有页面操作的步骤不会显示为「通过」。截图和录屏是否查阅按你的账号记录。</div>
</div>
{review_row()}
</main>'''
    return ticket_list() + main


# =====================================================================
# 4. 执行日志 · 报错
# =====================================================================
def p_log():
    pipe = [("收单", "ok", "13:40"), ("复现", "ok", "13:52"), ("定位", "ok", "14:05"), ("改代码", "ok", "14:18"), ("浏览器验证", "err", "受阻 · 2 次"), ("交付", "wait", "等待")]
    ps = ""
    for i, (n, s, t) in enumerate(pipe):
        g = {"ok": "✓", "err": "!", "wait": str(i + 1)}[s]
        ps += f'<div class="pst{" done" if s=="ok" else ""}"><span class="pdot pd-{s}">{g}</span><span class="f13 w6"{" style=\"color:var(--ink-red)\"" if s=="err" else ""}>{n}</span><span class="f11 t3">{t}</span></div>'
    err = '''<span class="d">[14:32:07] verify  goto https://test.tita.work/okr/progress?period=2026Q4</span>
<span class="d">[14:32:09] verify  login as okr-staff-07 (role: 普通员工)</span>
<span class="h"><span class="e">Error: Navigation blocked — 403 Forbidden</span></span>    at checkAccess (okr-web/src/router/guard.ts:88:11)
    at Router.beforeEach (okr-web/src/router/index.ts:41:5)
    response: {"code":40301,"msg":"当前账号无 OKR 进度查看权限"}
    cookie: tita_sid=<span class="w">••••••••（已脱敏）</span>
<span class="e">Process exited with code 1</span> <span class="d">after 00:41</span>'''
    main = f'''<main class="glass pn grow" style="min-width:0">
{ticket_head("执行日志", title="OKR：切换周期后进度条不刷新", tid="OKR-2231", src="JIRA", pill=("p-orange","需要协助 · 验证受阻"), meta='OKR-2231 · P2 · OKR / 进度 · 修复人 林某 · 执行 Bot-02')}
<div class="col g14 grow" style="padding:16px 22px;min-height:0;overflow:hidden">
  <div class="card" style="padding:16px 10px 12px"><div class="pipe">{ps}</div></div>
  <div class="row g14 grow" style="align-items:stretch;min-height:0">
    <div class="col g10 grow" style="min-width:0">
      <div class="row g8"><span class="sec" style="color:var(--ink-red)">浏览器验证失败</span><span class="tag tg-r">退出码 1</span><span class="tag tg-n mono">guard.ts:88</span><span class="grow"></span>
        <div class="seg" style="padding:2px"><span class="on" style="height:26px;font-size:12px">第 2 次 · 14:32</span><span style="height:26px;font-size:12px">第 1 次 · 13:58</span></div></div>
      <div class="err">{err}</div>
      <div class="row g8"><span class="btn2 sm a-sec" style="background:var(--fill)">{I("copy",13)}复制报错</span><span class="btn2 sm a-sec" style="background:var(--fill)">{I("terminal",13)}展开这次尝试的上下文日志 · 218 行</span><span class="btn2 sm a-sec" style="background:var(--fill)">{I("image",13)}失败时截图</span><span class="grow"></span><span class="f11 t3">凭据在展示、复制和 AI 引用前已脱敏</span></div>
      <div class="card" style="padding:10px 14px 8px">
        <div class="row g8" style="margin-bottom:4px"><span class="f12 w6 t2 grow">上下文日志 · 第 2 次尝试</span><span class="f11 t3">第 200–212 行 / 共 218 行 · 高亮为 AI 引用</span></div>
        <div class="log">
          <div class="ln"><span class="ts">200</span><span class="ts">14:31:52</span><span class="lv t3">INFO</span><span class="t2">skill 页面交互回归 v1 · step 1/4 进入进度页</span></div>
          <div class="ln"><span class="ts">203</span><span class="ts">14:32:05</span><span class="lv t3">INFO</span><span class="t2">browser ready · chromium 132 · viewport 1440×900</span></div>
          <div class="ln" style="background:color-mix(in srgb,var(--purple) 10%,transparent);margin:0 -14px;padding:0 14px"><span class="ts">204</span><span class="ts">14:32:07</span><span class="lv" style="color:var(--ink-orange)">WARN</span><span>GET /api/okr/period?id=2026Q4 → 403 (118ms)</span></div>
          <div class="ln" style="background:color-mix(in srgb,var(--purple) 10%,transparent);margin:0 -14px;padding:0 14px"><span class="ts">209</span><span class="ts">14:32:09</span><span class="lv" style="color:var(--ink-red)">ERROR</span><span>router guard rejected: role=普通员工 lacks okr.progress.view</span></div>
          <div class="ln"><span class="ts">212</span><span class="ts">14:32:48</span><span class="lv t3">INFO</span><span class="t2">screenshot saved · fail-2.png · 已关联第 2 轮</span></div>
        </div></div>
      <div class="card flat" style="padding:10px 14px">
        <div class="row g8"><span class="f12 w6 t2">第 1 次尝试 · 13:58</span><span class="tag tg-o">超时</span><span class="grow"></span><span class="f12 t3">原始记录保留，不被覆盖</span></div>
        <div class="f12 t2" style="margin-top:4px">浏览器工具 120 秒内没有返回，未拿到错误文本。已观测到：页面停在登录后的跳转，最后一次网络请求 <span class="mono">/api/okr/period</span> 无响应。</div>
      </div>
    </div>
    <div class="col g10" style="width:330px;flex:none">
      <div class="card" style="padding:14px 16px">
        <div class="row g8"><span class="aid" style="width:22px;height:22px;border-radius:7px">{I("spark",12)}</span><span class="f13 w7 grow">AI 解读</span><span class="tag tg-o">根因待核实</span></div>
        <div class="col g8 f13" style="margin-top:10px;line-height:1.55">
          <div><b style="color:var(--ink-green)">能确认</b>　复测受阻：okr-staff-07 无权进入进度页。</div>
          <div><b style="color:var(--ink-orange)">不能确认</b>　代码改动是否生效，页面没打开。</div>
          <div><b>下一步</b>　换一个有 OKR 查看权限的普通员工账号，或在原单补充测试账号。</div>
        </div>
        <div class="f12 t3" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hair)">依据：第 2 次尝试日志 第 204–211 行 · 失败截图 1</div>
      </div>
      <div class="card" style="padding:14px 16px">
        <div class="f13 w7">需要你</div>
        <div class="field" style="margin-top:8px;font-size:13px">换账号 <span class="mono">okr-staff-12</span>，密码在原单附件里<span style="display:inline-block;width:1.5px;height:15px;background:var(--blue);vertical-align:-2px;margin-left:1px"></span></div>
        <div class="row g8" style="margin-top:10px"><span class="btn2 a-pri grow" style="background:var(--btn-pri-bg);color:#fff">{I("refresh",14)}补充后让 Bot 重试</span><span class="btn2 a-sec" style="background:var(--fill)">人工接手</span></div>
        <div class="f11 t3" style="margin-top:8px">重试复用已完成的复现、定位和改代码，不会新建 MR。</div>
      </div>
    </div>
  </div>
</div>
</main>'''
    return ticket_list("20855") + main


# =====================================================================
# 5. Bot 在问你（需要协助 → 回复）
# =====================================================================
def p_ask():
    main = f'''<main class="glass pn grow" style="min-width:0">
{ticket_head("对话", title="考勤：按部门筛选后列表没有变化", tid="TK-20862", pill=("p-orange","需要协助 · Bot 在问你"), meta='TK-20862 · <span style="color:var(--ink-orange)">P2</span> · 考勤 / 打卡记录 · 修复人 林某 · 执行 Bot-03')}
<div class="col g12 grow" style="padding:12px 26px 6px;min-height:0;justify-content:flex-end;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 56px);mask-image:linear-gradient(180deg,transparent 0,#000 56px)">
  <div class="card flat" style="padding:12px 16px;margin-left:40px">
    <div class="row g8"><span class="sc10 sc-t">Tita</span><span class="f13 w7 grow">原单 · 客户反馈</span><span class="f12 t3">反馈人 李娜 · 今天 11:02 · 附件 2</span></div>
    <div class="f13 t2" style="margin-top:6px;line-height:1.6">打卡记录页按部门筛选，选了「产品部」列表还是全公司的数据。客户说昨天还正常。环境：正式环境 2.17.4。</div>
  </div>
  <div class="divd">第 1 轮 · 今天 13:20 开始</div>
  <div class="row g10" style="align-items:flex-start"><span class="botav">{I("bot",16)}</span>
    <div class="col g10 grow" style="min-width:0">
      <div class="row g14" style="padding:8px 12px;border-radius:12px;background:var(--fill)">
        <span class="stp">{CK()}读工单</span><span class="stp">{CK("orange","!")}复现 · 用管理员未复现</span><span class="stp t3"><span class="ck" style="background:var(--fill)"></span>定位</span><span class="stp t3"><span class="ck" style="background:var(--fill)"></span>改代码</span><span class="stp t3"><span class="ck" style="background:var(--fill)"></span>验证</span><span class="grow"></span><span class="f12 t3">已暂停 · 等你回复</span>
      </div>
      <div class="card" style="padding:16px 18px;border-radius:20px;box-shadow:0 0 0 2px color-mix(in srgb,var(--orange) 55%,transparent),0 14px 30px -18px rgba(255,149,0,.6)">
        <div class="row g8"><span class="ic-box" style="width:26px;height:26px;border-radius:8px;background:var(--orange)">{I("msgq",15,2.2)}</span><span class="f15 w7 grow">复现要用哪个角色？</span><span class="f12 t3">Bot-03 · 13:41</span></div>
        <div class="f13 t2" style="margin-top:8px;line-height:1.7">原单没写账号角色。我用<b style="color:var(--text)">管理员</b>在测试环境按「研发中心」筛选，列表正常变化，<b style="color:var(--text)">没有复现</b>。<br>部门筛选对「部门负责人」和「普通员工」的可见范围不同，问题可能只在其中一种角色出现。</div>
        <div class="row g6" style="margin-top:10px"><div class="shot" data-s="after" data-cap="管理员 · 未复现" style="width:180px;height:100px"></div><div class="col g4 f12 t3" style="margin-left:8px"><span>已尝试：管理员 admin-01</span><span>测试环境 2.17.4</span><span>筛选：研发中心 → 产品部</span></div></div>
        <div class="f12 w6 t2" style="margin-top:12px">直接点一个回答，或在下面输入</div>
        <div class="row g8 wrap" style="margin-top:8px"><span class="qr">用普通员工</span><span class="qr">用部门负责人</span><span class="qr">两个角色都测</span><span class="qr" style="color:var(--text-2);border-color:var(--hair)">我来人工复现</span></div>
      </div>
    </div>
  </div>
</div>
<div class="cmpwrap" style="padding-top:8px">
  <div class="row g8" style="padding:0 6px 8px"><span class="cbx"></span><span class="f12 t2">同时保存为「考勤」项目规则：复现筛选类问题时先用普通员工</span><span class="grow"></span><span class="f12 t3">不勾选只对本单生效</span></div>
  <div class="cmp" style="box-shadow:0 0 0 2px var(--blue),0 0 0 5px color-mix(in srgb,var(--blue) 16%,transparent)">
  <span class="aitag"><span class="aid">{I("spark",13)}</span><span class="f13 w7">本单 AI</span><span class="f12 t3 mono">TK-20862</span></span>
  <span class="f14 grow ell">用普通员工，账号 kq-staff-03，密码见原单附件<span style="display:inline-block;width:1.5px;height:17px;background:var(--blue);vertical-align:-3px;margin-left:1px"></span></span>{I("paperclip",17,style="color:var(--text-3)")}<span class="snd">{I("arrowup",17,2.4)}</span></div></div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">经过</div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--green)"></span><i></i></div><div style="padding-bottom:8px"><div class="f13 w6">接单 · 已通知你</div><div class="f12 t3">今天 13:18 · 节点「AI干活」</div></div></div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--orange);box-shadow:0 0 0 4px color-mix(in srgb,var(--orange) 20%,transparent)"></span></div><div><div class="f13 w6" style="color:var(--ink-orange)">需要协助 · 等你回复</div><div class="f12 t3">缺复现角色 · 34 分钟前</div></div></div></div>''',
        f'''<div class="card" style="padding:8px 14px"><div class="mini" style="margin:4px 0 2px">本轮采用</div>
  <div class="kv2"><span class="t2">工单材料</span><span class="f12 t3">原单 + 附件 2</span></div>
  <div class="kv2"><span class="t2">你的补充</span><span class="f12 t3">暂无</span></div>
  <div class="kv2"><span class="t2">编码 Skill</span><span class="f12">复用表单组件 v3</span></div>
  <div class="kv2"><span class="t2">验证 Skill</span><span class="f12">页面交互回归 v1</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">回复之后</div>
  <div class="f12 t2" style="line-height:1.7">Bot-03 从「复现」继续，不重新开单。<br>回复会标记为「已采纳 / 未采纳」，你能看到本轮是否用上。</div></div>''')
    return ticket_list("20862") + main + right


# =====================================================================
# 6. 打回原因（弹层）
# =====================================================================
def chat_main_dim():
    return f'''<main class="glass pn grow" style="min-width:0">
{ticket_head("对话")}
<div class="col g10 grow" style="padding:12px 26px;justify-content:flex-end;overflow:hidden">
  <div class="divd">第 2 轮 · 今天 14:10 开始</div>
  <div class="card" style="padding:14px 18px;margin-left:40px"><div class="f15 w7">第 2 轮交付：已修复，等你确认</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.7"><b style="color:var(--text)">根因</b>　切换分组时旧请求晚返回，覆盖新数据导致卡死。</div>
  <div class="row g14" style="margin-top:12px"><div class="shot" data-s="before" style="width:200px;height:124px"></div><div class="shot" data-s="after" style="width:200px;height:124px"></div></div></div>
</div>
{composer()}
</main>'''


def p_reject():
    dlg = f'''<div class="scrim"></div>
<div class="dlg" style="left:50%;top:50%;width:640px;transform:translate(-50%,-50%);padding:22px 24px">
  <div class="row g10"><span class="ic-box" style="background:linear-gradient(160deg,#FF8A7A,#E0281E)">{I("undo",16,2.2)}</span><div class="col grow"><span class="f18 w7">打回第 2 轮</span><span class="f12 t3">TK-20871 · 审核对象 <span class="mono">a3f9c21</span> · 意见会原样交给 Bot-01</span></div><span class="t3">{I("x",18)}</span></div>
  <div class="flabel" style="margin-top:18px">打回原因</div>
  <div class="field focus" style="min-height:92px">分组 2、3 好了，但<b>管理员</b>账号切到「销售部」还是会卡一下，大概 2 秒。另外第 49 行直接 return，加载态没有收起来，界面会一直转圈。<span style="display:inline-block;width:1.5px;height:16px;background:var(--blue);vertical-align:-3px"></span></div>
  <div class="row g6 wrap" style="margin-top:8px"><span class="f12 t3">常用：</span><span class="chip2" style="height:24px;font-size:12px">问题仍存在</span><span class="chip2" style="height:24px;font-size:12px">改出了新问题</span><span class="chip2" style="height:24px;font-size:12px">验证不充分</span><span class="chip2" style="height:24px;font-size:12px">改法不认可</span></div>
  <div class="flabel" style="margin-top:16px">附上的代码位置</div>
  <div class="row g10" style="padding:10px 12px;border-radius:12px;background:var(--fill)"><span class="st st-m" style="width:16px;height:16px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center">M</span><span class="mono f12 w6">GroupPicker.tsx:49</span><span class="mono f12 t2 grow ell">if (req.aborted) return;</span><span class="f12 lnk">换一行</span><span class="t3">{I("x",14)}</span></div>
  <div class="flabel" style="margin-top:16px">截图 / 录屏</div>
  <div class="row g10"><div class="shw" style="width:120px;height:78px"><div class="shot" data-s="before" data-cap="none" style="transform:scale(.522)"></div></div><div class="col" style="width:120px;height:74px;border-radius:12px;border:1.5px dashed var(--hair);align-items:center;justify-content:center;gap:4px;color:var(--text-3)">{I("plus",18)}<span class="f11">截图或录屏</span></div>
    <div class="col g6 grow" style="padding-left:6px"><div class="row g8"><span class="cbx on">{I("check",12,3)}</span><span class="f13">要求下一轮用「管理员」复测</span></div><div class="row g8"><span class="cbx on">{I("check",12,3)}</span><span class="f13">重新提交时展示相对本轮的改动</span></div></div></div>
  <div class="row g10" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--hair)"><span class="f12 t3 grow">打回后 Bot-01 会读取：本条意见 · 代码位置 1 · 截图 1</span><span class="btn2 a-sec" style="background:var(--fill);height:36px">取消</span><span class="btn2" style="height:36px;padding:0 18px;background:var(--btn-danger-bg);color:#fff;box-shadow:0 8px 20px -8px color-mix(in srgb,var(--red) 80%,transparent)">{I("undo",14)}打回并通知 Bot</span></div>
</div>'''
    right = aside(f'''<div class="card" style="padding:12px 14px"><div class="mini">经过</div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--green)"></span><i></i></div><div style="padding-bottom:8px"><div class="f13 w6">接单 · 已通知你</div><div class="f12 t3">昨天 21:52</div></div></div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--red)"></span><i></i></div><div style="padding-bottom:8px"><div class="f13 w6">第 1 轮 · 你打回了</div><div class="f12 t3">“第二个分组还是会卡”</div></div></div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--blue)"></span></div><div><div class="f13 w6" style="color:var(--ink-blue)">第 2 轮 · 等你审核</div><div class="f12 t3">8 分钟前</div></div></div></div>''',
        '''<div class="card" style="padding:8px 14px"><div class="mini" style="margin:4px 0 2px">各项进度</div><div class="kv2"><span class="t2">代码审核</span><span class="pill p-blue" style="height:22px">等你</span></div><div class="kv2"><span class="t2">原平台确认</span><span class="f12 t3">未确认</span></div></div>''')
    return ticket_list() + chat_main_dim() + right + '<!--OVERLAY-->' + dlg


# =====================================================================
# 7. 发布（单张工单）
# =====================================================================
PUBS = [("进行中", None, [("pub1", "林", "#FFC9A8,#F08F7A", "teal", "TK-20871 → 测试环境", "t", "核对生效中 · 审批 2.18.0-fix.2", "2 分钟", "", 72),
                          ("pub2", "林", "#FFC9A8,#F08F7A", "red", "大包 · 审批分组修复", "t", "部分完成 · B 构建失败", "dot-r", "red", None)]),
        ("等你确认", None, [("pub3", "王某", "#7FB2FF,#4C7DF0", "orange", "TK-20790 → 正式环境", "t", "测试已通过 · 待合回主分支", "", "orange", None)]),
        ("已完成", None, [("pub4", "张某", "#8FD8C9,#3FAE9A", "green", "TK-20811 → 正式环境", "j", "已生效 3.8.1 · 昨天", "", "", None),
                        ("pub5", "林", "#FFC9A8,#F08F7A", "green", "TK-20790 → 测试环境", "t", "已生效 · 王某复测通过", "", "", None)])]


def pub_list(sel):
    h = ['<section class="glass pn" style="width:300px;flex:none;padding:16px 10px 10px">',
         '<div class="row" style="padding:0 8px 2px"><span class="f18 w7">发布</span><span class="f13 t3" style="margin-left:8px;flex:1">5</span><div class="seg" style="padding:2px"><span class="on" style="height:24px;padding:0 10px;font-size:12px">我的</span><span style="height:24px;padding:0 10px;font-size:12px">全部</span></div></div>']
    for g, cls, rows in PUBS:
        h.append(f'<div class="g10h">{g}<span>{len(rows)}</span></div>')
        for t in rows:
            r = trow(t, t[0] == sel)
            if t[7] == "dot-r":
                r = r.replace('<span class="tm10">dot-r</span>', '' if t[0] == sel else '<span class="ud10" style="background:var(--red)"></span>')
            h.append(r)
    h.append('<span class="grow"></span>')
    h.append(f'<div class="row g8" style="margin:8px 6px 2px;padding:10px 12px;border-radius:12px;background:var(--fill)">{I("spark",14,style="color:var(--ink-purple)")}<span class="f12 t2">也可以对 AI 说「把这轮发到测试」</span></div>')
    h.append("</section>")
    return "".join(h)


def p_release(in_ticket=True):
    pipe = [("合入测试分支", "ok", "陈某审核通过"), ("打包上传", "ok", "tita build · 1 分 12 秒"), ("发布到测试", "ok", "tita release · 6 秒"), ("核对生效", "run", "读 Apollo 提交号…"), ("通知测试人", "wait", "对上后发送")]
    ps = "".join(f'<div class="pst{" done" if s=="ok" else ""}"><span class="pdot pd-{s}">{"✓" if s=="ok" else (I("loader",14,2.6) if s=="run" else str(i+1))}</span><span class="f13 w6">{n}</span><span class="f11 t3">{t}</span></div>' for i, (n, s, t) in enumerate(pipe))

    ch = f'''<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)">{CK()}<div class="col grow" style="min-width:0"><span class="f13 w6">本单改动已在包里</span><span class="f12 t3">MR <span class="mono">!318</span> · 3 个文件 · <span class="mono">a3f9c21</span></span></div></div>
<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)">{CK("orange","!")}<div class="col grow" style="min-width:0"><span class="f13 w6">还会带上别人的 4 个提交</span><span class="f12 t3 ell">来自 TK-20802 等 2 单 · 通知里一并列出</span></div><span class="f12 lnk">查看 ›</span></div>'''
    def env(name, cur, nxt, state, stc, note, on=True):
        grad = "linear-gradient(160deg,#4FD6E6,#16A3C0)" if on else "linear-gradient(160deg,#A9AEB8,#6E737D)"
        ver = f'<span class="mono f15 w6">{cur}</span><span class="t3">{I("arrowr",14)}</span><span class="mono f15 w7" style="color:var(--ink-blue)">{nxt}</span>' if nxt else f'<span class="mono f15 w6">{cur}</span>'
        return f'''<div class="col g6" style="flex:1;min-width:0{"" if on else ";opacity:.8"}">
  <div class="row g8"><span class="ic-box" style="width:22px;height:22px;border-radius:7px;background:{grad}">{I("server",12)}</span><span class="f13 w7">{name}</span><span class="tag tg-{stc}">{state}</span></div>
  <div class="row g8">{ver}<span class="f12 t3 grow ell" style="text-align:right">{note}</span></div></div>'''
    PILL = '<span class="pill" style="color:var(--ink-teal);background:color-mix(in srgb,var(--teal) 15%,transparent)">发布中 · 4/5</span>'
    if in_ticket:
        head = ticket_head("发布", pill=("p-green", "审核通过 · 第 2 轮"))
        subrow = f'''  <div class="row g10"><span class="f16 w7">第 2 轮 → 测试环境</span><span class="f12 t3 grow">发布任务 R-0412 · 发起人 林某 · 15:00 · 关掉客户端不影响</span><span class="f12 lnk">历次发布 2 ›</span>
    {PILL}</div>
'''
    else:
        head = f'''<header class="thead"><div class="row g12"><span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(160deg,#FFC54D,#FF7A00)">{I("pkg",20,2)}</span>
  <div class="col grow" style="min-width:0"><h1 class="ell">TK-20871 第 2 轮 → 测试环境</h1><div class="f12 t3" style="margin-top:2px">发布任务 R-0412 · 发起人 林某 · 15:00 · 关掉客户端不影响</div></div>{PILL}</div>
  <div class="row g10" style="margin-top:12px;padding:8px 10px 8px 8px;border-radius:12px;background:var(--fill)"><span class="appic ic-tita" style="width:28px;height:28px;border-radius:8px;font-size:8px">TITA</span>
    <span class="f13 w6 ell">审批中心：发起审批时点击分组，界面卡住</span><span class="f12 t3" style="flex:none">TK-20871 · 审核通过 · 修复人 林某</span><span class="grow"></span><span class="f13 lnk w6" style="flex:none">进入工单 ›</span></div>
</header>'''
        subrow = ""
    main = f'''<main class="glass pn grow" style="min-width:0">
{head}
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
{subrow}  <div class="card row g16" style="padding:12px 16px;align-items:stretch">{env("测试环境","2.17.4","2.18.0-fix.2","核对中","t","正在核对提交号")}<span style="width:1px;background:var(--hair)"></span>{env("正式环境","2.17.4","","未发布","n","测试通过 → 合回主分支 → 重新打包",False)}</div>
  <div class="card" style="padding:16px 10px 12px"><div class="pipe">{ps}</div></div>
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:14px 16px 6px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">这次发出去的包</span><span class="f12 t3 mono">dev-approval@e52c7a0</span></div>{ch}</div>
    <div class="card" style="width:300px;flex:none;padding:14px 16px">
      <div class="sec">测试人</div>
      <div class="row g10" style="margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--fill)"><span class="av" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">王某</span><span class="f11 t3">沿用工单测试人</span></div>{I("chevd",14,style="color:var(--text-3)")}</div>
      <div class="f12 t2" style="margin-top:10px;line-height:1.6">提交号对上后通知王某，带上版本、改动和复测步骤；被新发布覆盖时旧通知会提示。</div>
    </div>
  </div>
  <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">阶段明细</span><span class="f12 t3">每步单独记录 · 失败从失败处重试</span></div>
    <style>.tbl.tc td{{padding:7px 10px;white-space:nowrap}}</style><table class="tbl tc"><thead><tr><th style="width:15%">阶段</th><th>做了什么</th><th style="width:16%">时间</th><th style="width:11%">结果</th></tr></thead><tbody>
    <tr><td class="w6">合入测试分支</td><td class="t2">MR <span class="mono">!318</span> · 陈某审核 · 合入后 <span class="mono">e52c7a0</span></td><td class="mono f12 t3">14:52</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6">打包上传</td><td class="t2"><span class="mono">tita build</span> · 产物 <span class="mono">2.18.0-fix.2</span> 已传 OSS</td><td class="mono f12 t3">14:58 – 14:59</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6">发布到测试</td><td class="t2"><span class="mono">tita release --app www --env TEST</span></td><td class="mono f12 t3">15:00</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6">核对生效</td><td class="t2">Apollo TEST 的提交号应为 <span class="mono">e52c7a0</span></td><td class="mono f12 t3">15:00 起</td><td><span class="tag tg-t">核对中</span></td></tr>
    </tbody></table></div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">测试记录</div>
  <div class="row g8" style="padding:6px 0"><span class="tag tg-n">待测</span><span class="mono f12">2.18.0-fix.2</span><span class="f12 t3 grow" style="text-align:right">等生效</span></div>
  <div class="row g8" style="padding:6px 0;border-top:1px solid var(--hair)"><span class="tag tg-r">打回</span><span class="mono f12">2.18.0-fix.1</span><span class="f12 t3 grow" style="text-align:right">王某 · 昨天</span></div>
  <div class="f12 t3" style="margin-top:2px">“第二个分组还是卡” · 已归入第 1 轮</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">发布到正式环境</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}代码审核已通过</div>
  <div class="row g8 f13" style="padding:5px 0"><span class="ck" style="background:var(--fill)"></span><span class="t2">测试环境复测通过</span></div>
  <div class="row g8 f13" style="padding:5px 0"><span class="ck" style="background:var(--fill)"></span><span class="t2">合回主分支 · MR 审核通过</span></div>
  <button class="abtn a-sec" style="width:100%;justify-content:center;height:36px;margin-top:8px;opacity:.55">{I("rocket",14)}发布到正式环境</button>
  <div class="f12 t3" style="margin-top:8px">正式发布人：任何人 · 主分支重新打包</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行日志 · 最后 3 行</div>
  <div class="log t2"><div class="ln"><span class="ts">15:00:41</span>tita release --env TEST</div><div class="ln"><span class="ts">15:00:47</span>Tita_Static TEST 已发布 ✓</div><div class="ln"><span class="ts">15:00:48</span>读 CommitId …</div></div>
  <div class="f12 lnk" style="margin-top:6px">查看完整日志 ›</div></div>''')
    if not in_ticket:
        return pub_list("pub1") + main + right
    tl = ticket_list().replace("第 2 轮交付 · 验证 3/4", "审核通过 · 发测试中")
    return tl + main + right


# =====================================================================
# 7b. 发正式 · 7c. 等复测（同一套发布详情，不同状态）
# =====================================================================
def tk_bar(title, meta, src="TITA"):
    return f'''<div class="row g10" style="margin-top:12px;padding:8px 10px 8px 8px;border-radius:12px;background:var(--fill)"><span class="appic ic-{src.lower()}" style="width:28px;height:28px;border-radius:8px;font-size:8px">{src}</span>
    <span class="f13 w6 ell">{title}</span><span class="f12 t3" style="flex:none">{meta}</span><span class="grow"></span><span class="f13 lnk w6" style="flex:none">进入工单 ›</span></div>'''


def pub_head(icon_bg, icon, title, sub, pill, bar):
    return f'''<header class="thead"><div class="row g12"><span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:{icon_bg}">{I(icon,20,2)}</span>
  <div class="col grow" style="min-width:0"><h1 class="ell">{title}</h1><div class="f12 t3" style="margin-top:2px">{sub}</div></div>{pill}</div>
  {bar}
</header>'''


def pill_c(c, t):
    return f'<span class="pill" style="color:var(--ink-{c});background:color-mix(in srgb,var(--{c}) 15%,transparent)">{t}</span>'


def p_prod():
    """和「发布到测试」同一套骨架，只是状态不同：还没点发布，第 1 步完成，其余等待。"""
    lst = pub_list("pub3").replace("测试已通过 · 待合回主分支", "主分支已合入 · 可以发正式")
    pipe = [("合回主分支", "ok", "林某审核通过"), ("打包上传", "wait", "tita build"), ("发布到正式", "wait", "tita release"), ("核对生效", "wait", "读 Apollo 提交号"), ("通知", "wait", "对上后发送")]
    ps = "".join(f'<div class="pst{" done" if s=="ok" else ""}"><span class="pdot pd-{s}">{"✓" if s=="ok" else str(i+1)}</span><span class="f13 w6">{n}</span><span class="f11 t3">{t}</span></div>' for i, (n, s, t) in enumerate(pipe))

    def env(name, cur, nxt, state, stc, note, grad, dim=False):
        ver = f'<span class="mono f15 w6">{cur}</span><span class="t3">{I("arrowr",14)}</span><span class="f13 w6" style="color:var(--ink-blue)">{nxt}</span>' if nxt else f'<span class="mono f15 w6">{cur}</span>'
        return f'''<div class="col g6" style="flex:1;min-width:0{";opacity:.8" if dim else ""}">
  <div class="row g8"><span class="ic-box" style="width:22px;height:22px;border-radius:7px;background:{grad}">{I("server",12)}</span><span class="f13 w7">{name}</span><span class="tag tg-{stc}">{state}</span></div>
  <div class="row g8">{ver}<span class="f12 t3 grow ell" style="text-align:right">{note}</span></div></div>'''
    ch = f'''<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)">{CK()}<div class="col grow" style="min-width:0"><span class="f13 w6">本单改动和测试时一样</span><span class="f12 t3">MR <span class="mono">!322</span> · 同样 2 个文件 · <span class="mono">c71a5e0</span></span></div></div>
<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)">{CK("orange","!")}<div class="col grow" style="min-width:0"><span class="f13 w6">还会带上别人的 1 个提交</span><span class="f12 t3 ell">TK-20802 列表排序 · 已在测试环境测过</span></div><span class="f12 lnk">查看 ›</span></div>'''
    main = f'''<main class="glass pn grow" style="min-width:0">
{pub_head("linear-gradient(160deg,#5AC8FA,#007AFF)", "rocket", "TK-20790 第 1 轮 → 正式环境", "发布任务 R-0415 · 王某 11:20 复测通过 · 关掉客户端不影响", pill_c("orange", "等你发布"), tk_bar("审批单撤回后状态错乱", "TK-20790 · 测试通过 · 修复人 林某"))}
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="card row g16" style="padding:12px 16px;align-items:stretch">{env("正式环境","2.17.4","打包后读出","等你发布","o","在 master 上重新打包","linear-gradient(160deg,#5AC8FA,#007AFF)")}<span style="width:1px;background:var(--hair)"></span>{env("测试环境","2.18.0-fix.1","","复测通过","g","王某 · 今天 11:20","linear-gradient(160deg,#4FD6E6,#16A3C0)",True)}</div>
  <div class="card" style="padding:16px 10px 12px"><div class="pipe">{ps}</div></div>
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:14px 16px 6px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">和测试时比</span><span class="f12 t3 mono">master@9b1d3f2</span></div>{ch}</div>
    <div class="card" style="width:300px;flex:none;padding:14px 16px">
      <div class="sec">生效后通知</div>
      <div class="row g10" style="margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--fill)"><span class="av" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#FFC9A8,#F08F7A)">林某</span><span class="av" style="width:30px;height:30px;font-size:11px;margin-left:-14px;box-shadow:0 0 0 2px var(--glass-2);background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">林某、王某</span><span class="f11 t3">修复人和测试人</span></div></div>
      <div class="f12 t2" style="margin-top:10px;line-height:1.6">提交号对上后通知；发到 Apollo <span class="mono">Tita_Static</span> 的正式环境。</div>
    </div>
  </div>
  <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">阶段明细</span><span class="f12 t3">每步单独记录 · 失败从失败处重试</span></div>
    <style>.tbl.tc td{{padding:7px 10px;white-space:nowrap}}</style><table class="tbl tc"><thead><tr><th style="width:15%">阶段</th><th>做了什么</th><th style="width:16%">时间</th><th style="width:11%">结果</th></tr></thead><tbody>
    <tr><td class="w6">合回主分支</td><td class="t2">MR <span class="mono">!322</span> · 林某审核 · 合入后 <span class="mono">9b1d3f2</span></td><td class="mono f12 t3">11:40</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6">打包上传</td><td class="t2"><span class="mono">tita build</span> · 在 master 上重新打包</td><td class="mono f12 t3">—</td><td><span class="tag tg-n">等待</span></td></tr>
    <tr><td class="w6">发布到正式</td><td class="t2"><span class="mono">tita release --app www --env PROD</span></td><td class="mono f12 t3">—</td><td><span class="tag tg-n">等待</span></td></tr>
    <tr><td class="w6">核对生效</td><td class="t2">Apollo PROD 的提交号应为 <span class="mono">9b1d3f2</span></td><td class="mono f12 t3">—</td><td><span class="tag tg-n">等待</span></td></tr>
    </tbody></table></div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">测试记录</div>
  <div class="row g8" style="padding:6px 0"><span class="tag tg-g">通过</span><span class="mono f12">2.18.0-fix.1</span><span class="f12 t3 grow" style="text-align:right">王某 · 11:20</span></div>
  <div class="f12 t3" style="margin-top:2px">“撤回后状态正常，列表也刷新了”</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">发布到正式环境</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}代码审核已通过</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}测试环境复测通过</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}合回主分支 · MR 审核通过</div>
  <button class="abtn a-pri" style="width:100%;justify-content:center;height:36px;margin-top:8px">{I("rocket",14)}发布到正式环境</button>
  <div class="row g6 f12 t3" style="margin-top:8px">{I("key",12)}<span class="grow">用你的 Apollo 账号 <span class="mono t2">lin.x</span></span><span class="lnk">改 ›</span></div>
  <div class="f12 t3" style="margin-top:6px">正式发布人：任何人 · 主分支重新打包</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行日志 · 最后 3 行</div>
  <div class="log t2"><div class="ln"><span class="ts">11:40:12</span>MR !322 合入 master ✓</div><div class="ln"><span class="ts">11:40:13</span>master@9b1d3f2</div><div class="ln"><span class="ts">11:40:13</span>等发布人确认 …</div></div>
  <div class="f12 lnk" style="margin-top:6px">查看完整日志 ›</div></div>''')
    return lst + main + right

def p_waittest():
    """同一套发布详情，状态：已生效 · 等复测（测试人王某登录时看到的）。"""
    lst = pub_list("pub1").replace("核对生效中 · 审批 2.18.0-fix.2", "已生效 · 等你复测")
    pipe = [("合入测试分支", "ok", "陈某审核通过"), ("打包上传", "ok", "tita build · 1 分 12 秒"), ("发布到测试", "ok", "tita release · 6 秒"), ("核对生效", "ok", "提交号一致"), ("通知测试人", "ok", "已通知王某 · 15:01")]
    ps = "".join(f'<div class="pst done"><span class="pdot pd-ok">✓</span><span class="f13 w6">{n}</span><span class="f11 t3">{t}</span></div>' for n, s, t in pipe)

    def env(name, cur, nxt, state, stc, note, grad, dim=False):
        ver = f'<span class="mono f15 w6">{cur}</span><span class="t3">{I("arrowr",14)}</span><span class="mono f15 w7" style="color:var(--ink-blue)">{nxt}</span>' if nxt else f'<span class="mono f15 w6">{cur}</span>'
        return f'''<div class="col g6" style="flex:1;min-width:0{";opacity:.8" if dim else ""}">
  <div class="row g8"><span class="ic-box" style="width:22px;height:22px;border-radius:7px;background:{grad}">{I("server",12)}</span><span class="f13 w7">{name}</span><span class="tag tg-{stc}">{state}</span></div>
  <div class="row g8">{ver}<span class="f12 t3 grow ell" style="text-align:right">{note}</span></div></div>'''
    ch = f'''<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)">{CK()}<div class="col grow" style="min-width:0"><span class="f13 w6">本单改动已在包里</span><span class="f12 t3">MR <span class="mono">!318</span> · 3 个文件 · <span class="mono">a3f9c21</span></span></div></div>
<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)">{CK("orange","!")}<div class="col grow" style="min-width:0"><span class="f13 w6">还会带上别人的 4 个提交</span><span class="f12 t3 ell">来自 TK-20802 等 2 单 · 通知里一并列出</span></div><span class="f12 lnk">查看 ›</span></div>'''
    main = f'''<main class="glass pn grow" style="min-width:0">
{pub_head("linear-gradient(160deg,#FFC54D,#FF7A00)", "pkg", "TK-20871 第 2 轮 → 测试环境", "发布任务 R-0412 · 发起人 林某 · 15:00 · 关掉客户端不影响", pill_c("green", "已生效 · 等复测"), tk_bar("审批中心：发起审批时点击分组，界面卡住", "TK-20871 · 审核通过 · 修复人 林某"))}
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="card row g16" style="padding:12px 16px;align-items:stretch">{env("测试环境","2.17.4","2.18.0-fix.2","已生效","g","提交号已核对","linear-gradient(160deg,#4FD6E6,#16A3C0)")}<span style="width:1px;background:var(--hair)"></span>{env("正式环境","2.17.4","","未发布","n","测试通过 → 合回主分支 → 重新打包","linear-gradient(160deg,#A9AEB8,#6E737D)",True)}</div>
  <div class="card" style="padding:16px 10px 12px"><div class="pipe">{ps}</div></div>
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:14px 16px 6px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">这次发出去的包</span><span class="f12 t3 mono">dev-approval@e52c7a0</span></div>{ch}</div>
    <div class="card" style="width:300px;flex:none;padding:14px 16px">
      <div class="sec">测试人</div>
      <div class="row g10" style="margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--fill)"><span class="av" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">王某</span><span class="f11 t3">已通知 · 15:01</span></div></div>
      <div class="row g8 f12" style="margin-top:10px"><span class="t3" style="width:30px">入口</span><span class="mono lnk grow">test.tita.work/approval ↗</span></div>
      <div class="row g8 f12" style="margin-top:6px"><span class="t3" style="width:30px">账号</span><span class="grow">普通员工 <span class="mono">kq-staff-03</span></span></div>
    </div>
  </div>
  <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">阶段明细</span><span class="f12 t3">每步单独记录 · 失败从失败处重试</span></div>
    <style>.tbl.tc td{{padding:7px 10px;white-space:nowrap}}</style><table class="tbl tc"><thead><tr><th style="width:15%">阶段</th><th>做了什么</th><th style="width:16%">时间</th><th style="width:11%">结果</th></tr></thead><tbody>
    <tr><td class="w6">合入测试分支</td><td class="t2">MR <span class="mono">!318</span> · 陈某审核 · 合入后 <span class="mono">e52c7a0</span></td><td class="mono f12 t3">14:52</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6">打包上传</td><td class="t2"><span class="mono">tita build</span> · 产物 <span class="mono">2.18.0-fix.2</span> 已传 OSS</td><td class="mono f12 t3">14:58 – 14:59</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6">发布到测试</td><td class="t2"><span class="mono">tita release --app www --env TEST</span></td><td class="mono f12 t3">15:00</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6">核对生效</td><td class="t2">Apollo TEST 的提交号是 <span class="mono">e52c7a0</span> · 一致</td><td class="mono f12 t3">15:01</td><td><span class="tag tg-g">成功</span></td></tr>
    </tbody></table></div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px;box-shadow:0 0 0 2px color-mix(in srgb,var(--blue) 55%,transparent)"><div class="mini">测试记录</div>
  <div class="row g8" style="padding:6px 0"><span class="tag tg-b">等复测</span><span class="mono f12">2.18.0-fix.2</span><span class="f12 t3 grow" style="text-align:right">你 · 现在</span></div>
  <div class="row g8" style="margin:4px 0 8px"><button class="abtn" style="flex:1;justify-content:center;height:36px;background:var(--btn-ok-bg);color:#fff">{I("check",14,2.6)}通过</button><button class="abtn a-red" style="flex:1;justify-content:center;height:36px">{I("undo",14)}打回</button></div>
  <div class="row g8" style="padding:6px 0;border-top:1px solid var(--hair)"><span class="tag tg-r">打回</span><span class="mono f12">2.18.0-fix.1</span><span class="f12 t3 grow" style="text-align:right">你 · 昨天</span></div>
  <div class="f12 t3" style="margin-top:2px">“第二个分组还是卡” · 已归入第 1 轮</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">发布到正式环境</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}代码审核已通过</div>
  <div class="row g8 f13" style="padding:5px 0"><span class="ck" style="background:var(--fill)"></span><span class="t2">测试环境复测通过</span></div>
  <div class="row g8 f13" style="padding:5px 0"><span class="ck" style="background:var(--fill)"></span><span class="t2">合回主分支 · MR 审核通过</span></div>
  <button class="abtn a-sec" style="width:100%;justify-content:center;height:36px;margin-top:8px;opacity:.55">{I("rocket",14)}发布到正式环境</button>
  <div class="f12 t3" style="margin-top:8px">正式发布人：任何人 · 主分支重新打包</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行日志 · 最后 3 行</div>
  <div class="log t2"><div class="ln"><span class="ts">15:00:47</span>Tita_Static TEST 已发布 ✓</div><div class="ln"><span class="ts">15:01:02</span>CommitId e52c7a0 一致 ✓</div><div class="ln"><span class="ts">15:01:03</span>已通知 王某 ✓</div></div>
  <div class="f12 lnk" style="margin-top:6px">查看完整日志 ›</div></div>''')
    return lst + main + right


def p_pubfail():
    """同一套发布详情，状态：打包上传失败。"""
    global PUBS
    keep = PUBS
    PUBS = [("进行中", None, [("pubf", "林", "#FFC9A8,#F08F7A", "red", "OKR-412 → 测试环境", "j", "失败 · 打包上传", "", "red", None)] + keep[0][2])] + keep[1:]
    lst = pub_list("pubf").replace('<span class="f13 t3" style="margin-left:8px;flex:1">5</span>', '<span class="f13 t3" style="margin-left:8px;flex:1">6</span>')
    PUBS = keep
    pipe = [("合入测试分支", "ok", "林某审核通过"), ("打包上传", "err", "tita build · 退出码 1"), ("发布到测试", "wait", "没执行"), ("核对生效", "wait", "没执行"), ("通知测试人", "wait", "不会发")]
    ps = "".join(f'<div class="pst{" done" if s=="ok" else ""}"><span class="pdot pd-{s}">{"✓" if s=="ok" else ("!" if s=="err" else str(i+1))}</span><span class="f13 w6"{" style=\"color:var(--ink-red)\"" if s=="err" else ""}>{n}</span><span class="f11 t3">{t}</span></div>' for i, (n, s, t) in enumerate(pipe))

    def env(name, cur, nxt, state, stc, note, grad, dim=False):
        ver = f'<span class="mono f15 w6">{cur}</span><span class="t3">{I("arrowr",14)}</span><span class="mono f15 w6 t3" style="text-decoration:line-through">{nxt}</span>' if nxt else f'<span class="mono f15 w6">{cur}</span>'
        return f'''<div class="col g6" style="flex:1;min-width:0{";opacity:.8" if dim else ""}">
  <div class="row g8"><span class="ic-box" style="width:22px;height:22px;border-radius:7px;background:{grad}">{I("server",12)}</span><span class="f13 w7">{name}</span><span class="tag tg-{stc}">{state}</span></div>
  <div class="row g8">{ver}<span class="f12 t3 grow ell" style="text-align:right">{note}</span></div></div>'''
    err = f'''<div class="log" style="margin-top:8px;padding:10px 12px;border-radius:12px;background:#1E1F24;color:#C9CDD6;font-size:12px;line-height:1.7;white-space:nowrap;overflow:hidden">
<div style="color:#8A8F98">$ pnpm build-prod  · 4c1e9a2</div>
<div style="color:#FF8A80;background:rgba(255,80,80,.12);margin:0 -12px;padding:0 12px">calc.ts(88,14): error TS2322</div>
<div style="color:#FF8A80">Type 'string' → 'number'</div>
<div style="color:#FF8A80">Command failed with exit code 1.</div></div>'''
    main = f'''<main class="glass pn grow" style="min-width:0">
{pub_head("linear-gradient(160deg,#FFC54D,#FF7A00)", "pkg", "OKR-412 第 1 轮 → 测试环境", "发布任务 R-0420 · 发起人 林某 · 15:10 · 关掉客户端不影响", pill_c("red", "失败 · 打包上传"), tk_bar("对齐视图里子目标重复显示", "OKR-412 · 审核通过 · 修复人 林某", "JIRA"))}
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="card row g16" style="padding:12px 16px;align-items:stretch">{env("测试环境","1.6.0-fix.3","1.6.0-fix.4","没变","n","没受影响","linear-gradient(160deg,#4FD6E6,#16A3C0)")}<span style="width:1px;background:var(--hair)"></span>{env("正式环境","1.5.8","","未发布","n","测试通过 → 合回主分支 → 重新打包","linear-gradient(160deg,#A9AEB8,#6E737D)",True)}</div>
  <div class="card" style="padding:16px 10px 12px"><div class="pipe">{ps}</div></div>
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:14px 16px 12px;min-width:0"><div class="row g8"><span class="sec grow" style="color:var(--ink-red);white-space:nowrap">打包上传失败</span><span class="btn2 sm a-sec" style="background:var(--fill)">{I("copy",13)}复制</span><span class="btn2 sm a-sec" style="background:var(--fill)">完整日志</span></div>{err}
      <div class="f12 ell" style="margin-top:8px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--purple) 8%,transparent)"><b style="color:var(--ink-purple)">AI 解读 · 待核实</b>　别人改了 <span class="mono">TaxResult</span> 类型</div></div>
    <div class="card" style="width:300px;flex:none;padding:14px 16px;display:flex;flex-direction:column">
      <div class="sec">测试人</div>
      <div class="row g10" style="margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--fill)"><span class="av" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">王某</span><span class="f11 t3">没通知 · 版本没变</span></div></div>
      <span class="grow"></span>
      <button class="abtn a-pri" style="width:100%;justify-content:center;height:36px;margin-top:12px">{I("refresh",14)}从打包上传重试</button>
      <div class="f12 t3" style="margin-top:8px;line-height:1.5">用已合入的代码重打，不重新提 MR；重复点只会回到这个任务。</div>
    </div>
  </div>
  <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">阶段明细</span><span class="f12 t3">每步单独记录 · 失败从失败处重试</span></div>
    <style>.tbl.tc td{{padding:7px 10px;white-space:nowrap}}</style><table class="tbl tc"><thead><tr><th style="width:15%">阶段</th><th>做了什么</th><th style="width:16%">时间</th><th style="width:11%">结果</th></tr></thead><tbody>
    <tr><td class="w6">合入测试分支</td><td class="t2">MR <span class="mono">!77</span> · 林某审核 · 合入后 <span class="mono">4c1e9a2</span></td><td class="mono f12 t3">15:06</td><td><span class="tag tg-g">成功</span></td></tr>
    <tr><td class="w6" style="color:var(--ink-red)">打包上传</td><td class="t2"><span class="mono">tita build</span> · <span class="mono">pnpm build-prod</span> 退出码 1，没上传</td><td class="mono f12 t3">15:10 – 15:12</td><td><span class="tag tg-r">失败</span></td></tr>
    <tr><td class="w6 t3">发布到测试</td><td class="t3"><span class="mono">tita release --app www --env TEST</span></td><td class="mono f12 t3">—</td><td><span class="tag tg-n">没执行</span></td></tr>
    <tr><td class="w6 t3">核对生效</td><td class="t3">打包成功后再核对提交号</td><td class="mono f12 t3">—</td><td><span class="tag tg-n">没执行</span></td></tr>
    </tbody></table></div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">测试记录</div>
  <div class="f12 t3" style="padding:6px 0">这一轮还没测过</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">发布到正式环境</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}代码审核已通过</div>
  <div class="row g8 f13" style="padding:5px 0"><span class="ck" style="background:var(--fill)"></span><span class="t2">测试环境复测通过</span></div>
  <div class="row g8 f13" style="padding:5px 0"><span class="ck" style="background:var(--fill)"></span><span class="t2">合回主分支 · MR 审核通过</span></div>
  <button class="abtn a-sec" style="width:100%;justify-content:center;height:36px;margin-top:8px;opacity:.55">{I("rocket",14)}发布到正式环境</button>
  <div class="f12 t3" style="margin-top:8px">正式发布人：任何人 · 主分支重新打包</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行日志 · 最后 3 行</div>
  <div class="log t2"><div class="ln"><span class="ts">15:12:31</span>calc.ts(88,14) TS2322</div><div class="ln" style="color:var(--ink-red)"><span class="ts">15:12:31</span>exit code 1</div><div class="ln"><span class="ts">15:12:32</span>已通知林某：打包失败</div></div>
  <div class="f12 lnk" style="margin-top:6px">查看完整日志 ›</div></div>''')
    return lst + main + right


# =====================================================================
# 8. 大包明细
# =====================================================================
def p_bundle():
    def node(x, y, w, ico, bg, name, kind, ver, rows, cls="", st=("g", "已完成")):
        def rr(c, g, t):
            dot = f'<span class="ck" style="width:16px;height:16px;font-size:10px;background:var(--{c})">{g}</span>' if c else '<span class="ck" style="width:16px;height:16px;background:var(--fill)"></span>'
            return f'<div class="row g6 f12" style="margin-top:5px">{dot}<span class="{"t2" if c else "t3"}">{t}</span></div>'
        rs = "".join(rr(*r) for r in rows)
        return f'''<div class="gnode {cls}" style="left:{x}px;top:{y}px;width:{w}px">
  <div class="row g8"><span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:{bg}">{I(ico,15)}</span><div class="col grow" style="min-width:0;line-height:1.25"><span class="f13 w7 ell">{name}</span><span class="f11 t3">{kind}</span></div><span class="tag tg-{st[0]}">{st[1]}</span></div>
  <div class="mono f12" style="margin-top:8px">{ver}</div>{rs}</div>'''
    g = f'''<div class="graph" style="height:292px">
<svg class="gsvg" width="100%" height="292"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#34C759"/></marker><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#FF3B30"/></marker></defs>
  <path d="M250 146 C 295 146 290 68 334 68" fill="none" stroke-width="2" stroke="#34C759" marker-end="url(#ah)"/>
  <path d="M250 146 C 295 146 290 222 334 222" fill="none" stroke-width="2" stroke="#34C759" marker-end="url(#ah)"/>
  <path d="M626 68 C 668 68 668 146 710 146" fill="none" stroke-width="2" stroke="#34C759" marker-end="url(#ah)"/>
  <path d="M626 222 C 668 222 668 146 710 146" fill="none" stroke-width="2" stroke="#FF3B30" stroke-dasharray="5 5" marker-end="url(#ar)"/>
</svg>
{node(0,86,250,"pkg","linear-gradient(160deg,#C58BFF,#6A3DF0)","组件 C · tita-ui-kit","组件包 · 改了业务代码","1.4.2 → <b>1.4.3</b>",[("green","✓","打包并发布 1.4.3"),("green","✓","A、B 均可获取")])}
{node(336,0,290,"layers","linear-gradient(160deg,#5AA0FF,#1F6FFF)","子项目 A · approval-web","需要升级依赖并发布","C 1.4.3 · 3.8.1 → <b>3.8.2</b>",[("green","✓","升级依赖 · 锁文件已更新"),("green","✓","tita build / release · 提交号已核对")])}
{node(336,158,290,"layers","linear-gradient(160deg,#5AA0FF,#1F6FFF)","子项目 B · workflow-web","需要升级依赖并发布","C 1.4.3 · 2.4.0 → 2.4.1",[("green","✓","升级依赖"),("red","!","构建失败 · 退出码 2")],"gerr",("r","失败"))}
{node(712,82,242,"globe","linear-gradient(160deg,#A9AEB8,#6E737D)","主站 · tita-main","不需发布 · 从业务入口验证","入口加载 A 3.8.2 · B 2.4.0",[("","","等待 B 生效"),("","","业务入口浏览器验证")],"wait",("n","等待 B"))}
</div>'''
    err = '''<span class="d">$ pnpm build  (workflow-web @ 7d20e14, tita-ui-kit 1.4.3)</span>
<span class="h"><span class="e">src/flow/NodeEditor.tsx(126,18): error TS2339:</span></span><span class="e">  Property 'onGroupChange' does not exist on type 'GroupPickerProps'.</span>
<span class="e">ELIFECYCLE  Command failed with exit code 2.</span>'''
    vt = [("子项目 B", "workflow-web", "2.4.0", "2.4.1", "r", "构建失败"), ("主站", "tita-main", "—", "不需发布", "n", "等待 B")]
    rows = "".join(f'<tr><td class="w6">{a}</td><td class="mono f12 t2">{b}</td><td class="mono f12">{c}</td><td class="mono f12 w6">{d}</td><td><span class="tag tg-{e}">{f}</span></td></tr>' for a, b, c, d, e, f in vt)
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g12"><span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(160deg,#FFC54D,#FF7A00)">{I("layers",20,2)}</span>
  <div class="col grow" style="min-width:0"><h1 class="ell">大包 · 审批分组修复</h1><div class="f12 t3" style="margin-top:2px">B-0087 · 来自 TK-20871 第 2 轮 · <b style="color:var(--text-2)">测试环境</b> · 发起人 林某 · 15:20 · 清单按依赖关系建议，已人工核对</div></div>
  <span class="pill p-red">部分完成 · B 构建失败</span></div></header>
<div class="col g14 grow" style="padding:16px 22px;min-height:0;overflow:hidden">
  {g}
  <div class="row g14" style="align-items:stretch;min-height:0">
    <div class="col g8 grow" style="min-width:0">
      <div class="row g8"><span class="sec" style="color:var(--ink-red)">B 构建失败</span><span class="tag tg-n mono">NodeEditor.tsx:126</span><span class="grow"></span><span class="btn2 sm a-sec" style="background:var(--fill)">{I("copy",13)}复制</span><span class="btn2 sm a-sec" style="background:var(--fill)">{I("terminal",13)}完整日志</span></div>
      <div class="err" style="font-size:11.5px;line-height:19px">{err}</div>
      <div class="row g10"><div class="ains grow f12 t2" style="line-height:1.55"><b style="color:var(--ink-purple)">AI 建议 · 待核实</b>　C 1.4.3 把 <span class="mono">onGroupChange</span> 改名为 <span class="mono">onChange</span>，B 仍在用旧名。依据：C 的改动 GroupPicker.tsx:12、构建日志第 88 行。</div>
      <span class="btn2" style="height:36px;background:var(--btn-pri-bg);color:#fff">{I("refresh",14)}从 B 构建重试</span></div>
      <div class="card" style="padding:8px 14px 2px"><table class="tbl"><thead><tr><th>未完成</th><th>仓库</th><th>当前生效</th><th>目标</th><th>状态</th></tr></thead><tbody>{rows}</tbody></table></div>
    </div>
    <div class="col g10" style="width:330px;flex:none">
      <div class="card" style="padding:12px 14px"><div class="mini">整包提测通知</div>
        <div class="row g8"><span class="tag tg-n">未发送</span><span class="f12 t2">等 B 生效、主站入口核实后发送</span></div>
        <div class="f12 t3" style="margin-top:6px">将附版本清单：C 1.4.3 · A 3.8.2 · B 2.4.1</div></div>
      <div class="card" style="padding:12px 14px"><div class="mini">重试会怎么做</div>
        <div class="f12 t2" style="line-height:1.7">先核对 C、A 的产物仍可用，再从 B 构建继续，不重发 C。<br><span style="color:var(--ink-orange)">若要改 C 的源码，会发 1.4.4，并把 A、B 重新标为待更新。</span></div>
        <div class="row g8" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--hair)"><span class="f12 t3 grow">尝试 #2 15:20 B 构建失败 · #1 15:02 C 发布超时</span><span class="f12 lnk">对照</span></div></div>
    </div></div>
  </div>
</div>
</main>'''
    return pub_list("pub2") + main


# =====================================================================
# 9. 紧急回滚（Apollo）
# =====================================================================
def p_rollback():
    hist = [("11-20 14:05", "approval-web 3.8.2 上线", "当前生效", "r", False, False),
            ("11-18 21:40", "approval-web 3.8.1", "验证通过 · 7 天", "g", True, True),
            ("11-15 20:10", "approval-web 3.8.0", "验证通过", "g", False, True),
            ("11-12 19:30", "workflow 配置调整", "无验证记录", "n", False, False)]
    hs = ""
    for t, n, s, c, on, ok in hist:
        st = 'background:linear-gradient(180deg,#3B8BFF,#1F6FFF);color:#fff;box-shadow:0 8px 18px -10px rgba(31,111,255,.9)' if on else ''
        tg = f'<span class="tag" style="background:rgba(255,255,255,.22);color:#fff">{s}</span>' if on else f'<span class="tag tg-{c}">{s}</span>'
        hs += f'<div class="row g10" style="padding:10px;border-radius:12px;{st}"><span class="{"radio on" if on else "radio"}"{" style=\"box-shadow:inset 0 0 0 5px #fff,inset 0 0 0 9px #1F6FFF\"" if on else ""}></span><div class="col grow" style="min-width:0"><span class="f13 w6 ell">{n}</span><span class="f11" style="opacity:.75">{t} · 张某</span></div>{tg}</div>'
    left = f'''<section class="glass pn" style="width:300px;flex:none;padding:16px 12px 12px">
  <div class="row" style="padding:0 6px 10px"><span class="f18 w7 grow">紧急回滚</span><span class="tag tg-r">值班</span></div>
  <div class="flabel" style="padding:0 6px">应用</div>
  <div class="row g10" style="margin:0 4px;padding:9px 10px;border-radius:12px;background:var(--fill)"><span class="ic-box" style="width:26px;height:26px;border-radius:7px;background:linear-gradient(160deg,#5AA0FF,#1F6FFF)">{I("globe",14)}</span><div class="col grow"><span class="f13 w6">Tita_Static</span><span class="f11 t3">Apollo 配置中心</span></div>{I("chevd",14,style="color:var(--text-3)")}</div>
  <div class="flabel" style="padding:0 6px;margin-top:12px">环境 · 集群 · Namespace</div>
  <div class="seg" style="margin:0 4px"><span class="on" style="flex:1;justify-content:center;color:var(--ink-red)">PRO 正式</span><span style="flex:1;justify-content:center">TEST 测试</span></div>
  <div class="row g6 f12 t2" style="padding:8px 8px 0"><span class="chip2" style="height:24px;font-size:12px">default</span><span class="chip2" style="height:24px;font-size:12px">application</span></div>
  <div class="g10h" style="padding-top:16px">发布历史 · 选择回到哪一次</div>
  <div class="col g2">{hs}</div>
  <span class="grow"></span>
  <div class="f11 t3" style="padding:8px 6px 0;line-height:1.5">通过公司内网服务对接 Apollo，手机和外网不直连管理页面。</div>
</section>'''
    steps = [("选择目标", "ok"), ("预览差异", "on"), ("确认", "wait"), ("执行与验证", "wait")]
    ss = "".join(f'<div class="row g8">{"<span class=\"pdot pd-ok\" style=\"width:24px;height:24px;font-size:12px\">✓</span>" if s=="ok" else f"<span class=\"pdot\" style=\"width:24px;height:24px;font-size:12px;background:{"var(--blue)" if s=="on" else "var(--fill)"};color:{"#fff" if s=="on" else "var(--text-3)"}\">{i+1}</span>"}<span class="f13 {"w7" if s=="on" else "t2"}">{n}</span></div>' + ('<span style="width:40px;height:2px;background:var(--hair)"></span>' if i < 3 else "") for i, (n, s) in enumerate(steps))
    diff = [("approval.web.version", "3.8.2", "3.8.1", "chg", "本次要回退"),
            ("approval.web.cdn", "…/approval/3.8.2/", "…/approval/3.8.1/", "chg", "本次要回退"),
            ("feature.kanban.v2", "true", "false", "warn", "连带恢复"),
            ("workflow.web.version", "2.4.0", "2.4.0", "same", "不变"),
            ("main.entry.hash", "e91a…", "e91a…", "same", "不变")]
    dr = ""
    for k, a, b, t, s in diff:
        bg = {"chg": "color-mix(in srgb,var(--blue) 7%,transparent)", "warn": "color-mix(in srgb,var(--orange) 10%,transparent)", "same": "transparent"}[t]
        tc = {"chg": "b", "warn": "o", "same": "n"}[t]
        dr += f'<tr style="background:{bg}"><td class="mono f12">{k}</td><td class="mono f12"{" style=\"color:var(--ink-red);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--red) 50%,transparent)\"" if t!="same" else " class=\"t3\""}>{a}</td><td class="mono f12 w6"{" style=\"color:var(--ink-green)\"" if t!="same" else ""}>{b}</td><td><span class="tag tg-{tc}">{s}</span></td></tr>'
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g12"><span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(160deg,#FF8A7A,#E0281E)">{I("history",20,2)}</span>
  <div class="col grow" style="min-width:0"><h1 class="ell">PRO 回到 11-18 21:40 的发布</h1><div class="f12 t3" style="margin-top:2px">Tita_Static · default · application · 当前 approval-web 3.8.2 → 目标 3.8.1 · 选它是因为有 7 天验证通过记录</div></div></div>
  <div class="row g12" style="margin-top:12px">{ss}</div></header>
<div class="col g14 grow" style="padding:16px 22px;min-height:0;overflow:hidden">
  <div class="card" style="padding:12px 14px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">配置差异</span><span class="f12 t3">Apollo 按整个 Namespace 回退 · 5 项中 3 项会变化</span></div>
    <table class="tbl"><thead><tr><th style="width:32%">配置项</th><th>当前</th><th>回滚后</th><th style="width:16%">说明</th></tr></thead><tbody>{dr}</tbody></table></div>
  <div class="row g10" style="padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--orange) 12%,transparent)">{I("alert",18,style="color:var(--ink-orange)")}<div class="f13" style="line-height:1.55"><b>会连带恢复 feature.kanban.v2 = false</b>　这是 11-19 单独打开的看板新版开关，回退后看板会回到旧版。</div></div>
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:12px 14px"><div class="mini">实际会变化的应用和资源</div>
      <div class="kv2"><span class="row g8"><span class="sc10 sc-t">应用</span>approval-web</span><span class="mono f12">3.8.2 → 3.8.1</span></div>
      <div class="kv2"><span class="row g8"><span class="sc10 sc-t">入口</span>/approval · /approval/start</span><span class="f12 t3">回退后按回滚规则验证</span></div></div>
    <div class="card grow" style="padding:12px 14px"><div class="mini">大包兼容</div>
      <div class="kv2"><span class="t2">组件 tita-ui-kit</span><span class="row g6 f12">{CK()}3.8.1 使用 1.4.2，仍可用</span></div>
      <div class="kv2"><span class="t2">子项目 workflow-web</span><span class="f12 t3">不受影响</span></div></div>
  </div>
  <div class="card" style="padding:12px 14px"><div class="row g8" style="margin-bottom:4px"><span class="mini grow" style="margin:0">回滚后的业务验证（项目回滚验证规则）</span><span class="row g6 f12 t3">{I("spark",12,style="color:var(--ink-purple)")}预览由 AI 准备，执行需要你确认</span></div>
    <div class="row g14 f13" style="margin-top:6px"><span class="row g6"><span class="tag tg-n">1</span>入口 /approval 实际加载 3.8.1 资源</span><span class="row g6"><span class="tag tg-n">2</span>发起审批页能打开、能选审批人</span><span class="row g6"><span class="tag tg-n">3</span>看板旧版正常</span></div></div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:14px 16px">
  <div class="row g8"><span class="sec grow">确认回滚</span><span class="tag tg-r">PRO 正式环境</span></div>
  <div class="kv2" style="margin-top:6px"><span class="t2">当前</span><span class="mono f13">3.8.2</span></div>
  <div class="kv2"><span class="t2">目标</span><span class="mono f13 w7" style="color:var(--ink-green)">3.8.1</span></div>
  <div class="kv2"><span class="t2">影响</span><span class="f12">3 项配置 · 1 个应用</span></div>
  <div class="flabel" style="margin-top:10px">回滚理由</div>
  <div class="field" style="font-size:12.5px">审批发起页白屏，先回退再让 Bot 查根因</div>
  <div class="flabel" style="margin-top:10px">输入 PRO 确认</div>
  <div class="field focus mono" style="font-size:13px">PRO<span style="display:inline-block;width:1.5px;height:15px;background:var(--blue);vertical-align:-2px"></span></div>
  <button class="abtn" style="width:100%;justify-content:center;height:40px;margin-top:12px;background:var(--btn-danger-bg);color:#fff;box-shadow:0 8px 20px -8px color-mix(in srgb,var(--red) 80%,transparent)">{I("history",15)}确认回滚到 3.8.1</button>
  <div class="row g6 f12 t3" style="margin-top:8px">{I("key",12)}<span class="grow">用你的 Apollo 账号 <span class="mono t2">lin.x</span></span><span class="lnk">改 ›</span></div>
  <div class="f11 t3" style="margin-top:8px;line-height:1.5">确认时如线上版本已变化，会刷新差异让你重新确认。</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行后分别显示</div>
  <div class="kv2"><span class="t2">请求结果</span><span class="f12 t3">Apollo 返回</span></div>
  <div class="kv2"><span class="t2">配置回读</span><span class="f12 t3">读回实际值</span></div>
  <div class="kv2"><span class="t2">业务验证</span><span class="f12 t3">入口加载版本</span></div></div>''')
    return left + main + right


# =====================================================================
# 10. Skills
# =====================================================================
def skills_left(sel="页面交互回归 · 我的版本"):
    def sk(name, desc, kind, src, used, on=False, draft=False):
        bg = "linear-gradient(160deg,#5AA0FF,#1F6FFF)" if kind == "编码" else "linear-gradient(160deg,#5EDB7A,#28B04F)"
        ic = "code" if kind == "编码" else "eye"
        st = 'background:linear-gradient(180deg,#3B8BFF,#1F6FFF);color:#fff;box-shadow:0 8px 18px -10px rgba(31,111,255,.9)' if on else ''
        dt = '<span class="tag" style="background:rgba(255,255,255,.22);color:#fff">草稿</span>' if (draft and on) else ('<span class="tag tg-o">草稿</span>' if draft else "")
        return f'<div class="row g10" style="padding:10px;border-radius:14px;align-items:flex-start;{st}"><span class="ic-box" style="width:32px;height:32px;background:{bg}{";box-shadow:0 0 0 2px rgba(255,255,255,.55)" if on else ""}">{I(ic,16,2)}</span><div class="col grow" style="min-width:0"><div class="row g6"><span class="t10 ell grow">{name}</span>{dt}</div><span class="f12 ell" style="opacity:.7;margin-top:2px">{desc}</span><span class="f11" style="opacity:.6;margin-top:3px">{kind} · {src} · {used}</span></div></div>'
    left = f'''<section class="glass pn" style="width:300px;flex:none;padding:16px 10px 10px">
      <div class="row g8" style="padding:0 8px 8px"><span class="f18 w7 grow">Skills</span><span class="btn2 sm" style="background:var(--btn-pri-bg);color:#fff">{I("plus",13,2.4)}在线新建</span><span class="btn2 sm a-sec" style="background:var(--fill)">{I("download",13)}导入</span></div>
      <div class="seg" style="margin:0 6px"><span class="on" style="flex:1;justify-content:center;height:26px;font-size:12px">全部 6</span><span style="flex:1;justify-content:center;height:26px;font-size:12px">编码 3</span><span style="flex:1;justify-content:center;height:26px;font-size:12px">验证 3</span></div>
      <div class="g10h">我的<span>3</span></div>
      {sk("页面交互回归 · 我的版本","按复现路径回归，等列表加载完再点","验证","复制自内置","草稿 v2",sel=="页面交互回归 · 我的版本",True)}
      {sk("复用表单组件","优先复用现有表单组件，不新写","编码","我注入","审批 · 考勤",sel=="复用表单组件")}
      {sk("权限类问题先换角色","复现失败先换普通员工","验证","从对话保存","考勤")}
      <div class="g10h">平台内置<span>3</span></div>
      {sk("页面交互回归","目标环境复现 + 改动版本复测","验证","内置","OKR · 审批")}
      {sk("最小改动修复","只改与根因相关的代码","编码","内置","全局默认")}
      {sk("接口回归","调用相关接口核对返回","验证","内置","未启用")}
    </section>'''
    return left


def p_skills():
    left = skills_left()
    body = [("1", "## 什么时候用", "h"), ("2", "审批、考勤这类表单页面的交互问题。", ""), ("3", "", ""),
            ("4", "## 复现", "h"), ("5", "1. 在目标环境用工单指定的角色登录；没写角色就**先问**。", ""),
            ("6", "2. 按工单的复现路径操作，录屏保留最后一次交互。", ""),
            ("7", "+ 3. 每次切换分组、筛选后，等列表请求完成再进行下一步。", "add"), ("8", "", ""),
            ("9", "## 复测", "h"), ("10", "1. 在包含改动的版本上重走复现路径。", ""),
            ("11", "2. 工单没给的角色或分组名，标为「缺失条件」，不要猜。", ""),
            ("12", "3. 只构建成功不算通过，必须有页面操作证据。", ""), ("13", "", ""),
            ("14", "## 证据", "h"), ("15", "- 修前复现、修后复测各一段录屏，注明环境、版本和账号角色。", ""),
            ("16", "- 未执行的步骤写明原因，交付时列为待确认项。", "")]
    bl = "".join(f'<div class="cl{" add" if t=="add" else ""}" style="line-height:24px"><span class="n">{n}</span><span class="c" style="padding-left:8px;{"color:var(--ink-purple);font-weight:600" if t=="h" else ""}">{c.replace("+ ","").replace("**","")}</span></div>' for n, c, t in body)
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(160deg,#5EDB7A,#28B04F)">{I("eye",20,2)}</span>
  <div class="col grow" style="min-width:0"><h1>页面交互回归 · 我的版本</h1><div class="f12 t3" style="margin-top:2px">验证 Skill · 复制自内置 v1 · 草稿已自动保存 15:02 · 手机可接着写</div></div>
  <span class="btn2 a-sec" style="background:var(--fill)">{I("history",14)}版本</span><span class="btn2" style="background:var(--btn-pri-bg);color:#fff">保存草稿</span></div></header>
<div class="col g12 grow" style="padding:16px 22px;min-height:0;overflow:hidden">
  <div class="row g12"><div class="grow"><div class="flabel">名称</div><div class="field">页面交互回归 · 我的版本</div></div><div style="width:150px"><div class="flabel">类型</div><div class="seg"><span style="flex:1;justify-content:center">编码</span><span class="on" style="flex:1;justify-content:center">验证</span></div></div></div>
  <div><div class="flabel">用途（Bot 判断何时使用）</div><div class="field">审批、考勤等表单页面的交互类 Bug，复现和复测都按页面操作留证据。</div></div>
  <div class="col grow" style="min-height:0"><div class="row g8"><span class="flabel grow" style="margin:0">规则正文</span><span class="f12 t3">Markdown · 16 行</span></div>
    <div class="code" style="margin-top:6px;border-radius:14px;background:var(--glass-2);border:1px solid var(--stroke);padding:8px 0;font-size:12.5px;flex:1;overflow:hidden">{bl}</div></div>
</div>
</main>'''
    right = aside(
        f'''<div class="gbord" style="padding:14px 14px 12px;border-radius:18px">
  <div class="row g8"><span class="aid" style="width:22px;height:22px;border-radius:7px">{I("spark",12)}</span><span class="f13 w7 grow">AI 帮你改</span></div>
  <div class="me" style="font-size:12.5px;padding:8px 12px;margin-top:10px;max-width:100%">加一条：切换分组后要等列表加载完再点</div>
  <div class="f12 t2" style="margin-top:10px;line-height:1.6">已在第 7 行加入草稿（绿色）。先检查再决定是否采用：</div>
  <div class="row g8" style="margin-top:8px"><span class="btn2 sm grow" style="background:var(--btn-pri-bg);color:#fff">采用</span><span class="btn2 sm a-sec grow" style="background:var(--fill)">放弃</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">启用到项目</div>
  <div class="row g8" style="padding:6px 0"><span class="cbx on">{I("check",12,3)}</span><span class="f13 grow">审批</span><span class="f12 t3">替换内置 v1</span></div>
  <div class="row g8" style="padding:6px 0"><span class="cbx"></span><span class="f13 grow">考勤</span><span class="f12 t3">未启用</span></div>
  <div class="row g8" style="padding:6px 0"><span class="cbx"></span><span class="f13 grow t3">OKR</span><span class="f12 t3">无设置权限</span></div>
  <div class="hr" style="margin:6px 0"></div>
  <div class="row g8 f13" style="padding:4px 0"><span class="radio on"></span>下一轮任务开始生效</div>
  <div class="f11 t3" style="line-height:1.5;margin:2px 0 10px 26px">进行中的 TK-20871 仍用 v1；历史轮次可回看当时正文。</div>
  <button class="abtn a-pri" style="width:100%;justify-content:center;height:36px">确认启用 v2 到审批</button></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">版本</div>
  <div class="kv2"><span class="row g6"><span class="tag tg-o">草稿</span>v2</span><span class="f12 t3">林某 · 15:02</span></div>
  <div class="kv2"><span class="row g6"><span class="tag tg-g">在用</span>v1 内置</span><span class="f12 t3">审批 · OKR</span></div></div>''')
    return left + main + right


# =====================================================================
# 11. 设置
# =====================================================================
# =====================================================================
# 11. 设置 · 项目（= 开工准备：每项配置的当前值 + Bot 实测，点「改」打开对应编辑面板）
# =====================================================================
# 设置左菜单（按工作空间 / 项目 / 个人永久锁死，不随新插件类型膨胀；所有设置页共用）
SET_NAV = [("spark", "linear-gradient(160deg,#C58BFF,#6A3DF0)", "全局 AI", ""),
           ("server", "linear-gradient(155deg,#34D399,#059669)", "执行器", "2"),
           ("link", "linear-gradient(160deg,#38BDF8,#2563EB)", "连接器", "5"),
           ("layers", "linear-gradient(160deg,#5AA0FF,#1F6FFF)", "项目", "4"),
           ("inbox", "linear-gradient(160deg,#4FD6E6,#16A3C0)", "来源采集", "!"), ("users", "linear-gradient(160deg,#5EDB7A,#28B04F)", "成员与身份", "1"),
           ("key", "linear-gradient(160deg,#FFC15A,#F08A00)", "我的账号", ""), ("bell", "linear-gradient(160deg,#FF8A7A,#E0281E)", "通知", "")]


def p_settings():
    nav = SET_NAV
    nv = "".join(f'<div class="sn{" on" if n=="项目" else ""}"><span class="si" style="background:{bg}">{I(ic,14,2)}</span>{n}<em{" style=\"color:var(--ink-orange)\"" if e=="!" else ""}>{e}</em></div>' for ic, bg, n, e in nav)
    def pj(name, st, c, on=False):
        sty = ' style="background:var(--glass-2);font-weight:600;box-shadow:0 0 0 .5px var(--hair)"' if on else ''
        return f'<div class="sn"{sty}><span class="pdt" style="background:var(--{c})"></span>{name}<em style="color:var(--ink-{c})">{st}</em></div>'
    left = f'''<section class="glass pn" style="width:240px;flex:none;padding:16px 4px 10px">
  <div class="row" style="padding:0 14px 6px"><span class="f18 w7">设置</span></div>{nv}
  <div class="g10h" style="padding-left:14px">项目</div>
  <div class="snav" style="padding-top:0">{pj("审批","已就绪","green")}{pj("考勤","已就绪","green")}{pj("OKR","差 1 项","orange",True)}{pj("薪酬","未开始","text-3")}</div>
</section>'''

    OK = '<span class="ck" style="background:var(--green)">' + I("check",12,3.2) + '</span>'
    NO = '<span class="ck" style="background:var(--red)">' + I("x",12,3.2) + '</span>'
    WN = '<span class="ck" style="background:var(--orange);font-size:12px;font-weight:800">!</span>'
    def item(st, title, who, detail, right, req=True):
        ic = {"ok": OK, "no": NO, "wn": WN}[st]
        rq = '' if req else '<span class="tag tg-n" style="margin-left:6px">只影响发布</span>'
        return f'''<div class="pq"><span style="margin-top:1px">{ic}</span>
  <div class="grow" style="min-width:0"><div class="row g6"><span class="f14 w6">{title}</span>{rq}<span class="f12 t3" style="margin-left:4px">{who}</span></div>
  <div class="f12 t2 ell" style="margin-top:3px">{detail}</div></div><div class="pqr">{right}</div></div>'''
    def done(t): return f'<span class="f12 t3">{t}</span><span class="f12 lnk" style="margin-left:12px">改</span>'
    def todo(t, pri=True):
        cls = "a-pri" if pri else "a-sec"
        sty = "" if pri else ' style="background:var(--fill)"'
        return f'<button class="btn2 sm {cls}"{sty}>{t}</button>'

    g1 = "".join([
        item("ok", "代码来源与读写权限", "项目管理员", '可修改：<span class="mono">tita-okr-web</span>（GitLab · AI 推测 master/dev-okr）· 仅查看：<span class="mono">tita-ui-kit</span>（GitHub）、<span class="mono">tita-okr-api</span>（宿主机禁写）', done("10:20 实测通过")),
        item("ok", "安装依赖与构建", "AI 推测 · Bot 实测", '<span class="mono">pnpm i &amp;&amp; pnpm build-prod</span>（AI 扫仓自动推测，构建通过 3 分 12 秒 · 可微调）', done("10:24 实测通过")),
        item("ok", "MR 审核人", "默认规则", '合入测试分支：工单的修复人（默认）· 合回主分支：林某（项目负责人）', done("已设置")),
    ])
    g2 = "".join([
        item("ok", "环境", "项目管理员", '测试 <span class="mono">test.tita.work/okr</span> · 联调 · 正式 <span class="mono">www.tita.com/okr</span>，都能打开', done("10:25 实测通过")),
        item("no", "环境账号", "项目管理员", '测试环境 5 个账号能登录　<b style="color:var(--ink-red)">OKR 管理员：没有账号</b>，复现大部分 OKR Bug 要用它', todo("填写账号")),
    ])
    g3 = "".join([
        item("ok", "工单来源", "管理员", 'Jira OKR「AI修复」→ 测试环境；Tita「AI干活」→ 正式环境', done("2 分钟前收单")),
        item("ok", "Skills", "项目管理员", '编码：最小改动修复、组件包升级　验证：页面交互回归', done("3 个已启用")),
        item("wn", "发布配置", "项目管理员", '还没填 tita build / tita release。不影响 Bot 修代码，但修完不能一键发测试', todo("去配置", False), req=False),
    ])
    def grp(t, sub, body):
        return f'<div class="card" style="padding:2px 16px 0"><div class="row g8" style="padding:6px 0 2px"><span class="sec" style="font-size:14px">{t}</span><span class="f12 t3">{sub}</span></div>{body}</div>'

    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><h1>项目 · OKR</h1><div class="f12 t3" style="margin-top:2px">人才发展 · 你是项目管理员 · 和第一次使用的步骤器是同一份数据</div></div>
  <span class="chip2">{I("spark",13,style="color:var(--ink-purple)")}也可以问 AI「OKR 还差什么才能开工？」</span></div>
</header>
<div class="col g8 grow" style="padding:10px 22px;min-height:0;overflow:hidden">
  <div class="sum" style="padding:8px 18px">
    <div class="ring2"><svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="24" fill="none" stroke="var(--fill)" stroke-width="7"/><circle cx="29" cy="29" r="24" fill="none" stroke="var(--orange)" stroke-width="7" stroke-linecap="round" stroke-dasharray="{150.8*5/6:.1f} 150.8" transform="rotate(-90 29 29)"/></svg><b>5/6</b></div>
    <div class="grow"><div class="f16 w7">还差 1 项必需条件，Bot 暂不接 OKR 的单</div>
      <div class="f13 t2" style="margin-top:4px">补齐后自动开工，已收的 2 张单不用重新提</div></div>
    <button class="btn2 a-sec" style="background:var(--fill)">{I("refresh",14)}让 Bot 重新检查</button>
  </div>
  {grp("改代码", "Bot 能拿到代码并构建", g1)}
  {grp("验证", "Bot 能在浏览器里复现和复测 · 测试数据由每张工单提供", g2)}
  {grp("收单与交付", "", g3)}
</div>
</main>'''

    steps = [("ok","拉取 3 个仓库","8 秒"),("ok","安装依赖","1 分 40 秒"),("ok","构建","3 分 12 秒"),("ok","打开测试环境","2 秒"),
             ("ok","用「普通员工」登录","4 秒"),("no","用「OKR 管理员」登录","没有账号")]
    def stp(st, t, r):
        c = {"ok":"green","no":"red","wn":"orange"}[st]
        return f'<div class="row g8 f13" style="height:27px"><span class="dot" style="width:7px;height:7px;color:var(--{c})"></span><span class="grow">{t}</span><span class="f12" style="color:{"var(--text-3)" if st=="ok" else f"var(--ink-{c})"}">{r}</span></div>'
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">没准备好时会怎样</div>
  <div class="f13 t2" style="line-height:1.6">OKR 的单照常收进来，标为<b style="color:var(--ink-orange);white-space:nowrap">「等开工准备」</b>，先不派给 Bot，补齐后自动开始。</div>
  <div class="row g10" style="margin-top:10px;padding:9px 10px;border-radius:12px;background:var(--fill)"><span class="sc10 sc-j">Jira</span><span class="f13 grow ell">OKR-412 对齐视图里子目标重复显示</span><span class="f12" style="color:var(--ink-orange)">等待中</span></div>
  <div class="row g10" style="margin-top:6px;padding:9px 10px;border-radius:12px;background:var(--fill)"><span class="sc10 sc-t">Tita</span><span class="f13 grow ell">目标进度导出缺少部门</span><span class="f12" style="color:var(--ink-orange)">等待中</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="row"><span class="mini grow" style="margin:0">最近一次检查</span><span class="f12 t3">今天 10:20 · Bot-02</span></div>
  <div style="margin-top:8px">{"".join(stp(*x) for x in steps)}</div>
  <div class="f12 lnk" style="margin-top:8px">看完整日志 ›</div></div>''')
    return left + main + right



# =====================================================================
# 12. 设置 · 全局 AI（管理员接一次，所有项目共用）
# =====================================================================
def p_aiset():
    nav = SET_NAV
    nv = "".join(f'<div class="sn{" on" if n=="全局 AI" else ""}"><span class="si" style="background:{bg}">{I(ic,14,2)}</span>{n}<em{" style=\"color:var(--ink-orange)\"" if e=="!" else ""}>{e}</em></div>' for ic, bg, n, e in nav)
    left = f'''<section class="glass pn" style="width:240px;flex:none;padding:16px 4px 10px">
  <div class="row" style="padding:0 14px 6px"><span class="f18 w7">设置</span></div>{nv}
</section>'''
    CK = f'<span class="cbx on">{I("check",12,3)}</span>'
    NO = '<span class="cbx"></span>'
    LK = f'<span class="cbx" style="opacity:.5">{I("lock",11,2.2,style="color:var(--text-3)")}</span>'
    def act(c, t, d):
        return f'<div class="row g10" style="padding:5px 0;border-top:1px solid var(--hair)">{c}<span class="f13 w6" style="width:190px;flex:none">{t}</span><span class="f12 t3 grow">{d}</span></div>'
    def chip(t, on=True):
        return f'<span class="tag {"tg-b" if on else "tg-n"}" style="height:28px;padding:0 12px;font-size:12.5px">{t}</span>'
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><h1>全局 AI</h1><div class="f12 t3" style="margin-top:2px">所有项目共用 · 只有管理员能改 · 改了从下一张单开始生效</div></div>
  <span class="chip2">{I("spark",13,style="color:var(--ink-purple)")}也可以问 AI「连续受阻几次会找人？」</span></div></header>
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="card" style="padding:12px 16px 6px"><div class="row g8" style="margin-bottom:4px"><span class="sec grow">连接</span><span class="row g6 f12" style="color:var(--ink-green)">{I("check",13,3)}已连通 · 今天 10:12 试过，1.2 秒</span><span class="btn2 sm a-sec" style="background:var(--fill);margin-left:8px">{I("refresh",13)}再试一下</span></div>
    <div class="kv2"><span class="t2">AI 引擎</span><span class="f13 w6">Pi（默认内置 · 多模型）</span></div>
    <div class="kv2"><span class="t2">主力模型</span><span class="f13 w6">gpt-6.2-sol</span></div>
    <div class="kv2"><span class="t2">连接方式</span><span class="row g8"><span class="f13">公司网关</span><span class="mono f12 t2">https://ai-gateway.tita.cloud</span></span></div>
    <div class="kv2"><span class="t2">访问令牌</span><span class="row g8"><span class="mono f12 t2">•••••••••••• 3f9a</span><span class="f12 t3">加密存在内网服务器上，只给 Bot 用</span></span></div></div>
  <div class="card" style="padding:12px 16px 6px"><div class="row g8" style="margin-bottom:2px"><span class="sec grow">引擎插件与外部连接</span><span class="f12 t3">按 5 贡献点分工 · 0% 重复配置</span><span class="f12 lnk">去插件市场 ›</span></div>
    <div class="kv2"><span class="t2">引擎扩展</span><span class="row g8"><span class="f13">按 <span class="mono">runtimes</span> 契约动态装载</span><span class="f12 t3">安装 ACP / Claude Code / Codex 后此处自动出现</span></span></div>
    <div class="kv2"><span class="t2">外部鉴权</span><span class="row g8"><span class="f13">GitLab · GitHub · 本机目录 · Jira · Tita</span><span class="f12 lnk">统一在「设置 → 连接器」管理 ›</span></span></div></div>
  <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:2px"><span class="sec grow">Bot 可以自己做的事</span><span class="f12 t3">没勾的要等人点</span></div>
    {act(CK, "复现问题", "在目标环境用登记过的账号操作页面")}
    {act(CK, "改代码、提交到修复分支", "只在 fix/ 分支上提交，不碰主分支和测试分支")}
    {act(CK, "提 MR 到测试分支", "合入仍要审核人通过")}
    {act(NO, "发到测试环境", "默认由修复人在工单里点「发布到测试」")}
    {act(LK, "发到正式环境", "始终要真人发，不能打开")}</div>
  <div class="card" style="padding:12px 16px"><div class="row g8"><span class="sec grow">什么时候停下来找人</span><span class="f12 lnk">+ 加一条</span></div>
    <div class="row g8" style="margin-top:10px;flex-wrap:wrap">{chip("缺账号或角色")}{chip("同一步连续受阻 2 次")}{chip("一次要改 10 个以上文件")}{chip("要改接口约定或数据库")}</div></div>
  <div class="card" style="padding:12px 16px"><div class="row g8"><span class="sec grow">共用修复提示词</span><span class="f12 t3">所有项目、所有单都会带上</span><span class="f12 lnk" style="margin-left:10px">改</span></div>
    <div class="f13 t2" style="margin-top:8px;line-height:1.7">先复现再改；只改和根因有关的代码；改完按工单步骤再走一遍并留证据；拿不准就停下来问，不要猜。</div></div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">运行情况</div>
  <div class="kv2"><span class="t2">在线的 Bot</span><span class="f13 w6">3 个</span></div>
  <div class="kv2"><span class="t2">今天调用</span><span class="f13">126 次</span></div>
  <div class="kv2"><span class="t2">失败</span><span class="f13" style="color:var(--ink-green)">0 次</span></div>
  <div class="kv2"><span class="t2">平均响应</span><span class="f13">1.4 秒</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">最近改动</div>
  <div class="f13" style="line-height:1.6">林某 把模型换成 gpt-6.2-sol</div><div class="f12 t3">11-18 16:20 · 进行中的 2 张单沿用旧模型</div>
  <div class="hr" style="margin:10px 0"></div>
  <div class="f13" style="line-height:1.6">林某 加了「要改接口约定或数据库」</div><div class="f12 t3">11-12 10:05</div></div>''')
    return left + main + right

# =====================================================================
# 13. 设置 · 来源采集（单子有没有收进来）
# =====================================================================
def set_left(sel):
    nav = SET_NAV
    nv = "".join(f'<div class="sn{" on" if n==sel else ""}"><span class="si" style="background:{bg}">{I(ic,14,2)}</span>{n}<em{" style=\"color:var(--ink-orange)\"" if e=="!" else ""}>{e}</em></div>' for ic, bg, n, e in nav)
    return f'''<section class="glass pn" style="width:240px;flex:none;padding:16px 4px 10px">
  <div class="row" style="padding:0 14px 6px"><span class="f18 w7">设置</span></div>{nv}
</section>'''


def p_source():
    def kv(k, v):
        return f'<div class="kv2"><span class="t3">{k}</span><span class="f13">{v}</span></div>'
    jira = f'''<div class="card" style="flex:1;min-width:0;padding:14px 16px 10px">
  <div class="row g10"><span class="appic ic-jira" style="width:30px;height:30px;border-radius:9px;font-size:8.5px">JIRA</span><span class="f15 w7 grow">Jira</span><span class="tag tg-g">正常</span></div>
  <div style="margin-top:8px">{kv("地址", '<span class="mono f12">jira.tita.work</span>')}{kv("接入账号", '<span class="mono f12">bot-fix</span> · 只读')}{kv("多久采一次", "每 2 分钟")}{kv("最近成功", "2 分钟前 · 收到 1 张")}</div>
  <div class="row g8" style="margin-top:8px"><span class="grow"></span><button class="btn2 sm a-sec" style="background:var(--fill)">{I("refresh",13)}立即采集</button></div></div>'''
    tita = f'''<div class="card" style="flex:1;min-width:0;padding:14px 16px 10px;box-shadow:0 0 0 2px color-mix(in srgb,var(--red) 55%,transparent)">
  <div class="row g10"><span class="appic ic-tita" style="width:30px;height:30px;border-radius:9px;font-size:8.5px">TITA</span><span class="f15 w7 grow">Tita 工单</span><span class="tag tg-r">采集失败</span></div>
  <div style="margin-top:8px">{kv("最近成功", '14:40 · <span style="color:var(--ink-red)">已断 22 分钟</span>')}{kv("自动重试", "3 次都失败 · 下次 15:06")}</div>
  <div class="log t2" style="margin-top:8px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--red) 7%,transparent)"><div class="ln"><span class="ts">15:02:11</span>GET /openapi/workorder/list → <b style="color:var(--ink-red)">401</b></div><div class="ln"><span class="ts"></span>{{"code":40101,"msg":"token expired"}}</div></div>
  <div class="row g8" style="margin-top:10px"><span class="f12 t3 grow">接入令牌过期了</span><button class="btn2 sm a-sec" style="background:var(--fill)">立即重试</button><button class="btn2 sm a-pri">更新令牌</button></div></div>'''
    rows = [("15:00", "j", "OKR-412", "对齐视图里子目标重复显示", "OKR", "o", "已收 · 等开工准备", ""),
            ("14:58", "j", "OKR-3320", "目标对齐后父目标不更新", "OKR", "r", "没收成 · 确定不了真人修复人", "去处理 ›"),
            ("14:40", "t", "TK-20871", "发起审批时点击分组，界面卡住", "审批", "n", "重复 · 同一次交付，已跳过", ""),
            ("14:32", "t", "TK-20880", "补卡后考勤统计没更新", "考勤", "g", "已建任务 · 通知了周某", ""),
            ("14:10", "j", "KQ-118", "排班导入后日期错一天", "考勤", "g", "已建任务 · 通知了李娜", ""),
            ("13:52", "t", "TK-20862", "按部门筛选后列表没有变化", "考勤", "g", "已建任务 · 通知了林某", ""),
            ("13:30", "j", "APR-77", "审批流转后抄送人收不到", "审批", "g", "已建任务 · 通知了陈晨", "")]
    tb = "".join(f'''<tr><td class="mono f12 t3">{t}</td><td><span class="sc10 sc-{s}">{"Jira" if s=="j" else "Tita"}</span></td><td><span class="mono f12 w6">{n}</span> <span class="t2">{ti}</span></td><td class="t2">{pj}</td><td><span class="tag tg-{c}">{r}</span></td><td class="lnk w6" style="text-align:right">{a}</td></tr>''' for t, s, n, ti, pj, c, r, a in rows)
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><h1>来源采集</h1><div class="f12 t3" style="margin-top:2px">单子有没有收进来 · 管理员维护 · 各项目收哪些单在「项目 → 工单来源」里设</div></div>
  <span class="chip2">{I("spark",13,style="color:var(--ink-purple)")}也可以问 AI「今天 Tita 漏收了吗？」</span></div></header>
<div class="col g14 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="row g14" style="align-items:stretch">{jira}{tita}</div>
  <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">最近收单</span><span class="seg" style="padding:2px"><span class="on" style="height:24px;font-size:12px">全部</span><span style="height:24px;font-size:12px">没收成 1</span><span style="height:24px;font-size:12px">重复跳过</span></span></div>
    <style>.tbl.sr td{{padding:8px 10px;white-space:nowrap}}</style><table class="tbl sr"><thead><tr><th style="width:8%">时间</th><th style="width:7%">来源</th><th>工单</th><th style="width:8%">项目</th><th style="width:26%">结果</th><th style="width:9%"></th></tr></thead><tbody>{tb}</tbody></table>
    <div class="f12 t3" style="padding:8px 0;border-top:1px solid var(--hair)">同一来源、同一工单的同一次交付只建一项任务；打回后沿用原任务。</div></div>
</div>
</main>'''
    def cond(p, j, t, c="t2"):
        return f'<div class="col g4" style="padding:8px 0;border-top:1px solid var(--hair)"><div class="row"><span class="f13 w6 grow">{p}</span><span class="f12 lnk">改 ›</span></div><span class="f12 {c}">{j}</span><span class="f12 {c}">{t}</span></div>'
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">今天</div>
  <div class="row g8" style="margin-top:8px"><div class="col grow"><span style="font-size:24px;line-height:1.2" class="w7">12</span><span class="f11 t3">收到</span></div><div class="col grow"><span class="w7" style="font-size:24px;line-height:1.2;color:var(--ink-green)">9</span><span class="f11 t3">建了任务</span></div><div class="col grow"><span style="font-size:24px;line-height:1.2" class="w7 t3">2</span><span class="f11 t3">重复</span></div><div class="col grow"><span class="w7" style="font-size:24px;line-height:1.2;color:var(--ink-red)">1</span><span class="f11 t3">没收成</span></div></div></div>''',
        f'''<div class="card" style="padding:12px 14px 4px"><div class="mini">各项目收哪些单</div>
  {cond("审批", "Jira APR「AI修复」→ 测试环境", "Tita 审批「AI干活」→ 正式环境")}
  {cond("考勤", "Jira KQ「AI修复」→ 测试环境", "Tita 考勤「AI干活」→ 正式环境")}
  {cond("OKR", "Jira OKR「AI修复」→ 测试环境", "Tita OKR「AI干活」→ 正式环境")}
  {cond("OKR", "还没配置", "收到的单先放进「需要处理」", "t3")}</div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">断了会丢单吗</div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">不会。恢复后从上次成功的时间点补收，已有的任务不会重复建。</div></div>''')
    return set_left("来源采集") + main + right


# =====================================================================
# 14. 设置 · 成员与身份（单子通知谁、谁有权审核）
# =====================================================================
def p_members():
    def av(n, g):
        return f'<span class="av" style="width:26px;height:26px;font-size:10px;background:linear-gradient(150deg,{g})">{n}</span>'
    def pick(n, dept, acct, g):
        return f'''<div class="row g10" style="flex:1;padding:10px 12px;border-radius:12px;background:var(--fill)">{av(n,g)}<div class="col grow" style="min-width:0"><span class="f13 w6">{n} · {dept}</span><span class="f12 t3"><span class="mono">{acct}</span> · 手上 2 张单</span></div><button class="btn2 sm a-pri">就是他</button></div>'''
    pend = f'''<div class="card" style="padding:14px 16px;box-shadow:0 0 0 2px color-mix(in srgb,var(--orange) 55%,transparent)">
  <div class="row g8"><span class="ck" style="background:var(--orange);font-size:12px;font-weight:800">!</span><span class="f14 w7 grow">OKR-3320 不知道该通知谁</span><span class="f12 t3">14:58 收单 · 管理员或 OKR 负责人可选 · 单子先留着</span></div>
  <div class="f13 t2" style="margin:6px 0 10px 30px">Jira 经办人显示「张伟」，账号 <span class="mono">zw01</span> 还没关联成员。工作台里有 2 个叫张伟的，选一个——以后 <span class="mono">zw01</span> 的单自动给他。</div>
  <div class="row g10" style="margin-left:30px">{pick("张伟","人事产研","zhangwei","#9FD7FF,#3A8EE6")}{pick("张伟","销售产研","zhangwei2","#C9B6FF,#7B5BE0")}</div></div>'''
    M = [("林某", "#FFC9A8,#F08F7A", "lin@company.com", "林某 · lin", "林某", "审批 考勤 OKR", "空间管理员", "g", "正常"),
         ("王某", "#7FB2FF,#4C7DF0", "wang@company.com", "王某 · wang", "—", "审批 考勤", "负责人 · 审批", "g", "正常"),
         ("陈晨", "#FFD27F,#F0A23C", "chen@company.com", "陈晨 · chenchen", "陈晨", "审批", "成员", "g", "正常"),
         ("张某", "#8FD8C9,#3FAE9A", "zhang@company.com", "张某 · zhang", "张某", "审批 OKR", "成员", "g", "正常"),
         ("李娜", "#F7A8D0,#E0609E", "lina@company.com", "李娜 · lina", "李娜", "考勤", "成员", "g", "正常"),
         ("周某", "#B5E3A0,#5FB84A", "zhou@company.com", "周某 · zhou", '<span style="color:var(--ink-orange)">未关联</span>', "考勤", "成员", "g", "正常"),
         ("赵磊", "#C8CCD4,#8A909B", "zhao@company.com", "赵磊 · zhaolei", "赵磊", "考勤", "成员", "n", "已停用")]
    tb = "".join(f'''<tr{" style=\"opacity:.6\"" if s=="已停用" else ""}><td><div class="row g8">{av(n,g)}<span class="w6">{n}</span></div></td><td class="mono f11 t2">{a}</td><td class="f12 t2">{j}</td><td class="f12 t2">{t}</td><td class="f12 t2">{p}</td><td>{"<span class=\"tag tg-b\">空间管理员</span>" if r=="空间管理员" else (f"<span class=\"tag tg-p\">{r}</span>" if r.startswith("负责人") else "<span class=\"f12 t3\">成员</span>")}</td><td><span class="tag tg-{c}">{s}</span></td></tr>''' for n, g, a, j, t, p, r, c, s in M)
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><h1>成员与身份</h1><div class="f12 t3" style="margin-top:2px">独立邮箱登录 · 工作空间管理员管全部，项目负责人管本项目 · 支持免 SMTP 一次性邀请链接</div></div>
  <button class="btn2 a-sec" style="background:var(--fill)">{I("ext",13)}生成邀请链接</button>
  <button class="btn2 a-pri">{I("plus",14,2.4)}添加成员</button></div></header>
<div class="col g14 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  {pend}
  <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">成员</span><span class="seg" style="padding:2px"><span class="on" style="height:24px;font-size:12px">全部 12</span><span style="height:24px;font-size:12px">未关联 1</span><span style="height:24px;font-size:12px">已停用 1</span></span></div>
    <style>.tbl.mb td{{padding:7px 8px;white-space:nowrap}}</style><table class="tbl mb"><thead><tr><th style="width:13%">成员</th><th style="width:20%">登录邮箱</th><th style="width:15%">Jira 身份</th><th style="width:9%">Tita</th><th>能看的项目</th><th style="width:14%">角色</th><th style="width:8%">状态</th></tr></thead><tbody>{tb}</tbody></table>
    <div class="row g8 f12" style="padding:8px 0;border-top:1px solid var(--hair)"><span class="ck" style="background:var(--orange);width:16px;height:16px;font-size:10px;font-weight:800">!</span><span class="t2 grow">赵磊已停用，还有 1 张单等他审核，指定新负责人后才会转出去</span><span class="lnk w6">指定新负责人 ›</span></div></div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="row"><div class="mini grow" style="margin:0">免 SMTP 邀请链接</div><span class="tag tg-g">私有部署</span></div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">内网无邮件服务器时，生成 24 小时一次性链接直接发企微/飞书，同事点开即可设密码加入。</div>
  <div class="row g6" style="margin-top:8px;padding:6px 8px;border-radius:8px;background:var(--fill)"><span class="mono f11 t2 ell grow">https://cc.intra/join/9f2a…k8</span><span class="lnk f11 w6" style="white-space:nowrap">复制</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">单子怎么找到人</div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.65">1. 按原单外部用户 ID（非显示名）匹配<br>2. 对不上、同名或缺失进入顶部待处理，不发错人</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">谁能做什么</div>
  <div class="kv2"><span class="t2">通过 / 打回</span><span class="f12">仅本单修复人</span></div>
  <div class="kv2"><span class="t2">成员 / 角色 / 邀请</span><span class="f12">空间管理员</span></div>
  <div class="kv2"><span class="t2">本项目身份映射</span><span class="f12">管理员 · 负责人</span></div>
  <div class="f12 t3" style="margin-top:6px">管理员不能替别人审核；停用保留历史署名。</div></div>''')
    return set_left("成员与身份") + main + right


# =====================================================================
# 15. 设置 · 通知（每个人自己的）
# =====================================================================
def p_notify():
    T = lambda on: f'<span class="tgl{" on" if on else ""}"></span>'
    L = f'<span class="tgl on" style="opacity:.45"></span>'
    ev = [("接到新单", "我是修复人", T(True), T(True)), ("Bot 在问我 / 需要协助", "说清缺哪项", T(True), T(True)),
          ("待我审核", "每轮修好后", T(True), T(True)), ("可以复测", "我是测试人，提交号对上后", T(True), T(True)),
          ("测试结果", "我的单被测试通过或打回", T(True), T(False)), ("发布失败", "哪个环境、哪个项目、哪一步", L, L),
          ("紧急回滚结果", "我发起或我负责的项目", L, L), ("待原平台确认", "每天 18:00 汇总一次", T(False), T(True))]
    rows = "".join(f'<div class="row g10" style="padding:7px 0;border-top:1px solid var(--hair)"><div class="row g10 grow" style="min-width:0"><span class="f13 w6" style="width:170px;flex:none">{a}</span><span class="f12 t3 ell">{b}</span></div><div style="width:110px;display:flex;justify-content:center">{c}</div><div style="width:110px;display:flex;justify-content:center">{d}</div></div>' for a, b, c, d in ev)
    def dev(ic, n, d, st, c, act):
        return f'<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)"><span class="ic-box" style="width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,#A9AEB8,#6E737D)">{I(ic,15)}</span><div class="col grow"><span class="f13 w6">{n}</span><span class="f12 t3">{d}</span></div><span class="f12" style="color:var(--ink-{c})">{st}</span><span class="f12 lnk w6" style="width:96px;text-align:right">{act}</span></div>'
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><h1>通知</h1><div class="f12 t3" style="margin-top:2px">你自己的设置 · 只影响你收到什么 · 错过的通知都能在待办里找到</div></div>
  <span class="chip2">{I("spark",13,style="color:var(--ink-purple)")}也可以对 AI 说「晚上别推测试结果」</span></div></header>
<div class="col g14 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="card" style="padding:12px 16px 6px"><div class="row g10"><span class="sec grow">什么事通知我</span><span class="f12 t3" style="width:110px;text-align:center">PC 桌面提醒</span><span class="f12 t3" style="width:110px;text-align:center">手机推送</span></div>{rows}
    <div class="row g6 f12 t3" style="padding:8px 0 4px;border-top:1px solid var(--hair)">{I("lock",12)}发布失败和回滚结果关不掉，出了问题一定要有人知道</div></div>
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:12px 16px 4px"><div class="sec">已登录的设备</div>
      {dev("phone","iPhone 15","今天 15:01 · 家里 Wi-Fi","推送已开启","green","发条测试通知")}
      {dev("monitor","MacBook Pro","在线 · 公司网络","桌面提醒已允许","green","发条测试通知")}
      {dev("phone","iPad","3 天前","没开推送权限","orange","怎么打开 ›")}</div>
    <div class="card" style="width:300px;flex:none;padding:12px 16px"><div class="row"><span class="sec grow">免打扰</span>{T(True)}</div>
      <div class="row g8" style="margin-top:12px"><span class="chip2 mono">22:00</span><span class="t3">到</span><span class="chip2 mono">08:00</span><span class="f12 t3">每天</span></div>
      <div class="f12 t2" style="margin-top:12px;line-height:1.6">这段时间只推 <b>P1 单</b>和<b>发布失败</b>，其余早上 8 点汇总成一条。</div></div>
  </div>
</div>
</main>'''
    def ban(t, b, s):
        return f'''<div style="padding:10px 12px;border-radius:16px;background:var(--glass-2);box-shadow:0 6px 18px -8px rgba(0,0,0,.25);margin-top:10px">
  <div class="row g8"><span style="width:20px;height:20px;border-radius:6px;background:linear-gradient(160deg,#5B8CFF,#6A3DF0);flex:none"></span><span class="f11 t3 grow">云匠</span><span class="f11 t3">现在</span></div>
  <div class="f13 w7" style="margin-top:6px">{t}</div><div class="f12 t2" style="margin-top:2px">{b}</div><div class="f11 t3" style="margin-top:4px">{s}</div></div>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">通知长这样</div>
  {ban("待我审核 · TK-20871 第 2 轮", "点击分组后界面卡住 · 验证 3/4，1 项待确认", "点开直达这张单的「对话」")}
  {ban("可以复测 · TK-20871", "测试环境 2.18.0-fix.2 已生效 · 账号 kq-staff-03", "点开直达发布详情，带复测步骤")}
  {ban("发布失败 · OKR · 测试环境", "打包上传失败：pnpm build-prod 退出码 1", "点开直达这次报错")}</div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">登录过期了点通知</div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">先登录，再回到原来那张单；没权限的只提示「无权查看」，不露内容。</div></div>''')
    return set_left("通知") + main + right


# =====================================================================
# 边界状态（展示板，2 × 2）
# =====================================================================
def p_edge():
    css = """
.eb{position:absolute;inset:0;padding:26px 30px 28px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px 22px}
.et{display:flex;flex-direction:column;min-height:0}
.el{display:flex;align-items:center;gap:10px;height:34px;flex:none;padding:0 4px}
.el .no{width:22px;height:22px;border-radius:50%;background:var(--text);color:var(--bg,#fff);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}
html.dark .el .no{color:#111}
html:not(.dark) .el .no{color:#fff}
.el b{font-size:16px;font-weight:700}
.el em{font-style:normal;font-size:13px;color:var(--text-3)}
.ep{flex:1;min-height:0;border-radius:22px;display:flex;flex-direction:column;overflow:hidden}
.ein{height:40px;border-radius:11px;background:var(--fill);display:flex;align-items:center;gap:10px;padding:0 12px;font-size:14px}
.ein.fo{box-shadow:0 0 0 2px color-mix(in srgb,var(--blue) 55%,transparent);background:var(--glass-2)}
.bdj{width:18px;height:18px;border-radius:5px;background:linear-gradient(160deg,#4FA3FF,#1D6FE0);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.dots{letter-spacing:3px;font-size:16px;line-height:1}
.ebar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px}
.eb .thead{padding:12px 18px 10px}
.eb .thead h1{font-size:16px}
"""
    def tile(no, name, when, inner):
        return f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div><section class="glass ep">{inner}</section></div>'

    def mini_head(title, meta, pill, tabs_on=None):
        tabs = ""
        if tabs_on:
            tabs = '<div class="row g10" style="margin-top:8px"><div class="tab2">' + "".join(
                f'<span{" class=\"on\"" if n == tabs_on else ""}>{n}{(" <b>" + c + "</b>") if c else ""}</span>'
                for n, c in [("对话", ""), ("代码改动", "3"), ("证据", "4"), ("执行日志", ""), ("发布", "")]) + "</div></div>"
        return f'''<header class="thead"><div class="row g10"><span class="appic ic-tita" style="width:32px;height:32px;font-size:9px;border-radius:9px">TITA</span>
<div class="col grow" style="min-width:0"><h1 class="ell">{title}</h1><div class="f12 t3 ell" style="margin-top:1px">{meta}</div></div>{pill}</div>{tabs}</header>'''

    # 1 无权查看
    t1 = f'''<div class="row grow" style="padding:0 34px;gap:34px;align-items:center">
  <div class="col" style="width:270px;flex:none">
    <span class="ic-box" style="width:60px;height:60px;border-radius:18px;background:linear-gradient(160deg,#FF7A70,#E5372C)">{I("lock",28,2)}</span>
    <div style="font-size:20px;font-weight:800;margin-top:16px">当前账号无权查看这张工单</div>
    <div class="f13 t2" style="margin-top:8px;line-height:1.65">可能换了账号登录，或项目权限已被撤销。<br>工单内容不会显示。</div>
  </div>
  <div class="col grow g12" style="min-width:0">
    <div class="card" style="padding:12px 14px">
      <div class="row g10"><span class="av" style="width:34px;height:34px;font-size:12px;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
        <div class="col grow"><span class="f12 t3">当前登录</span><span class="row g6" style="margin-top:2px"><span class="bdj">J</span><span class="f14 w6">linmo</span></span></div><span class="f13 lnk">换个账号</span></div>
      <div style="height:1px;background:var(--hair);margin:11px 0"></div>
      <div class="row g8 f12 t2">{I("msgq",14,style="color:var(--text-3)")}需要权限请联系项目管理员</div>
    </div>
    <div class="f12 t3" style="line-height:1.6;padding:0 2px">工单列表、搜索和 AI 助手里也查不到这张单。</div>
    <button class="abtn a-sec" style="height:36px;justify-content:center">回到我的工单</button>
  </div>
</div>'''

    # 2 登录过期
    t2 = f'''<div class="row grow" style="padding:0 34px;gap:34px;align-items:center">
  <div class="col" style="width:250px;flex:none">
    <img src="logo.svg" width="64" height="64" alt="" style="margin-left:-4px">
    <div style="font-size:20px;font-weight:800;margin-top:12px">登录已过期</div>
    <div class="f13 t2" style="margin-top:6px">重新登录后，直接回到刚才的页面</div>
    <div class="card" style="padding:10px 12px;margin-top:16px"><div class="row g10"><span class="ic-box" style="width:30px;height:30px;background:linear-gradient(160deg,#6CC4FF,#1673FF)">{I("bell",15)}</span>
      <div class="col grow"><span class="f11 t3">你点开的链接</span><span class="row g6"><span class="mono f13 w6">TK-20871</span><span class="f12 t2">发布 · 等复测</span></span></div>{I("lock",14,style="color:var(--text-3)")}</div>
      <div class="f11 t3" style="margin-top:7px">登录前不显示工单内容</div></div>
  </div>
  <div class="col grow g10" style="min-width:0">
    <div class="ein"><span class="bdj">J</span><span class="grow">linmo</span><span class="f13 lnk">换账号</span></div>
    <div class="ein fo">{I("lock",15,style="color:var(--text-3)")}<span class="dots grow">●●●●●●●●</span>{I("eye",15,style="color:var(--text-3)")}</div>
    <button class="abtn a-pri" style="height:40px;justify-content:center;margin-top:4px">登录并回到 TK-20871</button>
    <div class="f12 t3" style="text-align:center">换成别的账号登录时，不会打开这张单</div>
    <div class="row g8 f12 t2" style="margin-top:4px;padding:8px 10px;border-radius:10px;background:var(--fill)">{I("edit",13,style="color:var(--text-3)")}<span class="grow">没发出去的回复存在本机，登录后还在</span></div>
  </div>
</div>'''

    # 3 状态已经变了
    t3 = mini_head("审批中心：发起审批时点击分组，界面卡住", 'TK-20871 · 修复人 林某 · 第 2 轮', '<span class="pill p-green" style="flex:none">审核通过 · 发测试中</span>') + f'''
<div class="col grow g10" style="padding:12px 18px 0;min-height:0">
  <div class="row" style="justify-content:flex-end"><div class="col" style="align-items:flex-end;gap:4px">
    <span class="f11 t3">你 · 在昨天的对话里</span>
    <span style="padding:8px 12px;border-radius:14px 14px 4px 14px;background:var(--btn-pri-bg);color:#fff;font-size:13px">打回吧，分组按钮点完还是会闪一下</span></div></div>
  <div class="row g10" style="align-items:flex-start">
    <span class="aid" style="margin-top:2px">{I("spark",13)}</span>
    <div class="card col g8 grow" style="padding:11px 13px;min-width:0">
      <div class="row g8"><span class="tag tg-o">状态已经变了</span><span class="f13 w6">这一轮没有打回，什么也没改</span></div>
      <div class="f13 t2" style="line-height:1.6">第 2 轮 <span class="mono">a3f9c21</span> 今天 14:20 已由你审核通过，合入测试分支，正在发测试环境。</div>
      <div class="row g8"><span class="btn2 sm a-sec" style="background:var(--fill)">去「发布」看进度</span><span class="btn2 sm a-sec" style="background:var(--fill)">复测时让王某重点看这点</span></div>
    </div>
  </div>
  <span class="grow"></span>
  <div class="row g8 f12 t2" style="margin:0 0 2px 34px;padding:8px 12px;border-radius:10px;background:var(--fill)">{I("refresh",13,style="color:var(--text-3)")}<span class="grow">页面上的旧按钮也一样：点了先刷新，提示「已由某某处理」，不会重复执行</span></div>
</div>
<div class="row g8" style="margin:8px 14px 12px;height:40px;padding:0 6px 0 10px;border-radius:13px;background:var(--fill)"><span class="aid" style="width:20px;height:20px;border-radius:6px">{I("spark",11)}</span><span class="f12 w6">本单 AI</span><span class="mono f11 t3">TK-20871</span><span class="f13 t3 grow ell">问这张单…</span></div>'''

    # 4 审核中有新提交
    t4 = mini_head("审批中心：发起审批时点击分组，界面卡住", 'TK-20871 · 修复人 林某 · 第 2 轮', '<span class="pill p-blue" style="flex:none">待我审核 · 第 2 轮</span>', "代码改动") + f'''
<div class="col grow g6" style="padding:10px 18px 0;min-height:0">
  <div class="ebar" style="padding:8px 14px;background:color-mix(in srgb,var(--orange) 13%,transparent)">{I("git",16,style="color:var(--ink-orange)")}
    <div class="col grow" style="min-width:0"><span class="f13 w6">Bot 刚又提交了 <span class="mono">b71e0d2</span></span><span class="f12 t2">15:06 · 1 个文件 · 你正在看的是 <span class="mono">a3f9c21</span></span></div>
    <span class="btn2 sm a-sec" style="background:var(--glass-2)">只看新增的</span><span class="btn2 sm a-pri">切到最新</span></div>
  <div class="col" style="gap:2px">
    <div class="row g8" style="padding:3px 10px;border-radius:10px"><span class="st st-m" style="width:16px;height:16px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center">M</span><span class="f13 w6">GroupPicker.tsx</span><span class="tag tg-o">有新改动 · 要重看</span><span class="grow"></span><span class="f11 num" style="color:var(--ink-green)">+1</span><span class="f11 num" style="color:var(--ink-red)">−1</span></div>
    <div class="row g8" style="padding:3px 10px;border-radius:10px"><span class="st st-m" style="width:16px;height:16px;border-radius:4px;font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center">M</span><span class="f13 w6">useMembers.ts</span><span class="tag tg-g">已看 · 没变</span><span class="grow"></span><span class="f11 t3">保留已看</span></div>
  </div>
  <div class="mono" style="font-size:11.5px;line-height:21px;border-radius:10px;overflow:hidden;border:1px solid var(--hair)">
    <div class="hunk"><span>b71e0d2 新增 · GroupPicker.tsx</span></div>
    <div class="cl del"><span class="n">53</span><span class="s">−</span><span class="c">  setLoading(true);</span></div>
    <div class="cl add"><span class="n">53</span><span class="s">+</span><span class="c">  if (!members.length) setLoading(true);</span></div>
  </div>
</div>
<div class="row g8" style="padding:10px 18px;border-top:1px solid var(--hair)">
  <span class="f12 t3 grow">要通过的是最新的 <span class="mono">b71e0d2</span></span>
  <button class="abtn a-red" style="height:36px;font-size:13px">{I("undo",13)}打回</button>
  <button class="abtn a-sec" style="height:36px;font-size:13px;opacity:.55">{I("check",14,2.6)}看完新改动才能通过</button></div>'''

    body = '<div class="eb">' + tile(1, "无权查看", "换了账号，或项目权限被撤销", t1) + tile(2, "登录过期", "点链接或通知时，登录后回原处", t2) \
        + tile(3, "状态已经变了", "旧对话、旧页面里的操作不改写已有结果", t3) + tile(4, "审核中有新提交", "通过的永远是最新的那个提交", t4) + "</div>"
    return (body, css)


# =====================================================================
# 链路补图（docs/05 第五节）：修复中 · 发测试前 · 合回主分支 MR 审核 · 待原平台确认
# =====================================================================
EMPTY_CK = '<span class="ck" style="background:var(--fill)"></span>'
NB2 = '<span style="width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--purple) 14%,transparent);color:var(--ink-purple);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none">{}</span>'


def _pipe(steps):
    out = []
    for i, (n, s, t) in enumerate(steps):
        if s == "ask":
            dot = f'<span class="pdot" style="background:var(--orange);box-shadow:0 0 0 5px color-mix(in srgb,var(--orange) 22%,transparent)">{i+1}</span>'
            out.append(f'<div class="pst">{dot}<span class="f13 w6" style="color:var(--ink-orange)">{n}</span><span class="f11 t3">{t}</span></div>')
            continue
        g = "✓" if s == "ok" else (I("loader", 14, 2.6) if s == "run" else str(i + 1))
        out.append(f'<div class="pst{" done" if s=="ok" else ""}"><span class="pdot pd-{s}">{g}</span><span class="f13 w6">{n}</span><span class="f11 t3">{t}</span></div>')
    return '<div class="card" style="padding:16px 10px 12px"><div class="pipe">' + "".join(out) + "</div></div>"


def _env(name, cur, nxt, state, stc, note, grad, dim=False, nxt_mono=True):
    if nxt:
        nx = f'<span class="{"mono f15 w7" if nxt_mono else "f13 w6"}" style="color:var(--ink-blue)">{nxt}</span>'
        ver = f'<span class="mono f15 w6">{cur}</span><span class="t3">{I("arrowr",14)}</span>{nx}'
    else:
        ver = f'<span class="mono f15 w6">{cur}</span>'
    return f'''<div class="col g6" style="flex:1;min-width:0{";opacity:.8" if dim else ""}">
  <div class="row g8"><span class="ic-box" style="width:22px;height:22px;border-radius:7px;background:{grad}">{I("server",12)}</span><span class="f13 w7">{name}</span><span class="tag tg-{stc}">{state}</span></div>
  <div class="row g8">{ver}<span class="f12 t3 grow ell" style="text-align:right">{note}</span></div></div>'''


TEST_G = "linear-gradient(160deg,#4FD6E6,#16A3C0)"
PROD_G = "linear-gradient(160deg,#5AC8FA,#007AFF)"
GRAY_G = "linear-gradient(160deg,#A9AEB8,#6E737D)"


def _rows(rows):
    return "".join(f'<tr><td class="w6{" t3" if dim else ""}">{a}</td><td class="{"t3" if dim else "t2"}">{b}</td><td class="mono f12 t3">{c}</td><td>{d}</td></tr>' for a, b, c, d, dim in rows)


def _table(rows, note="每步单独记录 · 失败从失败处重试"):
    return f'''<div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">阶段明细</span><span class="f12 t3">{note}</span></div>
    <style>.tbl.tc td{{padding:7px 10px;white-space:nowrap}}</style><table class="tbl tc"><thead><tr><th style="width:15%">阶段</th><th>做了什么</th><th style="width:16%">时间</th><th style="width:11%">结果</th></tr></thead><tbody>{_rows(rows)}</tbody></table></div>'''


def _crow(ck, title, sub, link=""):
    return f'''<div class="row g10" style="padding:10px 0;border-top:1px solid var(--hair)">{ck}<div class="col grow" style="min-width:0"><span class="f13 w6">{title}</span><span class="f12 t3 ell">{sub}</span></div>{f'<span class="f12 lnk" style="flex:none">{link}</span>' if link else ""}</div>'''


def _prod_card(c1, c2, c3, label3="合回主分支 · MR 审核通过", on=False):
    def r(ok, t):
        return f'<div class="row g8 f13" style="padding:5px 0">{CK() if ok else EMPTY_CK}<span{"" if ok else " class=\"t2\""}>{t}</span></div>'
    return f'''<div class="card" style="padding:12px 14px"><div class="mini">发布到正式环境</div>
  {r(c1, "代码审核已通过")}{r(c2, "测试环境复测通过")}{r(c3, label3)}
  <button class="abtn {"a-pri" if on else "a-sec"}" style="width:100%;justify-content:center;height:36px;margin-top:8px{"" if on else ";opacity:.55"}">{I("rocket",14)}发布到正式环境</button>
  <div class="f12 t3" style="margin-top:8px">正式发布人：任何人 · 主分支重新打包</div></div>'''


# ---------- 3 Bot 修复中 ----------
def p_working():
    head = ticket_head("对话", title="考勤：导出月报后部门名显示乱码", tid="TK-20840",
                       meta='TK-20840 · <span style="color:var(--ink-orange)">P2</span> · 考勤 / 月报导出 · 修复人 林某 · 执行 Bot-02',
                       pill=("p-teal", "AI 修复中 · 第 1 轮"))
    head = head.replace('class="pill p-teal" style="flex:none"', 'class="pill" style="flex:none;color:var(--ink-teal);background:color-mix(in srgb,var(--teal) 15%,transparent)"')
    steps = [("ok", "读工单"), ("ok", "复现"), ("ok", "定位"), ("ok", "改代码"), ("ok", "试构建"), ("run", "修后验证")]
    sb = "".join(f'<span style="white-space:nowrap" class="stp{" w6" if s=="run" else ""}"{" style=\"color:var(--ink-teal)\"" if s=="run" else ""}>{CK() if s=="ok" else I("loader",14,2.6)}{n}</span>' for s, n in steps)
    acts = [("15:31", "用 hr-admin-02 登录测试环境", "ok"), ("15:33", "导出「研发中心」考勤月报", "ok"), ("15:34", "打开 Excel，核对「部门」列", "ok"), ("15:35", "导出「全公司」· 你刚才的补充", "run")]
    al = "".join(f'<div class="row g8 f12" style="padding:4px 0"><span class="mono t3" style="width:38px">{t}</span>{CK() if s=="ok" else I("loader",13,2.6,style="color:var(--ink-teal)")}<span class="{"t2" if s=="ok" else "w6"}"{" style=\"color:var(--ink-teal)\"" if s=="run" else ""}>{a}</span></div>' for t, a, s in acts)
    main = f'''<main class="glass pn grow" style="min-width:0">
{head}
<div class="col g12 grow" style="padding:12px 26px 6px;min-height:0;justify-content:flex-end;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 56px);mask-image:linear-gradient(180deg,transparent 0,#000 56px)">
  <div class="card flat" style="padding:12px 16px;margin-left:40px">
    <div class="row g8"><span class="sc10 sc-t">Tita</span><span class="f13 w7 grow">原单 · 客户反馈</span><span class="f12 t3">反馈人 赵磊 · 今天 13:50 · 附件 1</span></div>
    <div class="f13 t2" style="margin-top:6px;line-height:1.6">考勤月报导出 Excel，打开后「部门」一列全是乱码，姓名和出勤天数正常。正式环境 2.17.4。</div>
  </div>
  <div class="divd">第 1 轮 · 今天 14:05 开始 · Bot-02</div>
  <div class="row g10" style="align-items:flex-start"><span class="botav">{I("bot",16)}</span>
    <div class="col g10 grow" style="min-width:0">
      <div class="row g12" style="padding:8px 12px;border-radius:12px;background:var(--fill);white-space:nowrap">{sb}<span class="grow"></span><span class="f12 t3">已用 1 小时 30 分</span></div>
      <div class="card" style="padding:14px 16px;border-radius:20px;box-shadow:0 0 0 2px color-mix(in srgb,var(--teal) 50%,transparent),0 14px 30px -18px rgba(48,176,199,.6)">
        <div class="row g8"><span class="ic-box" style="width:26px;height:26px;border-radius:8px;background:var(--teal)">{I("eye",15,2.2)}</span><span class="f15 w7 grow">正在做：修后浏览器验证</span><span class="f12 t3">验证 3 / 4 · 测试环境</span></div>
        <div class="row g16" style="margin-top:10px;align-items:flex-start">
          <div class="col" style="flex:none"><div style="width:210px;border-radius:10px;overflow:hidden;border:1px solid var(--hair);background:var(--glass-2);font-size:11.5px">
            <div class="row g6" style="padding:5px 8px;background:color-mix(in srgb,var(--green) 14%,transparent)"><span style="width:10px;height:10px;border-radius:2px;background:#1E8E3E"></span><span class="w6 f11">考勤月报-全公司.xlsx</span></div>
            <div style="display:grid;grid-template-columns:52px 1fr 40px"><span style="padding:4px 8px;border-top:1px solid var(--hair);font-weight:600;color:var(--text-3)">姓名</span><span style="padding:4px 8px;border-top:1px solid var(--hair);font-weight:600;color:var(--text-3)">部门</span><span style="padding:4px 8px;border-top:1px solid var(--hair);font-weight:600;color:var(--text-3)">出勤</span><span style="padding:4px 8px;border-top:1px solid var(--hair)">张伟</span><span style="padding:4px 8px;border-top:1px solid var(--hair);background:color-mix(in srgb,var(--green) 10%,transparent)">研发中心</span><span style="padding:4px 8px;border-top:1px solid var(--hair)">22</span><span style="padding:4px 8px;border-top:1px solid var(--hair)">李娜</span><span style="padding:4px 8px;border-top:1px solid var(--hair);background:color-mix(in srgb,var(--green) 10%,transparent)">产品部</span><span style="padding:4px 8px;border-top:1px solid var(--hair)">21</span><span style="padding:4px 8px;border-top:1px solid var(--hair)">…</span><span style="padding:4px 8px;border-top:1px solid var(--hair)">…</span><span style="padding:4px 8px;border-top:1px solid var(--hair)">…</span></div>
            <div class="f11" style="padding:4px 8px;color:var(--ink-teal);border-top:1px solid var(--hair)">实时画面 · 15:35</div></div></div>
          <div class="col grow" style="min-width:0">{al}</div>
        </div>
        <div class="row g8 f12 t2" style="margin-top:8px;padding-top:9px;border-top:1px solid var(--hair)">已做完：修前复现 1 张截图 · 根因在导出时没写 UTF-8 BOM · 改了 2 个文件 <span class="mono">7c2e1a9</span><span class="grow"></span><span class="lnk">展开过程 ›</span></div>
      </div>
    </div>
  </div>
  <div class="row" style="justify-content:flex-end"><div class="col" style="align-items:flex-end;gap:4px"><span class="f11 t3">你 · 15:28</span>
    <span style="padding:9px 14px;border-radius:18px 18px 6px 18px;background:linear-gradient(180deg,#3B8BFF,#1F6FFF);color:#fff;font-size:14px">顺便看下导出「全公司」的时候也正常吗</span></div></div>
  <div class="row g10" style="align-items:flex-start"><span class="botav">{I("bot",16)}</span>
    <div class="row g8" style="padding:9px 14px;border-radius:14px;background:var(--glass-2);border:1px solid var(--stroke)"><span class="tag tg-g">已采纳</span><span class="f13">加进本轮验证，多测一项「全公司」导出，不重新开始。</span></div></div>
</div>
{composer("TK-20840")}
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">经过</div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--green)"></span><i></i></div><div style="padding-bottom:8px"><div class="f13 w6">接单 · 已通知你</div><div class="f12 t3">14:02 · 节点「AI干活」</div></div></div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--green)"></span><i></i></div><div style="padding-bottom:8px"><div class="f13 w6">复现到了</div><div class="f12 t3">14:31 · 修前截图 1 张</div></div></div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--green)"></span><i></i></div><div style="padding-bottom:8px"><div class="f13 w6">改代码 · 试构建通过</div><div class="f12 t3">15:20 · <span class="mono">7c2e1a9</span></div></div></div>
  <div class="tlx"><div class="rail"><span class="bul" style="background:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 20%,transparent)"></span></div><div><div class="f13 w6" style="color:var(--ink-teal)">修后验证中</div><div class="f12 t3">3 / 4 · 还要约 5 分钟</div></div></div></div>''',
        f'''<div class="card" style="padding:8px 14px"><div class="mini" style="margin:4px 0 2px">本轮采用</div>
  <div class="kv2"><span class="t2">工单材料</span><span class="f12 t3">原单 + 附件 1</span></div>
  <div class="kv2"><span class="t2">你的补充</span><span class="f12" style="color:var(--ink-green)">1 条 · 已采纳</span></div>
  <div class="kv2"><span class="t2">验证账号</span><span class="f12 mono">hr-admin-02</span></div>
  <div class="kv2"><span class="t2">验证 Skill</span><span class="f12">页面交互回归 v1</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">接下来</div>
  <div class="f12 t2" style="line-height:1.7">验证完交付第 1 轮，通知你审核。<br>受阻会停下来问你，不会自己猜。</div>
  <div class="row g8" style="margin-top:10px"><span class="btn2 sm a-sec" style="background:var(--fill);flex:1">我来接手</span><span class="btn2 sm a-sec" style="background:var(--fill);flex:1">停止本轮</span></div></div>''')
    return ticket_list("20840") + main + right


# ---------- 5 发测试 · 发布前 ----------
def p_pubbefore():
    head = ticket_head("发布", pill=("p-green", "审核通过 · 第 2 轮"))
    subrow = f'''  <div class="row g10"><span class="f16 w7">第 2 轮 → 测试环境</span><span class="f12 t3 grow">还没开始 · 你 14:48 审核通过 <span class="mono">a3f9c21</span></span><span class="f12 lnk">历次发布 1 ›</span>
    <span class="pill" style="color:var(--text-2);background:var(--fill)">发布前</span></div>
'''
    env = f'''<div class="card row g16" style="padding:12px 16px;align-items:stretch">{_env("测试环境","2.18.0-fix.1","打包后读出","等你发起","o","第 1 轮版本",TEST_G,nxt_mono=False)}<span style="width:1px;background:var(--hair)"></span>{_env("正式环境","2.17.4","","未发布","n","测试通过 → 合回主分支 → 重新打包",GRAY_G,True)}</div>'''
    pipe = _pipe([("合入测试分支", "wait", "MR · 陈某审核"), ("打包上传", "wait", "tita build"), ("发布到测试", "wait", "tita release"), ("核对生效", "wait", "读 Apollo 提交号"), ("通知测试人", "wait", "对上后发送")])
    left = (_crow(CK("blue", "1"), "本单改动会提 MR 到 dev-approval", 'a3f9c21 · 3 个文件 · 审核人 陈某（项目设置）')
            + _crow(CK("orange", "!"), "测试分支上已有别人的 4 个提交", "来自 TK-20802 等 2 单 · 会一起打进包里", "查看 ›"))
    tester = f'''<div class="card" style="width:300px;flex:none;padding:14px 16px;display:flex;flex-direction:column">
      <div class="row g8"><span class="sec grow">测试人</span><span class="f11 t3">Tita 单没有提单测试人</span></div>
      <div class="row g10" style="margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--glass-2);box-shadow:0 0 0 2px var(--blue)"><span class="av" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">王某</span><span class="f11 t3">第 1 轮复测人 · 账号 kq-staff-03</span></div>{I("chevd",14,style="color:var(--text-3)")}</div>
      <span class="grow"></span>
      <button class="abtn a-pri" style="width:100%;justify-content:center;height:36px;margin-top:10px">{I("pkg",14)}发布到测试环境</button>
      <div class="row g6 f12 t3" style="margin-top:8px">{I("key",12)}<span class="grow">用你的 Apollo 账号 <span class="mono t2">lin.x</span></span><span class="lnk">改 ›</span></div>
      <div class="f12 t3" style="margin-top:7px;line-height:1.5">发测试的人：修复人（项目可改）· 关掉也会继续</div>
    </div>'''
    rows = [("合入测试分支", 'MR <span class="mono">a3f9c21</span> → <span class="mono">dev-approval</span>，等陈某审核', "—", '<span class="tag tg-n">等待</span>', False),
            ("打包上传", '<span class="mono">tita build</span> · 在测试分支上', "—", '<span class="tag tg-n">等待</span>', False),
            ("发布到测试", '<span class="mono">tita release --app www --env TEST</span>', "—", '<span class="tag tg-n">等待</span>', False),
            ("核对生效", "Apollo TEST 的提交号要和本次打包一致", "—", '<span class="tag tg-n">等待</span>', False)]
    main = f'''<main class="glass pn grow" style="min-width:0">
{head}
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
{subrow}  {env}
  {pipe}
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:14px 16px 6px;min-width:0"><div class="row g8" style="margin-bottom:6px"><span class="sec grow" style="white-space:nowrap">这次会发出去的包</span><span class="f12 t3 mono">dev-approval@4b70d13</span></div>{left}</div>
    {tester}
  </div>
  {_table(rows, "点发布后每步单独记录")}
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">测试记录</div>
  <div class="row g8" style="padding:6px 0"><span class="tag tg-r">打回</span><span class="mono f12">2.18.0-fix.1</span><span class="f12 t3 grow" style="text-align:right">王某 · 昨天</span></div>
  <div class="f12 t3" style="margin-top:2px">“第二个分组还是卡” · 已归入第 1 轮</div></div>''',
        _prod_card(True, False, False),
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行日志</div>
  <div class="f12 t3" style="padding:4px 0">还没开始，点发布后在这里滚动显示</div></div>''')
    tl = ticket_list().replace("第 2 轮交付 · 验证 3/4", "审核通过 · 等发测试")
    return tl + main + right


# ---------- 10 合回主分支 · MR 审核 ----------
def p_mrmain():
    lst = pub_list("pub3").replace("测试已通过 · 待合回主分支", "等你审核 MR · 合回主分支")
    pipe = _pipe([("合回主分支", "ask", "等你审核 MR !322"), ("打包上传", "wait", "tita build"), ("发布到正式", "wait", "tita release"), ("核对生效", "wait", "读 Apollo 提交号"), ("通知", "wait", "对上后发送")])
    env = f'''<div class="card row g16" style="padding:12px 16px;align-items:stretch">{_env("正式环境","2.17.4","合入后重新打包","未发布","n","在 master 上打包",PROD_G,nxt_mono=False)}<span style="width:1px;background:var(--hair)"></span>{_env("测试环境","2.18.0-fix.1","","复测通过","g","王某 · 今天 11:20",TEST_G,True)}</div>'''
    files = [("ApprovalRevoke.tsx", "+12", "−3"), ("useApprovalState.ts", "+5", "−1")]
    fl = "".join(f'<div class="row g8" style="padding:4px 0 4px 30px"><span class="st st-m" style="width:15px;height:15px;border-radius:4px;font-size:9.5px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center">M</span><span class="f12 mono">{n}</span><span class="f11 num" style="color:var(--ink-green)">{a}</span><span class="f11 num" style="color:var(--ink-red)">{d}</span></div>' for n, a, d in files)
    left = (_crow(CK(), "本单改动和测试时一样", '2 个文件 · 和测过的 2.18.0-fix.1 逐行一致', "看逐行 ›")
            + _crow(CK("orange", "!"), "还会带上别人的 1 个提交", "TK-20802 列表排序 · 已在测试环境测过", "查看 ›"))
    review = f'''<div class="card" style="width:300px;flex:none;padding:14px 16px;display:flex;flex-direction:column;box-shadow:0 0 0 2px color-mix(in srgb,var(--orange) 55%,transparent)">
      <div class="row g8"><span class="sec grow">MR 审核</span><span class="tag tg-o">等你</span></div>
      <div class="row g10" style="margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--fill)"><span class="av" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#FFC9A8,#F08F7A);color:#5A2414">林</span><div class="col grow"><span class="f13 w6">你 · 林某</span><span class="f11 t3">项目设的「合回主分支」审核人</span></div></div>
      <span class="grow"></span>
      <div class="row g8" style="margin-top:12px"><button class="abtn a-red" style="height:36px;flex:none;padding:0 14px">{I("undo",14)}打回</button><button class="abtn a-pri" style="height:36px;flex:1;justify-content:center;padding:0 10px">{I("check",15,2.6)}通过并合入</button></div>
      <div class="row g6 f12 t3" style="margin-top:8px">{I("key",12)}<span class="grow">用你的 GitLab 账号 <span class="mono t2">lin.x</span> 合入</span><span class="lnk">改 ›</span></div>
      <div class="f12 t3" style="margin-top:6px;line-height:1.5">打回到修复人和 Bot，改了要重新测</div>
    </div>'''
    rows = [("合回主分支", 'MR <span class="mono">!322</span> <span class="mono">fix/TK-20790</span> → <span class="mono">master</span> · 等林某审核', "11:32 提交", '<span class="tag tg-o">等审核</span>', False),
            ("打包上传", '<span class="mono">tita build</span> · 合入后在 master 上重新打包', "—", '<span class="tag tg-n">等待</span>', True),
            ("发布到正式", '<span class="mono">tita release --app www --env PROD</span>', "—", '<span class="tag tg-n">等待</span>', True),
            ("核对生效", "Apollo PROD 的提交号要和本次打包一致", "—", '<span class="tag tg-n">等待</span>', True)]
    main = f'''<main class="glass pn grow" style="min-width:0">
{pub_head(PROD_G, "rocket", "TK-20790 第 1 轮 → 正式环境", "发布任务 R-0415 · 王某 11:20 复测通过 · 林某 11:30 点了「合回主分支」", pill_c("orange", "等你审核 MR"), tk_bar("审批单撤回后状态错乱", "TK-20790 · 测试通过 · 修复人 林某"))}
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  {env}
  {pipe}
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:14px 16px 6px;min-width:0"><div class="row g8" style="margin-bottom:6px"><span class="sec grow">和测试时比</span><span class="f12 t3"><span class="mono">!322 → master</span> · 无冲突 · 试构建通过</span></div>{left}</div>
    {review}
  </div>
  {_table(rows)}
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">测试记录</div>
  <div class="row g8" style="padding:6px 0"><span class="tag tg-g">通过</span><span class="mono f12">2.18.0-fix.1</span><span class="f12 t3 grow" style="text-align:right">王某 · 11:20</span></div>
  <div class="f12 t3" style="margin-top:2px">“撤回后状态正常，列表也刷新了”</div></div>''',
        _prod_card(True, True, False, "合回主分支 · 等你审核"),
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行日志 · 最后 3 行</div>
  <div class="log t2"><div class="ln"><span class="ts">11:30:12</span>林某点合回主分支 → 提 MR</div><div class="ln"><span class="ts">11:32:40</span>试合并 master · 无冲突</div><div class="ln"><span class="ts">11:33:02</span>已通知林某审核</div></div>
  <div class="f12 lnk" style="margin-top:6px">查看完整日志 ›</div></div>''')
    return lst + main + right


# ---------- 13 待原平台确认 ----------
def p_confirm():
    head = ticket_head("对话", title="审批单撤回后状态错乱", tid="TK-20790",
                       meta='TK-20790 · <span style="color:var(--ink-orange)">P2</span> · 审批 / 撤回 · 修复人 林某 · 执行 Bot-01',
                       pill=("p-green", "审核通过 · 待原平台确认"))
    st = lambda c, t, s: f'<div class="row g10" style="padding:7px 12px;border-radius:12px;background:var(--fill)">{CK(c) if c else EMPTY_CK}<span class="f13 w6">{t}</span><span class="grow"></span><span class="f12 t3">{s}</span></div>'
    main = f'''<main class="glass pn grow" style="min-width:0">
{head}
<div class="col g12 grow" style="padding:12px 26px 6px;min-height:0;justify-content:flex-end;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 56px);mask-image:linear-gradient(180deg,transparent 0,#000 56px)">
  <div class="card flat" style="padding:12px 16px;margin-left:40px">
    <div class="row g8"><span class="sc10 sc-t">Tita</span><span class="f13 w7 grow">原单 · 客户反馈</span><span class="f12 t3">反馈人 孙浩 · 昨天 09:40</span></div>
    <div class="f13 t2" style="margin-top:6px;line-height:1.6">审批单撤回后，列表里还显示「审批中」，刷新才变成「已撤回」。</div>
  </div>
  <div class="row g10" style="align-items:flex-start"><span class="botav">{I("bot",16)}</span>
    <div class="card row g12 grow" style="padding:11px 14px;min-width:0"><span class="f14 w7">第 1 轮交付</span><span class="f12 t2 grow ell">根因：撤回后没刷新本地状态缓存 · 2 个文件 · 修前修后截图 2</span><span class="tag tg-g">你已通过</span><span class="f12 lnk">展开 ›</span></div></div>
  <div class="divd">审核通过之后 · <span class="mono">c71a5e0</span></div>
  <div class="row g10" style="align-items:flex-start"><span class="botav">{I("bot",16)}</span>
    <div class="col g8 grow" style="min-width:0">
      {st("green", "发到测试环境 2.18.0-fix.1", "王某 今天 11:20 复测通过")}
      {st("green", "合回 master · MR !322", "林某 11:40 审核通过")}
      {st(None, "发布到正式环境", "等发布人点发布")}
    </div></div>
  <div class="row g10" style="align-items:flex-start"><span class="botav">{I("bot",16)}</span>
    <div class="card grow" style="padding:16px 18px;border-radius:20px;box-shadow:0 0 0 2px color-mix(in srgb,var(--purple) 45%,transparent),0 14px 30px -18px rgba(175,82,222,.5)">
      <div class="row g8"><span class="ic-box" style="width:26px;height:26px;border-radius:8px;background:var(--purple)">{I("check",15,2.4)}</span><span class="f15 w7 grow">还差一件事：回 Tita 原单确认</span><span class="f12 t3">审核通过时生成 · 和发布并行</span></div>
      <div class="col g8" style="margin-top:12px">
        <div class="row g10 f13">{NB2.format(1)}打开 Tita 原单（会在新窗口打开，工作台不替你点）</div>
        <div class="row g10 f13">{NB2.format(2)}在「AI干活」节点点「已完成」，之后的复测、关单按 Tita 原流程走</div>
        <div class="row g10 f13">{NB2.format(3)}回到这里点「我已在原单确认」</div>
      </div>
      <div class="row g8" style="margin-top:14px"><span class="btn2 a-sec" style="background:var(--fill)">打开 Tita 原单 ↗</span><span class="btn2 a-pri">{I("check",14,2.6)}我已在原单确认</span><span class="grow"></span><span class="f12 t3">只打开链接不算确认</span></div>
    </div></div>
</div>
{composer("TK-20790")}
</main>'''
    main = main.replace("<style>", "")
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">修复完成 · 由你点</div>
  <div class="row g8 f13" style="padding:6px 0">{EMPTY_CK}<span class="grow">正式环境已生效</span><span class="f12 t3">等发布</span></div>
  <div class="row g8 f13" style="padding:6px 0;border-top:1px solid var(--hair)">{EMPTY_CK}<span class="grow">原平台已确认</span><span class="f12" style="color:var(--ink-purple)">等你</span></div>
  <button class="abtn a-sec" style="width:100%;justify-content:center;height:36px;margin-top:8px">{I("check",14,2.6)}修复完成</button>
  <div class="f12 t3" style="margin-top:7px;line-height:1.5">工单负责人点了才算完成；还有没做完的会再提醒一次</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">环境版本</div>
  <div class="kv2"><span class="t2">测试环境</span><span class="f12"><span class="mono">2.18.0-fix.1</span> · 复测通过</span></div>
  <div class="kv2"><span class="t2">正式环境</span><span class="f12"><span class="mono">2.17.4</span> · 等发布</span></div>
  <div class="kv2"><span class="t2">测试人</span><span class="f12">王某</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">确认之后</div>
  <div class="f12 t2" style="line-height:1.7">记下你和确认时间。<br>之后再被采集也不会重开一轮。<br>Tita 打不开时，待办一直保留。</div></div>''')
    return ticket_list("20790") + main + right


# ---------- 9 → 10 复测通过 · 等修复人点「合回主分支」 ----------
def p_pubpassed():
    head = ticket_head("发布", title="审批单撤回后状态错乱", tid="TK-20790",
                       meta='TK-20790 · <span style="color:var(--ink-orange)">P2</span> · 审批 / 撤回 · 修复人 林某 · 执行 Bot-01',
                       pill=("p-green", "审核通过 · 复测通过"))
    subrow = f'''  <div class="row g10"><span class="f16 w7">第 1 轮 → 测试环境</span><span class="f12 t3 grow">发布任务 R-0409 · 已生效 · 王某 11:20 复测通过</span><span class="f12 lnk">历次发布 1 ›</span>
    {pill_c("green", "复测通过")}</div>
'''
    env = f'''<div class="card row g16" style="padding:12px 16px;align-items:stretch">{_env("测试环境","2.18.0-fix.1","","复测通过","g","王某 · 今天 11:20",TEST_G)}<span style="width:1px;background:var(--hair)"></span>{_env("正式环境","2.17.4","","未发布","n","合回主分支 → 审核 → 重新打包",GRAY_G,True)}</div>'''
    pipe = _pipe([("合入测试分支", "ok", "林某审核通过"), ("打包上传", "ok", "tita build · 58 秒"), ("发布到测试", "ok", "tita release · 5 秒"), ("核对生效", "ok", "提交号对上"), ("通知测试人", "ok", "已通知王某")])
    left = (_crow(CK(), "本单改动已在包里", 'MR <span class="mono">!305</span> · 2 个文件 · <span class="mono">c71a5e0</span>')
            + _crow(CK("orange", "!"), "还带了别人的 1 个提交", "TK-20802 列表排序 · 合回时再比一次", "查看 ›"))
    tester = f'''<div class="card" style="width:300px;flex:none;padding:14px 16px">
      <div class="sec">测试人</div>
      <div class="row g10" style="margin-top:10px;padding:8px 10px;border-radius:12px;background:var(--fill)"><span class="av" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">王某</span><span class="f11" style="color:var(--ink-green)">复测通过 · 11:20</span></div></div>
      <div class="f12 t2" style="margin-top:10px;line-height:1.6">“撤回后状态正常，列表也刷新了” · 附录屏 1 段</div>
    </div>'''
    ok = '<span class="tag tg-g">成功</span>'
    rows = [("合入测试分支", 'MR <span class="mono">!305</span> · 林某审核 · 合入后 <span class="mono">d41c0b8</span>', "10:42", ok, False),
            ("打包上传", '<span class="mono">tita build</span> · 产物 <span class="mono">2.18.0-fix.1</span> 已传 OSS', "10:47 – 10:48", ok, False),
            ("发布到测试", '<span class="mono">tita release --app www --env TEST</span>', "10:48", ok, False),
            ("核对生效", 'Apollo TEST 提交号 <span class="mono">d41c0b8</span> · 对上', "10:49", ok, False)]
    main = f'''<main class="glass pn grow" style="min-width:0">
{head}
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
{subrow}  {env}
  {pipe}
  <div class="row g14" style="align-items:stretch">
    <div class="card grow" style="padding:14px 16px 6px;min-width:0"><div class="row g8" style="margin-bottom:6px"><span class="sec grow" style="white-space:nowrap">这次发出去的包</span><span class="f12 t3 mono">dev-approval@d41c0b8</span></div>{left}</div>
    {tester}
  </div>
  {_table(rows)}
</div>
</main>'''
    prod = f'''<div class="card" style="padding:12px 14px;box-shadow:0 0 0 2px color-mix(in srgb,var(--blue) 45%,transparent)"><div class="mini">发布到正式环境</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}代码审核已通过</div>
  <div class="row g8 f13" style="padding:5px 0">{CK()}测试环境复测通过</div>
  <div class="row g8 f13" style="padding:5px 0">{EMPTY_CK}<span class="t2 grow">合回主分支</span><span class="btn2 sm a-pri" style="height:28px;padding:0 12px">合回主分支</span></div>
  <div class="f12 t3" style="margin:4px 0 0 28px;line-height:1.5">点了才提 MR，等林某审核</div>
  <button class="abtn a-sec" style="width:100%;justify-content:center;height:36px;margin-top:10px;opacity:.55">{I("rocket",14)}发布到正式环境</button>
  <div class="f12 t3" style="margin-top:8px">正式发布人：任何人 · 主分支重新打包</div></div>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">测试记录</div>
  <div class="row g8" style="padding:6px 0"><span class="tag tg-g">通过</span><span class="mono f12">2.18.0-fix.1</span><span class="f12 t3 grow" style="text-align:right">王某 · 11:20</span></div>
  <div class="f12 t3" style="margin-top:2px">“撤回后状态正常，列表也刷新了”</div></div>''',
        prod,
        f'''<div class="card" style="padding:12px 14px"><div class="mini">执行日志 · 最后 3 行</div>
  <div class="log t2"><div class="ln"><span class="ts">11:20:31</span>王某复测通过 2.18.0-fix.1</div><div class="ln"><span class="ts">11:20:32</span>已通知林某</div><div class="ln"><span class="ts">11:20:32</span>等林某点合回 …</div></div>
  <div class="f12 lnk" style="margin-top:6px">查看完整日志 ›</div></div>''')
    return ticket_list("20790") + main + right


# ---------- Skills · 版本历史 ----------
def p_skhistory():
    vers = [("v3", "在用 · 审批", "g", "林某 · 11-19", "加：弹窗里的表单也算", True),
            ("v2", "在用 · 考勤", "g", "林某 · 11-15", "加：校验提示用组件自带的", False),
            ("v1", "导入", "n", "林某 · 11-10", "从「团队前端规范.md」导入", False)]
    vl = "".join(f'''<div class="col g4" style="padding:10px 12px;border-radius:14px;{"background:var(--glass-2);box-shadow:0 0 0 2px var(--blue)" if on else ""}">
  <div class="row g8"><span class="f15 w7">{v}</span><span class="tag tg-{c}">{st}</span><span class="grow"></span><span class="f11 t3">{who}</span></div>
  <span class="f12 t2">{note}</span></div>''' for v, st, c, who, note, on in vers)
    diff = [("4", "## 什么时候用", "h"), ("5", "审批、考勤里的表单页面。", ""),
            ("6", "审批、考勤里的表单页面和弹窗。", "add"), ("7", "", ""),
            ("8", "## 规则", "h"), ("9", "1. 优先用 TitaForm 和公司组件库。", ""),
            ("10", "2. 弹窗里的表单也用 TitaForm。", "add"),
            ("11", "3. 校验提示用组件自带的，不另写。", "")]
    dl = "".join(f'<div class="cl{" add" if t=="add" else ""}" style="line-height:24px"><span class="n">{n}</span><span class="s">{"+" if t=="add" else ""}</span><span class="c" style="padding-left:4px;{"color:var(--ink-purple);font-weight:600" if t=="h" else ""}">{c}</span></div>' for n, c, t in diff)
    dl = dl.replace('<div class="cl" style="line-height:24px"><span class="n">5</span><span class="s"></span>', '<div class="cl del" style="line-height:24px"><span class="n">5</span><span class="s">−</span>', 1)
    used = [("TK-20871", "第 2 轮", "v3", "今天 14:10"), ("TK-20871", "第 1 轮", "v2", "昨天 21:52"), ("KQ-1180", "第 1 轮", "v2", "11-16")]
    ul = "".join(f'<tr><td class="mono">{a}</td><td>{b}</td><td><span class="tag tg-n">{c}</span></td><td class="mono f12 t3">{d}</td><td><span class="f12 lnk">看当时正文 ›</span></td></tr>' for a, b, c, d in used)
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(160deg,#5AA0FF,#1F6FFF)">{I("code",20,2)}</span>
  <div class="col grow" style="min-width:0"><h1>复用表单组件 · 版本历史</h1><div class="f12 t3" style="margin-top:2px">编码 Skill · 3 个版本 · 每个项目可以用不同版本 · 改动从下一轮任务开始生效</div></div>
  <span class="btn2 a-sec" style="background:var(--fill)">{I("edit",14)}回到编辑</span></div></header>
<div class="row g14 grow" style="padding:16px 22px;min-height:0;align-items:stretch;overflow:hidden">
  <div class="col g6" style="width:250px;flex:none">{vl}
    <div class="f12 t3" style="padding:8px 12px;line-height:1.6">旧版本不删，进行中的任务和历史轮次都能回看当时的正文。</div></div>
  <div class="col g12 grow" style="min-width:0">
    <div class="col" style="min-height:0"><div class="row g8"><span class="sec grow">v3 相对 v2 改了什么</span><span class="f12 t3">+2 −1</span><span class="seg" style="padding:2px"><span class="on" style="height:24px;padding:0 10px;font-size:12px">只看改动</span><span style="height:24px;padding:0 10px;font-size:12px">完整正文</span></span></div>
      <div class="code" style="margin-top:8px;border-radius:14px;background:var(--glass-2);border:1px solid var(--stroke);padding:8px 0;font-size:12.5px">{dl}</div></div>
    <div class="card" style="padding:12px 16px 4px"><div class="row g8" style="margin-bottom:4px"><span class="sec grow">哪些轮次用过</span><span class="f12 t3">审核人能回看那一轮实际用的规则</span></div>
      <style>.tbl.tu td{{padding:7px 10px;white-space:nowrap}}</style><table class="tbl tu"><thead><tr><th>工单</th><th>轮次</th><th>版本</th><th>时间</th><th></th></tr></thead><tbody>{ul}</tbody></table></div>
  </div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">在哪些项目用</div>
  <div class="kv2"><span class="t2">审批</span><span class="row g6"><span class="tag tg-g">v3</span><span class="f12 t3">最新</span></span></div>
  <div class="kv2"><span class="t2">考勤</span><span class="row g6"><span class="tag tg-o">v2</span><span class="f12 t3">旧一版</span></span></div>
  <div class="kv2"><span class="t2 t3">OKR</span><span class="f12 t3">未启用</span></div></div>''',
        f'''<div class="card" style="padding:12px 14px;box-shadow:0 0 0 2px color-mix(in srgb,var(--blue) 45%,transparent)"><div class="mini">把 v3 用到考勤</div>
  <div class="f12 t2" style="line-height:1.6">考勤现在用 v2。换成 v3 后，从考勤的下一轮任务开始生效；进行中的单仍用 v2。</div>
  <button class="abtn a-pri" style="width:100%;justify-content:center;height:36px;margin-top:10px">启用 v3 到考勤</button>
  <div class="f12 t3" style="margin-top:8px;line-height:1.5">要退回旧版本：选中那一版再点启用</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">来源</div>
  <div class="row g8" style="padding:4px 0">{I("download",14,style="color:var(--text-3)")}<span class="f13 grow">v1 从文件导入</span></div>
  <div class="f12 t3" style="line-height:1.6">团队前端规范.md · 林某 11-10<br>v2、v3 在工作台里改</div></div>''')
    return skills_left("复用表单组件") + main + right


# ---------- Skills · 导入 ----------
def p_skimport():
    body = p_skills()
    prev = [("1", "# 表单开发规范", "h"), ("2", "审批、考勤这类表单页面都按这份来。", ""), ("3", "", ""), ("4", "## 规则", "h"),
            ("5", "1. 表单统一用 TitaForm，不手写 input。", ""), ("6", "2. 测试账号 test01 / ********", "mask")]
    pl = "".join(f'<div class="cl" style="line-height:22px{";background:color-mix(in srgb,var(--orange) 12%,transparent)" if t=="mask" else ""}"><span class="n">{n}</span><span class="c" style="padding-left:8px;{"color:var(--ink-purple);font-weight:600" if t=="h" else ""}">{c}</span></div>' for n, c, t in prev)
    dlg = f'''<div class="scrim"></div>
<div class="dlg" style="left:50%;top:50%;width:680px;transform:translate(-50%,-50%);padding:22px 24px">
  <div class="row g10"><span class="ic-box" style="background:linear-gradient(160deg,#C58BFF,#6A3DF0)">{I("download",16,2.2)}</span><div class="col grow"><span class="f18 w7">导入 Skill</span><span class="f12 t3">导入后先是草稿，在编辑器里看过、启用到项目才生效</span></div><span class="t3">{I("x",18,2)}</span></div>
  <div class="seg" style="margin-top:16px"><span class="on" style="flex:1;justify-content:center">文件 .md / .txt</span><span style="flex:1;justify-content:center">GitLab 文件链接</span><span style="flex:1;justify-content:center">粘贴文字</span></div>
  <div class="row g10" style="margin-top:12px;padding:12px 14px;border-radius:14px;border:1.5px dashed color-mix(in srgb,var(--blue) 45%,transparent);background:color-mix(in srgb,var(--blue) 5%,transparent)">{I("file",18,style="color:var(--ink-blue)")}<div class="col grow"><span class="f13 w6">团队前端规范.md</span><span class="f12 t3">6 KB · 42 行 · 拖进来或点这里换一个</span></div><span class="tag tg-g">已读出</span></div>
  <div class="row g12" style="margin-top:14px">
    <div class="col grow" style="min-width:0"><div class="flabel">名称（取自第一个标题）</div><div class="field">表单开发规范</div></div>
    <div style="width:170px;flex:none"><div class="flabel">类型</div><div class="seg"><span class="on" style="flex:1;justify-content:center">编码</span><span style="flex:1;justify-content:center">验证</span></div></div></div>
  <div class="flabel" style="margin-top:12px">用途（Bot 判断什么时候用，取自第一段，可改）</div><div class="field">审批、考勤这类表单页面都按这份来。</div>
  <div class="row g8" style="margin-top:12px"><span class="flabel grow" style="margin:0">正文预览</span><span class="f12 t3">前 6 行</span></div>
  <div class="code" style="margin-top:6px;border-radius:12px;background:var(--fill);padding:6px 0;font-size:12.5px">{pl}</div>
  <div class="row g8 f12" style="margin-top:10px;padding:8px 12px;border-radius:10px;background:color-mix(in srgb,var(--orange) 12%,transparent);color:var(--ink-orange)">{I("alert",14)}<span class="grow">第 6 行像是账号密码，已换成 ********，不会存进 Skill</span></div>
  <div class="row g10" style="margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--fill)"><span class="f13 w6 grow">和「复用表单组件」内容很像</span>
    <span class="row g6 f13"><span class="radio on"></span>新建一个 Skill</span><span class="row g6 f13" style="margin-left:10px"><span class="radio"></span>作为它的 v4</span></div>
  <div class="row g10" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--hair)"><span class="f12 t3 grow">导入不会启用到任何项目</span><span class="btn2 a-sec" style="background:var(--fill);height:36px">取消</span><span class="btn2" style="background:var(--btn-pri-bg);color:#fff;height:36px;padding:0 18px">导入为草稿，打开编辑</span></div>
</div>'''
    return body + "<!--OVERLAY-->" + dlg



# =====================================================================
# 空状态：没有数据时各页长什么样（和边界状态同一套 2×2 画板）
# =====================================================================
def p_empty():
    css = """
.eb{position:absolute;inset:0;padding:26px 30px 28px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px 22px}
.et{display:flex;flex-direction:column;min-height:0}
.el{display:flex;align-items:center;gap:10px;height:34px;flex:none;padding:0 4px}
.el .no{width:22px;height:22px;border-radius:50%;background:var(--text);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}
html.dark .el .no{color:#111}
html:not(.dark) .el .no{color:#fff}
.el b{font-size:16px;font-weight:700}
.el em{font-style:normal;font-size:13px;color:var(--text-3)}
.ep{flex:1;min-height:0;border-radius:22px;display:flex;overflow:hidden}
.ml{width:200px;flex:none;border-right:1px solid var(--hair);padding:14px 10px 10px;display:flex;flex-direction:column}
.ml .hd{display:flex;align-items:center;gap:6px;padding:0 6px 8px}
.ml .hd b{font-size:16px;font-weight:700}
.ph{border:1.5px dashed var(--hair);border-radius:12px;height:46px;margin:6px 4px 0}
.ph.s{height:34px;opacity:.6}
.bdj{width:18px;height:18px;border-radius:5px;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.ec{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:0 26px}
.eh{font-size:19px;font-weight:800;margin-top:12px}
.kv2{display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 0}
.kv2+.kv2{border-top:1px solid var(--hair)}
.chip{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:8px;background:var(--fill);font-size:12px;font-weight:600;color:var(--text-2);white-space:nowrap}
.arr{color:var(--text-3);font-size:12px}
.opt{flex:1;min-width:0;padding:12px;border-radius:14px;display:flex;flex-direction:column;gap:6px}
"""
    def tile(no, name, when, inner):
        return f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div><section class="glass ep">{inner}</section></div>'

    def mini_list(title, seg, extra=""):
        return f'''<div class="ml"><div class="hd"><b>{title}</b><span class="f13 t3 grow">0</span>
<div class="seg" style="padding:2px"><span class="on" style="height:22px;padding:0 8px;font-size:11px">{seg[0]}</span><span style="height:22px;padding:0 8px;font-size:11px">{seg[1]}</span></div></div>
{extra}<div class="ph"></div><div class="ph"></div><div class="ph s"></div><span class="grow"></span></div>'''

    def ibox(bg, ic):
        return f'<span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:{bg}">{I(ic,24,2)}</span>'

    JB = '<span class="bdj" style="background:linear-gradient(160deg,#4FA3FF,#1D6FE0)">J</span>'
    TB = '<span class="bdj" style="background:linear-gradient(160deg,#FF9F5A,#F2662B)">T</span>'

    # 1 工单：开工后还没收到单
    t1 = mini_list("工单", ("我的", "全部")) + f'''<div class="ec">
  {ibox("linear-gradient(160deg,#5FE0D0,#13A8A0)","inbox")}
  <div class="eh">Bot 在等单</div>
  <div class="f13 t2" style="margin-top:6px">开工准备已就绪 · 3 个 Bot 在线</div>
  <div class="card" style="padding:2px 14px;margin-top:12px">
    <div class="kv2">{JB}<span class="w6">Jira</span><span class="t2 grow ell">项目 SP · 标签 ai-fix · 指派给你</span></div>
    <div class="kv2">{TB}<span class="w6">Tita</span><span class="t2 grow ell">流转到「AI干活」节点</span></div>
    <div class="kv2">{I("refresh",14,style="color:var(--text-3)")}<span class="t2 grow">上次采集 2 分钟前</span><span class="tag tg-g">正常</span></div>
  </div>
  <div class="row g8" style="margin-top:12px"><span class="btn2 sm a-sec" style="background:var(--fill)">看收单条件</span><span class="btn2 sm a-sec" style="background:var(--fill)">去来源采集</span><span class="f12 t3" style="margin-left:4px">单一进来就开始修，并通知你</span></div>
</div>'''

    # 2 搜索 / 筛选没有结果
    srch = f'''<div class="row g6" style="height:30px;margin:0 4px 6px;padding:0 9px;border-radius:9px;background:var(--glass-2);box-shadow:0 0 0 2px color-mix(in srgb,var(--blue) 50%,transparent)">{I("search",13,style="color:var(--text-3)")}<span class="f12 grow">导出</span>{I("x",12,style="color:var(--text-3)")}</div>
<div class="row g6" style="padding:0 4px 2px"><span class="tag tg-t">修复中</span><span class="f11 t3">筛选 1 项</span></div>'''
    t2 = mini_list("工单", ("我的", "全部"), srch) + f'''<div class="ec">
  {ibox("linear-gradient(160deg,#B7BDC8,#8A92A0)","search")}
  <div class="eh">「我的 · 修复中」里没有「导出」</div>
  <div class="f13 t2" style="margin-top:6px">搜的是标题、工单号和原单内容</div>
  <div class="row g8" style="margin-top:14px"><span class="btn2 sm a-pri">在全部里找 · 2 张</span><span class="btn2 sm a-sec" style="background:var(--fill)">清除筛选</span></div>
  <div class="row g8 f12 t2" style="margin-top:16px;padding:8px 10px;border-radius:10px;background:var(--fill)">{I("spark",13,style="color:var(--ink-purple)")}<span class="grow">也可以问 AI 助手：「上周和导出有关的单」</span></div>
  <div class="f12 t3" style="margin-top:8px">已完成的单也能搜到；没有权限的单不显示</div>
</div>'''

    # 3 发布：还没有发布记录
    t3 = mini_list("发布", ("我的", "全部")) + f'''<div class="ec">
  {ibox("linear-gradient(160deg,#6CC4FF,#1673FF)","rocket")}
  <div class="eh">还没有发布记录</div>
  <div class="f13 t2" style="margin-top:6px">单审核通过后，发布记录会出现在这里</div>
  <div class="row g6" style="margin-top:14px"><span class="chip">审核通过</span><span class="arr">→</span><span class="chip">发测试</span><span class="arr">→</span><span class="chip">复测通过</span><span class="arr">→</span><span class="chip">发正式</span></div>
  <div class="row g10" style="margin-top:16px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--orange) 13%,transparent)">{I("alert",15,style="color:var(--ink-orange)")}
    <div class="col grow" style="min-width:0"><span class="f13 w6">发布配置还没填</span><span class="f12 t2">开工时跳过了 · 不影响修单，发测试前要填好</span></div>
    <span class="btn2 sm a-sec" style="background:var(--glass-2)">去填</span></div>
</div>'''

    # 4 Skills：「我的」还没有
    def bi(name, kind):
        bg = "linear-gradient(160deg,#5AA0FF,#1F6FFF)" if kind == "编码" else "linear-gradient(160deg,#5EDB7A,#28B04F)"
        ic = "code" if kind == "编码" else "eye"
        return f'<div class="row g8" style="padding:6px"><span class="ic-box" style="width:24px;height:24px;border-radius:7px;background:{bg}">{I(ic,12,2)}</span><span class="f12 w6 ell grow">{name}</span></div>'
    sk_left = f'''<div class="ml"><div class="hd"><b>Skills</b><span class="f13 t3 grow">4</span></div>
<div class="g10h" style="margin-top:0">我的<span>0</span></div><div class="ph s"></div>
<div class="g10h">平台内置<span>4</span></div>{bi("最小改动修复","编码")}{bi("组件包升级","编码")}{bi("页面交互回归","验证")}{bi("接口回归","验证")}<span class="grow"></span></div>'''

    def opt(ic, bg, t, d, pri=False):
        st = "background:color-mix(in srgb,var(--blue) 10%,transparent);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--blue) 45%,transparent)" if pri else "background:var(--fill)"
        return f'<div class="opt" style="{st}"><span class="ic-box" style="width:30px;height:30px;border-radius:9px;background:{bg}">{I(ic,15,2)}</span><span class="f13 w7" style="margin-top:2px">{t}</span><span class="f11 t2" style="line-height:1.5">{d}</span></div>'
    t4 = sk_left + f'''<div class="ec">
  {ibox("linear-gradient(160deg,#C08BFF,#8A4DFF)","layers")}
  <div class="eh">还没有自己的 Skill</div>
  <div class="f13 t2" style="margin-top:6px">Bot 现在只用平台内置的 4 条规则</div>
  <div class="row g10" style="margin-top:16px;align-items:stretch">
    {opt("plus","linear-gradient(160deg,#5AA0FF,#1F6FFF)","在线新建","从空白写<br>AI 读仓库帮你起草",True)}
    {opt("download","linear-gradient(160deg,#B7BDC8,#8A92A0)","导入",".md 文件 · 粘贴<br>GitLab 文件链接")}
    {opt("copy","linear-gradient(160deg,#5EDB7A,#28B04F)","复制内置的改","在内置规则上<br>改成自己的版本")}
  </div>
  <div class="f12 t3" style="margin-top:12px">写好先是草稿，启用到项目后从下一轮生效</div>
</div>'''

    body = '<div class="eb">' + tile(1, "工单 · 还没收到单", "开工准备做完，第一张单还没来", t1) + tile(2, "搜索没有结果", "带着筛选搜，先说清是在哪里没找到", t2) \
        + tile(3, "发布 · 还没有发布", "第一张单审核通过之前", t3) + tile(4, "Skills · 我的还没有", "只有平台内置的规则", t4) + "</div>"
    return (body, css)


def p_empty2():
    """空状态第二张：AI 助手第一次打开 · 紧急回滚没有可回滚的 · 代码改动还没提交 · 工单发布还没开始。同一套画板。"""
    css = p_empty()[1] + """
.ask{padding:10px 12px;border-radius:12px;background:var(--fill);font-size:12.5px;line-height:1.5;display:flex;gap:8px;align-items:flex-start}
.ask .k{flex:none;height:18px;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center}
.eb .thead{padding:12px 18px 10px}
.eb .thead h1{font-size:16px}
.ep.v{flex-direction:column}
"""
    def tile(no, name, when, inner, v=False):
        return f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div><section class="glass ep{" v" if v else ""}">{inner}</section></div>'

    def ibox(bg, ic):
        return f'<span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:{bg}">{I(ic,24,2)}</span>'

    def mini_head(title, tid, meta, pill, tabs_on, tabs):
        tb = '<div class="row g10" style="margin-top:8px"><div class="tab2">' + "".join(
            f'<span{" class=\"on\"" if n == tabs_on else ""}>{n}{(" <b>" + c + "</b>") if c else ""}</span>' for n, c in tabs) + "</div></div>"
        return f'''<header class="thead"><div class="row g10"><span class="appic ic-tita" style="width:32px;height:32px;font-size:9px;border-radius:9px">TITA</span>
<div class="col grow" style="min-width:0"><h1 class="ell">{title}</h1><div class="f12 t3 ell" style="margin-top:1px">{tid} · {meta}</div></div>{pill}</div>{tb}</header>'''

    # 1 AI 助手 · 第一次打开
    left1 = f'''<div class="ml"><div class="hd"><b class="grow">AI 助手</b></div>
<div class="row g6" style="margin:0 4px 4px;height:28px;padding:0 9px;border-radius:9px;background:var(--fill);color:var(--text-3)">{I("search",12)}<span class="f12">搜索对话</span></div>
<div class="ph"></div><div class="ph"></div><div class="ph s"></div>
<div class="f11 t3" style="padding:10px 6px 0;line-height:1.5">问过的会留在这里，下次接着问</div><span class="grow"></span></div>'''
    def ask(k, kc, t):
        return f'<div class="ask"><span class="k tag tg-{kc}">{k}</span><span class="grow">{t}</span></div>'
    t1 = left1 + f'''<div class="ec">
  <span class="orb" style="width:52px;height:52px">{I("spark",24,style="color:#fff")}</span>
  <div class="eh">有事直接说</div>
  <div class="f13 t2" style="margin-top:6px">能做的和页面上一样，按你的权限来</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
    {ask("查","b","哪几张在等我审核？")}
    {ask("办","p","把 TK-20871 发到测试")}
    {ask("查","b","今天 Tita 收单正常吗？")}
    {ask("问","t","TK-20855 为什么打包失败")}
  </div>
  <div class="row g8" style="margin-top:12px;height:38px;padding:0 6px 0 12px;border-radius:12px;background:var(--glass-2);box-shadow:0 0 0 1px var(--hair)"><span class="f13 t3 grow">问 AI 助手…</span><span class="chip2" style="height:26px;font-size:11.5px">关联：全局</span><span class="ic-box" style="width:28px;height:28px;border-radius:9px;background:linear-gradient(160deg,#5AA0FF,#1F6FFF)">{I("arrowup",14,2.4)}</span></div>
  <div class="f12 t3" style="margin-top:8px">说的不清楚是哪张单时，会先问你</div>
</div>'''

    # 2 紧急回滚 · 没有可回滚的
    left2 = f'''<div class="ml"><div class="hd"><b class="grow">紧急回滚</b><span class="tag tg-r">值班</span></div>
<div class="row g8" style="margin:0 4px;padding:7px 8px;border-radius:10px;background:var(--fill)"><span class="ic-box" style="width:22px;height:22px;border-radius:6px;background:linear-gradient(160deg,#5AA0FF,#1F6FFF)">{I("globe",12)}</span><span class="f12 w6 grow ell">okr-web</span>{I("chevd",11,style="color:var(--text-3)")}</div>
<div class="seg" style="margin:8px 4px 0;padding:2px"><span class="on" style="flex:1;justify-content:center;height:22px;font-size:11px;color:var(--ink-red)">PRO 正式</span><span style="flex:1;justify-content:center;height:22px;font-size:11px">TEST 测试</span></div>
<div class="g10h" style="padding-top:12px">发布历史<span>1</span></div>
<div class="row g8" style="padding:7px 8px;border-radius:10px"><div class="col grow" style="min-width:0"><span class="f12 w6 ell">okr-web 2.1.0 上线</span><span class="f11 t3">11-19 20:30</span></div><span class="tag tg-r">当前生效</span></div>
<div class="ph s"></div><span class="grow"></span></div>'''
    t2 = left2 + f'''<div class="ec">
  {ibox("linear-gradient(160deg,#B7BDC8,#8A92A0)","history")}
  <div class="eh">没有可以回到的上一次</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.65">okr-web 正式环境在 Apollo 里只有当前这一次发布。<br>回滚只回到之前的某次发布，不重新打包。</div>
  <div class="row g8" style="margin-top:14px"><span class="btn2 sm a-sec" style="background:var(--fill)">换个应用</span><span class="btn2 sm a-sec" style="background:var(--fill)">看测试环境</span></div>
  <div class="row g8 f12 t2" style="margin-top:14px;padding:8px 10px;border-radius:10px;background:var(--fill)">{I("msgq",13,style="color:var(--text-3)")}<span class="grow">历史从 Apollo 读，不是从工作台发的也会列出来</span></div>
</div>'''

    TABS = lambda code, ev: [("对话", ""), ("代码改动", code), ("证据", ev), ("执行日志", ""), ("发布", "")]

    # 3 代码改动 · 这一轮还没提交
    t3 = mini_head("考勤：导出月报后部门名显示乱码", "TK-20840", "修复人 林某 · 第 1 轮", '<span class="pill p-teal" style="flex:none">AI 修复中 · 第 1 轮</span>', "代码改动", TABS("", "1")) + f'''
<div class="col grow" style="align-items:center;justify-content:center;text-align:center;padding:0 30px">
  {ibox("linear-gradient(160deg,#B7BDC8,#8A92A0)","code")}
  <div class="eh">第 1 轮还没提交代码</div>
  <div class="row g8 f13 t2" style="margin-top:8px"><span class="dot10" style="width:8px;height:8px;border-radius:50%;background:var(--teal)"></span>Bot 正在「定位」· 已用 6 分钟</div>
  <div class="f13 t2" style="margin-top:6px">提交后这里显示逐行差异，修复中也能随时看</div>
  <div class="row g8" style="margin-top:14px"><span class="btn2 sm a-sec" style="background:var(--fill)">去对话看进度</span></div>
  <div class="f12 t3" style="margin-top:14px">证据、执行日志没有内容时也一样：写清 Bot 做到哪一步</div>
</div>'''

    # 4 工单 · 发布 · 还没审核通过
    t4 = mini_head("审批中心：发起审批时点击分组，界面卡住", "TK-20871", "修复人 林某 · 第 2 轮", '<span class="pill p-blue" style="flex:none">待我审核 · 第 2 轮</span>', "发布", TABS("3", "4")) + f'''
<div class="col grow" style="align-items:center;justify-content:center;text-align:center;padding:0 30px">
  {ibox("linear-gradient(160deg,#B7BDC8,#8A92A0)","rocket")}
  <div class="eh">这张单还没发布</div>
  <div class="f13 t2" style="margin-top:6px">第 2 轮等你审核，通过后在这里发到测试环境</div>
  <div class="row g6" style="margin-top:14px"><span class="chip" style="background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue)">审核通过</span><span class="arr">→</span><span class="chip">合入测试分支</span><span class="arr">→</span><span class="chip">打包</span><span class="arr">→</span><span class="chip">发测试</span></div>
  <div class="row g8" style="margin-top:14px"><span class="btn2 sm a-pri">去审核代码</span></div>
  <div class="f12 t3" style="margin-top:14px">第 1 轮被你打回，没有发布过</div>
</div>'''

    body = '<div class="eb">' + tile(1, "AI 助手 · 第一次打开", "还没有任何对话", t1) + tile(2, "紧急回滚 · 没有可回滚的", "这个环境只发布过一次", t2) \
        + tile(3, "代码改动 · 还没提交", "Bot 修复中，这一轮还没改完", t3, True) + tile(4, "工单 · 发布 · 还没开始", "审核通过之前", t4, True) + "</div>"
    return (body, css)


# =====================================================================
# 排队：Bot 都在忙时（需求 §8 第 3 条，2026-11-21 用户确认）
# =====================================================================
def p_queue():
    css = p_empty()[1] + """
.eb .thead{padding:12px 18px 10px}
.eb .thead h1{font-size:16px}
.ep.v{flex-direction:column}
.qn{width:22px;height:22px;border-radius:50%;background:var(--fill);font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.qx{display:flex;align-items:center;gap:10px;padding:8px 4px}
.qr+.qx{border-top:1px solid var(--hair)}
.stp{display:flex;align-items:center;border-radius:10px;background:var(--fill);height:32px}
.stp span{width:34px;text-align:center;font-size:16px;color:var(--text-2)}
.stp b{min-width:34px;text-align:center;font-size:15px}
"""
    def tile(no, name, when, inner, v=False):
        return f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div><section class="glass ep{" v" if v else ""}">{inner}</section></div>'

    GR = "#C7CBD4,#9298A6"
    def tg(c, t):
        return f'<span class="tag tg-{c}">{t}</span>'

    # 1 列表里排队的单
    rows_fix = [("20840", "赵磊", "#8FD8C9,#3FAE9A", "teal", "考勤导出部门名乱码", "t", "浏览器验证中 · 84%", "", "", 84),
                ("20833", "周婷", "#C3A8FF,#8E6BEA", "teal", "看板拖拽后回弹", "j", "复现中 · 还有 1 张", "", "", 30)]
    rows_q = [("20891", "郑然", "#FF9F94,#E5604F", "text-3", "报表导出 500", "j", "排第 1 · P1 先修", "", "", None),
              ("20880", "王芳", "#7FB2FF,#4C7DF0", "text-3", "流程图节点不显示", "t", "排第 2 · 打回重修 · 第 2 轮", "", "", None),
              ("20884", "陈晨", "#FFC38A,#F08A5D", "text-3", "日程提醒重复", "j", "排第 3 · 11:02 进来", "", "", None)]
    lst = '<div class="ml" style="width:290px"><div class="hd"><b>工单</b><span class="f13 t3 grow">11</span></div>' \
        + '<div class="g10h" style="margin-top:0">排队中<span>3</span></div>' + "".join(trow(t) for t in rows_q) + '<span class="grow"></span><div class="f12 t3" style="padding:8px 6px 2px">「排队中」排在「Bot 修复中」下面</div></div>'
    t1 = lst + f'''<div class="ec" style="padding:0 22px">
  <span class="pill glass" style="align-self:flex-start;height:30px;padding:0 12px">{I("bot",13)}3 个 Bot 都在忙 · 3 张排队</span>
  <div class="f12 t3" style="margin-top:6px">顶栏胶囊，点开是右边第 4 块</div>
  <div class="card" style="padding:12px 14px;margin-top:14px">
    <div class="f13 w7">排队顺序（固定）</div>
    <div class="qx"><span class="qn">1</span><span class="f13 grow">P1 最先</span>{tg("r","P1")}</div>
    <div class="qx"><span class="qn">2</span><span class="f13 grow">同级里打回重修的在前</span>{tg("o","打回重修")}</div>
    <div class="qx"><span class="qn">3</span><span class="f13 grow">再按进来的先后</span>{tg("n","先来先到")}</div>
  </div>
  <div class="f12 t3" style="margin-top:10px;line-height:1.6">优先级取自原单；顺序不能手动拖。</div>
</div>'''

    # 2 工单 · 排队中
    t2 = f'''<header class="thead"><div class="row g10"><span class="appic ic-tita" style="width:32px;height:32px;font-size:9px;border-radius:9px">TITA</span>
<div class="col grow" style="min-width:0"><h1 class="ell">审批中心：流程图节点不显示</h1><div class="f12 t3 ell" style="margin-top:1px">TK-20880 · 修复人 王芳 · 第 2 轮</div></div><span class="pill p-gray" style="flex:none">排队中 · 第 2</span></div></header>
<div class="col grow g10" style="padding:12px 18px 0;min-height:0">
  <div class="divd" style="margin:0">第 1 轮 · 你 10:40 打回：「连线还是会错位」</div>
  <div class="row g10" style="align-items:flex-start">
    <span class="aid" style="margin-top:2px">{I("clock",13)}</span>
    <div class="card col g8 grow" style="padding:12px 14px;min-width:0">
      <div class="row g8"><span class="tag tg-n">排队中</span><span class="f14 w6">第 2 轮还没开始：3 个 Bot 都在忙</span></div>
      <div class="f13 t2" style="line-height:1.65">前面还有 1 张（P1 · TK-20891）。打回重修排在同级新单前面，预计 <b style="color:var(--text)">15:40</b> 开始。</div>
      <div class="row g8 f12 t2" style="padding:7px 10px;border-radius:10px;background:var(--fill)">{I("bell",13,style="color:var(--text-3)")}<span class="grow">轮到时自动开始，并通知你</span></div>
    </div>
  </div>
  <span class="grow"></span>
  <div class="f12 t3" style="margin:0 0 2px 34px">现在补充的资料，开始修时一起用</div>
</div>
<div class="row g8" style="margin:8px 14px 12px;height:40px;padding:0 6px 0 10px;border-radius:13px;background:var(--fill)"><span class="aid" style="width:20px;height:20px;border-radius:6px">{I("spark",11)}</span><span class="f12 w6">本单 AI</span><span class="mono f11 t3">TK-20880</span><span class="f13 t3 grow ell">补充资料，或问为什么还没开始…</span></div>'''

    # 3 设置 · 全局 AI · 同时修几张
    t3 = f'''<div class="ec" style="padding:0 26px">
  <div class="row g8"><span class="f12 t3">设置 · 全局 AI</span><span class="tag tg-n">只有管理员能改</span></div>
  <div class="card" style="padding:4px 14px;margin-top:10px">
    <div class="qx" style="padding:10px 0"><div class="col grow"><span class="f14 w6">同时修几张</span><span class="f12 t3">多出来的单排队；现在 3 个 Bot 在线</span></div><div class="stp"><span>−</span><b>3</b><span>+</span></div></div>
    <div class="qx" style="padding:10px 0"><div class="col grow"><span class="f14 w6">排队顺序</span><span class="f12 t3">P1 最先 → 打回重修 → 先来先到</span></div><span class="row g6 f12 t3">{I("lock",12)}固定</span></div>
    <div class="qx" style="padding:10px 0"><div class="col grow"><span class="f14 w6">收单</span><span class="f12 t3">每 2 分钟采一次，新单 5 分钟内开始修并通知</span></div></div>
    <div class="qx" style="padding:10px 0"><div class="col grow"><span class="f14 w6">采集异常</span><span class="f12 t3">超过 15 分钟没采到：顶栏变橙，来源采集页标红</span></div></div>
  </div>
  <div class="f12 t3" style="margin-top:10px">改了从下一张单开始生效，正在修的不受影响</div>
</div>'''

    # 4 现在谁在修、谁在排
    def bot(n, tid, what, pct):
        return f'<div class="qx"><span class="ic-box" style="width:26px;height:26px;border-radius:8px;background:linear-gradient(160deg,#5FE0D0,#13A8A0)">{I("bot",13,2)}</span><span class="f13 w6" style="width:52px">{n}</span><span class="mono f12 t2">{tid}</span><span class="f12 t2 grow ell">{what}</span><span class="f12 num" style="color:var(--ink-teal)">{pct}</span></div>'
    def q(i, tid, title, tags, eta):
        return f'<div class="qx"><span class="qn">{i}</span><span class="mono f12 t2">{tid}</span><span class="f13 grow ell">{title}</span>{tags}<span class="f12 t3" style="width:44px;text-align:right">{eta}</span></div>'
    t4 = f'''<div class="ec" style="padding:0 26px">
  <div class="row g8"><span class="f12 t3">设置 · 全局 AI · 运行情况</span></div>
  <div class="card" style="padding:4px 14px;margin-top:10px">
    <div class="f12 w7 t2" style="padding:8px 0 2px">在修 3</div>
    {bot("Bot-01","TK-20840","浏览器验证","84%")}
    {bot("Bot-02","TK-20833","复现","30%")}
    {bot("Bot-03","TK-20877","定位","12%")}
  </div>
  <div class="card" style="padding:4px 14px;margin-top:10px">
    <div class="f12 w7 t2" style="padding:8px 0 2px">排队 3</div>
    {q(1,"TK-20891","报表导出 500",tg("r","P1"),"15:20")}
    {q(2,"TK-20880","流程图节点不显示",tg("o","打回重修"),"15:40")}
    {q(3,"TK-20884","日程提醒重复",tg("n","先来先到"),"16:05")}
  </div>
</div>'''

    body = '<div class="eb">' + tile(1, "列表 · 有单在排队", "Bot 都在忙时，列表多一组「排队中」", t1) + tile(2, "工单 · 排队中", "排队的单打开后", t2, True) \
        + tile(3, "同时修几张", "管理员在「设置 → 全局 AI」里配", t3) + tile(4, "谁在修、谁在排", "顶栏胶囊点开 / 全局 AI 运行情况", t4) + "</div>"
    return (body, css)


# =====================================================================
# 审核通过 · 有未测项（需求 §8 第 4 条，2026-11-21 用户确认）
# =====================================================================
def p_approve():
    base = p_reject().split('<!--OVERLAY-->')[0]
    ok = lambda t: f'<div class="row g8 f13"><span class="ck" style="background:var(--green);width:16px;height:16px;font-size:10px">✓</span><span class="t2">{t}</span></div>'
    dlg = f'''<div class="scrim"></div>
<div class="dlg" style="left:50%;top:50%;width:620px;transform:translate(-50%,-50%);padding:22px 24px">
  <div class="row g10"><span class="ic-box" style="background:linear-gradient(160deg,#5AA0FF,#1F6FFF)">{I("check",16,2.6)}</span><div class="col grow"><span class="f18 w7">审核通过第 2 轮</span><span class="f12 t3">TK-20871 · 审核对象 <span class="mono">a3f9c21</span> · 改了 2 个文件</span></div></div>
  <div class="flabel" style="margin-top:18px">Bot 已验证 3 项</div>
  <div class="col g6" style="padding:10px 12px;border-radius:12px;background:var(--fill)">{ok("普通员工切换分组不再卡住")}{ok("分组 2、3 切换后列表正确")}{ok("刷新后停在原来的分组")}</div>
  <div class="flabel" style="margin-top:16px;color:var(--ink-orange)">还有 1 项没测 · 待人工复测</div>
  <div class="col g8" style="padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--orange) 11%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--orange) 35%,transparent)">
    <div class="row g8"><span class="ck" style="background:var(--orange);width:16px;height:16px;font-size:10px">!</span><span class="f14 w6 grow">「管理员」切到「销售部」不卡</span><span class="f12 lnk">先登记账号，让 Bot 补测 ›</span></div>
    <div class="f12 t2" style="padding-left:24px">没测的原因：项目里没有登记管理员账号，Bot 没能登录</div>
  </div>
  <div class="flabel" style="margin-top:16px">通过后，这一项交给测试人</div>
  <div class="row g10" style="padding:10px 12px;border-radius:12px;border:1px solid var(--hair)">{I("bell",15,style="color:var(--text-3)")}
    <div class="col grow" style="min-width:0"><span class="f12 t3">复测通知里会写</span><span class="f13"><span class="tag tg-o" style="margin-right:6px">重点测</span>「管理员」切到「销售部」不卡（Bot 没测过）</span></div></div>
  <div class="row g8" style="margin-top:16px"><span class="cbx on">{I("check",12,3)}</span><span class="f14 w6">我知道有 1 项没测，交给测试人重点测</span><span class="grow"></span><span class="f12 t3">不勾不能通过</span></div>
  <div class="row g10" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--hair)"><span class="f12 t3 grow">通过后可以发测试，同时生成「待原平台确认」</span><span class="btn2 a-sec" style="background:var(--fill);height:36px">取消</span><span class="btn2 a-pri" style="height:36px">{I("check",14,2.6)}审核通过 a3f9c21</span></div>
</div>'''
    return base + '<!--OVERLAY-->' + dlg


# =====================================================================
# 设置 · 我的账号（个人 Apollo 账号，2026-11-21 用户确认）
# =====================================================================
def p_myacct():
    def yes(t="能"):
        return f'<span class="row g4 f12 w6" style="color:var(--ink-green);justify-content:center">{I("check",12,3)}{t}</span>'
    def no(t="不能"):
        return f'<span class="f12 t3" style="text-align:center;display:block">{t}</span>'
    def mrow(p, a, b, c, d, note=""):
        cell = lambda x: f'<div style="width:96px;flex:none">{x}</div>'
        return f'<div class="row g8" style="padding:8px 0;border-top:1px solid var(--hair)"><span class="f13 w6" style="width:70px;flex:none">{p}</span>{cell(a)}{cell(b)}{cell(c)}{cell(d)}<span class="f12 t3 grow ell" style="padding-left:6px">{note}</span></div>'
    def hcell(t, sub):
        return f'<div class="col" style="width:96px;flex:none;align-items:center;gap:1px"><span class="f12 t2 w6">{t}</span><span class="f11 t3">{sub}</span></div>'
    def use(ic, bg, t, d):
        return f'<div class="row g10" style="padding:8px 0;border-top:1px solid var(--hair)"><span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:{bg}">{I(ic,14)}</span><div class="col grow" style="gap:1px"><span class="f13 w6">{t}</span><span class="f12 t3">{d}</span></div></div>'
    def acct(logo, title, ok, fields, btn, foot):
        return f'''<div class="card grow" style="padding:12px 16px 14px;min-width:0">
    <div class="row g8">{logo}<span class="sec grow">{title}</span><span class="row g6 f12" style="color:var(--ink-green)">{I("check",13,3)}{ok}</span></div>
    {fields}
    <div class="row g10" style="margin-top:12px"><span class="btn2 a-sec" style="height:32px">{I("zap",13)}{btn}</span><span class="f12 t3 grow ell">{foot}</span></div></div>'''
    GL = '<span style="width:20px;height:20px;border-radius:6px;background:#FC6D26;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none">G</span>'
    AP = '<span style="width:20px;height:20px;border-radius:6px;background:linear-gradient(160deg,#4FA3FF,#1D6FE0);color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none">A</span>'
    gl_f = '''<div class="flabel" style="margin-top:12px">个人访问令牌</div><div class="field mono" style="font-size:13px;letter-spacing:1px">•••••••••••••••• 7c2e</div>
    <div class="f12 t3" style="margin-top:6px">识别为 <span class="mono t2">lin.x</span> · 有效期到 2027-05-20 · 权限 api</div>'''
    ap_f = '''<div class="row g10" style="margin-top:12px"><div class="grow"><div class="flabel">用户名</div><div class="field mono" style="font-size:13px">lin.x</div></div>
    <div class="grow"><div class="flabel">密码</div><div class="field mono" style="font-size:13px;letter-spacing:2px">••••••••••</div></div></div>'''
    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><h1>我的账号</h1><div class="f12 t3" style="margin-top:2px">只给你用 · 合入 MR、发布、回滚都用你本人的账号</div></div>
  <span class="chip2">{I("spark",13,style="color:var(--ink-purple)")}也可以问 AI「我能合哪些分支？」</span></div></header>
<div class="col g14 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="card" style="padding:10px 16px">
    <div class="row g12"><span class="av" style="width:34px;height:34px;font-size:13px;background:linear-gradient(150deg,#FFB38A,#F0703C)">林</span>
      <div class="col grow" style="gap:1px"><span class="f14 w6">林某 <span class="f12 t3" style="font-weight:400">· 独立邮箱 <span class="mono">lin@company.com</span> 登录</span></span><span class="f12 t3">空间管理员 · 能看审批、OKR、考勤</span></div>
      <span class="f12 t3">独立云匠账号 · 外部工具走个人连接器</span></div>
  </div>
  <div class="row g14" style="align-items:stretch">
    {acct(GL, "GitLab 账号", "已连通", gl_f, "试连接", "在 GitLab 偏好设置 → 访问令牌里生成")}
    {acct(AP, "Apollo 账号", "已连通 · 10:20", ap_f, "试登录", "加密存在内网服务器上")}
  </div>
  <div class="card" style="padding:12px 16px 6px">
    <div class="row g8"><span class="sec grow">你能做什么</span><span class="f12 t3">试连接时实测 · 工作台的权限另算，两边都要过</span></div>
    <div class="row g8" style="margin-top:8px;padding-bottom:6px"><span style="width:70px;flex:none"></span>{hcell("合入测试分支","GitLab")}{hcell("合回主分支","GitLab")}{hcell("发测试","Apollo")}{hcell("发正式 · 回滚","Apollo")}<span class="grow"></span></div>
    {mrow("OKR", yes(), yes(), yes(), yes())}
    {mrow("审批", yes(), no(), yes(), no("只能看"), "找管理员加权限")}
    {mrow("考勤", yes(), yes(), yes(), yes())}
  </div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="mini">什么时候用你的账号</div>
  {use("branch","linear-gradient(160deg,#FF9A5A,#FC6D26)","你点「通过并合入」","两次 MR 都用你的 GitLab 账号合入")}
  {use("rocket","linear-gradient(160deg,#5AA0FF,#1F6FFF)","你点发测试、发正式","用你的 Apollo 账号写回并发布")}
  {use("history","linear-gradient(160deg,#FF8A7A,#E0281E)","你确认紧急回滚","看历史、预览、执行都用你的")}
  <div class="f12 t3" style="padding:8px 0 2px;border-top:1px solid var(--hair);line-height:1.55">拉代码、推 fix/ 分支、提 MR 由 Bot 用 <span class="mono">bot-fix</span> 做，不用你的。</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">GitLab、Apollo 里会记成谁</div>
  <div class="row g8" style="margin-top:8px"><span class="ck" style="background:var(--green);width:16px;height:16px">{I("check",10,3.2)}</span><span class="f13 grow" style="white-space:nowrap">合入人、发布人 <span class="mono">lin.x</span></span></div>
  <div class="row g8" style="margin-top:6px;opacity:.55"><span class="ck" style="background:var(--text-3);width:16px;height:16px">{I("x",10,3.2)}</span><span class="f13 grow" style="white-space:nowrap"><span class="mono">bot-fix</span> / <span class="mono">deployuser</span></span></div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">过期了怎么办</div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">令牌快到期前 7 天提醒你。Apollo 改了密码回来这里也改。忘了也没事：用到时失败会通知你，改完在那一步点「重试」。</div></div>''')
    return set_left("我的账号") + main + right


# =====================================================================
# 第一次发布 · 先配你的 Apollo 账号（2026-11-21 用户确认）
# =====================================================================
def p_acctneed():
    base = p_pubbefore()
    dlg = f'''<div class="scrim"></div>
<div class="dlg" style="left:50%;top:50%;width:560px;transform:translate(-50%,-50%);padding:22px 24px">
  <div class="row g10"><span class="ic-box" style="background:linear-gradient(160deg,#FFC15A,#F08A00)">{I("key",16)}</span><div class="col grow"><span class="f18 w7">发布前，先配你的 Apollo 账号</span><span class="f12 t3">第一次在工作台发布 · 用你本人的账号，Apollo 里记的是你</span></div></div>
  <div class="row g12" style="margin-top:18px">
    <div class="grow"><div class="flabel">Apollo 用户名</div><div class="field mono" style="font-size:13px">lin.x</div></div>
    <div class="grow"><div class="flabel">密码</div><div class="field focus mono" style="font-size:13px;letter-spacing:2px">••••••••<span style="display:inline-block;width:1.5px;height:15px;background:var(--blue);vertical-align:-2px;margin-left:2px"></span></div></div>
  </div>
  <div class="row g8 f13" style="margin-top:12px;padding:9px 12px;border-radius:12px;background:color-mix(in srgb,var(--green) 10%,transparent)"><span class="ck" style="background:var(--green);width:16px;height:16px">{I("check",10,3.2)}</span><span class="grow">登录成功 · 审批测试环境能发布</span><span class="f12 t3">刚刚试过</span></div>
  <div class="row g8 f12 t3" style="margin-top:12px;line-height:1.55">{I("lock",13)}<span>加密存在内网服务器上，存到「设置 → 我的账号」，下次不用再填。第一次合入 MR 时同样会让你配 GitLab 令牌。</span></div>
  <div class="row g10" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--hair)"><span class="f12 t3 grow">测试人：王某 · 测试环境 · 审批</span><span class="btn2 a-sec" style="background:var(--fill);height:36px">取消</span><span class="btn2 a-pri" style="height:36px">{I("pkg",14)}保存并发布到测试环境</span></div>
</div>'''
    return base + '<!--OVERLAY-->' + dlg


def p_runners():
    """设置 · 执行器（跳过首次选择后的补配入口 + 随时切换本机 / 自有服务器 / 云端 Pro）。"""
    nav = SET_NAV
    nv = "".join(f'<div class="sn{" on" if n=="执行器" else ""}"><span class="si" style="background:{bg}">{I(ic,14,2)}</span>{n}<em{" style=\"color:var(--ink-orange)\"" if e=="!" else ""}>{e}</em></div>' for ic, bg, n, e in nav)
    left = f'''<section class="glass pn" style="width:240px;flex:none;padding:16px 4px 10px">
  <div class="row" style="padding:0 14px 6px"><span class="f18 w7">设置</span></div>{nv}
</section>'''

    def rcard(bg, ic, name, badges, meta, sub, status, stc, actions, active=False):
        bds = "".join(f'<span class="tag tg-{c}">{t}</span>' for t, c in badges)
        sty = ' style="padding:14px 16px;box-shadow:0 0 0 1.5px color-mix(in srgb,var(--blue) 45%,transparent)"' if active else ' style="padding:14px 16px"'
        return f'''<div class="card"{sty}>
  <div class="row g12" style="align-items:flex-start">
    <span class="ic-box" style="width:38px;height:38px;border-radius:11px;background:{bg};flex:none">{I(ic,18,2)}</span>
    <div class="col grow" style="min-width:0;gap:4px">
      <div class="row g8"><span class="f15 w7">{name}</span>{bds}<span class="grow"></span><span class="row g6 f12 w6" style="color:var(--ink-{stc})"><span class="dot" style="width:7px;height:7px;color:var(--{stc})"></span>{status}</span></div>
      <div class="f12 t2">{meta}</div>
      <div class="row g10" style="margin-top:6px;padding-top:8px;border-top:1px solid var(--hair)">
        <span class="f12 t3 grow ell">{sub}</span>{actions}
      </div>
    </div>
  </div>
</div>'''

    c1 = rcard(
        "linear-gradient(145deg,#34D399,#059669)", "server",
        "shanghai-ci-01", [("团队服务器", "g"), ("默认优先", "b")],
        "Linux x64 · 4C 8G · 出站 WSS 延迟 14ms · 并发修单 1 / 2 · v1.4.0",
        "全团队共用 · 代码与构建 100% 留在公司内网，关电脑也能通宵修单",
        "在线 · 忙碌中", "green",
        f'<span class="btn2 sm a-sec" style="background:var(--fill)">看日志</span><span class="btn2 sm a-sec" style="background:var(--fill)">解绑</span>',
        active=True,
    )
    c2 = rcard(
        "linear-gradient(145deg,#38BDF8,#2563EB)", "monitor",
        "MacBook Pro · 本机执行器", [("个人免费", "b"), ("免 Docker", "n")],
        "macOS arm64 · 复用本机 Chrome 131 · 仅自己可见 · 无需额外服务器",
        "已就绪 · 团队服务器全忙或离线时自动顶上，也可一键设为主用",
        "在线 · 待命", "green",
        f'<span class="btn2 sm a-sec" style="background:var(--fill)">设为主用</span><span class="btn2 sm a-sec" style="background:var(--fill)">重检环境</span>',
    )
    c3 = rcard(
        "linear-gradient(145deg,#A855F7,#6366F1)", "globe",
        "云端托管算力池", [("Pro", "p"), ("24h 在线", "n")],
        "华东上海节点 · 4C 8G 独占容器 · 免下载免维护 · 合盖关机持续修单",
        "未开通 · 适合无自有服务器且希望离机自动修复的个人或小团队",
        "未开通", "text-3",
        f'<span class="btn2 sm a-pri">去开通 / 绑兑换码 ›</span>',
    )

    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><h1>执行器</h1><div class="f12 t3" style="margin-top:2px">管理云匠干活的算力节点 · 首次跳过选择或日后换机器都在这里随时配</div></div>
  <span class="btn2 a-sec" style="background:var(--fill)">{I("refresh",13)}刷新状态</span>
  <span class="btn2 a-pri">{I("plus",14,2.4)}添加执行器</span></div></header>
<div class="col g12 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="card row g12" style="padding:11px 16px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2))">
    <span class="ic-box" style="width:30px;height:30px;border-radius:9px;background:var(--blue)">{I("zap",15,2)}</span>
    <div class="col grow" style="min-width:0;gap:2px"><span class="f13 w7">调度策略：团队服务器优先 → 本机电脑兜底</span><span class="f12 t2">全部执行器离线时，新单自动排队并在 PC / 手机提示上线；连上后自动续修</span></div>
    <span class="btn2 sm a-sec" style="background:var(--glass-2)">切换策略</span>
  </div>
  {c1}
  {c2}
  {c3}
  <div class="row g8 f12 t3" style="padding:2px 4px">{I("shield",13)}<span>点击右上角「添加执行器」可随时重新打开三选一向导（本机 / 自有服务器 / 云端 Pro）；跳过首次配置进入工作台后也由此处补配。</span></div>
</div>
</main>'''

    def slot_row(lbl, val, pct, col):
        return f'''<div style="margin-top:9px"><div class="row f12"><span class="t2 grow">{lbl}</span><span class="mono w6" style="color:var(--ink-{col})">{val}</span></div>
  <div style="height:5px;border-radius:3px;background:var(--fill);margin-top:4px;overflow:hidden"><div style="width:{pct}%;height:100%;border-radius:3px;background:var(--{col})"></div></div></div>'''

    right = aside(
        f'''<div class="card" style="padding:12px 14px"><div class="row"><span class="mini grow" style="margin:0">实时资源槽 · 4C 8G</span><span class="tag tg-g">健康</span></div>
  {slot_row("并发修单槽", "1 / 2", 50, "teal")}
  {slot_row("浏览器沙箱槽", "1 / 1 · 活跃", 100, "blue")}
  {slot_row("构建打包槽", "0 / 1 · 空闲", 0, "green")}
  {slot_row("视频转码槽", "0 / 1 · 空闲", 0, "green")}
  <div class="f11 t3" style="margin-top:10px;line-height:1.5">浏览器空闲 2 分钟自动休眠释放内存；打包与发布共用构建槽且发布优先。</div></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">快速挂载新服务器</div>
  <div class="f12 t2" style="line-height:1.55">在任意 Linux / macOS 服务器跑一行命令即可自动扩容算力池，纯出站 WSS 零入站端口。</div>
  <button class="abtn a-sec" style="width:100%;justify-content:center;height:36px;margin-top:10px;background:var(--fill)">{I("terminal",13)}获取一行安装命令</button></div>''',
        f'''<div class="card" style="padding:12px 14px"><div class="mini">切换机器会丢数据吗？</div>
  <div class="f12 t2" style="line-height:1.6">不会。工单、项目配置、Skills、会话树与证据全部持久化在云端，执行器纯无状态，随时换机或重装 <b>0 丢数</b>。</div></div>''')
    return left + main + right


# =====================================================================
# 34. 手动新建工单（点列表顶部 + 弹出；一期独立使用 / 未接外部平台 / 临时救火）
# =====================================================================
def p_newticket():
    overlay = f'''<!--OVERLAY--><div class="scrim"></div>
  <div class="dlg" style="left:50%;top:50%;width:650px;transform:translate(-50%,-50%);padding:22px 24px">
    <div class="row g10">
      <span class="ic-box" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("plus",18,2.6)}</span>
      <div class="col grow">
        <div class="f18 w7">手动新建工单</div>
        <div class="f12 t3" style="margin-top:2px">不依赖 Jira / Tita，直接派给 Bot 修复 · 自动编号 <span class="mono t2">M-105</span> · 不生成「待原平台确认」待办</div>
      </div>
      <span class="t3">{I("x",18)}</span>
    </div>

    <div class="col g12" style="margin-top:16px">
      <!-- 所属项目 & 优先级 -->
      <div class="row g14" style="align-items:flex-start">
        <div class="col g6 grow">
          <span class="f12 w6 t2">所属项目</span>
          <div class="row g6">
            <span class="pill p-blue" style="height:30px;padding:0 12px;border:1px solid color-mix(in srgb,var(--blue) 45%,transparent)">审批 · 已开工</span>
            <span class="pill p-gray" style="height:30px;padding:0 12px">OKR</span>
            <span class="pill p-gray" style="height:30px;padding:0 12px">考勤</span>
          </div>
        </div>
        <div class="col g6">
          <span class="f12 w6 t2">优先级（决定排队顺序）</span>
          <div class="row g6">
            <span class="pill p-red" style="height:30px;padding:0 11px;border:1px solid color-mix(in srgb,var(--red) 45%,transparent)">P1 紧急</span>
            <span class="pill p-gray" style="height:30px;padding:0 11px">P2 高</span>
            <span class="pill p-gray" style="height:30px;padding:0 11px">P3 普通</span>
          </div>
        </div>
      </div>

      <!-- 复现环境 & 修复人 -->
      <div class="row g14">
        <div class="col g6 grow">
          <span class="f12 w6 t2">复现环境</span>
          <div class="row g8" style="height:36px;padding:0 12px;border-radius:10px;background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl)">
            <span class="dot" style="width:7px;height:7px;color:var(--green)"></span>
            <span class="f13 w6">测试环境</span>
            <span class="mono f11 t3 grow ell">test.tita.work/approval</span>
            {I("chevd",13,style="color:var(--text-3)")}
          </div>
        </div>
        <div class="col g6" style="width:220px;flex:none">
          <span class="f12 w6 t2">真人修复人（审核人）</span>
          <div class="row g8" style="height:36px;padding:0 10px;border-radius:10px;background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl)">
            <span class="av" style="width:22px;height:22px;font-size:10px;background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
            <span class="f13 w6 grow">林某（我）</span>
            {I("chevd",13,style="color:var(--text-3)")}
          </div>
        </div>
      </div>

      <!-- 标题 -->
      <div class="col g6">
        <span class="f12 w6 t2">问题标题</span>
        <div class="row" style="height:36px;padding:0 12px;border-radius:10px;background:var(--glass-2);border:1px solid var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo)">
          <span class="f13.5 w5" style="font-size:13.5px">审批单批量导出时，部门名称包含斜杠导致文件名被截断</span>
        </div>
      </div>

      <!-- 问题说明与复现步骤 -->
      <div class="col g6">
        <div class="row"><span class="f12 w6 t2 grow">复现步骤与期望结果</span><span class="f11 t3">越具体，Bot 一次修对率越高</span></div>
        <div style="padding:10px 12px;border-radius:10px;background:var(--well);border:1px solid var(--hair);font-size:13px;line-height:1.65;color:var(--text-2)">
          1. 用普通员工进入「审批中心 → 我发起的」，筛选「研发/前端组」<br>
          2. 勾选 3 条审批单，点击右上角「批量导出 Excel」<br>
          <b style="color:var(--text)">实际</b>：下载文件名只剩「前端组.xlsx」，斜杠前全部丢失；<b style="color:var(--text)">期望</b>：自动转义非法路径字符。
        </div>
      </div>

      <!-- 附件与截图 -->
      <div class="row g10" style="padding:9px 12px;border-radius:11px;background:var(--fill)">
        <span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue)">{I("paperclip",14)}</span>
        <div class="col grow" style="min-width:0"><span class="f12.5 w6" style="font-size:12.5px">export-filename-bug.png</span><span class="f11 t3">428 KB · 作为修前参考材料交给 Bot</span></div>
        <span class="btn2 sm a-sec" style="background:var(--glass-2)">{I("plus",12,2.4)}添加截图 / 录屏</span>
      </div>
    </div>

    <div class="row g10" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--hair)">
      <span class="f12 t3 grow">创建后立即按优先级入队交给 Bot，开启机审门禁与浏览器复测</span>
      <button class="btn2 a-sec" style="background:var(--fill)">取消</button>
      <button class="btn2 a-pri" style="padding:0 20px">{I("bot",14)}创建并派给 Bot</button>
    </div>
  </div>'''
    return ticket_list("20871") + chat_main_dim() + aside(
        '<div class="card" style="padding:12px 14px;opacity:.45"><div class="mini">经过</div><div class="f12 t3">正在新建手动工单…</div></div>') + overlay


def p_connectors():
    """设置 · 连接器（外部平台鉴权与本机代码源唯一运维总览 · 与首次步骤器第 1 步同源）。"""
    css = '''<style>
.cgrp{display:flex;align-items:center;gap:8px;margin-top:4px}
.cgrp b{font-size:13px;font-weight:700}
.cgrp .csub{font-size:11.5px;color:var(--text-3)}
.c2g{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.cc{border-radius:15px;padding:13px 15px;background:var(--glass-2);border:1px solid var(--stroke);display:flex;flex-direction:column;gap:8px;min-width:0}
.cc.cc-err{border:1.5px solid color-mix(in srgb,var(--red) 62%,transparent);background:color-mix(in srgb,var(--red) 6%,var(--glass-2))}
.cc.cc-dash{background:transparent;border:1.5px dashed color-mix(in srgb,var(--text) 18%,transparent);justify-content:center;gap:6px}
.cic2{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;flex:none}
.cft{display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid var(--hair);font-size:11.5px;color:var(--text-3)}
.cft .ca{margin-left:auto;color:var(--ink-blue);font-weight:600;white-space:nowrap}
.fbar{display:flex;align-items:center;gap:8px}
.fc{height:28px;padding:0 11px;border-radius:9px;font-size:12px;font-weight:600;color:var(--text-2);background:var(--fill);display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.fc.on{background:var(--btn-pri-bg);color:#fff}
.fc em{font-style:normal;opacity:.72;font-size:11px;font-weight:500}
.catrow{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--hair);font-size:12px}
.catrow:first-child{border-top:0}
</style>'''
    main = css + f'''<main class="glass pn grow" style="min-width:0">
<header class="thead">
  <div class="row g10">
    <div class="col grow" style="min-width:0">
      <h1>连接器</h1>
      <div class="f12 t3" style="margin-top:2px">外部平台鉴权与本机代码源 · 由插件市场「连接器类插件」驱动 · 与首次步骤器同源</div>
    </div>
    <button class="btn2 a-sec" style="background:var(--fill)">{I("pkg",14)}插件市场装更多 ›</button>
    <button class="btn2 a-pri">{I("plus",14,2.4)}新建连接器</button>
  </div>
</header>
<div class="col g10 grow" style="padding:14px 22px;min-height:0;overflow:hidden">
  <div class="fbar">
    <span class="fc on">全部<em>5</em></span>
    <span class="fc">代码存储<em>2</em></span>
    <span class="fc">工单平台<em>2</em></span>
    <span class="fc">发布与通知<em>1</em></span>
    <span class="grow"></span>
    <span class="chip2" style="height:28px;font-size:12px">共享范围：全部 {I("chevd",12)}</span>
  </div>

  <div class="cgrp"><b>代码存储</b><span class="mono f11 t3">code_source</span><span class="csub">· 自动出现在开工引导第 1 步</span></div>
  <div class="c2g">
    <div class="cc">
      <div class="row g10">
        <span class="cic2" style="background:linear-gradient(155deg,#FF8A4C,#E24329)">G</span>
        <div class="grow" style="min-width:0">
          <div class="row g6"><b class="f13" style="white-space:nowrap">公司 GitLab</b><span class="tag tg-n" style="height:18px;font-size:10.5px">公司共用</span><span class="tag tg-b" style="height:18px;font-size:10.5px">官方</span></div>
          <div class="mono f11 t3 ell" style="margin-top:2px">https://git.tita.cloud</div>
        </div>
        <span class="tag tg-g">鉴权通过</span>
      </div>
      <div class="f12 t2 ell">令牌 <span class="mono">bot-fix</span> · 读写分支、禁合入主干 · 28 个仓库</div>
      <div class="cft"><span>已关联 3 个项目</span><span class="ca">鉴权设置 ›</span></div>
    </div>
    <div class="cc">
      <div class="row g10">
        <span class="cic2" style="background:linear-gradient(155deg,#5AA0FF,#2B6BFF)">{I("folder",16,2)}</span>
        <div class="grow" style="min-width:0">
          <div class="row g6"><b class="f13" style="white-space:nowrap">本机代码目录</b><span class="tag tg-p" style="height:18px;font-size:10.5px">本机执行器</span></div>
          <div class="mono f11 t3 ell" style="margin-top:2px">~/workspace</div>
        </div>
        <span class="tag tg-g">已授权</span>
      </div>
      <div class="f12 t2 ell">免远端令牌 · 自动走 <span class="mono">worktree</span> 隔离不脏工作区</div>
      <div class="cft"><span>识别 4 个本地 Git 仓</span><span class="ca">增减目录 ›</span></div>
    </div>
  </div>

  <div class="cgrp"><b>工单平台</b><span class="mono f11 t3">ticket_source</span><span class="csub">· 自动出现在开工引导第 1 步（可选）</span></div>
  <div class="c2g">
    <div class="cc">
      <div class="row g10">
        <span class="cic2" style="background:linear-gradient(155deg,#4C9AFF,#0052CC)">J</span>
        <div class="grow" style="min-width:0">
          <div class="row g6"><b class="f13" style="white-space:nowrap">公司 Jira</b><span class="tag tg-n" style="height:18px;font-size:10.5px">公司共用</span><span class="tag tg-b" style="height:18px;font-size:10.5px">官方</span></div>
          <div class="mono f11 t3 ell" style="margin-top:2px">https://jira.tita.cloud</div>
        </div>
        <span class="tag tg-g">鉴权通过</span>
      </div>
      <div class="f12 t2 ell">只读采集 · 自动收「AI修复」状态（每 2 分钟同步）</div>
      <div class="cft"><span>2 分钟前正常同步</span><span class="ca">改鉴权 / 触发 ›</span></div>
    </div>
    <div class="cc cc-err">
      <div class="row g10">
        <span class="cic2" style="background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">Tita</span>
        <div class="grow" style="min-width:0">
          <div class="row g6"><b class="f13" style="white-space:nowrap">Tita 工单</b><span class="tag tg-n" style="height:18px;font-size:10.5px">公司共用</span><span class="tag tg-b" style="height:18px;font-size:10.5px">官方</span></div>
          <div class="mono f11 t3 ell" style="margin-top:2px">https://openapi.tita.work</div>
        </div>
        <span class="tag tg-r">令牌已过期</span>
      </div>
      <div class="f12 ell" style="color:var(--ink-red)">已断 22 分钟 · <span class="mono">401 token expired</span>（恢复后补收）</div>
      <div class="cft"><span class="t2">仅影响 Tita 自动收单</span><span style="margin-left:auto"><button class="btn2 sm a-pri" style="height:24px;padding:0 11px;font-size:11.5px">更新令牌</button></span></div>
    </div>
  </div>

  <div class="cgrp"><b>发布与通知</b><span class="mono f11 t3">release_provider · notify_approval</span><span class="csub">· 不混入首次引导，按需启用</span></div>
  <div class="c2g">
    <div class="cc">
      <div class="row g10">
        <span class="cic2" style="background:linear-gradient(155deg,#FF8A7A,#E0281E)">{I("history",16,2)}</span>
        <div class="grow" style="min-width:0">
          <div class="row g6"><b class="f13" style="white-space:nowrap">Apollo 配置</b><span class="tag tg-o" style="height:18px;font-size:10.5px">仅我自己</span><span class="tag tg-t" style="height:18px;font-size:10.5px">市场</span></div>
          <div class="mono f11 t3 ell" style="margin-top:2px">https://apollo.tita.work</div>
        </div>
        <span class="tag tg-g">鉴权通过</span>
      </div>
      <div class="f12 t2 ell">本人账号 <span class="mono">lin.x</span> · 发布与回滚均以本人身份写回留痕</div>
      <div class="cft"><span>测试 / 正式环境</span><span class="ca">更新账号 ›</span></div>
    </div>
    <div class="cc cc-dash">
      <div class="row g6"><span style="color:var(--ink-blue)">{I("plus",15,2.4)}</span><b class="f13">接入更多外部平台</b></div>
      <div class="f12 t3" style="line-height:1.5">去插件市场装 GitHub / Gitee / 禅道 / 飞书审批，或直接配「通用 Git / Webhook / L2 MCP」连接器</div>
      <div class="row g6" style="margin-top:2px"><span class="tag tg-n" style="height:19px;font-size:10.5px">通用 Git</span><span class="tag tg-n" style="height:19px;font-size:10.5px">Webhook 映射</span><span class="tag tg-p" style="height:19px;font-size:10.5px">自定义 MCP</span></div>
    </div>
  </div>
</div>
</main>'''
    right = aside(
        f'''<div class="card" style="padding:12px 14px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border:1px solid color-mix(in srgb,var(--blue) 22%,transparent)">
  <div class="row g6"><span style="color:var(--ink-blue)">{I("rocket",14)}</span><span class="f13 w7 grow">跳过首次向导怎么补配？</span></div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">在这里补建连接器完成鉴权，再去「设置 → 项目」划定<b>可修改 / 仅查看</b>即可开工；数据与首次向导完全同源。</div>
  <button class="btn2 sm a-pri" style="width:100%;justify-content:center;margin-top:10px;height:30px">继续未完成的开工向导 ›</button></div>''',
        f'''<div class="card" style="padding:12px 14px">
  <div class="mini">插件按能力标签自动归类</div>
  <div class="f12 t3" style="margin-bottom:6px;line-height:1.5">无需官方写死白名单，插件 <span class="mono">manifest</span> 声明以下类别即自动出现在对应位置：</div>
  <div>
    <div class="catrow"><span class="tag tg-g" style="height:19px;font-size:10.5px">code_source</span><span class="t2 grow">代码存储 · 进向导第 1 步</span></div>
    <div class="catrow"><span class="tag tg-b" style="height:19px;font-size:10.5px">ticket_source</span><span class="t2 grow">工单平台 · 进向导第 1 步</span></div>
    <div class="catrow"><span class="tag tg-o" style="height:19px;font-size:10.5px">release</span><span class="t2 grow">发布回滚 · 不混入向导</span></div>
    <div class="catrow"><span class="tag tg-p" style="height:19px;font-size:10.5px">notify</span><span class="t2 grow">审批通知 · 不混入向导</span></div>
  </div></div>''',
        f'''<div class="card" style="padding:12px 14px">
  <div class="mini">非官方平台 3 档兼容</div>
  <div class="f12 t2" style="line-height:1.65">
    <b>1. 零代码通用兜底</b>：通用 Git（任意 URL + Token/SSH）与 Webhook 字段映射。<br>
    <b>2. 标准 MCP</b>：企业自研平台暴露 4～5 个标准 Tool 即接入。<br>
    <b>3. 市场插件</b>：按 <span class="mono">authSchema</span> 自动渲染鉴权抽屉。
  </div></div>''')
    return set_left("连接器") + main + right


PAGES = {
    "ai": ("AI 助手", "ai", p_ai()),
    "newticket": ("手动新建工单", "chat", p_newticket()),
    "code": ("代码改动", "chat", p_code()),
    "evidence": ("证据", "chat", p_evidence()),
    "log": ("执行日志 · 报错", "chat", p_log()),
    "ask": ("Bot 在问你", "chat", p_ask()),
    "reject": ("打回原因", "chat", p_reject()),
    "approve": ("审核通过 · 有未测项", "chat", p_approve()),
    "release": ("发布", "pub", p_release(False)),
    "tkrelease": ("工单 · 发布", "chat", p_release()),
    "prod": ("发布 · 发正式", "pub", p_prod()),
    "waittest": ("发布 · 等复测", "pub", p_waittest(), "王某"),
    "pubfail": ("发布 · 失败", "pub", p_pubfail()),
    "bundle": ("大包明细", "pub", p_bundle()),
    "rollback": ("紧急回滚", "rb", p_rollback()),
    "skills": ("Skills", "sk", p_skills()),
    "skhistory": ("Skills · 版本历史", "sk", p_skhistory()),
    "skimport": ("Skills · 导入", "sk", p_skimport()),
    "settings": ("设置 · 项目", "set", p_settings()),
    "aiset": ("设置 · 全局 AI", "set", p_aiset()),
    "runners": ("设置 · 执行器", "set", p_runners()),
    "connectors": ("设置 · 连接器", "set", p_connectors()),
    "source": ("设置 · 来源采集", "set", p_source()),
    "members": ("设置 · 成员与身份", "set", p_members()),
    "notify": ("设置 · 通知", "set", p_notify()),
    "myacct": ("设置 · 我的账号", "set", p_myacct()),
    "edge": ("边界状态", None, p_edge()),
    "empty": ("空状态", None, p_empty()),
    "empty2": ("空状态 · 二", None, p_empty2()),
    "queue": ("排队", None, p_queue()),
    "working": ("工单 · 修复中", "chat", p_working()),
    "pubbefore": ("工单 · 发测试前", "chat", p_pubbefore()),
    "acctneed": ("工单 · 第一次发布配账号", "chat", p_acctneed()),
    "mrmain": ("发布 · 合回主分支 MR 审核", "pub", p_mrmain()),
    "confirm": ("工单 · 待原平台确认", "chat", p_confirm()),
    "pubpassed": ("工单 · 发布 · 复测通过", "chat", p_pubpassed()),
}
