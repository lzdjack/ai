#!/usr/bin/env python3
"""生成 PC 插件市场页面：reference/src/v5/pc-market.html（1440×900）
复用 shell_pc.py 定稿外壳（顶栏 + Dock + 三栏苹果毛玻璃骨架）。
以「紧急回滚（Apollo 发布历史）」作为默认安装的官方插件验证第 12 节动态模块底座：
挂载 6 黄金插座、craft 回滚指令映射、标准 MCP 能力、最小权限授权、可自由停用卸载。
用法：python3 scripts/gen-market.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_pc import page, I, DOCK_ICONS  # noqa: E402

EXTRA_CSS = '''
<style>
.mk-item{display:flex;gap:10px;padding:9px 10px;border-radius:14px;align-items:center;position:relative}
.mk-item+.mk-item::after{content:"";position:absolute;left:54px;right:10px;top:0;height:1px;background:var(--hair)}
.mk-item.on{background:linear-gradient(180deg,var(--btn-pri-bg),var(--btn-pri-active));color:#fff;box-shadow:0 8px 18px -10px color-mix(in srgb,var(--btn-pri-bg) 88%,transparent),inset 0 1px 0 rgba(255,255,255,.25)}
.mk-item.on::after,.mk-item.on+.mk-item::after{display:none}
.mk-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 4px 10px -4px rgba(0,0,0,.3)}
.mk-item.on .mk-sub{color:rgba(255,255,255,.84)!important}
.mk-item.on .mk-bd{background:rgba(255,255,255,.22)!important;color:#fff!important}
.mk-bd{height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap;flex:none}
.slot-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-top:10px}
.slot-c{padding:11px 13px;border-radius:14px;background:var(--fill);border:1px solid var(--hair);min-width:0;overflow:hidden}
.cmd-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:var(--fill);font-size:12.5px}
.cmd-row+.cmd-row{margin-top:7px}
.cmd-k{font-family:"SF Mono",ui-monospace,monospace;font-weight:700;color:var(--ink-blue);min-width:118px;flex:none}
.cmd-v{font-family:"SF Mono",ui-monospace,monospace;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmd-n{font-size:11.5px;color:var(--text-3);white-space:nowrap;flex:none}
.mcp-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:9px;background:color-mix(in srgb,var(--purple) 11%,transparent);color:var(--ink-purple);font-family:"SF Mono",ui-monospace,monospace;font-size:12px;font-weight:600}
.inst-pill{height:var(--ctl-xs);padding:0 10px;border-radius:var(--r-sm);font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 12%,transparent)}
</style>
'''

SVG_BOX = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2.6l8.4 4.7L12 12 3.6 7.3z" fill="#FFE2A8"/><path d="M3.6 7.3L12 12v9.4l-8.4-4.7z" fill="#fff" opacity=".95"/><path d="M20.4 7.3L12 12v9.4l8.4-4.7z" fill="#fff" opacity=".7"/></svg>'
SVG_RB = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.8 4.8v4.4h4.4"/><path d="M4.2 9.2A8.3 8.3 0 1 1 3.9 13.6"/><path d="M12 8v4.2l2.7 1.7"/></svg>'
SVG_PI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>'
SVG_WAVE = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>'
SVG_TERM = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'
SVG_PLUG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/></svg>'
SVG_MSG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'


def mrow(name, sub, icon_svg, bg, badge, badge_cls="tg-g", on=False, action_txt=""):
    bd = f'<span class="mk-bd {badge_cls}">{badge}</span>' if badge else ""
    act = f'<span class="inst-pill">{action_txt}</span>' if action_txt else ""
    return (f'<div class="mk-item{" on" if on else ""}">'
            f'<span class="mk-ic" style="background:{bg}">{icon_svg}</span>'
            f'<div class="grow" style="min-width:0">'
            f'<div class="row g6"><span class="f13 w6 ell grow">{name}</span>{bd}{act}</div>'
            f'<div class="f12 t3 ell mk-sub" style="margin-top:2px">{sub}</div>'
            f'</div></div>')


left = f'''<section class="glass pn" style="width:296px;flex:none;padding:16px 10px 10px">
  <div class="row" style="padding:0 8px 8px">
    <span class="f18 w7 grow">插件市场</span>
    <span class="btn2 sm" style="background:var(--fill);color:var(--text)">{I("plus",13,2.3)}私有插件</span>
  </div>
  <div class="row g8" style="margin:0 6px;height:var(--ctl-sm);padding:0 10px;border-radius:var(--r-sm);background:var(--well);border:1px solid var(--hair);color:var(--text-3)">{I("search",14)}<span class="f12">搜索插件、连接器、主题、MCP…</span></div>
  <div class="cc-seg cc-seg-sm" style="margin:10px 6px 2px;display:flex">
    <span class="on" style="flex:1">全部 8</span>
    <span style="flex:1">已安装 4</span>
    <span style="flex:1">企业私有</span>
  </div>

  <div class="g10h">已安装 · 含官方预装<span>4</span></div>
  {mrow("紧急回滚（Apollo）", "views + connectors · 回滚与差异预览", SVG_RB, "linear-gradient(160deg,#FF8A7A,#E0281E)", "默认安装", "tg-g", on=True)}
  {mrow("发布流水线（Tita）", "views + craft · 发测试与正式流水线", SVG_BOX, "linear-gradient(160deg,#FFC54D,#FF7A00)", "默认安装", "tg-g")}
  {mrow("GitLab / Jira 连接器", "connectors · 鉴权归「设置 → 连接器」", SVG_PLUG, "linear-gradient(155deg,#38BDF8,#2563EB)", "官方预装", "tg-b")}
  {mrow("Pi 修复引擎（runtime-pi）", "runtimes · 多模型与流式交互", SVG_PI, "linear-gradient(155deg,#5E8BFF,#8B5CF6)", "核心默认", "tg-b")}

  <div class="g10h">可安装 · 扩展生态<span>4</span></div>
  {mrow("Token 费用检测", "topbar.widgets + 插件设置 · 预算熔断", SVG_WAVE, "linear-gradient(155deg,#34D399,#059669)", "", "", action_txt="安装")}
  {mrow("高对比暗夜主题", "themes · 自动归「外观与语言」单选", SVG_TERM, "linear-gradient(155deg,#A855F7,#6366F1)", "", "", action_txt="安装")}
  {mrow("外部 CLI 引擎（ACP）", "runtimes · 复用 Claude Code / Codex", SVG_PLUG, "linear-gradient(155deg,#64748B,#334155)", "", "", action_txt="安装")}
  {mrow("飞书 / 钉钉审批联动", "connectors + mcp · 群审批卡", SVG_MSG, "linear-gradient(155deg,#60A5FA,#4F46E5)", "", "", action_txt="安装")}
</section>'''

main = f'''<main class="glass pn grow" style="min-width:0;padding:18px 22px;gap:12px">
  <div class="row g14" style="align-items:flex-start;padding-bottom:13px;border-bottom:1px solid var(--hair)">
    <span class="ap ap-rb" style="width:52px;height:52px;border-radius:14px;transform:none;flex:none">{DOCK_ICONS["rb"]}</span>
    <div class="col grow" style="min-width:0;gap:5px">
      <div class="row g8">
        <h1 class="f18 w7" style="font-size:19px;white-space:nowrap">紧急回滚（Apollo）</h1>
        <span class="tag tg-g">已安装 · 默认安装</span>
        <span class="tag tg-n mono">v1.2.0</span>
      </div>
      <div class="f12 t2" style="line-height:1.5">官方扩展插件 <span class="mono t3">plugins/module-rollback-apollo</span> · 遵循 5 贡献点协议（<span class="mono">views / connectors / capabilities</span>），不展示令牌明文，鉴权实例归口「设置 → 连接器」。</div>
    </div>
    <div class="row g8" style="flex:none">
      <button class="btn2" style="background:color-mix(in srgb,var(--blue) 13%,transparent);color:var(--ink-blue)">插件设置</button>
      <button class="btn2" style="background:color-mix(in srgb,var(--red) 11%,transparent);color:var(--ink-red)">停用卸载</button>
    </div>
  </div>

  <div class="card" style="padding:13px 16px">
    <div class="row"><span class="sec">声明的贡献点与扩展插座</span><span class="grow"></span><span class="f12 t3">按 manifest 自动归位 · 卸载零核心残留</span></div>
    <div class="slot-grid">
      <div class="slot-c">
        <div class="row g6"><span class="tag tg-r mono">dock.items</span><span class="f13 w6 ell">左侧 Dock · 紧急回滚</span></div>
        <div class="f12 t3" style="margin-top:5px">挂载红色时钟图标，直达发布历史与 Namespace 差异预览</div>
      </div>
      <div class="slot-c">
        <div class="row g6"><span class="tag tg-b mono">ticket.actions</span><span class="f13 w6 ell">工单操作 · 关联回滚查因</span></div>
        <div class="f12 t3" style="margin-top:5px">回滚完成后一键建单或关联原工单，让 Bot 自动定位根因</div>
      </div>
      <div class="slot-c">
        <div class="row g6"><span class="tag tg-o mono">ticket.sidebar</span><span class="f13 w6 ell">工单右栏 · 回滚状态徽章</span></div>
        <div class="f12 t3" style="margin-top:5px">区分「配置已回退 / 业务恢复待验证 / 已恢复」三段状态</div>
      </div>
      <div class="slot-c">
        <div class="row g6"><span class="tag tg-p mono">connectors</span><span class="f13 w6 ell">鉴权归「设置 → 连接器」 ›</span></div>
        <div class="f12 t3" style="margin-top:5px">复用本人 Apollo 账号执行与审计，需输入 PROD 二次确认</div>
      </div>
    </div>
  </div>

  <div class="card" style="padding:13px 16px">
    <div class="row" style="margin-bottom:9px"><span class="sec">craft 回滚指令映射</span><span class="grow"></span><span class="f12 t3">其他企业可替换为 kubectl rollout undo / 自研命令</span></div>
    <div class="cmd-row"><span class="cmd-k">craft history</span><span class="cmd-v">apollo.listReleases({{{{app}}}}, {{{{env}}}})</span><span class="cmd-n">验证过版本排前</span></div>
    <div class="cmd-row"><span class="cmd-k">craft diff</span><span class="cmd-v">apollo.previewNamespaceDiff({{{{cur}}}}, {{{{to}}}})</span><span class="cmd-n">展示连带变化</span></div>
    <div class="cmd-row"><span class="cmd-k">craft rollback</span><span class="cmd-v">apollo.rollback({{{{app}}}}, {{{{env}}}}, {{{{to}}}})</span><span class="cmd-n">回滚插队优先</span></div>
  </div>

  <div class="card" style="padding:13px 16px">
    <div class="row" style="margin-bottom:8px"><span class="sec">已注册的标准 MCP 能力</span><span class="grow"></span><span class="f12 t3">AI 仅可查历史与做预览，执行必须真人点确认</span></div>
    <div class="row g8" style="flex-wrap:wrap">
      <span class="mcp-chip">✦ rollback.listHistory</span>
      <span class="mcp-chip">✦ rollback.previewDiff</span>
      <span class="mcp-chip">✦ rollback.verifyPage</span>
      <span class="mcp-chip">✦ rollback.linkTicket</span>
    </div>
  </div>
</main>'''

right = f'''<aside class="glass pn" style="width:288px;flex:none;padding:16px 14px;gap:12px">
  <div class="card" style="padding:13px 14px">
    <div class="mini">权限授权（最小权限）</div>
    <div class="kv2"><span class="t2">读工单与版本</span><span class="f12 w6" style="color:var(--ink-green)">✓ tickets:read</span></div>
    <div class="kv2"><span class="t2">调用浏览器验证</span><span class="f12 w6" style="color:var(--ink-green)">✓ browser:verify</span></div>
    <div class="kv2"><span class="t2">发送关不掉通知</span><span class="f12 w6" style="color:var(--ink-green)">✓ notify:alert</span></div>
    <div class="kv2"><span class="t2">写回滚审计卡</span><span class="f12 w6" style="color:var(--ink-green)">✓ post_card</span></div>
    <div class="f12 t3" style="margin-top:8px;line-height:1.55">严禁直连主库；回滚记录存隔离表 <span class="mono">module_records</span>。</div>
  </div>

  <div class="card" style="padding:13px 14px">
    <div class="mini">订阅与发出的事件（Outbox）</div>
    <div class="tlx">
      <div class="rail"><span class="bul" style="background:var(--green)"></span><i></i></div>
      <div style="padding-bottom:10px"><div class="f13 w6 mono">release.verified</div><div class="f12 t3">标记「验证通过」的安全回滚基线</div></div>
    </div>
    <div class="tlx">
      <div class="rail"><span class="bul" style="background:var(--red)"></span></div>
      <div><div class="f13 w6 mono">rollback.executed</div><div class="f12 t3">触发浏览器业务验证 + 关不掉推送</div></div>
    </div>
  </div>

  <div class="card" style="padding:13px 14px">
    <div class="mini">企业自研与新物种插件</div>
    <div class="f12 t2" style="line-height:1.6">外部鉴权自动进「设置 → 连接器」，主题进「外观与语言」；Token 费用检测等任意新物种零代码自动落入「插件设置」通用 Schema 抽屉。</div>
    <div class="row g8" style="margin-top:11px">
      <span class="btn2 sm grow" style="background:var(--btn-pri-bg);color:#fff">导入私有插件</span>
      <span class="btn2 sm" style="background:var(--fill);color:var(--text)">SDK 文档</span>
    </div>
  </div>
</aside>'''

html = page("插件市场 · PC", "mkt", EXTRA_CSS + left + main + right)
(OUT / "pc-market.html").write_text(html, encoding="utf-8")
print("ok: pc-market.html (Plugin Market unified)")
