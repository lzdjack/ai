#!/usr/bin/env python3
"""生成二期（M4）跨项目需求变更集 4 组核心高清蓝图（reference/src/v5/phase2-*.html → reference/images/phase2/）。
与一期 reference/images/pages/ 物理隔离，仅作二期蓝图参考，M1 严禁提前实现 UI。
用法：python3 scripts/gen-phase2.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_pc import I, TOPBAR, DOCK_ICONS, trow, TICKETS  # noqa: E402

SPEC_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="3.5" width="16" height="17" rx="3.2" fill="#fff" opacity=".24"/><rect x="4" y="3.5" width="16" height="17" rx="3.2" stroke="#fff" stroke-width="1.9"/><path d="M8 9h8M8 13h6M8 17h4" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><circle cx="17.2" cy="16.8" r="2.6" fill="#34D399"/></svg>'

EXTRA_CSS = '''<style>
.ap-spec{background:linear-gradient(155deg,#6366F1 0%,#4F46E5 55%,#0EA5E9 100%)}
.c-pill{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0}
.cp-b{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue)}
.cp-g{background:color-mix(in srgb,var(--green) 15%,transparent);color:var(--ink-green)}
.cp-o{background:color-mix(in srgb,var(--orange) 16%,transparent);color:var(--ink-orange)}
.cp-r{background:color-mix(in srgb,var(--red) 14%,transparent);color:var(--ink-red)}
.cp-p{background:color-mix(in srgb,var(--purple) 14%,transparent);color:var(--ink-purple)}
.cp-i{background:color-mix(in srgb,var(--purple) 15%,transparent);color:var(--ink-purple)}
.cp-n{background:var(--fill);color:var(--text-2)}
.plus-btn{width:28px;height:28px;border-radius:var(--r-sm);background:var(--btn-pri-bg);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}
/* 活原型预览与单跳提案 */
.proto-box{border-radius:14px;padding:11px 13px;background:var(--surface);border:1px solid var(--hair);box-shadow:0 6px 18px -12px rgba(20,30,70,.25)}
html.dark .proto-box{background:rgba(20,23,34,.85)}
.ptbl{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:7px}
.ptbl th{text-align:left;color:var(--text-3);font-weight:600;padding:4px 8px;border-bottom:1px solid var(--hair)}
.ptbl td{padding:5px 8px;border-bottom:1px solid var(--hair)}
.ptbl tr:last-child td{border-bottom:0}
.ptbl .newc{background:color-mix(in srgb,var(--blue) 10%,transparent);color:var(--ink-blue);font-weight:700;border-radius:5px}
.prop-row{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:12px;background:var(--fill);margin-top:7px}
.prop-row.wait{background:color-mix(in srgb,var(--orange) 10%,var(--glass-2));box-shadow:inset 0 0 0 1.2px color-mix(in srgb,var(--orange) 45%,transparent)}
/* 轻筛选胶囊 */
.fstrip{display:flex;align-items:center;gap:5px;padding:4px 8px 6px}
.fpill{height:var(--ctl-xs);padding:0 11px;border-radius:var(--r-full);font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;background:var(--fill);color:var(--text-2);white-space:nowrap}
.fpill.on{background:color-mix(in srgb,var(--blue) 16%,transparent);color:var(--ink-blue)}
/* 角标 */
.cs-chip{height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0;background:color-mix(in srgb,var(--purple) 14%,transparent);color:var(--ink-purple)}
.r10.on .cs-chip{background:rgba(255,255,255,.24);color:#fff}
.p1-chip{height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0;background:var(--btn-danger-bg);color:#fff}
.sub-row{margin-left:14px;border-left:2px solid color-mix(in srgb,var(--red) 40%,transparent);padding-left:6px;margin-top:-2px}
/* 工单顶部变更集联动横条 */
.cs-bar{display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:12px;background:color-mix(in srgb,var(--purple) 10%,var(--glass-2));border:1px solid color-mix(in srgb,var(--purple) 30%,transparent);font-size:12px}
.cs-btn{height:var(--ctl-xs);padding:0 10px;border-radius:var(--r-sm);font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);color:var(--text)}
.cs-btn.pri{background:color-mix(in srgb,var(--purple) 15%,transparent);border-color:color-mix(in srgb,var(--purple) 34%,transparent);color:var(--ink-purple)}
/* 切片工单行 */
.srow{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:13px;background:var(--glass-2);border:1px solid var(--stroke)}
.srow.hi{border-color:color-mix(in srgb,var(--blue) 55%,transparent)}
/* 无损右侧毛玻璃抽屉 */
.stage-rel{position:relative;flex:1;min-width:0;display:flex;gap:14px}
.dim-scrim{position:absolute;inset:0;border-radius:24px;background:var(--scrim);z-index:var(--z-scrim)}
.drawer{position:absolute;top:0;right:0;bottom:0;width:960px;z-index:var(--z-drawer);border-radius:24px;display:flex;flex-direction:column;overflow:hidden;
  background:var(--glass-overlay);
  backdrop-filter:var(--blur-panel);-webkit-backdrop-filter:var(--blur-panel);
  border:1px solid var(--stroke);
  box-shadow:var(--shadow-dialog)}
/* 契约字段表 */
.cf-row{display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:8px;background:var(--fill);font-size:11.5px;margin-top:5px}
/* QA 断言行 */
.qa-row{display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:12px;background:var(--glass-2);border:1px solid var(--stroke)}
.qa-row.fail{background:color-mix(in srgb,var(--red) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--red) 35%,transparent)}
.qa-dot{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;flex:none;font-size:11px;font-weight:800}
.qa-ok{background:var(--btn-ok-bg)}.qa-no{background:var(--btn-danger-bg)}
.har-box{padding:9px 12px;border-radius:10px;background:var(--fill);font-size:11.5px;line-height:1.65}
.har-ok{color:var(--ink-green);font-weight:600}
.har-bad{color:var(--ink-red);font-weight:700}
</style>'''


def wrap(title, dock_html, body):
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../v3/base.css">
<link rel="stylesheet" href="../v4/apple.css">
<link rel="stylesheet" href="pc.css">
{EXTRA_CSS}
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
</head><body><div class="root">{TOPBAR}{dock_html}<div class="panels">{body}</div></div>
<script src="icons.js"></script></body></html>'''


def dock_with_spec(sel, spec_badge="1", chat_badge="3"):
    """红点彻底去重：变更集仅计决策事件(1)，工单仅计执行待办(3)"""
    def it(k, svg, badge=""):
        b = f"<b>{badge}</b>" if badge else ""
        return f'<span class="dki{" on" if k == sel else ""}"><span class="ap ap-{k}">{svg}</span>{b}</span>'
    return ('<nav class="dockv glass" aria-label="主菜单">'
            + it("ai", DOCK_ICONS["ai"]) + '<span class="dsep"></span>'
            + it("spec", SPEC_ICON, spec_badge)
            + it("chat", DOCK_ICONS["chat"], chat_badge)
            + it("pub", DOCK_ICONS["pub"], "1")
            + it("rb", DOCK_ICONS["rb"])
            + it("sk", DOCK_ICONS["sk"]) + '<span class="grow"></span>'
            + it("mkt", DOCK_ICONS["mkt"])
            + it("set", DOCK_ICONS["set"]) + "</nav>")


# ============================================================
# 图 1：需求变更集与活原型拍板（薪酬 + 组织人事 + 绩效 + CRM）
# ============================================================
def build_1_spec():
    left = f'''<section class="glass pn" style="width:296px;flex:none;padding:16px 10px 10px">
  <div class="row g8" style="padding:0 8px 6px"><span class="f18 w7">需求变更集</span><span class="c-pill cp-i">二期 M4</span><span class="grow"></span><span class="plus-btn">{I("plus",14,2.6)}</span></div>
  <div class="g10h">待拍板契约<span>2</span></div>
  <div class="r10 on" style="align-items:flex-start">
    <span class="ic-box" style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.22);flex:none">{I("layers",17,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><span class="t10 ell grow">月度算薪接入绩效与 CRM 提成</span></div>
      <div class="row g4" style="margin-top:4px"><span class="sc10">薪酬主导</span><span class="d10 ell">4 项目 · 差 CRM 拍板</span></div>
      <span class="pg10"><i style="width:75%;background:#fff"></i></span>
    </div>
  </div>
  <div class="r10" style="align-items:flex-start">
    <span class="ic-box" style="width:34px;height:34px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF);flex:none">{I("layers",17,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><span class="t10 ell grow">审批单支持批量撤回</span><span class="tm10">1 小时</span></div>
      <div class="row g6" style="margin-top:3px"><span class="sc10 sc-t">审批主导</span><span class="d10 ell">2 个项目 · 活原型已确认</span></div>
    </div>
  </div>
  <div class="g10h">并行开发中<span>1</span></div>
  <div class="r10" style="align-items:flex-start">
    <span class="ic-box" style="width:34px;height:34px;border-radius:10px;background:linear-gradient(155deg,#34D399,#059669);flex:none">{I("git",17,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><span class="t10 ell grow">考勤月报导出新版模板</span></div>
      <div class="row g6" style="margin-top:3px"><span class="sc10 sc-j">考勤</span><span class="d10 ell">契约已冻结 · 编码中 62%</span></div>
      <span class="pg10"><i style="width:62%"></i></span>
    </div>
  </div>
  <div class="grow"></div>
  <div class="card" style="margin:6px;padding:10px 12px">
    <div class="mini" style="margin-bottom:5px">红点彻底去重</div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">变更集红点 <b>1</b></span><span class="f11 t3">仅计决策事件</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">工单红点 <b>3</b></span><span class="f11 t3">仅计执行待办</span></div>
  </div>
</section>'''

    main = f'''<main class="glass pn grow" style="min-width:0">
  <header class="thead">
    <div class="row g10">
      <span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(155deg,#6366F1,#0EA5E9)">{I("layers",20,2)}</span>
      <div class="col grow" style="min-width:0">
        <div class="row g8"><h1 class="ell">月度算薪自动拉取绩效系数与 CRM 提成</h1><span class="c-pill cp-o">差 CRM 10 秒拍板</span></div>
        <div class="f12 t3" style="margin-top:2px">CS-089 · 牵头项目：<b class="t2">薪酬</b> · 联动平级项目：组织人事 / 绩效 / CRM · 5 个交付切片</div>
      </div>
    </div>
    <div class="row g10" style="margin-top:11px">
      <div class="cc-seg"><span class="on">协作流</span><span>活原型</span><span>契约 3</span><span>切片 5</span><span>联调验收</span></div>
      <span class="grow"></span>
      <span class="f12 t3" style="white-space:nowrap">契约拍板即触发契约级真并行</span>
    </div>
  </header>

  <div class="col g10 grow" style="padding:12px 20px 10px;min-height:0;overflow:hidden">
    <div class="row" style="justify-content:flex-end">
      <div class="me" style="max-width:82%;font-size:13px;padding:8px 14px">
        做个薪酬需求：月度算薪表增加「绩效系数」和「CRM 回款提成」两列，自动拉绩效与 CRM 数据，员工调岗时同步带入组织人事生效日期。
      </div>
    </div>

    <div class="card" style="padding:12px 15px">
      <div class="row g8">
        <span class="aid" style="width:22px;height:22px;border-radius:7px">{I("spark",12)}</span>
        <b class="f13.5" style="font-size:13.5px;white-space:nowrap">活原型已就绪（真实组件可点）</b>
        <span class="c-pill cp-g">{I("check",11,2.6)}自动生成 4 条 E2E 断言</span>
        <span class="grow"></span>
        <span class="btn2 sm a-sec" style="background:var(--fill)">圈点修改</span>
        <span class="btn2 sm a-pri">打开可点原型 ↗</span>
      </div>
      <div class="proto-box" style="margin-top:9px">
        <div class="row g8 f11 t3">
          <span class="mono">薪酬中心 / 月度算薪表 · 2026-11（Contract-as-Mock 驱动）</span>
          <span class="grow"></span>
          <span style="color:var(--ink-blue)">✦ 蓝色高亮为本次新增联动列</span>
        </div>
        <table class="ptbl">
          <thead><tr><th>员工</th><th>异动生效日（组织人事）</th><th>基础薪资</th><th class="newc">绩效系数（绩效）</th><th class="newc">回款提成（CRM）</th><th>应发合计</th></tr></thead>
          <tbody>
            <tr><td class="w6">王敏 · 销售部</td><td class="mono f11 t2">2026-11-01</td><td class="mono">¥18,000</td><td class="mono newc">1.15 (A)</td><td class="mono newc">+¥4,620</td><td class="mono w7">¥25,320</td></tr>
            <tr><td class="w6">赵磊 · 产研部</td><td class="mono f11 t2">2026-11-15（调岗分段）</td><td class="mono">¥24,000</td><td class="mono newc">1.00 (B+)</td><td class="mono newc">¥0</td><td class="mono w7">¥24,000</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="padding:12px 15px">
      <div class="row g8">
        <span class="ic-box" style="width:22px;height:22px;border-radius:7px;background:linear-gradient(155deg,#34D399,#059669)">{I("bot",13)}</span>
        <b class="f13.5" style="font-size:13.5px;white-space:nowrap">领域 Agent 单跳提案（各自沙箱读 Repo Atlas · 禁越权）</b>
        <span class="grow"></span>
        <span class="f11 t3" style="white-space:nowrap">Max Hops = 1 · 锚定 repo@sha</span>
      </div>

      <div class="prop-row">
        <span class="c-pill cp-b">绩效 Agent</span>
        <div class="col grow" style="min-width:0">
          <span class="f12.5 w6 ell" style="font-size:12.5px">开放 <span class="mono">GET /api/perf/coeff</span> · 锚定 <span class="mono t3">perf@a91c:dto.ts#42</span></span>
        </div>
        <span class="c-pill cp-g">{I("check",11,2.6)}已冻结 #9f2a@v1</span>
      </div>

      <div class="prop-row">
        <span class="c-pill cp-p">组织人事 Agent</span>
        <div class="col grow" style="min-width:0">
          <span class="f12.5 w6 ell" style="font-size:12.5px">异动事件补充 <span class="mono">effectiveDate</span> · 锚定 <span class="mono t3">hr@4d2f:event.ts#18</span></span>
        </div>
        <span class="c-pill cp-g">{I("check",11,2.6)}已冻结 #4c18@v1</span>
      </div>

      <div class="prop-row wait">
        <span class="c-pill cp-o">CRM Agent</span>
        <div class="col grow" style="min-width:0">
          <span class="f12.5 w6 ell" style="font-size:12.5px">新增回款提成接口 <span class="mono">POST /hook/commission</span> · 锚定 <span class="mono t3">crm@8e1b:order.ts#91</span></span>
          <span class="f11 t3">按 Expand-Contract 兼容增量设计；仅 CRM 成员可见源码，薪酬侧只读此契约</span>
        </div>
        <span class="btn2 sm a-red">退回调整</span>
        <span class="btn2 sm a-pri">{I("check",12,2.8)}10 秒批准</span>
      </div>
    </div>

    <div class="row g8" style="margin-top:auto;padding:7px 10px;border-radius:14px;background:var(--well);border:1px solid var(--hair)">
      <span class="aitag"><span class="aid">{I("spark",11)}</span>变更集 AI</span>
      <span class="f13 t3 grow ell">直接说修改意见（如：退单时 CRM 提成按负数冲红，并更新活原型与契约）…</span>
      <span style="width:30px;height:30px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;display:flex;align-items:center;justify-content:center">{I("arrowup",14,2.4)}</span>
    </div>
  </div>
</main>'''

    right = '''<aside class="glass pn" style="width:292px;flex:none;padding:13px;display:flex;flex-direction:column;gap:10px">
  <div class="card" style="padding:11px 13px">
    <div class="row"><span class="mini grow" style="margin:0">独立接口契约版本</span><span class="c-pill cp-b">2 / 3 已冻结</span></div>
    <div class="kv2" style="padding:4px 0"><span class="f12">绩效系数 DTO</span><span class="mono f11" style="color:var(--ink-green)">#9f2a@v1 ✓</span></div>
    <div class="kv2" style="padding:4px 0"><span class="f12">组织异动生效日</span><span class="mono f11" style="color:var(--ink-green)">#4c18@v1 ✓</span></div>
    <div class="kv2" style="padding:4px 0"><span class="f12">CRM 回款提成</span><span class="f11" style="color:var(--ink-orange);font-weight:600">待 CRM 批准</span></div>
    <div class="f11 t3" style="margin-top:6px;line-height:1.5">各接口独立演进，中途改动走 Contract RFC 升 v2，无关项目零打扰。</div>
  </div>

  <div class="card" style="padding:11px 13px">
    <div class="row"><span class="mini grow" style="margin:0">平级项目切片（5 切片）</span><span class="c-pill cp-n">白名单</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f12">绩效 · TK-901</span><span class="c-pill cp-g">已批 · 可开工</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f12">组织人事 · TK-902</span><span class="c-pill cp-g">已批 · 可开工</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f12">CRM · TK-903</span><span class="c-pill cp-o">待 Owner 批</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f12 w6">薪酬 API · TK-904a</span><span class="c-pill cp-n">待冻结派生</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f12 w6">薪酬 Web · TK-904b</span><span class="c-pill cp-n">待冻结派生</span></div>
  </div>

  <div class="card" style="padding:11px 13px">
    <div class="mini" style="margin-bottom:4px">两层 RBAC 与隔离护栏</div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">活原型与契约</span><span class="f11.5 w6" style="font-size:11.5px;color:var(--ink-green)">4 方只读共享</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">源码 / 录屏 / 测试号</span><span class="mono f11" style="color:var(--ink-blue)">project_only</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">并行联调策略</span><span class="f11.5 w6" style="font-size:11.5px">契约 Mock 先行</span></div>
  </div>
</aside>'''

    return wrap("二期蓝图 1 · 跨项目需求变更集与活原型拍板", dock_with_spec("spec", "1", "3"), left + main + right)


# ============================================================
# 图 2：无损抽屉下钻（变更集总览不跳页，右侧滑出 72% 毛玻璃工单抽屉就地审核）
# ============================================================
def build_2_drawer():
    bg_left = f'''<section class="glass pn" style="width:296px;flex:none;padding:16px 10px 10px">
  <div class="row g8" style="padding:0 8px 6px"><span class="f18 w7">需求变更集</span><span class="c-pill cp-i">待决策 1</span><span class="grow"></span><span class="plus-btn">{I("plus",14,2.6)}</span></div>
  <div class="g10h">并行执行中<span>1</span></div>
  <div class="r10 on" style="align-items:flex-start">
    <span class="ic-box" style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.22);flex:none">{I("layers",17,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><span class="t10 ell grow">月度算薪接入绩效与 CRM 提成</span></div>
      <div class="row g4" style="margin-top:4px"><span class="sc10">薪酬主导</span><span class="d10 ell">5 切片 · 1 联调待定责</span></div>
      <span class="pg10"><i style="width:76%;background:#fff"></i></span>
    </div>
  </div>
  <div class="g10h">待拍板契约<span>1</span></div>
  <div class="r10" style="align-items:flex-start">
    <span class="ic-box" style="width:34px;height:34px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF);flex:none">{I("layers",17,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><span class="t10 ell grow">审批单支持批量撤回</span><span class="tm10">1 小时</span></div>
      <div class="row g6" style="margin-top:3px"><span class="sc10 sc-t">审批主导</span><span class="d10 ell">2 个项目 · 待签契约</span></div>
    </div>
  </div>
  <div class="grow"></div>
  <div class="card" style="margin:6px;padding:10px 12px">
    <div class="mini" style="margin-bottom:5px">红点彻底去重</div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">变更集红点 <b>1</b></span><span class="f11 t3">仅计决策事件</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">工单红点 <b>3</b></span><span class="f11 t3">仅计执行待办</span></div>
  </div>
</section>'''

    bg_main = f'''<main class="glass pn grow" style="min-width:0;opacity:.72">
  <header class="thead">
    <div class="row g10">
      <span class="ic-box" style="width:38px;height:38px;border-radius:11px;background:linear-gradient(155deg,#6366F1,#0EA5E9)">{I("layers",19,2)}</span>
      <div class="col grow" style="min-width:0">
        <div class="row g8"><h1 class="ell">月度算薪自动拉取绩效系数与 CRM 提成</h1></div>
        <div class="f12 t3" style="margin-top:2px">CS-089 · 4 个平级项目 · 5 个交付切片</div>
      </div>
    </div>
    <div class="row g10" style="margin-top:11px">
      <div class="cc-seg"><span>协作流</span><span>活原型</span><span>契约 3</span><span class="on">切片 5</span><span>联调验收</span></div>
    </div>
  </header>
  <div class="col g8" style="padding:12px 20px">
    <div class="srow"><span class="c-pill cp-g">绩效</span><span class="mono f12 w7">TK-901</span><span class="f13 w6 ell grow">开放季度绩效系数查询接口</span></div>
    <div class="srow"><span class="c-pill cp-p">组织人事</span><span class="mono f12 w7">TK-902</span><span class="f13 w6 ell grow">员工调岗异动事件补充 effectiveDate</span></div>
    <div class="srow hi"><span class="c-pill cp-o">CRM</span><span class="mono f12 w7" style="color:var(--ink-blue)">TK-903</span><span class="f13 w6 ell grow">订单回款推送销售提成明细</span></div>
    <div class="srow"><span class="c-pill cp-b">薪酬 API</span><span class="mono f12 w7">TK-904a</span><span class="f13 w6 ell grow">月度算薪引擎接入绩效与提成（契约 Mock 4/4）</span></div>
    <div class="srow"><span class="c-pill cp-b">薪酬 Web</span><span class="mono f12 w7">TK-904b</span><span class="f13 w6 ell grow">算薪明细表新增绩效与提成列（CDP Mock 过审）</span></div>
  </div>
</main>'''

    drawer = f'''<div class="dim-scrim"></div>
<section class="drawer">
  <div class="row g10" style="padding:12px 18px;border-bottom:1px solid var(--hair);flex:none">
    <span class="cs-btn">← Esc 返回 CS-089 总览</span>
    <span class="c-pill cp-o">CRM 切片</span>
    <span class="mono f13 w7">TK-903</span>
    <span class="f13 w6 ell grow">订单回款推送销售提成明细 POST /hook/commission</span>
    <span class="c-pill cp-g">CRM 成员 · 可审源码</span>
    <span class="cs-btn">全屏进工单 ↗</span>
  </div>

  <div class="row grow" style="align-items:stretch;min-height:0;overflow:hidden">
    <div class="col g10 grow" style="padding:14px 18px;min-width:0;border-right:1px solid var(--hair)">
      <div class="row g8">
        <div class="cc-seg"><span class="on">对话</span><span>代码改动 2</span><span>证据 3</span><span>执行日志</span></div>
        <span class="grow"></span>
        <span class="c-pill cp-b">待审核代码 · L1 中危</span>
      </div>

      <div class="row g8" style="padding:8px 11px;border-radius:11px;background:color-mix(in srgb,var(--green) 11%,var(--glass-2));border:1px solid color-mix(in srgb,var(--green) 30%,transparent);white-space:nowrap">
        <span class="ck" style="background:var(--green);width:17px;height:17px">{I("check",10,3)}</span>
        <b class="f12">机审与契约全绿</b>
        <span class="c-pill cp-g">#8e1b@v1 0 漂移</span>
        <span class="c-pill cp-g">Provider 校验 9/9</span>
        <span class="c-pill cp-g">向前兼容 ✓</span>
      </div>

      <div class="card" style="padding:13px 15px">
        <div class="row g8">
          <b class="f14.5" style="font-size:14.5px">第 1 轮交付：CRM 切片已完成，等你审代码</b>
          <span class="f11.5 t3" style="margin-left:auto;font-size:11.5px">提交 <span class="mono t2">7c3e91a</span> · CRM Agent</span>
        </div>
        <div class="f12 t2" style="margin-top:8px;line-height:1.6">
          <b>改动摘要：</b>按独立契约 <span class="mono">#8e1b@v1</span> 在订单回款事件新增异步 Webhook 推送，已按 Expand-Contract 规范保留旧回调兼容，无破坏性字段变更。<br>
          <b>契约级并行验证：</b>已跑通双向契约测试集（含退单/幂等 9 条样本），无需等待薪酬合入即可独立交付。
        </div>
        <div class="row g8" style="margin-top:9px;padding:7px 10px;border-radius:10px;background:var(--fill);font-size:11.5px;white-space:nowrap">
          <span class="w6">改动文件</span>
          <span class="mono t2">crm/hooks/commission.ts (+62)</span>
          <span class="mono t2">crm/order.service.ts (+14)</span>
          <span class="lnk" style="margin-left:auto">展开 Diff ›</span>
        </div>
        <div class="row g8" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hair)">
          <span class="f11.5 t3 grow" style="font-size:11.5px">遵循 04 规范：审过后发起测试 MR，由负责人独立审批合入 dev-crm</span>
          <span class="btn2 sm a-red">{I("undo",13)}打回修改</span>
          <span class="btn2 sm a-pri">{I("check",13,2.6)}审核代码通过 7c3e91a</span>
        </div>
      </div>

      <div class="row g8" style="padding:8px 11px;border-radius:10px;background:var(--fill);font-size:11.5px;color:var(--text-2)">
        <span class="c-pill cp-i">RBAC 兜底</span>
        <span class="grow">非 CRM 成员点开此抽屉时，自动折叠源码与原始录屏区，仅显契约合规态与状态摘要，绝不撞红锁。</span>
      </div>

      <div class="card" style="padding:12px 15px">
        <div class="row g8">
          <span class="c-pill cp-g">单仓契约级交付</span>
          <b class="f13">无需干等兄弟项目，双向契约已就地闭环</b>
          <span class="f11 t3" style="margin-left:auto">入 TEST 后自动触发全仓 E2E</span>
        </div>
        <div class="f12 t2" style="margin-top:6px;line-height:1.55">
          • <b>CRM（提供方）</b>：Provider 契约校验 9/9 通过（含退单负数与幂等头），按 Expand-Contract 波次 1 先上。<br>
          • <b>薪酬（消费方）</b>：<span class="mono">TK-904a/b</span> 已用契约 Mock 并行过审，不因本单阻塞开发。
        </div>
      </div>

      <div class="row g8" style="margin-top:auto;padding:7px 10px;border-radius:13px;background:var(--well);border:1px solid var(--hair)">
        <span class="aitag"><span class="aid">{I("spark",11)}</span>本单 AI · TK-903</span>
        <span class="f12.5 t3 grow ell" style="font-size:12.5px">就地追问 CRM Agent 幂等键生成逻辑，Esc 一键退回变更集总览…</span>
        <span style="width:28px;height:28px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;display:flex;align-items:center;justify-content:center">{I("arrowup",13,2.4)}</span>
      </div>
    </div>

    <aside class="col g10" style="width:270px;flex:none;padding:14px 14px;background:color-mix(in srgb,var(--fill) 45%,transparent)">
      <div class="card" style="padding:11px 13px">
        <div class="row g6"><span class="mini grow" style="margin:0">独立契约版本</span><span class="c-pill cp-i">#8e1b@v1</span></div>
        <div class="mono f12 w7" style="margin-top:6px">POST /hook/commission</div>
        <div class="cf-row"><span class="mono w6">orderId</span><span class="mono t3">string · req</span></div>
        <div class="cf-row"><span class="mono w6">sellerId</span><span class="mono t3">string · req</span></div>
        <div class="cf-row"><span class="mono w6">amount</span><span class="mono t3">Decimal(12,2)</span></div>
        <div class="cf-row"><span class="mono w6">isRefund</span><span class="mono t3">bool · 退单负数</span></div>
        <div class="cf-row"><span class="mono w6">idemKey</span><span class="mono" style="color:var(--ink-green)">header ✓</span></div>
        <button class="cc-btn cc-btn-xs cc-btn-sec" style="width:100%;justify-content:center;margin-top:9px">发起契约 RFC（升 v2）</button>
      </div>

      <div class="card" style="padding:11px 13px">
        <div class="mini" style="margin-bottom:6px">本切片所属拓扑</div>
        <div class="kv2"><span class="f11.5 t2" style="font-size:11.5px">契约消费方</span><span class="f11.5 w6" style="font-size:11.5px">薪酬 TK-904a</span></div>
        <div class="kv2"><span class="f11.5 t2" style="font-size:11.5px">薪酬并行状态</span><span class="c-pill cp-g">Mock 4/4 通过</span></div>
        <div class="kv2"><span class="f11.5 t2" style="font-size:11.5px">发版波次</span><span class="f11.5 w6" style="font-size:11.5px">波次 1 · 兼容先上</span></div>
        <div class="kv2"><span class="f11.5 t2" style="font-size:11.5px">源码可见域</span><span class="c-pill cp-n">project_only</span></div>
      </div>
    </aside>
  </div>
</section>'''

    return wrap("二期蓝图 2 · 需求变更集无损抽屉下钻", dock_with_spec("spec", "1", "3"),
                f'<div class="stage-rel">{bg_left}{bg_main}{drawer}</div>')


# ============================================================
# 图 3：一线开发「工单页」实战三栏（P1 救火强置顶 + 右栏常驻冻结契约护栏）
# ============================================================
def build_3_ticket():
    p1_row = ("882", "王芳", "#FF9A9E,#F6416C", "red", "薪资明细导出接口超时 504", "t", "线上告警 · 第 1 轮交付待审", "3 分钟", "", None)
    crm_row = ("903", "陈某", "#FFC38A,#F08A5D", "blue", "回款推送销售提成明细接口", "t", "L1 中危 · #8e1b@v1 · 待审代码", "5 分钟", "", None)
    bug_row = ("104", "李娜", "#FBC2EB,#A6C1EE", "orange", "退单提成未做负数冲红", "j", "AI 归因 → CRM · L2 高危", "8 分钟", "", None)

    r_p1 = trow(p1_row, on=False).replace('<span class="sc10 sc-t">Tita</span>', '<span class="p1-chip">P1 救火</span>')
    r_crm = trow(crm_row, on=True).replace('<span class="sc10 sc-t">Tita</span>', '<span class="cs-chip">CS-089</span>')
    r_bug = '<div class="sub-row">' + trow(bug_row, on=False).replace('<span class="sc10 sc-j">Jira</span>', '<span class="cs-chip" style="background:color-mix(in srgb,var(--red) 16%,transparent);color:var(--ink-red)">联调 M-104</span>') + '</div>'

    left = ['<section class="glass pn" style="width:302px;flex:none;padding:16px 10px 10px">',
            f'<div class="row g8" style="padding:0 8px 4px"><span class="f18 w7">工单</span><span class="f13 t3">9</span><span class="plus-btn">{I("plus",14,2.6)}</span><span class="grow"></span><div class="cc-seg cc-seg-xs"><span class="on">我的</span><span>全部</span></div></div>',
            '<div class="fstrip"><span class="fpill on">全部 9</span><span class="fpill">救火 Bug 5</span><span class="fpill">需求切片 4</span></div>',
            '<div class="g10h">等你决定<span>3</span></div>',
            r_p1,
            r_crm,
            r_bug,
            '<div class="g10h">Bot 在问你<span>1</span></div>',
            trow(TICKETS[1][2][0], on=False),
            '<div class="g10h">Bot 修复中<span>2</span></div>',
            trow(TICKETS[2][2][0], on=False),
            '</section>']
    left_html = "".join(left)

    main = f'''<main class="glass pn grow" style="min-width:0">
  <header class="thead">
    <div class="cs-bar" style="margin-bottom:10px">
      <span class="c-pill cp-i">{I("layers",11)}CS-089</span>
      <b class="ell grow">月度算薪接入绩效与 CRM 提成</b>
      <span class="cs-btn pri">浮层看活原型</span>
      <span class="cs-btn">进变更集 ↗</span>
    </div>

    <div class="row g10">
      <span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(155deg,#F59E0B,#EA580C);font-size:12px;font-weight:800">CRM</span>
      <div class="col grow" style="min-width:0">
        <div class="row g8"><h1 class="ell">订单回款推送销售提成明细 POST /hook/commission</h1><span class="c-pill cp-b">待审代码 · L1 中危</span></div>
        <div class="f12 t3" style="margin-top:2px">TK-903 · CRM 切片 · 修复人 张某 · <span style="color:var(--ink-green)">源码/录屏仅 CRM 可见</span></div>
      </div>
    </div>
    <div class="row g10" style="margin-top:10px">
      <div class="cc-seg"><span class="on">对话</span><span>代码改动 2</span><span>证据 3</span><span>执行日志</span><span>发布</span></div>
      <span class="grow"></span>
      <span class="f12 t3" style="white-space:nowrap">左审 Diff · 右核冻结契约</span>
    </div>
  </header>

  <div class="col g10 grow" style="padding:12px 20px 10px;min-height:0;overflow:hidden">
    <div class="row g8" style="padding:8px 12px;border-radius:12px;background:color-mix(in srgb,var(--green) 11%,var(--glass-2));border:1px solid color-mix(in srgb,var(--green) 30%,transparent);white-space:nowrap">
      <span class="ck" style="background:var(--green);width:18px;height:18px">{I("check",11,3)}</span>
      <b class="f12.5" style="font-size:12.5px">机审与契约全绿</b>
      <span class="c-pill cp-g">#8e1b@v1 0 漂移</span>
      <span class="c-pill cp-g">Provider 校验 9/9</span>
      <span class="c-pill cp-g">Expand-Contract ✓</span>
    </div>

    <div class="card" style="padding:13px 16px">
      <div class="row g8">
        <b class="f15">第 1 轮交付：CRM 切片已完成，等你审代码</b>
        <span class="f12 t3" style="margin-left:auto">审核对象 <span class="mono t2">7c3e91a</span> · 5 分钟前</span>
      </div>
      <div class="f12.5 t2" style="margin-top:8px;line-height:1.6;font-size:12.5px">
        <b>改动摘要：</b>按 <span class="mono">#8e1b@v1</span> 在订单回款回调处新增提成明细异步推送，已加幂等头防重复推，旧订单回调逻辑零改动。<br>
        <b>不变量校验：</b>原有 CRM 订单列表与对账接口零回归；已补 3 条退单与幂等单测。
      </div>
      <div class="row g10" style="margin-top:10px;padding:8px 11px;border-radius:11px;background:var(--fill);font-size:12px;white-space:nowrap">
        <span class="w6">改动文件</span>
        <span class="mono t2">crm/hooks/commission.ts (+62)</span>
        <span class="mono t2">crm/order.service.ts (+14)</span>
        <span class="lnk" style="margin-left:auto">查看逐行 Diff ›</span>
      </div>
      <div class="row g8" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hair)">
        <span class="f12 t3 grow">审过后将创建测试 MR，经独立审批合入 <span class="mono">dev-crm</span>（绝不自动合入）</span>
        <span class="btn2 a-red">{I("undo",14)}打回修改</span>
        <span class="btn2 a-pri">{I("check",14,2.6)}审核代码通过 7c3e91a</span>
      </div>
    </div>

    <div class="card" style="padding:12px 15px">
      <div class="row g8">
        <span class="c-pill cp-g">契约级真并行</span>
        <b class="f13">无需干等兄弟项目，双向契约已就地闭环</b>
        <span class="f11 t3" style="margin-left:auto">第 2 阶段统一跑 TEST 真环境 E2E</span>
      </div>
      <div class="f12 t2" style="margin-top:6px;line-height:1.55">
        • <b>本仓（提供方）</b>：已用契约样本集跑过 Provider 契约校验 9/9，杜绝「联调假绿」。<br>
        • <b>薪酬（消费方）</b>：<span class="mono">TK-904a/b</span> 已基于同契约 Mock 并行跑通 4/4 断言，合入 TEST 后自动触发跨仓 E2E。
      </div>
    </div>

    <div class="row g8" style="margin-top:auto;padding:7px 10px;border-radius:14px;background:var(--well);border:1px solid var(--hair)">
      <span class="aitag"><span class="aid">{I("spark",11)}</span>本单 AI · TK-903</span>
      <span class="f13 t3 grow ell">问 CRM Agent 为什么这样写，或让它补充异常重试单测…</span>
      <span style="width:30px;height:30px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;display:flex;align-items:center;justify-content:center">{I("arrowup",14,2.4)}</span>
    </div>
  </div>
</main>'''

    right = f'''<aside class="glass pn" style="width:292px;flex:none;padding:13px;display:flex;flex-direction:column;gap:10px">
  <div class="card" style="padding:11px 13px">
    <div class="row g6"><span class="mini grow" style="margin:0">冻结契约护栏</span><span class="c-pill cp-i">#8e1b@v1</span><span class="c-pill cp-g">0 漂移</span></div>
    <div class="mono f12 w7" style="margin-top:5px">POST /hook/commission</div>
    <div class="cf-row" style="padding:4px 8px"><span class="mono w6">orderId / sellerId</span><span class="mono t3">string · req</span></div>
    <div class="cf-row" style="padding:4px 8px"><span class="mono w6">amount</span><span class="mono t3">Decimal · 退单&lt;0</span></div>
    <div class="cf-row" style="padding:4px 8px"><span class="mono w6">isRefund</span><span class="mono t3">bool · 退单标记</span></div>
    <div class="cf-row" style="padding:4px 8px"><span class="mono w6">idemKey</span><span class="mono" style="color:var(--ink-green)">header 幂等 ✓</span></div>
    <button class="cc-btn cc-btn-xs cc-btn-sec" style="width:100%;justify-content:center;height:28px;margin-top:7px">发起契约 RFC（升 v2）</button>
  </div>

  <div class="card" style="padding:11px 13px">
    <div class="row"><span class="mini grow" style="margin:0">兄弟切片进度（只读）</span><span class="c-pill cp-n">白名单</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">绩效 · TK-901</span><span class="c-pill cp-g">已入 TEST</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">人事 · TK-902</span><span class="c-pill cp-g">已入 TEST</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 w7" style="font-size:11.5px;color:var(--ink-blue)">CRM · TK-903（本单）</span><span class="c-pill cp-b">待审代码</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">薪酬 API · TK-904a</span><span class="c-pill cp-n">Mock 4/4</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">薪酬 Web · TK-904b</span><span class="c-pill cp-n">Mock 过审</span></div>
    <button class="cc-btn cc-btn-xs cc-btn-sec" style="width:100%;justify-content:center;margin-top:8px">{I("plus",12,2.4)}提联调 Bug · 入待定责池</button>
  </div>

  <div class="card" style="padding:11px 13px">
    <div class="mini" style="margin-bottom:4px">环境与发布约束</div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">工作分支</span><span class="mono f11.5" style="font-size:11.5px">fix/tk-903</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">目标测试分支</span><span class="mono f11.5" style="font-size:11.5px">dev-crm</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">上线策略</span><span class="f11.5 w6" style="font-size:11.5px;color:var(--ink-green)">波次 1 · 兼容先上</span></div>
  </div>
</aside>'''

    return wrap("二期蓝图 3 · 一线开发工单页实战三栏", dock_with_spec("chat", "1", "3"), left_html + main + right)


# ============================================================
# 图 4：QA 联调验收 + AI 机械归因定责池 + Expand-Contract 安全波次发布
# ============================================================
def build_4_qa():
    left = f'''<section class="glass pn" style="width:296px;flex:none;padding:16px 10px 10px">
  <div class="row g8" style="padding:0 8px 6px"><span class="f18 w7">需求变更集</span><span class="c-pill cp-i">待决策 1</span><span class="grow"></span><span class="plus-btn">{I("plus",14,2.6)}</span></div>
  <div class="g10h">联调验收中<span>1</span></div>
  <div class="r10 on" style="align-items:flex-start">
    <span class="ic-box" style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.22);flex:none">{I("layers",17,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><span class="t10 ell grow">月度算薪接入绩效与 CRM 提成</span></div>
      <div class="row g4" style="margin-top:4px"><span class="sc10">QA 验收</span><span class="d10 ell">E2E 3/4 · 1 项待定责</span></div>
      <span class="pg10"><i style="width:82%;background:#fff"></i></span>
    </div>
  </div>
  <div class="g10h">待拍板契约<span>1</span></div>
  <div class="r10" style="align-items:flex-start">
    <span class="ic-box" style="width:34px;height:34px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF);flex:none">{I("layers",17,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><span class="t10 ell grow">审批单支持批量撤回</span><span class="tm10">1 小时</span></div>
      <div class="row g6" style="margin-top:3px"><span class="sc10 sc-t">审批主导</span><span class="d10 ell">2 个项目 · 等契约冻结</span></div>
    </div>
  </div>
  <div class="grow"></div>
  <div class="card" style="margin:6px;padding:10px 12px">
    <div class="mini" style="margin-bottom:5px">QA 验收环境</div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">联调环境</span><span class="c-pill cp-g">TEST-02 在线</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">已部署仓</span><span class="f11.5 w6" style="font-size:11.5px">5 / 5 仓就绪</span></div>
  </div>
</section>'''

    main = f'''<main class="glass pn grow" style="min-width:0">
  <header class="thead">
    <div class="row g10">
      <span class="ic-box" style="width:40px;height:40px;border-radius:11px;background:linear-gradient(155deg,#6366F1,#0EA5E9)">{I("layers",20,2)}</span>
      <div class="col grow" style="min-width:0">
        <div class="row g8"><h1 class="ell">月度算薪自动拉取绩效系数与 CRM 提成</h1><span class="c-pill cp-o">TEST 联调验收 · 3/4</span></div>
        <div class="f12 t3" style="margin-top:2px">CS-089 · 4 个平级项目 · 5 个交付切片 · 活原型 E2E 清单由系统自动生成</div>
      </div>
    </div>
    <div class="row g10" style="margin-top:11px">
      <div class="cc-seg"><span>协作流</span><span>活原型</span><span>契约 3</span><span>切片 5</span><span class="on">联调验收</span></div>
      <span class="grow"></span>
      <span class="cs-btn pri">{I("play",11)}重跑全仓 E2E</span>
    </div>
  </header>

  <div class="col g10 grow" style="padding:12px 20px 12px;min-height:0;overflow:hidden">
    <div class="col g6">
      <div class="qa-row">
        <span class="qa-dot qa-ok">✓</span>
        <span class="f12.5 w6 grow ell" style="font-size:12.5px">1. 拉取季度绩效 S/A/B 系数并参与月度算薪公式</span>
        <span class="c-pill cp-g">绩效 + 薪酬 · 通过</span>
        <span class="f11.5 t3" style="font-size:11.5px">QA 李娜已签</span>
      </div>
      <div class="qa-row">
        <span class="qa-dot qa-ok">✓</span>
        <span class="f12.5 w6 grow ell" style="font-size:12.5px">2. 员工月中调岗按 effectiveDate 拆分归属成本中心</span>
        <span class="c-pill cp-g">人事 + 薪酬 · 通过</span>
        <span class="f11.5 t3" style="font-size:11.5px">QA 李娜已签</span>
      </div>
      <div class="qa-row">
        <span class="qa-dot qa-ok">✓</span>
        <span class="f12.5 w6 grow ell" style="font-size:12.5px">3. 订单回款后 5 秒内推入薪酬提成明细并防重入账</span>
        <span class="c-pill cp-g">CRM + 薪酬 · 通过</span>
        <span class="f11.5 t3" style="font-size:11.5px">QA 李娜已签</span>
      </div>
      <div class="qa-row fail">
        <span class="qa-dot qa-no">✕</span>
        <span class="f12.5 w6 grow ell" style="font-size:12.5px">4. 客户退单后，薪酬提成明细自动生成负数冲红记录</span>
        <span class="c-pill cp-r">E2E 失败 · 已入定责池</span>
        <span class="c-pill cp-i">AI 已举证</span>
      </div>
    </div>

    <div class="card" style="padding:12px 15px;border-color:color-mix(in srgb,var(--red) 35%,transparent)">
      <div class="row g8">
        <span class="c-pill cp-r">待定责池 · M-104</span>
        <b class="f13.5" style="font-size:13.5px">退单提成未做负数冲红</b>
        <span class="c-pill cp-g" style="margin-left:auto">Ajv/Zod 机械判责 · 0 幻觉</span>
      </div>
      <div class="har-box" style="margin-top:8px">
        <div><span class="t3">冻结契约 #8e1b@v1：</span><span class="mono har-ok">when isRefund == true =&gt; amount &lt; 0</span></div>
        <div><span class="t3">脱敏抓包（CRM 发出）：</span><span class="mono har-bad">{{ "orderId": "ORD-***91", "isRefund": true, "amount": +1280.00 }}  ← 响应违约！</span></div>
        <div class="f11.5 t2" style="margin-top:3px;font-size:11.5px"><b>归因结论：</b>100% 归责提供方 <b>CRM</b>（未按契约发负数），非薪酬算错；原始录屏已按 <span class="mono">project_only</span> 脱敏隔离。</div>
      </div>
      <div class="row g8" style="margin-top:9px">
        <span class="btn2 sm a-pri">{I("check",13,2.6)}确认派给 CRM 生成工单</span>
        <span class="btn2 sm a-sec" style="background:var(--fill)">转契约 RFC 升 v2</span>
        <span class="cc-select cc-select-xs"><span class="cc-sel-val">改派项目</span><span class="cc-sel-sp"></span><span class="cc-sel-caret">{I("chevd",13)}</span></span>
        <span class="f11 t3" style="margin-left:auto">确认后自动挂入 CRM 待办并支持审计转派</span>
      </div>
    </div>

    <div class="row g10" style="margin-top:auto;padding:9px 13px;border-radius:12px;background:color-mix(in srgb,var(--blue) 8%,transparent);font-size:11.5px;color:var(--text-2)">
      <span style="color:var(--ink-blue);display:flex">{I("rocket",15)}</span>
      <span class="grow"><b>安全发版波次（Expand-Contract + Flag）：</b>波次 1 绩效/人事/CRM 兼容增量先上 → 波次 2 薪酬关开关上线 → 验稳开 Flag（异常 0 秒关开关，<b>严禁自动级联全回滚</b>）。</span>
      <span class="cc-btn cc-btn-xs cc-btn-sec is-disabled" style="opacity:.46;white-space:nowrap">编排 PROD 波次（差 1 项）</span>
    </div>
  </div>
</main>'''

    right = '''<aside class="glass pn" style="width:292px;flex:none;padding:13px;display:flex;flex-direction:column;gap:10px">
  <div class="card" style="padding:11px 13px">
    <div class="row"><span class="mini grow" style="margin:0">切片状态（公共白名单）</span><span class="c-pill cp-n">5 切片</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">绩效 · TK-901</span><span class="c-pill cp-g">TEST 就绪</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">人事 · TK-902</span><span class="c-pill cp-g">TEST 就绪</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">CRM · TK-903</span><span class="c-pill cp-r">待修 M-104</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">薪酬 API · TK-904a</span><span class="c-pill cp-g">TEST 就绪</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">薪酬 Web · TK-904b</span><span class="c-pill cp-g">TEST 就绪</span></div>
  </div>

  <div class="card" style="padding:11px 13px">
    <div class="mini" style="margin-bottom:5px">跨项目 RBAC 隐私护栏</div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">联调公共区</span><span class="f11.5 w6" style="font-size:11.5px;color:var(--ink-green)">仅脱敏契约 Diff</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">录屏与堆栈</span><span class="mono f11" style="color:var(--ink-blue)">project_only</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">全局 AI 聚合</span><span class="f11.5 w6" style="font-size:11.5px">按成员强裁剪</span></div>
  </div>

  <div class="card" style="padding:11px 13px">
    <div class="mini" style="margin-bottom:5px">PROD 波次编排（release_bundles）</div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">波次 1（提供方）</span><span class="f11.5 w6" style="font-size:11.5px">绩效 / 人事 / CRM</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">波次 2（消费方）</span><span class="f11.5 w6" style="font-size:11.5px">薪酬 API + Web</span></div>
    <div class="kv2" style="padding:3px 0"><span class="f11.5 t2" style="font-size:11.5px">灰度开关</span><span class="c-pill cp-o">Flag OFF</span></div>
    <div class="f11 t3" style="margin-top:6px;line-height:1.5">每个节点复用一期 <span class="mono">release_tasks</span> 串行锁、个人 Apollo 账号与真人输 <span class="mono">PROD</span> 确认。</div>
  </div>
</aside>'''

    return wrap("二期蓝图 4 · QA 联调验收与 AI 机械归因定责池", dock_with_spec("spec", "1", "3"), left + main + right)


PAGES = [
    ("phase2-spec.html", build_1_spec()),
    ("phase2-drawer.html", build_2_drawer()),
    ("phase2-ticket.html", build_3_ticket()),
    ("phase2-qa.html", build_4_qa()),
]

for fname, html in PAGES:
    p = OUT / fname
    p.write_text(html, encoding="utf-8")
    print("→", p)
