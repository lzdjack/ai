#!/usr/bin/env python3
"""生成移动端其余页面：reference/src/v5/m-*.html（每张 3 台手机，画布 1440 × 1000）。
用法：python3 scripts/gen-mobile-pages.py
外壳（状态栏、Tab 栏、头像行）来自 shell_m.py，与定稿 v4/mobile.html 一致。
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status, tabbar, row  # noqa: E402


def I(n, s=16, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else "") + (f' style="{st}"' if st else "") + "></i>"


def phone(inner, extra=""):
    return f'<div class="phone"><div class="scr">{status}{inner}{extra}<div class="home"></div></div></div>'


def nav(back, title, right=None):
    if right is None:
        r = f'<span class="nb2 glass">{I("more",18)}</span>'
    elif right == "":
        r = '<span aria-hidden="true"></span>'
    else:
        r = right
    return f'<div class="nav"><span class="bk">{I("chevr",20,st="transform:rotate(180deg)")}{back}</span><span style="text-align:center;font-weight:600;font-size:15px">{title}</span>{r}</div>'


def seg(items, on):
    return '<div class="cc-m-seg" style="margin-top:12px">' + "".join(f'<span{" class=\"on\"" if i == on else ""} style="padding:0 4px">{t}</span>' for i, t in enumerate(items)) + "</div>"


def review_dock():
    return f'''<div class="dock2 glass">
  <div class="row g12"><button class="abtn a-red" style="flex:1;height:44px;justify-content:center;border-radius:14px">{I("undo",15)}打回</button><button class="abtn a-pri" style="flex:1.6;height:44px;justify-content:center;border-radius:14px">{I("check",16,2.6)}审核通过 a3f9c21</button></div>
  <div class="cmp"><span class="aitag"><span class="aid">{I("spark",11)}</span>本单 AI</span><span class="grow t3 ell">问这张单，或让 Bot 再做点什么…</span><span class="snd">{I("arrowup",15,2.4)}</span></div>
</div>'''


def thead(title, tags, tab):
    return f'''<div class="pad" style="padding-top:2px">
  <div class="row g12" style="align-items:flex-start"><span class="appic ic-tita" style="width:40px;height:40px;border-radius:11px;font-size:11px;font-weight:800">TITA</span>
  <div class="grow" style="min-width:0"><div style="font-size:17px;font-weight:700;line-height:1.3" class="ell">{title}</div><div class="row g6" style="margin-top:5px">{tags}</div></div></div>
  {seg(["对话", "改动 3", "证据 4", "日志", "发布"], tab)}
</div>'''


TAGS = '<span class="tg" style="color:var(--ink-red);background:color-mix(in srgb,var(--red) 12%,transparent)">P1</span><span class="tg" style="color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 12%,transparent)">待我审核 · 第 2 轮</span>'
K = lambda s: f'<span class="kw">{s}</span>'
F = lambda s: f'<span class="fn">{s}</span>'


def cl(n, t, c):
    sg = "+" if "add" in t else ("−" if "del" in t else "")
    return f'<div class="l {t}"><span class="n">{n}</span><span class="s">{sg}</span><span class="c">{c}</span></div>'


# ============ 板 1：代码与审核 ============
def m_code():
    code = "".join([
        '<div class="hk">@@ −42,6 +43,10 @@ GroupPicker</div>',
        cl(43, "", f" {K('const')} {F('onSelectGroup')} = (id) =&gt; {{"),
        cl(44, "", f"   {F('setActive')}(id);"),
        cl(44, "del", f"   {F('fetchMembers')}(id).{F('then')}(l =&gt; {{"),
        cl(45, "add", f"   reqRef.current?.{F('abort')}();"),
        cl(46, "add", f"   {K('const')} req = {F('abortable')}(…);"),
        cl(47, "add", "   reqRef.current = req;"),
        cl(48, "add sel", f"   req.promise.{F('then')}(l =&gt; {{"),
        cl(49, "add", f"     {K('if')} (req.aborted) {K('return')};"),
        cl(50, "", f"     {F('setMembers')}(l);"),
        cl(51, "", "   });"),
    ])
    inner = f'''{nav("工单", "代码改动")}
<div class="pad" style="padding-top:2px">
  <div class="row g8"><div class="cc-m-select grow"><span class="tag tg-o">M</span><span class="cc-sel-val mono">GroupPicker.tsx</span><span class="cc-sel-sp"></span><span class="f13 t3">1 / 3</span><span class="cc-sel-caret">{I("chevd",14)}</span></div></div>
  <div class="row g8" style="margin-top:8px"><div class="cc-m-seg" style="flex:1"><span>相对基线</span><span class="on">相对上轮</span></div><span class="f12 t3 mono">a3f9c21</span></div>
  <div class="cd" style="margin-top:10px">{code}</div>
  <div class="card2" style="margin-top:10px;padding:11px 12px">
    <div class="row g6"><span class="f12 t3">选中第 48 行</span><span class="grow"></span><span class="f12 lnk">查看完整文件</span></div>
    <div class="row g8" style="margin-top:8px;align-items:flex-start"><span class="aid" style="width:20px;height:20px;border-radius:6px;flex:none">{I("spark",11)}</span><span class="f13 t2" style="line-height:1.55">改成可取消的请求，第 49 行丢掉晚返回的旧结果，避免覆盖新分组。依据 <span class="mono lnk">:45–49</span></span></div>
    <div class="row g8" style="margin-top:10px"><span class="chip" style="background:var(--fill);height:30px;font-size:12px">{I("send",12)}发给 Bot</span><span class="chip" style="background:color-mix(in srgb,var(--red) 12%,transparent);color:var(--ink-red);height:30px;font-size:12px">{I("undo",12)}附到打回</span></div>
  </div>
</div>{review_dock()}'''
    return phone(inner)


def m_reject():
    bg = f'''{nav("工单", "TK-20871")}{thead("发起审批时点击分组，界面卡住", TAGS, 0)}
<div class="pad"><div class="dv"><span>第 2 轮 · 今天 14:10</span></div><div class="dcard glass" style="height:300px"><div class="row"><span class="grow" style="font-size:15px;font-weight:700">第 2 轮交付：已修复</span></div><div class="kv"><b>根因</b>切换分组时旧请求晚返回。</div></div></div>'''
    sheet = f'''<div class="scrim"></div><div class="sheet">
  <div class="grab"></div>
  <div class="row g8"><span class="ttl grow">打回第 2 轮</span><span class="f13 t3">取消</span></div>
  <div class="f12 t3" style="margin-top:2px">审核对象 <span class="mono">a3f9c21</span> · 原样交给 Bot-01</div>
  <div class="flb">打回原因</div>
  <div class="fld focus" style="min-height:96px">管理员切到「销售部」还是会卡一下。第 49 行直接 return，加载态没收起来。<span class="cur"></span></div>
  <div class="row g8" style="margin-top:8px;flex-wrap:wrap"><span class="chip" style="background:var(--fill);height:26px;font-size:12px">问题仍存在</span><span class="chip" style="background:var(--fill);height:26px;font-size:12px">验证不充分</span><span class="chip" style="background:var(--fill);height:26px;font-size:12px">改法不认可</span></div>
  <div class="flb">附上</div>
  <div class="row g8 flat2" style="padding:9px 11px"><span class="tag tg-o">M</span><span class="mono f12 w6">GroupPicker.tsx:49</span><span class="grow"></span><span class="t3">{I("x",14)}</span></div>
  <div class="row g8" style="margin-top:8px"><div class="shw" style="width:92px;height:60px;flex:none"><div class="shot" data-s="before" data-cap="none" style="width:230px;height:150px;transform:scale(.4)"></div></div><div class="col" style="width:60px;height:60px;border-radius:12px;border:1.5px dashed var(--border-ctl-hover);align-items:center;justify-content:center;color:var(--text-3)">{I("plus",18)}</div>
    <div class="col g4 grow" style="padding-left:4px"><span class="row g8 f12" style="min-height:28px"><span class="cbx on">{I("check",12,3)}</span>下一轮用管理员复测</span><span class="row g8 f12" style="min-height:28px"><span class="cbx on">{I("check",12,3)}</span>展示相对本轮改动</span></div></div>
  <button class="bigbtn" style="margin-top:16px;background:var(--btn-danger-bg);color:#fff;box-shadow:0 10px 22px -10px color-mix(in srgb,var(--btn-danger-bg) 80%,transparent)">{I("undo",16)}打回并通知 Bot</button>
  <div class="f11 t3" style="text-align:center;margin-top:8px">PC 端会同步显示这条意见和代码位置</div>
</div>'''
    return phone(bg, sheet)


def m_ask():
    inner = f'''{nav("工单", "TK-20862")}
{thead("考勤：按部门筛选后列表没变化", '<span class="tg" style="color:var(--ink-orange);background:color-mix(in srgb,var(--orange) 14%,transparent)">需要协助 · Bot 在问你</span>', 0)}
<div class="pad">
  <div class="dv"><span>第 1 轮 · 13:20 · 已暂停等你回复</span></div>
  <div class="dcard glass" style="margin-top:0;box-shadow:0 0 0 2px color-mix(in srgb,var(--orange) 55%,transparent)">
    <div class="row g8"><span class="ck2" style="width:24px;height:24px;border-radius:7px;background:var(--btn-warn-bg)">{I("msgq",14,2.2)}</span><span class="grow" style="font-size:15.5px;font-weight:700">复现要用哪个角色？</span><span class="f11 t3">Bot-03</span></div>
    <div class="f13 t2" style="margin-top:8px;line-height:1.6">原单没写角色。我用<b style="color:var(--text)">管理员</b>筛选「研发中心」，列表正常变化，<b style="color:var(--text)">没有复现</b>。问题可能只在部门负责人或普通员工下出现。</div>
    <div class="row g8" style="margin-top:12px;flex-wrap:wrap"><span class="qr">用普通员工</span><span class="qr">用部门负责人</span><span class="qr">两个都测</span><span class="qr" style="color:var(--text-2);border-color:var(--border-ctl)">我来复现</span></div>
  </div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><span class="ubub">用普通员工，账号 kq-staff-03</span></div>
  <div class="row g6 f12" style="justify-content:flex-end;margin-top:6px;color:var(--ink-green)"><span class="ck2" style="width:16px;height:16px;background:var(--btn-ok-bg)">{I("check",10,3)}</span>Bot-03 已采纳 · 正在复现</div>
  <div class="row g8 flat2" style="margin-top:10px;min-height:var(--m-row-h);padding:9px 11px"><span class="cbx"></span><span class="f12 t2 grow">保存为「考勤」项目规则</span><span class="f11 t3">只对本单生效</span></div>
</div>
<div class="dock2 glass"><div class="cmp"><span class="aitag"><span class="aid">{I("spark",11)}</span>本单 AI</span><span class="grow t3 ell">补充资料，或让 Bot 再做点什么…</span><span class="snd">{I("arrowup",15,2.4)}</span></div></div>'''
    return phone(inner)


# ============ 板 2：证据 · 报错 · 发布 ============
def m_evidence():
    def md(kind, cap, tag, tc, seen, ring=""):
        return f'''<div class="col g4" style="min-width:0"><div class="shw" style="height:92px{ring}"><div class="shot" data-s="{kind}" data-cap="{cap}" style="width:230px;height:150px;transform:scale(.71)"></div></div><div class="row g4"><span class="tag tg-{tc}" style="height:18px;font-size:11px">{tag}</span><span class="grow"></span><span class="f11 {"t3" if seen else "lnk w6"}">{"已查阅" if seen else "未查阅"}</span></div></div>'''
    chk = [("orange", "!", "管理员角色未执行 · 缺账号", "补充"), ("green", "✓", "进入发起审批", "录屏 0:00"), ("green", "✓", "点击分组 1 → 2 → 3", "录屏 0:12"), ("green", "✓", "仍可选择审批人", "截图 2")]
    _bg = {"green": "background:var(--btn-ok-bg);color:#fff", "orange": "background:color-mix(in srgb,var(--orange) 18%,transparent);color:var(--ink-orange)"}
    ck = "".join(f'<div class="ir" style="font-size:13.5px"><span class="ck2" style="{_bg[c]}">{g}</span><span class="grow{" w6" if c=="orange" else ""}"{" style=\"color:var(--ink-orange)\"" if c=="orange" else ""}>{t}</span><em class="lnk" style="color:var(--ink-blue)">{e}</em></div>' for c, g, t, e in chk)
    inner = f'''{nav("工单", "TK-20871")}{thead("发起审批时点击分组，界面卡住", TAGS, 2)}
<div class="pad">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
    {md("before","原单截图","原单材料","n",True)}{md("before","修前 · 0:18","修前复现","o",True)}
    {md("after","修后 · 0:41","修后复测","g",False,";box-shadow:0 0 0 2px var(--green)")}
    <div class="col g4"><div class="col" style="height:92px;border-radius:10px;border:1.5px dashed color-mix(in srgb,var(--orange) 55%,transparent);align-items:center;justify-content:center;gap:4px;color:var(--ink-orange);background:color-mix(in srgb,var(--orange) 6%,transparent)">{I("alert",18)}<span class="f12 w6">管理员未测</span></div><div class="row g4"><span class="tag tg-o" style="height:18px;font-size:11px">待确认</span></div></div>
  </div>
  <div class="sec2">验证记录<em>测试环境 2.18.0-fix.2 · 普通员工</em></div>
  <div class="grp glass">{ck}</div>
</div>{review_dock()}'''
    return phone(inner)


def m_error():
    err = '''<span class="d">14:32:07 goto /okr/progress?period=2026Q4</span>
<span class="e">Error: Navigation blocked — 403</span>
  at checkAccess (guard.ts:88:11)
  response: {"code":40301,"msg":"当前账号无 OKR 进度查看权限"}
  cookie: tita_sid=<span class="w">••••（已脱敏）</span>
<span class="e">exited with code 1</span> <span class="d">after 00:41</span>'''
    st = [("ok", "✓", "收单 · 复现 · 定位 · 改代码", "13:40 – 14:18", ""), ("err", "!", "浏览器验证 · 受阻", "第 2 次尝试 14:32 · 退出码 1", "red"), ("wait", "6", "交付", "等待", "")]
    vs = ""
    for i, (c, g, t, d, col) in enumerate(st):
        line = f'<i class="{"ok" if c=="ok" else ""}"></i>' if i < 2 else ""
        vs += f'<div class="vs"><div class="rl"><span class="vd {c}">{g}</span>{line}</div><div class="bd" style="padding-bottom:{12 if i<2 else 0}px"><div class="f14 w6"{" style=\"color:var(--ink-red)\"" if col else ""}>{t}</div><div class="f12 t3">{d}</div></div></div>'
    inner = f'''{nav("工单", "OKR-2231")}
<div class="pad" style="padding-top:2px">
  <div class="row g12" style="align-items:flex-start"><span class="appic ic-jira" style="width:40px;height:40px;border-radius:11px;font-size:11px;font-weight:800">JIRA</span><div class="grow"><div style="font-size:17px;font-weight:700;line-height:1.3">切换周期后进度条不刷新</div><div class="row g6" style="margin-top:5px"><span class="tg" style="color:var(--ink-orange);background:color-mix(in srgb,var(--orange) 14%,transparent)">需要协助 · 验证受阻</span></div></div></div>
  {seg(["对话", "改动 2", "证据 3", "日志", "发布"], 3)}
  <div class="card2" style="margin-top:12px">{vs}</div>
  <div class="row g8" style="margin:12px 2px 6px"><span class="f13 w7" style="color:var(--ink-red)">报错原文</span><span class="grow"></span><span class="chip" style="background:var(--fill);height:26px;font-size:12px">{I("copy",12)}复制</span><span class="chip" style="background:var(--fill);height:26px;font-size:12px">{I("terminal",12)}上下文</span></div>
  <div class="errm">{err}</div>
  <div class="ains" style="margin-top:10px"><b style="color:var(--ink-purple)">AI 解读 · 待核实</b>　能确认复测受阻（账号无权限）；不能确认代码是否生效。换一个有 OKR 查看权限的账号再试。<span class="t3">依据：日志 204–211 行</span></div>
</div>
<div class="dock2 glass"><div class=\"row g12\"><button class="abtn a-sec" style="flex:1;height:44px;justify-content:center;border-radius:14px">人工接手</button><button class="abtn a-pri" style="flex:1.6;height:44px;justify-content:center;border-radius:14px">{I("refresh",15)}补充账号后重试</button></div></div>'''
    return phone(inner)


def m_release():
    """和 PC 发布详情同一套骨架：工单条 → 环境 → 5 步 → 这次发出去的包 → 测试人。"""
    st = [("ok", "✓", "合入测试分支", "陈某审核通过 · MR !318"), ("ok", "✓", "打包上传", "tita build · 1 分 12 秒"), ("ok", "✓", "发布到测试", "tita release · 6 秒"),
          ("run", I("loader", 12, 2.6), "核对生效", "读 Apollo 提交号…"), ("wait", "5", "通知测试人", "对上后发送")]
    vs = ""
    for i, (c, g, t, d) in enumerate(st):
        line = f'<i class="{"ok" if c=="ok" else ""}"></i>' if i < 4 else ""
        vs += f'<div class="vs"><div class="rl"><span class="vd {c}">{g}</span>{line}</div><div class="bd row g8" style="padding-bottom:{8 if i<4 else 0}px;align-items:flex-start"><span class="f14 w6" style="flex:none">{t}</span><span class="f12 t3 grow ell" style="text-align:right;margin-top:2px">{d}</span></div></div>'
    ck = lambda c, g: f'<span class="vd" style="width:20px;height:20px;font-size:11px;{"background:var(--btn-ok-bg);color:#fff" if c=="green" else "background:color-mix(in srgb,var(--orange) 18%,transparent);color:var(--ink-orange)"}">{g}</span>'
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">TK-20871 第 2 轮 · 关掉 App 不影响</div><div class="lgt" style="font-size:28px">发布到测试</div></div><span class="tag tg-t" style="height:24px;font-size:12px">发布中 4/5</span></div>
  <div class="row g8 flat2" style="margin-top:10px;padding:8px 10px"><span class="appic ic-tita" style="width:26px;height:26px;border-radius:7px;font-size:12px;font-weight:800">T</span><span class="f13 w6 grow ell">发起审批时点击分组，界面卡住</span><span class="lnk f13 w6" style="flex:none">进入工单 ›</span></div>
  <div class="card2" style="margin-top:10px">
    <div class="row g8"><span class="f12 w6 grow">测试环境 <span class="tag tg-t" style="margin-left:4px">核对中</span></span><span class="mono f15 w6">2.17.4</span><span class="t3">{I("arrowr",14)}</span><span class="mono f15 w7" style="color:var(--ink-blue)">2.18.0-fix.2</span></div>
    <div class="row g8" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--hair)"><span class="f12 t2" style="flex:none">正式环境 2.17.4</span><span class="f12 t3 grow ell" style="text-align:right">测试通过 → 合回主分支 → 重新打包</span></div>
  </div>
  <div class="card2" style="margin-top:10px">{vs}</div>
  <div class="sec2">这次发出去的包<em>dev-approval</em></div>
  <div class="grp glass">
    <div class="ir" style="font-size:13.5px">{ck("green","✓")}<span class="grow ell"><b class="w6">本单改动已在包里</b> <span class="t3 f12">MR !318 · 3 个文件</span></span></div>
    <div class="ir" style="font-size:13.5px">{ck("orange","!")}<span class="grow ell"><b class="w6">还会带上别人的 4 个提交</b></span><span class="lnk f13">查看</span></div>
  </div>
  <div class="row g10 flat2" style="margin-top:10px"><span class="av2" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">测试人 王某</span><span class="f11 t3">提交号对上后通知</span></div><span class="lnk f13">更换</span></div>
</div>{tabbar("pub", 21)}'''
    return phone(inner)


# ============ 板 3：大包 · 紧急回滚 ============
def m_bundle():
    st = [("ok", "✓", "组件 C · tita-ui-kit", "1.4.2 → 1.4.3 · 已发布", "", ""),
          ("ok", "✓", "子项目 A · approval-web", "依赖 C 1.4.3 · 3.8.2 已生效", "", ""),
          ("err", "!", "子项目 B · workflow-web", "依赖已升级 · 构建失败 退出码 2", "red", "err"),
          ("wait", "4", "主站 · tita-main", "不需发布 · 等待 B 后从入口验证", "", "")]
    vs = ""
    for i, (c, g, t, d, col, ex) in enumerate(st):
        line = f'<i class="{"ok" if c=="ok" else ""}"></i>' if i < 3 else ""
        more = ""
        if ex:
            more = '<div class="errm" style="margin-top:8px;font-size:11px;line-height:17px"><span class="e">NodeEditor.tsx(126,18): TS2339</span>\nProperty \'onGroupChange\' does not exist on type \'GroupPickerProps\'.</div>'
        vs += f'<div class="vs"><div class="rl"><span class="vd {c}">{g}</span>{line}</div><div class="bd" style="padding-bottom:{12 if i<3 else 0}px"><div class="f14 w6"{" style=\"color:var(--ink-red)\"" if col else ""}>{t}</div><div class="f12 t3">{d}</div>{more}</div></div>'
    inner = f'''{nav("发布", "大包明细")}
<div class="pad" style="padding-top:2px">
  <div class="ttl" style="font-size:20px">审批分组修复</div>
  <div class="row g6" style="margin-top:6px"><span class="tag tg-r">部分完成 · B 构建失败</span><span class="f12 t3">测试环境 · 15:20</span></div>
  <div class="card2" style="margin-top:12px">{vs}</div>
  <div class="ains" style="margin-top:10px"><b style="color:var(--ink-purple)">AI 建议 · 待核实</b>　C 1.4.3 把 onGroupChange 改名为 onChange，B 仍用旧名。</div>
  <div class="row g8 flat2" style="margin-top:10px"><span class="tag tg-n">整包提测通知</span><span class="f12 t2">等 B 生效、主站核实后发送</span></div>
</div>
<div class="dock2 glass"><button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;height:48px">{I("refresh",16)}从 B 构建重试</button><div class="f11 t3" style="text-align:center">先核对 C、A 产物，不重发 C</div></div>'''
    return phone(inner)


def m_rb_preview():
    dif = [("approval.web.version", "3.8.2", "3.8.1", "b"), ("approval.web.cdn", "…/3.8.2/", "…/3.8.1/", "b"), ("feature.kanban.v2", "true", "false", "o")]
    dr = "".join(f'<div class="ir" style="min-height:48px;font-size:12.5px;{"background:color-mix(in srgb,var(--orange) 9%,transparent)" if c=="o" else ""}"><div class="col grow" style="min-width:0"><span class="mono f12 w6 ell">{k}</span><span class="mono f12"><span style="color:var(--ink-red);text-decoration:line-through">{a}</span> → <b style="color:var(--ink-green)">{b}</b></span></div><span class="tag tg-{c}">{"回退" if c=="b" else "连带恢复"}</span></div>' for k, a, b, c in dif)
    inner = f'''{nav("回滚", "Tita_Static · Apollo")}
<div class="pad">
  <div class="row" style="margin-top:2px"><div class="grow"><div class="lgt" style="font-size:24px">紧急回滚</div></div><span class="tag tg-r" style="height:24px;font-size:12px">PRO 正式</span></div>
  <div class="card2" style="margin-top:8px;padding:10px 12px">
    <div class="row g10"><div class="col grow"><span class="f11 t3">当前生效</span><span class="mono f16 w6">3.8.2</span><span class="f11 t3">11-20 14:05</span></div><span class="t3">{I("arrowr",16)}</span><div class="col grow" style="align-items:flex-end"><span class="f11 t3">回到</span><span class="mono f16 w7" style="color:var(--ink-green)">3.8.1</span><span class="f11" style="color:var(--ink-green)">验证通过 · 7 天</span></div></div>
  </div>
  <div class="sec2" style="margin-top:10px">配置差异<em>整个 Namespace 回退</em></div>
  <div class="grp glass">{dr}</div>
  <div class="f12" style="color:var(--ink-orange);margin:6px 4px 0;line-height:1.45">会连带关掉看板新版开关（11-19 单独打开的）。</div>
  <div class="flb" style="margin-top:8px">回滚理由</div>
  <div class="fld" style="font-size:13px;padding:8px 11px">审批发起页白屏，先回退再查根因</div>
  <div class="flb" style="margin-top:8px">输入 PRO 确认</div>
  <div class="fld focus mono" style="font-size:14px;padding:8px 11px">PRO<span class="cur"></span></div>
</div>
<div class="dock2 glass"><button class="bigbtn" style="background:var(--btn-danger-bg);color:#fff;height:48px;box-shadow:0 10px 22px -10px color-mix(in srgb,var(--btn-danger-bg) 80%,transparent)">{I("history",16)}确认回滚到 3.8.1</button><div class="f11 t3" style="text-align:center">AI 只准备预览，回滚需要你本人确认</div></div>'''
    return phone(inner)


def m_rb_result():
    st = [("ok", "✓", "请求结果", "Apollo 已接受回滚 · 15:42:08"), ("ok", "✓", "配置回读", "approval.web.version = 3.8.1"), ("run", I("loader", 12, 2.6), "业务入口验证", "/approval 仍有 32% 请求加载 3.8.2 资源")]
    vs = ""
    for i, (c, g, t, d) in enumerate(st):
        line = f'<i class="{"ok" if c=="ok" else ""}"></i>' if i < 2 else ""
        vs += f'<div class="vs"><div class="rl"><span class="vd {c}">{g}</span>{line}</div><div class="bd" style="padding-bottom:{12 if i<2 else 0}px"><div class="f14 w6">{t}</div><div class="f12 t3">{d}</div></div></div>'
    inner = f'''<div class="notif glass" style="margin-top:4px"><span class="ap ap-rb" style="width:34px;height:34px;border-radius:9px;transform:none;flex:none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.8 4.8v4.4h4.4"/><path d="M4.2 9.2A8.3 8.3 0 1 1 3.9 13.6"/><path d="M12 8v4.2l2.7 1.7"/></svg></span><div class="col grow" style="min-width:0"><div class="row"><span class="f13 w7 grow">云匠</span><span class="f11 t3">现在</span></div><span class="f13" style="line-height:1.4">PRO 配置已回退到 3.8.1，业务恢复待验证</span></div></div>
<div class="pad">
  <div class="row" style="margin-top:12px"><div class="grow"><div class="cap">PRO · 林某 · 15:42</div><div class="lgt" style="font-size:26px">回滚结果</div></div></div>
  <div class="row g8" style="margin-top:10px;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--orange) 13%,transparent)"><span style="color:var(--ink-orange)">{I("alert",18)}</span><div class="col"><span class="f14 w7">配置已回退，业务恢复待验证</span><span class="f12 t2">不宣告故障已恢复</span></div></div>
  <div class="card2" style="margin-top:10px">{vs}</div>
  <div class="sec2">记录</div>
  <div class="grp glass">
    <div class="ir" style="font-size:13.5px"><span class="t2">前后版本</span><em class="mono">3.8.2 → 3.8.1</em></div>
    <div class="ir" style="font-size:13.5px"><span class="t2">理由</span><em>发起页白屏</em></div>
    <div class="ir" style="font-size:13.5px"><span class="t2">证据</span><em class="lnk" style="color:var(--ink-blue)">回读截图 · 入口录屏</em></div>
  </div>
  <button class="bigbtn" style="margin-top:12px;background:var(--glass-2);border:1px solid var(--border-ctl);color:var(--text)">{I("link",15)}关联到工单，让 Bot 查根因</button>
</div>{tabbar("rb", 22)}'''
    return phone(inner)


# ============ 板 4：Skills · 设置 ============
def m_skills():
    def sk(n, d, kind, extra=""):
        bg = "linear-gradient(160deg,#5AA0FF,#1F6FFF)" if kind == "编码" else "linear-gradient(160deg,#5EDB7A,#28B04F)"
        return f'<div class="lr"><span class="av2" style="width:38px;height:38px;border-radius:11px;background:{bg}">{I("code" if kind=="编码" else "eye",18,2)}</span><div class="grow mn"><div class="row g6"><span class="lt ell grow">{n}</span>{extra}</div><div class="ls ell" style="margin-top:2px">{d}</div></div></div>'
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">编码和验证规则</div><div class="lgt">Skills</div></div><span class="nb2 glass">{I("download",17)}</span><span class="nb2" style="margin-left:8px;background:var(--btn-pri-bg);color:#fff">{I("plus",18,2.4)}</span></div>
  <div class="cc-m-seg" style="margin-top:12px"><span class="on">全部</span><span>编码</span><span>验证</span></div>
  <div class="gh">我的<span>3</span></div>
  <div class="grp glass">
    {sk("页面交互回归 · 我的版本","草稿 v2 · PC 15:02 保存","验证",'<span class="tag tg-o">草稿</span>')}
    {sk("复用表单组件","审批 · 考勤 在用","编码")}
    {sk("权限类问题先换角色","从对话保存 · 考勤","验证")}
  </div>
  <div class="gh">平台内置<span>3</span></div>
  <div class="grp glass">
    {sk("页面交互回归","OKR · 审批 在用","验证",'<span class="tag tg-n">内置</span>')}
    {sk("最小改动修复","全局默认","编码",'<span class="tag tg-n">内置</span>')}
  </div>
</div>{tabbar("sk", 23)}'''
    return phone(inner)


def m_skill_edit():
    body = [("## 复现", "h"), ("1. 用工单指定角色登录；没写就先问。", ""), ("2. 按复现路径操作，录屏保留最后一次交互。", ""),
            ("3. 每次切换分组、筛选后，等列表加载完再点。", "add"), ("## 复测", "h"), ("1. 在包含改动的版本上重走复现路径。", "")]
    bl = "".join(f'<div class="l{" add" if t=="add" else ""}" style="line-height:24px;white-space:normal"><span class="c" style="padding:0 10px;{"color:var(--ink-purple);font-weight:600" if t=="h" else ""}">{c}</span></div>' for c, t in body)
    inner = f'''{nav("Skills", "编辑草稿", '<span class="lnk" style="font-size:15px;font-weight:600;justify-self:end;min-height:var(--m-touch);display:inline-flex;align-items:center">保存</span>')}
<div class="pad" style="padding-top:2px">
  <div class="row g8 flat2" style="background:color-mix(in srgb,var(--blue) 10%,transparent)">{I("monitor",15,st="color:var(--ink-blue)")}<span class="f12 t2 grow">接着 PC 上 15:02 保存的草稿继续写</span></div>
  <div class="flb">名称</div><div class="fld">页面交互回归 · 我的版本</div>
  <div class="flb">用途</div><div class="fld" style="font-size:13px">表单页面的交互类 Bug，复现和复测都留页面操作证据。</div>
  <div class="flb" style="display:flex">规则正文<span style="margin-left:auto;font-weight:400" class="t3">Markdown</span></div>
  <div class="cd" style="font-size:12px;padding:6px 0">{bl}</div>
  <div class="gbm" style="margin-top:10px;border-radius:14px;padding:10px 12px;background:var(--glass-2);display:flex;gap:8px;align-items:center"><span class="aid" style="width:22px;height:22px;border-radius:7px;flex:none">{I("spark",12)}</span><span class="f12 t2 grow">AI 已按你的描述加了第 3 条（绿色）</span><span class="chip" style="height:26px;font-size:12px;background:var(--btn-pri-bg);color:#fff">采用</span></div>
</div>
<div class="dock2 glass"><button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;height:48px">启用到项目…</button><div class="f11 t3" style="text-align:center">下一轮任务生效，进行中的任务沿用 v1</div></div>'''
    return phone(inner)


MKT_SVG_SM = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2" fill="#fff"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2" fill="#fff" opacity=".82"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2" fill="#fff" opacity=".82"/><path d="M16.9 13.2l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#fff"/></svg>'


def m_settings():
    def ir(ic, bg, t, e="", badge="", raw=None):
        b = f'<span class="tag tg-r" style="min-width:20px;justify-content:center;border-radius:10px">{badge}</span>' if badge else ""
        icon = raw if raw is not None else I(ic, 15, 2)
        return f'<div class="ir"><span class="ii" style="background:{bg}">{icon}</span><span class="grow">{t}</span>{b}<em>{e}{I("chevr",14)}</em></div>'
    inner = f'''{nav("工单", "设置", "")}
<div class="pad" style="height:714px;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,#000 92%,transparent);mask-image:linear-gradient(180deg,#000 92%,transparent)">
  <div class="grp glass" style="margin-top:2px;padding:8px 12px;display:flex;align-items:center;gap:12px"><span class="me" style="width:40px;height:40px;font-size:15px">林</span><div class="col grow"><span class="f15 w7">林某</span><span class="f12 t3">云匠账号 · 审批项目管理员</span></div>{I("chevr",15,st="color:var(--text-3)")}</div>
  <div class="gh" style="padding:10px 6px 4px">收单（按已接入工单连接器）</div>
  <div class="grp glass">
    <div class="ir"><span class="sc sc-j">Jira</span><span class="grow">状态「AI修复」</span><em style="color:var(--ink-green);font-weight:600">2 分钟前</em></div>
    <div class="ir"><span class="sc sc-t">Tita</span><span class="grow">节点「AI干活」</span><em style="color:var(--ink-orange);font-weight:600">失败 · 重试中</em></div>
  </div>
  <div class="gh" style="padding:10px 6px 4px">AI 与插件</div>
  <div class="grp glass">
    {ir("spark","linear-gradient(160deg,#C58BFF,#6A3DF0)","全局 AI","Pi · 多模型")}
    {ir("","linear-gradient(155deg,#34D399,#0284C7)","插件市场","已装 4",raw=MKT_SVG_SM)}
    {ir("link","linear-gradient(160deg,#38BDF8,#2563EB)","连接器","5 个 · 1 过期")}
    {ir("layers","linear-gradient(160deg,#5AA0FF,#1F6FFF)","项目","OKR 差 1 项")}
    {ir("users","linear-gradient(160deg,#5EDB7A,#28B04F)","组织、角色与身份","",'1')}
  </div>
  <div class="gh" style="padding:10px 6px 4px">我自己</div>
  <div class="grp glass">
    {ir("key","linear-gradient(160deg,#FFC15A,#F08A00)","我的账号与外观","动态凭据与语言")}
    {ir("bell","linear-gradient(160deg,#FF8A7A,#E0281E)","通知","免打扰 22:00")}
    <div class="ir"><span class="ii" style="background:linear-gradient(160deg,#A9AEB8,#6E737D)">{I("monitor",15,2)}</span><span class="grow">执行器状态</span><em style="color:var(--ink-green);font-weight:600">本机在线</em></div>
  </div>
</div>'''
    return phone(inner)


# ============ 板：发布的三种状态（同一套骨架） ============
def _mck(c, g):
    st = "background:var(--btn-ok-bg);color:#fff" if c == "green" else "background:color-mix(in srgb,var(--orange) 18%,transparent);color:var(--ink-orange)"
    return f'<span class="vd" style="width:20px;height:20px;font-size:11px;{st}">{g}</span>'


def _msteps(st):
    vs = ""
    n = len(st)
    for i, (c, g, t, d) in enumerate(st):
        line = f'<i class="{"ok" if c=="ok" else ""}"></i>' if i < n - 1 else ""
        vs += f'<div class="vs"><div class="rl"><span class="vd {c}">{g}</span>{line}</div><div class="bd row g8" style="padding-bottom:{8 if i<n-1 else 0}px;align-items:flex-start"><span class="f14 w6" style="flex:none">{t}</span><span class="f12 t3 grow ell" style="text-align:right;margin-top:2px">{d}</span></div></div>'
    return f'<div class="card2" style="margin-top:10px">{vs}</div>'


def _mtk(title):
    return f'<div class="row g8 flat2" style="margin-top:10px;padding:8px 10px"><span class="appic ic-tita" style="width:26px;height:26px;border-radius:7px;font-size:12px;font-weight:800">T</span><span class="f13 w6 grow ell">{title}</span><span class="lnk f13 w6" style="flex:none">进入工单 ›</span></div>'


def m_waittest():
    st = [("ok", "✓", "合入测试分支", "陈某审核通过"), ("ok", "✓", "打包上传", "tita build · 1 分 12 秒"), ("ok", "✓", "发布到测试", "tita release · 6 秒"),
          ("ok", "✓", "核对生效", "提交号一致"), ("ok", "✓", "通知测试人", "已通知王某 · 15:01")]
    inner = f'''{nav("发布", "TK-20871")}
<div class="pad">
  <div class="row" style="margin-top:2px"><div class="grow"><div class="cap">第 2 轮 · 关掉 App 不影响</div><div class="lgt" style="font-size:24px">发布到测试</div></div><span class="tag tg-g" style="height:24px;font-size:12px">已生效 · 等复测</span></div>
  {_mtk("发起审批时点击分组，界面卡住")}
  <div class="card2" style="margin-top:8px">
    <div class="row g8"><span class="f12 w6 grow">测试环境 <span class="tag tg-g" style="margin-left:4px">已生效</span></span><span class="mono f15 w6">2.17.4</span><span class="t3">{I("arrowr",14)}</span><span class="mono f15 w7" style="color:var(--ink-blue)">2.18.0-fix.2</span></div>
    <div class="row g8" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--hair)"><span class="f12 t2" style="flex:none">入口</span><span class="mono f12 lnk grow ell" style="text-align:right">test.tita.work/approval ↗</span></div>
    <div class="row g8" style="margin-top:5px"><span class="f12 t2" style="flex:none">账号</span><span class="f12 grow" style="text-align:right">普通员工 <span class="mono">kq-staff-03</span></span></div>
  </div>
  {_msteps(st)}
  <div class="sec2" style="margin-top:10px">这次发出去的包<em>dev-approval</em></div>
  <div class="grp glass">
    <div class="ir" style="font-size:13.5px">{_mck("green","✓")}<span class="grow ell"><b class="w6">本单改动已在包里</b> <span class="t3 f12">MR !318 · 3 个文件</span></span></div>
    <div class="ir" style="font-size:13.5px">{_mck("orange","!")}<span class="grow ell"><b class="w6">还会带上别人的 4 个提交</b></span><span class="lnk f13">查看</span></div>
  </div>
</div>
<div class="dock2 glass">
  <div class="row g8 f12 t3" style="padding:0 4px"><span class="grow">结果记在 <span class="mono">2.18.0-fix.2 · e52c7a0</span></span><span>你是测试人</span></div>
  <div class=\"row g12\"><button class="abtn a-red" style="flex:1;height:44px;justify-content:center;border-radius:14px">{I("undo",15)}打回</button><button class="abtn" style="flex:1.6;height:44px;justify-content:center;border-radius:14px;background:var(--btn-ok-bg);color:#fff">{I("check",15,2.6)}复测通过</button></div>
</div>'''
    return phone(inner)


def m_prod():
    st = [("ok", "✓", "合回主分支", "林某审核 · MR !322"), ("wait", "2", "打包上传", "tita build"), ("wait", "3", "发布到正式", "tita release · PROD"),
          ("wait", "4", "核对生效", "读 Apollo 提交号"), ("wait", "5", "通知", "林某、王某")]
    inner = f'''{nav("发布", "TK-20790")}
<div class="pad">
  <div class="row" style="margin-top:2px"><div class="grow"><div class="cap">第 1 轮 · 王某 11:20 复测通过</div><div class="lgt" style="font-size:24px">发布到正式</div></div><span class="tag tg-o" style="height:24px;font-size:12px">等你发布</span></div>
  {_mtk("审批单撤回后状态错乱")}
  <div class="card2" style="margin-top:8px">
    <div class="row g8"><span class="f12 w6 grow">正式环境 <span class="tag tg-o" style="margin-left:4px">等你发布</span></span><span class="mono f15 w6">2.17.4</span><span class="t3">{I("arrowr",14)}</span><span class="f13 w6" style="color:var(--ink-blue)">打包后读出</span></div>
    <div class="row g8" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--hair)"><span class="f12 t2" style="flex:none">测试环境 2.18.0-fix.1</span><span class="f12 grow ell" style="text-align:right;color:var(--ink-green)">✓ 复测通过</span></div>
  </div>
  {_msteps(st)}
  <div class="sec2" style="margin-top:10px">和测试时比<em>master@9b1d3f2</em></div>
  <div class="grp glass">
    <div class="ir" style="font-size:13.5px">{_mck("green","✓")}<span class="grow ell"><b class="w6">本单改动和测试时一样</b> <span class="t3 f12">2 个文件</span></span></div>
    <div class="ir" style="font-size:13.5px">{_mck("orange","!")}<span class="grow ell"><b class="w6">还会带上别人的 1 个提交</b></span><span class="lnk f13">查看</span></div>
  </div>
</div>
<div class="dock2 glass">
  <div class="row g8 f12 t3" style="padding:0 4px"><span class="grow">三项前置都齐了 · 正式发布人：任何人</span><span>可回滚</span></div>
  <button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;height:var(--m-btn-h);border-radius:15px">{I("rocket",15)}发布到正式环境</button>
</div>'''
    return phone(inner)


def m_tkrelease():
    st = [("ok", "✓", "合入测试分支", "陈某审核通过"), ("ok", "✓", "打包上传", "tita build · 1 分 12 秒"), ("ok", "✓", "发布到测试", "tita release · 6 秒"),
          ("run", I("loader", 12, 2.6), "核对生效", "读 Apollo 提交号…"), ("wait", "5", "通知测试人", "对上后发送")]
    tags = '<span class="tg" style="color:var(--ink-green);background:color-mix(in srgb,var(--green) 14%,transparent)">审核通过 · 第 2 轮</span>'
    inner = f'''{nav("工单", "TK-20871")}
<div class="pad" style="padding-top:2px">
  <div class="row g12" style="align-items:flex-start"><span class="appic ic-tita" style="width:40px;height:40px;border-radius:11px;font-size:11px;font-weight:800">TITA</span>
  <div class="grow" style="min-width:0"><div style="font-size:17px;font-weight:700;line-height:1.3" class="ell">发起审批时点击分组，界面卡住</div><div class="row g6" style="margin-top:5px">{tags}</div></div></div>
  {seg(["对话", "改动 3", "证据 4", "日志", "发布"], 4)}
  <div class="row g8" style="margin-top:12px"><span class="f15 w7 grow">第 2 轮 → 测试环境</span><span class="tag tg-t" style="height:22px">发布中 4/5</span></div>
  <div class="card2" style="margin-top:10px">
    <div class="row g8"><span class="f12 w6 grow">测试环境 <span class="tag tg-t" style="margin-left:4px">核对中</span></span><span class="mono f15 w6">2.17.4</span><span class="t3">{I("arrowr",14)}</span><span class="mono f15 w7" style="color:var(--ink-blue)">2.18.0-fix.2</span></div>
    <div class="row g8" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--hair)"><span class="f12 t2" style="flex:none">正式环境 2.17.4</span><span class="f12 t3 grow ell" style="text-align:right">测试通过 → 合回主分支 → 重新打包</span></div>
  </div>
  {_msteps(st)}
  <div class="row g10 flat2" style="margin-top:10px"><span class="av2" style="width:30px;height:30px;font-size:11px;background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某</span><div class="col grow"><span class="f13 w6">测试人 王某</span><span class="f11 t3">提交号对上后通知</span></div><span class="lnk f13">历次发布 2 ›</span></div>
</div>
<div class="dock2 glass"><div class="cmp"><span class="aitag"><span class="aid">{I("spark",11)}</span>本单 AI</span><span class="grow t3 ell">问这次发布，或让 Bot 重试…</span><span class="snd">{I("arrowup",15,2.4)}</span></div></div>'''
    return phone(inner)


# ============ 板：通知（锁屏推送 · 通知设置 · 免打扰与设备） ============
def _ntf(title, body, when, go):
    return f'''<div class="glass" style="border-radius:22px;padding:11px 13px 10px;margin-top:8px;box-shadow:0 10px 26px -14px rgba(10,20,60,.45)">
  <div class="row g10" style="align-items:flex-start"><img src="logo.svg" width="38" height="38" alt="" style="border-radius:10px;flex:none">
    <div class="grow" style="min-width:0"><div class="row g6"><span class="f14 w7 grow ell">{title}</span><span class="f12 t3" style="flex:none">{when}</span></div>
      <div class="f13 t2" style="margin-top:2px;line-height:1.45">{body}</div>
      <div class="f11 t3" style="margin-top:4px">{go}</div></div></div></div>'''


def m_lock():
    inner = f'''<div class="pad" style="padding-top:10px">
  <div style="text-align:center;margin-top:6px">{I("lock",18,st="color:var(--text-2)")}</div>
  <div style="text-align:center;font-size:17px;font-weight:600;color:var(--text-2);margin-top:6px">11月20日 星期四</div>
  <div style="text-align:center;font-size:84px;font-weight:700;letter-spacing:1px;line-height:1;margin-top:2px">9:41</div>
  <div style="margin-top:36px">
  {_ntf("发布失败 · OKR-412 测试环境", "打包上传失败，退出码 1。测试环境没变，没通知测试人。", "1 分钟前", "点开 → 发布详情里失败的那一步")}
  {_ntf("待你审核 · TK-20871 第 2 轮", "点击分组后界面卡住 · 已修复，验证 4/4", "8 分钟前", "点开 → 这张单的对话和代码改动")}
  {_ntf("Bot 在问你 · TK-20862", "复现要用哪个角色？管理员没复现出来。", "34 分钟前", "点开 → 这张单，直接回答")}
  <div class="glass" style="border-radius:18px;height:16px;margin:-6px 14px 0;opacity:.6"></div>
  <div class="glass" style="border-radius:16px;height:12px;margin:-6px 28px 0;opacity:.4"></div>
  </div>
</div>
<div style="position:absolute;left:0;right:0;bottom:40px;display:flex;justify-content:space-between;padding:0 46px">
  <span class="glass" style="width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center">{I("flash",20)}</span>
  <span class="glass" style="width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center">{I("camera",20)}</span></div>'''
    return phone(inner)


def m_notify():
    L = '<span class="tgl on" style="opacity:.45;pointer-events:none"></span>'
    T = lambda on: f'<span class="tgl{" on" if on else ""}"></span>'
    ev = [("接到新单", "我是修复人", T(True)), ("Bot 在问我 / 需要协助", "说清缺哪项", T(True)), ("待我审核", "每轮修好后", T(True)),
          ("可以复测", "我是测试人，提交号对上后", T(True)), ("测试结果", "我的单被通过或打回", T(False)),
          ("发布失败", "核心告警 · 关不掉", L), ("紧急回滚结果", "已启回滚插件 · 锁定", L), ("待原平台确认", "按个人时区可配时刻汇总", T(True))]
    rows = "".join(f'<div class="ir" style="min-height:50px"><div class="col grow" style="min-width:0;gap:1px"><span class="f14 w6 row g6">{a}{I("lock",12,st="color:var(--text-3)") if ("关不掉" in b or "锁定" in b) else ""}</span><span class="f12 t3 ell">{b}</span></div>{c}</div>' for a, b, c in ev)
    inner = f'''{nav("设置", "通知", "")}
<div class="pad">
  <div class="grp glass" style="padding:12px;display:flex;align-items:center;gap:12px;margin-top:4px"><span class="ii" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(160deg,#5EDB7A,#28B04F);display:flex;align-items:center;justify-content:center;color:#fff">{I("bell",18,2)}</span>
    <div class="col grow"><span class="f15 w7">这台手机推送已开启</span><span class="f12 t3">iPhone 15 · 只影响你自己</span></div><span class="f13 lnk">试一条</span></div>
  <div class="gh">什么事推送到这台手机</div>
  <div class="grp glass">{rows}</div>
  <div class="f12 t3" style="padding:10px 6px 0;line-height:1.55">电脑的桌面提醒在 PC 上单独开关。错过的通知，都能在工单列表的待办里找到。</div>
  <div class="grp glass" style="margin-top:12px"><div class="ir"><span class="ii" style="background:linear-gradient(160deg,#8E8CF5,#5856D6)">{I("moon",15,2)}</span><span class="grow">免打扰</span><em>22:00 – 08:00{I("chevr",14)}</em></div></div>
</div>'''
    return phone(inner)


def m_dnd():
    def dv(ic, n, d, st, c):
        return f'<div class="ir" style="min-height:54px"><span class="ii" style="background:linear-gradient(160deg,#A9AEB8,#6E737D)">{I(ic,15,2)}</span><div class="col grow" style="gap:1px"><span class="f14 w6">{n}</span><span class="f12 t3">{d}</span></div><em style="color:var(--ink-{c});font-weight:600">{st}</em></div>'
    def go(a, b):
        return f'<div class="row g8" style="padding:7px 0;border-top:1px solid var(--hair)"><span class="f13 w6" style="width:86px;flex:none">{a}</span><span class="f12 t2 grow">{b}</span></div>'
    inner = f'''{nav("通知", "免打扰与设备", "")}
<div class="pad">
  <div class="grp glass" style="margin-top:4px">
    <div class="ir"><span class="ii" style="background:linear-gradient(160deg,#8E8CF5,#5856D6)">{I("moon",15,2)}</span><span class="grow">免打扰</span><span class="tgl on"></span></div>
    <div class="ir"><span class="grow" style="padding-left:39px">时间</span><span class="mono f13" style="padding:6px 12px;border-radius:var(--r-sm);background:var(--well);border:1px solid var(--hair)">22:00</span><span class="t3 f13">到</span><span class="mono f13" style="padding:6px 12px;border-radius:var(--r-sm);background:var(--well);border:1px solid var(--hair)">08:00</span></div>
  </div>
  <div class="f12 t2" style="padding:8px 6px 0;line-height:1.6">只推 <b>P1 单</b>和<b>发布失败</b>，其余早上 8 点汇总成一条。</div>
  <div class="gh">已登录的设备</div>
  <div class="grp glass">
    {dv("phone","iPhone 15 · 这台","今天 15:01 · 家里 Wi-Fi","推送已开","green")}
    {dv("monitor","MacBook Pro","在线 · 公司网络","桌面提醒已允许","green")}
    {dv("phone","iPad","3 天前","没开推送 ›","orange")}
  </div>
  <div class="gh">点开通知去哪</div>
  <div class="card2" style="padding:4px 14px 6px">
    {go("待我审核", "这张单的对话，代码改动一点就到")}
    {go("Bot 在问你", "这张单，在底部直接回答")}
    {go("可以复测", "发布详情，带入口、账号和复测步骤")}
    {go("发布失败", "发布详情里失败的那一步和报错原文")}
    {go("登录过期", "先登录，再回到原来那一页")}
  </div>
</div>'''
    return phone(inner)


# ---------- 空状态（对应 PC-空状态 / PC-空状态-2） ----------
def _tb0(sel, i):
    """真的什么都没有时（还没收到单、还没发布、第一次用 AI），Tab 栏不带角标。"""
    return tabbar(sel, i).replace("<b>4</b>", "").replace("<b>1</b>", "")


def _eic(bg, ic, orb=False):
    if orb:
        return f'<span class="orb" style="width:60px;height:60px">{I("spark",26,st="color:#fff")}</span>'
    return f'<span class="ii" style="width:60px;height:60px;border-radius:18px;background:{bg};display:flex;align-items:center;justify-content:center;color:#fff">{I(ic,28,2)}</span>'


def _ebox(icon, title, sub):
    return f'''<div class="col" style="align-items:center;text-align:center;margin-top:34px">{icon}
  <div style="font-size:21px;font-weight:800;margin-top:14px">{title}</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.6">{sub}</div></div>'''


def m_empty_tk():
    JB = '<span class="sc sc-j">Jira</span>'
    TB = '<span class="sc sc-t">Tita</span>'
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">11月20日 周四</div><div class="lgt">工单</div></div><span class="me">林</span></div>
  <div class="row g8" style="margin-top:12px"><span class="chip glass"><span class="dt" style="background:var(--green)"></span>3 个 Bot 在线</span><span class="chip glass"><span class="dt" style="background:var(--green)"></span>采集正常</span></div>
  {_ebox(_eic("linear-gradient(160deg,#5FE0D0,#13A8A0)","inbox"), "Bot 在等单", "开工准备已就绪<br>符合条件的单一进来就开始修，并通知你")}
  <div class="gh" style="margin-top:12px">收单条件</div>
  <div class="grp glass">
    <div class="ir" style="min-height:50px">{JB}<span class="grow f13 t2">项目 SP · 标签 ai-fix · 指派给你</span></div>
    <div class="ir" style="min-height:50px">{TB}<span class="grow f13 t2">流转到「AI干活」节点</span></div>
    <div class="ir" style="min-height:50px"><span class="ii" style="background:linear-gradient(160deg,#5EDB7A,#28B04F)">{I("refresh",14,2)}</span><span class="grow">上次采集</span><em>2 分钟前 · 正常</em></div>
  </div>
  <div class="row" style="justify-content:center;margin-top:14px"><span class="f13 lnk">去来源采集看看 ›</span></div>
</div>{_tb0("chat", 31)}'''
    return phone(inner)


def m_empty_pub():
    chips = '<span class="arr t3 f12">→</span>'.join(f'<span class="chip" style="background:var(--fill);height:26px;padding:0 9px">{t}</span>' for t in ["审核通过", "发测试", "复测通过", "发正式"])
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">测试 · 正式环境</div><div class="lgt">发布</div></div><span class="me">林</span></div>
  {seg(["我的", "全部"], 0)}
  {_ebox(_eic("linear-gradient(160deg,#6CC4FF,#1673FF)","rocket"), "还没有发布记录", "单审核通过后，发布记录会出现在这里")}
  <div class="row g6" style="justify-content:center;margin-top:16px">{chips}</div>
  <div class="card2" style="margin-top:22px;display:flex;align-items:center;gap:12px;background:color-mix(in srgb,var(--orange) 12%,transparent);border-color:transparent">
    {I("alert",18,st="color:var(--ink-orange);flex:none")}
    <div class="col grow" style="min-width:0;gap:2px"><span class="f14 w7">本项目发布参数还没填</span><span class="f12 t2" style="line-height:1.5">不影响修单 · 发起发测试前配好即可</span></div>
    <span class="chip glass" style="color:var(--text);border:1px solid var(--border-ctl)">去配置</span></div>
</div>{_tb0("pub", 32)}'''
    return phone(inner)


def m_empty_ai():
    def ask(k, c, t):
        return f'<div class="ir" style="min-height:50px"><span class="tg" style="color:var(--ink-{c});background:color-mix(in srgb,var(--{c}) 13%,transparent);height:20px;padding:0 6px;font-size:11px">{k}</span><span class="grow f14">{t}</span>{I("chevr",14,st="color:var(--text-3)")}</div>'
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">全局 · 所有工单和发布</div><div class="lgt">AI 助手</div></div><span class="nb2 glass">{I("clock",17)}</span></div>
  {_ebox(_eic("", "", True), "有事直接说", "能做的和页面上一样，按你的权限来")}
  <div class="gh" style="margin-top:14px">可以这样问</div>
  <div class="grp glass">
    {ask("查", "blue", "哪几张在等我审核？")}
    {ask("办", "purple", "把 TK-20871 发到测试")}
    {ask("查", "blue", "今天 Tita 收单正常吗？")}
    {ask("问", "teal", "TK-20855 为什么打包失败")}
  </div>
  <div class="f12 t3" style="text-align:center;margin-top:10px">说的不清楚是哪张单时，会先问你</div>
</div>
<div class="cmp" style="position:absolute;left:14px;right:14px;bottom:108px;height:var(--m-input-h);padding:0 6px 0 14px;border-radius:16px;z-index:var(--z-dock)"><span class="grow t3">问 AI 助手…</span><span class="chip" style="background:var(--fill);height:28px">关联：全局</span><span class="snd">{I("arrowup",15,2.4)}</span></div>
{_tb0("ai", 33)}'''
    return phone(inner)


def m_empty_search():
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">11月20日 周四</div><div class="lgt">工单</div></div><span class="me">林</span></div>
  <div class="cc-m-search is-focus" style="margin-top:12px">{I("search",16,st="color:var(--ink-blue)")}<span class="grow" style="color:var(--text)">导出</span><span class="cc-search-clear">{I("x",12,2.4)}</span></div>
  <div class="row g6" style="margin-top:10px"><span class="tg" style="color:var(--ink-teal);background:color-mix(in srgb,var(--teal) 14%,transparent)">我的 · 修复中</span><span class="f12 t3">筛选 1 项</span><span class="grow"></span><span class="f13 lnk">清除</span></div>
  {_ebox(_eic("linear-gradient(160deg,#B7BDC8,#8A92A0)","search"), "「我的 · 修复中」里<br>没有「导出」", "搜的是标题、工单号和原单内容")}
  <button class="bigbtn" style="margin-top:20px;height:48px;background:var(--btn-pri-bg);color:#fff">在全部里找 · 2 张</button>
  <div class="grp glass" style="margin-top:14px"><div class="ir" style="min-height:50px"><span class="ii" style="background:linear-gradient(135deg,#4F8BFF,#9B5CFF 55%,#FF5FA8)">{I("spark",14,2)}</span><span class="grow f13 t2">问 AI 助手：「上周和导出有关的单」</span>{I("chevr",14,st="color:var(--text-3)")}</div></div>
  <div class="f12 t3" style="text-align:center;margin-top:10px">已完成的单也能搜到；没有权限的单不显示</div>
</div>{tabbar("chat", 34)}'''
    return phone(inner)


def m_empty_sk():
    def sk(n, kind):
        bg = "linear-gradient(160deg,#5AA0FF,#1F6FFF)" if kind == "编码" else "linear-gradient(160deg,#5EDB7A,#28B04F)"
        return f'<div class="ir" style="min-height:48px"><span class="ii" style="background:{bg}">{I("code" if kind=="编码" else "eye",14,2)}</span><span class="grow">{n}</span><span class="tag tg-n">内置</span></div>'
    def opt(ic, bg, t, d, pri=False):
        st = "background:color-mix(in srgb,var(--blue) 10%,transparent);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--blue) 45%,transparent)" if pri else "background:var(--fill)"
        return f'<div class="col" style="flex:1;min-width:0;padding:11px 10px;border-radius:14px;gap:5px;{st}"><span class="ii" style="width:28px;height:28px;border-radius:8px;background:{bg};display:flex;align-items:center;justify-content:center;color:#fff">{I(ic,14,2)}</span><span class="f13 w7">{t}</span><span class="f11 t2" style="line-height:1.45">{d}</span></div>'
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">编码和验证规则</div><div class="lgt">Skills</div></div><span class="nb2 glass">{I("download",17)}</span><span class="nb2" style="margin-left:8px;background:var(--btn-pri-bg);color:#fff">{I("plus",18,2.4)}</span></div>
  <div class="col" style="align-items:center;text-align:center;margin-top:22px">{_eic("linear-gradient(160deg,#C08BFF,#8A4DFF)","layers")}
    <div style="font-size:21px;font-weight:800;margin-top:12px">还没有自己的 Skill</div>
    <div class="f13 t2" style="margin-top:6px">Bot 现在只用平台内置的 4 条规则</div></div>
  <div class="row g8" style="margin-top:16px;align-items:stretch">
    {opt("plus","linear-gradient(160deg,#5AA0FF,#1F6FFF)","在线新建","从空白写<br>AI 帮你起草",True)}
    {opt("download","linear-gradient(160deg,#B7BDC8,#8A92A0)","导入",".md · 粘贴<br>代码仓链接")}
    {opt("copy","linear-gradient(160deg,#5EDB7A,#28B04F)","复制内置","改成自己<br>的版本")}
  </div>
  <div class="gh">平台内置<span>4</span></div>
  <div class="grp glass">{sk("最小改动修复","编码")}{sk("组件包升级","编码")}{sk("页面交互回归","验证")}{sk("接口回归","验证")}</div>
</div>{tabbar("sk", 35)}'''
    return phone(inner)


def m_empty_rb():
    inner = f'''<div class="pad">
  <div class="row" style="margin-top:6px"><div class="grow"><div class="cap">Tita_Static · Apollo</div><div class="lgt" style="font-size:28px">紧急回滚</div></div><span class="tag tg-r" style="height:24px;font-size:12px">PRO 正式</span></div>
  <div class="grp glass" style="margin-top:12px"><div class="ir"><span class="ii" style="background:linear-gradient(160deg,#5AA0FF,#1F6FFF)">{I("globe",14,2)}</span><span class="grow">应用</span><em>okr-web{I("chevr",14)}</em></div></div>
  <div class="gh">发布历史<span>1</span></div>
  <div class="grp glass"><div class="ir" style="min-height:54px"><div class="col grow" style="gap:1px"><span class="f14 w6">okr-web 2.1.0 上线</span><span class="f12 t3">11-19 20:30</span></div><span class="tag tg-r">当前生效</span></div></div>
  {_ebox(_eic("linear-gradient(160deg,#B7BDC8,#8A92A0)","history"), "没有可以回到的上一次", "okr-web 正式环境在 Apollo 里只有当前这一次发布<br>回滚只回到之前的某次发布，不重新打包")}
  <div class=\"row g12\" style="margin-top:18px"><button class="bigbtn" style="flex:1;height:44px;background:var(--fill);color:var(--text)">换个应用</button><button class="bigbtn" style="flex:1;height:44px;background:var(--fill);color:var(--text)">看测试环境</button></div>
  <div class="f12 t3" style="text-align:center;margin-top:12px">历史从 Apollo 读，不是从工作台发的也会列出来</div>
</div>{tabbar("rb", 36)}'''
    return phone(inner)


# ============ 板：2026-11-21 定的规则（审核通过有未测项 · 排队中 · 换测试人） ============
def _mhead(title, tags, tab, src="TITA", segs=None):
    ic = '<span class="appic ic-tita" style="width:40px;height:40px;border-radius:11px;font-size:11px;font-weight:800">TITA</span>' if src == "TITA" else '<span class="appic" style="width:40px;height:40px;border-radius:11px;font-size:16px;font-weight:800;background:linear-gradient(160deg,#4FA3FF,#1D6FE0)">J</span>'
    return f'''<div class="pad" style="padding-top:2px">
  <div class="row g12" style="align-items:flex-start">{ic}
  <div class="grow" style="min-width:0"><div style="font-size:17px;font-weight:700;line-height:1.3" class="ell">{title}</div><div class="row g6" style="margin-top:5px">{tags}</div></div></div>
  {seg(segs or ["对话", "改动 3", "证据 4", "日志", "发布"], tab)}
</div>'''


def m_approve():
    bg = f'''{nav("工单", "TK-20871")}{thead("发起审批时点击分组，界面卡住", TAGS, 0)}
<div class="pad"><div class="dv"><span>第 2 轮 · 今天 14:10</span></div><div class="dcard glass" style="height:300px"><div class="row"><span class="grow" style="font-size:15px;font-weight:700">第 2 轮交付：已修复</span></div><div class="kv"><b>根因</b>切换分组时旧请求晚返回。</div></div></div>'''
    ok = lambda t: f'<div class="row g8 f13" style="padding:3px 0"><span class="ok2" style="background:var(--btn-ok-bg)">✓</span><span class="t2">{t}</span></div>'
    sheet = f'''<div class="scrim"></div><div class="sheet">
  <div class="grab"></div>
  <div class="row g8"><span class="ttl grow">审核通过第 2 轮</span><span class="f13 t3">取消</span></div>
  <div class="f12 t3" style="margin-top:2px">审核对象 <span class="mono">a3f9c21</span> · 改了 2 个文件</div>
  <div class="flb">Bot 已验证 3 项</div>
  <div class="flat2" style="padding:7px 11px">{ok("普通员工切换分组不再卡住")}{ok("分组 2、3 切换后列表正确")}{ok("刷新后停在原来的分组")}</div>
  <div class="flb" style="color:var(--ink-orange)">还有 1 项没测 · 待人工复测</div>
  <div style="padding:10px 12px;border-radius:14px;background:color-mix(in srgb,var(--orange) 11%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--orange) 35%,transparent)">
    <div class="row g8"><span class="ok2" style="background:color-mix(in srgb,var(--orange) 18%,transparent);color:var(--ink-orange)">!</span><span class="f14 w6 grow">「管理员」切到「销售部」不卡</span></div>
    <div class="f12 t2" style="margin:4px 0 0 26px;line-height:1.5">项目里没有登记管理员账号，Bot 没能登录</div>
    <div class="f12 lnk" style="margin:6px 0 0 26px">先登记账号，让 Bot 补测 ›</div>
  </div>
  <div class="row g8 f12 t2" style="margin-top:10px;padding:0 2px"><span class="tag tg-o">重点测</span><span class="grow">通过后，发测试时交给测试人</span></div>
  <div class="row g8" style="margin-top:10px;min-height:var(--m-row-h)"><span class="cbx"></span><span class="f14 w6 grow">我知道有 1 项没测</span><span class="f11 t3">不勾不能通过</span></div>
  <button class="bigbtn cc-m-btn-locked" style="margin-top:10px">{I("lock",15)}请先勾选上方确认框</button>
  <div class="f11 t3" style="text-align:center;margin-top:8px">通过后可以发测试，同时生成「待原平台确认」</div>
</div>'''
    return phone(bg, sheet)


def m_queue():
    tags = '<span class="tg" style="color:var(--text-2);background:var(--fill)">排队中 · 第 2</span><span class="tg" style="color:var(--ink-orange);background:color-mix(in srgb,var(--orange) 12%,transparent)">打回重修</span>'
    inner = f'''{nav("工单", "TK-20880")}{_mhead("审批中心：流程图节点不显示", tags, 0, segs=["对话", "改动 2", "证据 3", "日志", "发布"])}
<div class="pad">
  <div class="dv" style="margin-top:12px"><span>第 1 轮 · 你 10:40 打回</span></div>
  <div class="row" style="justify-content:flex-end;margin-top:8px"><span style="padding:9px 13px;border-radius:18px 18px 6px 18px;background:var(--btn-pri-bg);color:#fff;font-size:14px">连线还是会错位</span></div>
  <div class="card2" style="margin-top:14px">
    <div class="row g8"><span class="tg" style="color:var(--text-2);background:var(--fill)">排队中</span><span class="f14 w7 grow">第 2 轮还没开始</span></div>
    <div class="f13 t2" style="margin-top:8px;line-height:1.6">3 个 Bot 都在忙。前面还有 1 张：</div>
    <div class="row g8" style="margin-top:8px;padding:8px 10px;border-radius:12px;background:var(--fill)"><span class="tag tg-r">P1</span><span class="mono f12 t2">TK-20891</span><span class="f13 grow ell">报表导出 500</span></div>
    <div class="f13 t2" style="margin-top:8px;line-height:1.6">打回重修排在同级新单前面，预计 <b style="color:var(--text)">15:40</b> 开始。</div>
    <div class="row g8 f12 t2" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hair)">{I("bell",14,st="color:var(--text-3)")}<span class="grow">轮到时自动开始，并通知你</span></div>
  </div>
  <div class="f12 t3" style="text-align:center;margin-top:12px">现在补充的资料，开始修时一起用</div>
</div>
<div class="dock2 glass"><div class="cmp"><span class="aitag"><span class="aid">{I("spark",11)}</span>本单 AI</span><span class="grow t3 ell">补充资料，或问为什么还没开始…</span><span class="snd">{I("arrowup",15,2.4)}</span></div></div>'''
    return phone(inner)


def m_tester():
    tags = '<span class="tg" style="color:var(--ink-green);background:color-mix(in srgb,var(--green) 14%,transparent)">审核通过 · 第 1 轮</span>'
    def cand(av, gr, n, d, on=False):
        return f'<div class="ir" style="min-height:56px"><span class="av2" style="width:32px;height:32px;font-size:11px;background:linear-gradient(150deg,{gr})">{av}</span><div class="col grow" style="gap:1px"><span class="f14 w6">{n}</span><span class="f12 t3">{d}</span></div><span class="cc-m-radio{" is-checked" if on else ""}"></span></div>'
    inner = f'''{nav("工单", "KQ-118")}{_mhead("排班导入后日期错一天", tags, 4, src="J", segs=["对话", "改动 1", "证据 2", "日志", "发布"])}
<div class="pad">
  <div class="row g8" style="margin-top:12px"><span class="f15 w7 grow">第 1 轮 → 测试环境</span><span class="tag tg-n" style="height:22px">发布前</span></div>
  <div style="margin-top:10px;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--orange) 11%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--orange) 40%,transparent)">
    <div class="row g8"><span class="ok2" style="background:color-mix(in srgb,var(--orange) 18%,transparent);color:var(--ink-orange)">!</span><span class="f14 w7 grow">选一个测试人才能发</span></div>
    <div class="f12 t2" style="margin:5px 0 0 26px;line-height:1.5">Jira 提单人 赵磊 已停用，没法通知他复测</div>
  </div>
  <div class="gh">测试人</div>
  <div class="grp glass">
    {cand("李娜", "#F7A8D0,#E0609E", "李娜", "考勤 · 上次复测过 KQ-1180", True)}
    {cand("周某", "#B5E3A0,#5FB84A", "周某", "考勤 · 成员")}
    <div class="ir">{I("search",15,st="color:var(--text-3)")}<span class="grow t3 f14">搜索其他成员</span></div>
  </div>
  <div class="f12 t3" style="padding:8px 6px 0;line-height:1.55">Jira 单默认是提单人，发测试前都能换；通知里会带入口、账号和复测步骤。</div>
</div>
<div class="dock2 glass"><button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;height:48px">{I("rocket",16)}发布到测试环境</button><div class="f11 t3" style="text-align:center">测试人：李娜 · 发测试的人：修复人</div></div>'''
    return phone(inner)


# ============ 板：插件市场与执行器（移动端轻量对齐） ============
def m_market_list():
    def mrow(bg, ic, title, sub, badge="", right="", on=False):
        b = f'<span class="tag tg-g" style="height:18px;font-size:11px;padding:0 5px">{badge}</span>' if badge else ""
        sel = ' style="min-height:60px;background:color-mix(in srgb,var(--blue) 9%,transparent);border-radius:14px"' if on else ' style="min-height:60px"'
        return (f'<div class="ir"{sel}>'
                f'<span class="ii" style="width:36px;height:36px;border-radius:10px;background:{bg}">{I(ic,18,2)}</span>'
                f'<div class="col grow" style="min-width:0;gap:2px">'
                f'<div class="row g6"><span class="f14 w7 ell">{title}</span>{b}</div>'
                f'<span class="f12 t3 ell">{sub}</span></div>{right}</div>')
    inner = f'''{nav("设置", "插件市场", "")}
<div class="pad">
  <div class="row g8" style="margin-top:4px">
    <span class="chip" style="background:var(--btn-pri-bg);color:#fff">全部 7</span>
    <span class="chip glass">已安装 4</span>
    <span class="chip glass">官方 5</span>
  </div>
  <div class="gh" style="padding:10px 6px 4px">已安装<span>5</span><em>可随时启停</em></div>
  <div class="grp glass">
    {mrow("linear-gradient(160deg,#FF8A7A,#E0281E)","history","紧急回滚（Apollo）","可选扩展 · 停用仅藏回滚入口","默认安装",'<span class="tgl on"></span>',True)}
    {mrow("linear-gradient(160deg,#FFC54D,#FF7A00)","pkg","Tita / Apollo 部署连接器","发布到测试 / 正式环境","官方预装",'<span class="tgl on" style="opacity:.45;pointer-events:none"></span>')}
    {mrow("linear-gradient(160deg,#5AA0FF,#1F6FFF)","branch","GitLab 代码源连接器","同步代码、MR 和改动","官方预装",'<span class="tgl on" style="opacity:.45;pointer-events:none"></span>')}
    {mrow("linear-gradient(160deg,#60A5FA,#4F46E5)","link","Jira 工单源连接器","按条件收单 · 账号在「设置 → 连接器」配置","官方预装",'<span class="tgl on" style="opacity:.45;pointer-events:none"></span>')}
    {mrow("linear-gradient(155deg,#5E8BFF,#8B5CF6)","spark","Pi 修复引擎","AI 引擎 · 默认 · 多模型","核心默认",'<span class="tgl on" style="opacity:.45;pointer-events:none"></span>')}
  </div>
  <div class="gh" style="padding:10px 6px 4px">可安装<span>3</span><em>PC 端安装</em></div>
  <div class="grp glass">
    {mrow("linear-gradient(160deg,#34D399,#059669)","zap","Token 费用检测","顶栏预算微胶囊 · 插件设置阈值","","<em>PC 安装" + I("chevr",13) + "</em>")}
    {mrow("linear-gradient(160deg,#C58BFF,#6A3DF0)","moon","高对比暗夜主题","主题 · 在「我的账号」切换","","<em>PC 安装" + I("chevr",13) + "</em>")}
    {mrow("linear-gradient(160deg,#64748B,#334155)","terminal","自定义 CLI / MCP 适配器","接入企业自研工具与连接器","","<em>PC 安装" + I("chevr",13) + "</em>")}
  </div>
  <div class="f12 t3" style="padding:10px 6px 0;line-height:1.55">手机端支持查看与启停，安装和详细配置请在 PC 端「插件市场」或「设置 → 连接器」完成。关闭「紧急回滚」后底部回滚入口自动隐藏。</div>
</div>'''
    return phone(inner)


def m_market_detail():
    def kvrow(k, v):
        return f'<div class="row g8" style="padding:7px 0;border-top:1px solid var(--hair)"><span class="f12 t3" style="width:78px;flex:none">{k}</span><span class="f12 w6 grow ell">{v}</span></div>'
    inner = f'''{nav("插件市场", "插件详情", "")}
<div class="pad">
  <div class="card2" style="margin-top:4px;padding:14px">
    <div class="row g12" style="align-items:flex-start">
      <span class="ii" style="width:50px;height:50px;border-radius:14px;background:linear-gradient(160deg,#FF8A7A,#FF453A 55%,#E0281E);display:flex;align-items:center;justify-content:center;color:#fff;flex:none;box-shadow:0 8px 18px -6px rgba(224,40,30,.55)">{I("history",24,2.2)}</span>
      <div class="col grow" style="min-width:0;gap:5px">
        <div class="f16 w7 ell">紧急回滚（Apollo）</div>
        <div class="row g6"><span class="tag tg-b">官方</span><span class="tag tg-g">默认安装</span><span class="tag tg-n">v1.2.0</span></div>
      </div>
    </div>
    <div class="f12 t2" style="margin-top:10px;line-height:1.55">对接 Apollo 配置中心，预览配置差异、执行一键回退并触发业务回读校验；鉴权实例归口「设置 → 连接器」。</div>
  </div>
  <div class="grp glass" style="margin-top:10px">
    <div class="ir"><span class="grow w6">在当前团队启用</span><span class="tgl on"></span></div>
    <div class="ir"><span class="grow">生效项目</span><em>审批、考勤（2）{I("chevr",14)}</em></div>
  </div>
  <div class="sec2">插件会出现在这些位置</div>
  <div class="card2" style="padding:4px 14px 6px">
    <div class="row g8" style="padding:7px 0"><span class="f12 t3" style="width:78px;flex:none">入口</span><span class="f12 w6 grow">PC Dock + 手机底部「回滚」</span></div>
    {kvrow("账号", "用你自己的 Apollo 账号")}
    {kvrow("能力", "craft rollback / craft verify / MCP")}
    {kvrow("插件设置", "在插件详情里设置，不单独占菜单")}
  </div>
  <div class="sec2">最小权限边界<em>不可越权</em></div>
  <div class="card2" style="padding:10px 14px">
    <div class="row g6" style="flex-wrap:wrap">
      <span class="tag tg-g">{I("check",11,2.4)}读工单快照</span>
      <span class="tag tg-g">{I("check",11,2.4)}写回滚时间线</span>
      <span class="tag tg-b">{I("shield",11,2)}只读配置差异</span>
    </div>
    <div class="f11 t3" style="margin-top:8px;line-height:1.5">插件拿不到登录态和 Apollo 私钥，所有回滚请求由云匠宿主校验本人二次确认后代理签发。</div>
  </div>
</div>
<div class="dock2 glass">
  <button class="bigbtn" style="background:color-mix(in srgb,var(--red) 12%,transparent);color:var(--ink-red);height:var(--m-btn-h);font-size:14.5px">停用插件并隐藏回滚入口</button>
  <div class="f11 t3" style="text-align:center">停用后保留历史回滚记录，随时可重新开启</div>
</div>'''
    return phone(inner)


def m_no_runner():
    tags = '<span class="tg" style="color:var(--ink-orange);background:color-mix(in srgb,var(--orange) 14%,transparent)">等待执行器上线</span>'
    inner = f'''{nav("工单", "TK-20871")}{_mhead("点击分组后界面卡住", tags, 0)}
<div class="pad">
  <div class="card2" style="margin-top:12px;padding:18px 16px;text-align:center">
    <div style="width:54px;height:54px;border-radius:16px;margin:0 auto;background:linear-gradient(155deg,#34D399,#0284C7);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px -8px rgba(2,132,199,.5)">{I("monitor",26,2)}</div>
    <div class="f16 w7" style="margin-top:12px">当前没有在线执行器</div>
    <div class="f12 t2" style="margin-top:6px;line-height:1.55">工单已接单并排队，但你的本机执行器未在线，且团队尚未接入远程 Runner。</div>
  </div>
  <div class="gh" style="padding:12px 6px 6px">执行器状态</div>
  <div class="grp glass">
    <div class="ir" style="min-height:48px"><span class="ii" style="background:linear-gradient(160deg,#5AA0FF,#1F6FFF)">{I("monitor",15,2)}</span><div class="col grow" style="gap:1px"><span class="f14 w6">MacBook Pro · 本机</span><span class="f11 t3">个人默认模式 · 18 分钟前离线</span></div><em style="color:var(--ink-orange)">离线</em></div>
    <div class="ir" style="min-height:48px"><span class="ii" style="background:linear-gradient(160deg,#A9AEB8,#6E737D)">{I("server",15,2)}</span><div class="col grow" style="gap:1px"><span class="f14 w6">团队远程 Runner</span><span class="f11 t3">私有部署 / 团队内网算力池</span></div><em>未接入</em></div>
  </div>
  <div class="gh" style="padding:12px 6px 6px">怎么让 Bot 开始修</div>
  <div class="card2" style="padding:10px 14px;display:flex;flex-direction:column;gap:8px">
    <div class="row g8" style="align-items:flex-start"><span class="ok2" style="background:var(--btn-pri-bg);margin-top:1px">1</span><span class="f12 t2" style="line-height:1.5">回到电脑打开云匠 PC 端，连上后自动接着修这张单</span></div>
    <div class="row g8" style="align-items:flex-start"><span class="ok2" style="background:var(--btn-run-bg);margin-top:1px">2</span><span class="f12 t2" style="line-height:1.5">或在 PC 端切到「团队 Runner / 云端托管」</span></div>
  </div>
</div>
<div class="dock2 glass">
  <button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;height:var(--m-btn-h);font-size:15px">{I("bell",16,2)}执行器上线后提醒我</button>
  <div class="f11 t3" style="text-align:center">现在也能先补充复现说明，上线后自动带入</div>
</div>'''
    return phone(inner)


BOARDS = {
    "code": ("移动端 · 代码与审核", [(m_code, "代码改动", "单列差异 · 选中一行问 AI"), (m_reject, "打回", "原因 + 代码位置 + 截图"), (m_ask, "Bot 在问你", "一键回答，回复后接着跑")]),
    "evidence": ("移动端 · 证据与发布", [(m_evidence, "证据", "用途、查阅状态、验证记录"), (m_error, "报错", "失败步骤 + 原文 + AI 解读"), (m_release, "发布到测试", "关掉 App 也能接着看进度")]),
    "release": ("移动端 · 发布", [(m_tkrelease, "工单 · 发布", "工单里的第 5 个标签，同一份发布详情"), (m_waittest, "等复测", "测试人本人看到通过 / 打回"), (m_prod, "发布到正式", "三项前置齐了才能点")]),
    "rollback": ("移动端 · 大包与紧急回滚", [(m_bundle, "大包明细", "部分完成，从失败处重试"), (m_rb_preview, "紧急回滚", "看差异，本人确认"), (m_rb_result, "回滚结果", "请求、回读、业务验证分开")]),
    "notify": ("移动端 · 通知", [(m_lock, "锁屏推送", "说清哪张单、什么事，点开直达"), (m_notify, "通知设置", "核心发布失败锁定，插件告警随装随锁"), (m_dnd, "免打扰与设备", "免打扰、设备、点开去哪")]),
    "empty": ("移动端 · 空状态", [(m_empty_tk, "工单 · 还没收到单", "Bot 在等单，收单条件和采集状态"), (m_empty_pub, "发布 · 还没有发布", "审核通过后才有；配置没填先提醒"), (m_empty_ai, "AI 助手 · 第一次打开", "点一句就能问")]),
    "empty2": ("移动端 · 空状态二", [(m_empty_search, "搜索没有结果", "说清在哪没找到，去全部里找"), (m_empty_sk, "Skills · 我的还没有", "新建、导入、复制内置"), (m_empty_rb, "紧急回滚 · 没有上一次", "只发布过一次，没得回")]),
    "rules": ("移动端 · 审核与排队", [(m_approve, "审核通过 · 有未测项", "勾「我知道有未测项」才能通过"), (m_queue, "工单 · 排队中", "前面是谁、预计几点开始"), (m_tester, "发测试 · 换测试人", "提单人找不到时必须选一个")]),
    "skills": ("移动端 · Skills 与设置", [(m_skills, "Skills", "我的 + 平台内置"), (m_skill_edit, "编辑 Skill", "接着 PC 的草稿写"), (m_settings, "设置", "从头像进入 · 含插件市场与连接器")]),
    "market": ("移动端 · 插件市场与执行器", [(m_market_list, "插件市场", "查看与启停，安装与鉴权在 PC 端"), (m_market_detail, "紧急回滚 · 详情", "官方默认安装 · 出现位置与权限"), (m_no_runner, "暂无在线执行器", "个人电脑离线时的轻量引导")]),
}


def board(title, phones):
    cols = "".join(f'<div class="col3">{fn()}<div class="lbl">{t}<em>{d}</em></div></div>' for fn, t, d in phones)
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="m.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
</head><body><div class="board">{cols}</div>
<script src="../v3/shots.js"></script><script src="icons.js"></script></body></html>'''


for k, (t, ph) in BOARDS.items():
    (OUT / f"m-{k}.html").write_text(board(t, ph), encoding="utf-8")
    print("→", OUT / f"m-{k}.html")
