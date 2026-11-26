#!/usr/bin/env python3
"""全链路终审补齐 6 张高清设计板（T-08b / T-13 / T-14 / T-15）：
1. reference/src/v5/pc-ws-switch.html        (1440×900)  → PC-顶栏空间切换与邀请抽屉
2. reference/src/v5/pc-invite-expired.html   (1440×900)  → PC-邀请失效与切号
3. reference/src/v5/pc-project-workflow.html (1440×900)  → PC-设置-项目-流程模板
4. reference/src/v5/pc-edge-extra.html       (1440×900)  → PC-工作台-边界补全
5. reference/src/v5/pc-plugin-runtime.html   (1440×900)  → PC-插件运行态规范
6. reference/src/v5/m-runtime-extra.html     (1440×1000) → 移动端-运行态与异常补齐

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
# 1. PC-顶栏空间切换与邀请抽屉（T-13：多空间 >=2 时露出 + 原地升级团队）
# =====================================================================
def build_ws_switch():
    ws_pill = f'''<span class="cc-select cc-select-sm is-open" style="margin-left:10px;width:228px;flex:none;height:32px;border-radius:10px">
  <span class="ic-box" style="width:20px;height:20px;border-radius:6px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF);font-size:10px">星</span>
  <span class="cc-sel-val" style="font-size:12.5px">星辰研发中心</span>
  <span class="cc-tag cc-tag-b" style="height:17px;font-size:9.5px">2 空间</span>
  <span class="cc-sel-caret">{I("chevd",12)}</span>
</span>'''
    bell_btn = '''<span class="pill glass tpill" style="width:34px;height:34px;padding:0;justify-content:center;position:relative" title="站内通知中心">{I("bell",15,2.0)}<span style="position:absolute;top:5px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--red);box-shadow:0 0 0 1.5px var(--glass)"></span></span>'''
    right_tb = (
        f'<span class="pill glass tpill">{I("bot",13)}3 个 Bot 在线</span>'
        '<span class="pill glass tpill"><span class="dot" style="width:7px;height:7px;background:var(--green)"></span>Jira · 2 分钟前</span>'
        '<span class="pill glass tpill" style="color:var(--ink-orange)"><span class="dot" style="width:7px;height:7px;background:var(--orange)"></span>Tita 采集失败 · 重试中</span>'
        + bell_btn.replace('{I("bell",15,2.0)}', I("bell", 15, 2.0))
    )
    tb = make_topbar(ws_pill=ws_pill, right_extra=right_tb)
    _, chat_css = p_empty()
    base_body = ticket_list("20871") + '''<main class="glass pn grow" style="min-width:0;opacity:.75">''' + ticket_head() + '''
<div class="col g12 grow" style="padding:20px 26px"><div class="card flat" style="padding:14px 16px"><div class="f13 w7">已切换至工作空间：星辰研发中心（organization）</div><div class="f12 t2" style="margin-top:4px">当前工单、连接器、Skills 与个人凭据已通过 withWorkspaceTx 行级安全隔离。</div></div></div></main>'''

    ws_menu = f'''<div class="cc-menu" style="position:fixed;left:188px;top:58px;width:328px;z-index:var(--z-popover);padding:8px">
  <div class="f11 t3 w7" style="padding:4px 8px 6px">我的工作空间（仅 ≥ 2 时露出切换器）</div>
  <div class="cc-menu-item is-selected" style="padding:8px 10px">
    <span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">星</span>
    <div class="cc-mi-main"><b>星辰研发中心</b><em>organization · 研发成员（24 人）</em></div>
    <span class="cc-tag cc-tag-g">当前</span>
  </div>
  <div class="cc-menu-item" style="padding:8px 10px;margin-top:3px">
    <span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:linear-gradient(155deg,#A5B4FC,#6366F1)">个</span>
    <div class="cc-mi-main"><b>林某的个人工作台</b><em>personal · 本机 Runner（3 个私有项目）</em></div>
    <span class="cc-tag cc-tag-n">个人</span>
  </div>
  <div style="margin:6px 4px;padding-top:7px;border-top:1px solid var(--hair);display:flex;flex-direction:column;gap:4px">
    <div class="cc-menu-item" style="padding:7px 8px;color:var(--ink-blue);font-weight:600">{I("plus",14,2.4)}<span>原地将个人空间升级为团队组织 ›</span></div>
    <div class="cc-menu-item" style="padding:7px 8px;color:var(--ink-orange);font-weight:600">{I("link",14,2.2)}<span>输入邀请口令 #CC-…# 加入团队</span></div>
  </div>
</div>'''

    drawer = f'''{ws_menu}<div class="scrim"></div>
<aside class="cc-drawer" style="top:64px;height:calc(100% - 76px);width:560px;z-index:var(--z-drawer)">
  <div class="cc-drawer-hd">
    <span class="ic-box" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("users",18,2.2)}</span>
    <div class="col grow">
      <div class="f17 w7">原地升级为团队组织空间</div>
      <div class="f12 t3" style="margin-top:2px">无损把 <span class="mono">personal</span> 个人工作台升级为多人协同空间（零迁移、不断单）</div>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:12px">
    <div class="cc-field">
      <div class="cc-field-hd"><span>团队 / 组织显示名称</span><span class="cc-field-hint">仅内部成员可见</span></div>
      <div class="cc-input cc-input-md is-focus"><span class="grow w6">云匠开源协同组</span></div>
    </div>
    <div class="card" style="padding:12px 14px;gap:8px;background:color-mix(in srgb,var(--green) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--green) 24%,transparent)">
      <div class="row g8">{I("shield",15,2.2,"color:var(--ink-green)")}<span class="f13 w7" style="color:var(--ink-green)">资产原地保留清单（workspace_id 不变）</span></div>
      <div class="f12 t2" style="line-height:1.65">
        • 已配置 3 个项目仓、工作流模板与 4 条 Skills <b>100% 保留</b>；<br>
        • 已授权连接器沿用原密文，可选择是否共享给新邀请团队成员；<br>
        • <b style="color:var(--ink-red)">个人执行凭据（scope='user'）自动隔离</b>，不会被后续加入成员继承。
      </div>
    </div>
    <div class="card" style="padding:11px 14px;gap:8px">
      <div class="row g8"><span class="f13 w7 grow">顺便生成首条免 SMTP 成员邀请</span><span class="tag tg-b">24h · 12 位 Base32</span></div>
      <div class="row g8" style="padding:8px 10px;border-radius:10px;background:var(--well);border:1px solid var(--hair)">
        <span class="mono f12 t2 grow ell">https://cc.intra/join/9f2a4c8d · #CC-8K4P-9M2X-Q7R5#</span>
        <span class="cc-btn cc-btn-xs cc-btn-glass">复制文案</span>
      </div>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <button class="cc-btn cc-btn-md cc-btn-sec">取消</button>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-md cc-btn-pri">{I("check",14,2.6)}确认原地升级为团队空间</button>
  </div>
</aside>'''
    return pc_shell("顶栏空间切换与原地升级 · 云匠", "chat", base_body, tb, drawer)


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

    t2 = tile(2, "当前账号邮箱与受邀邮箱不一致", "防错入与越权顶替（invite.email 强核对）", f'''
  <span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(160deg,#FFC54D,#FF7A00)">{I("users",24,2.2)}</span>
  <div class="f18 w7" style="margin-top:12px">请切换为受邀邮箱后再加入</div>
  <div class="card col g6" style="margin-top:12px;padding:10px 14px;width:430px;text-align:left">
    <div class="row f12"><span class="t3" style="width:92px">当前已登录</span><span class="mono w6">zhang@personal.com</span><span class="tag tg-r" style="margin-left:auto">不匹配</span></div>
    <div class="row f12"><span class="t3" style="width:92px">本邀请指定邮箱</span><span class="mono w6" style="color:var(--ink-green)">zhang@company.com</span></div>
  </div>
  <div class="row g10" style="margin-top:14px"><button class="cc-btn cc-btn-md cc-btn-sec">取消并留在此账号</button><button class="cc-btn cc-btn-md cc-btn-pri">退出并用 zhang@company.com 登录</button></div>''')

    t3 = tile(3, "Web 管理后台安全交接中间确认页", "从桌面跳 /admin（#token= Fragment · 防反向代理日志泄露）", f'''
  <span class="ic-box" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(155deg,#3478F6,#5B21B6)">{I("shield",24,2.2)}</span>
  <div class="f18 w7" style="margin-top:12px">确认进入「星辰研发中心」企业管理后台？</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.6">正在由桌面端安全交接一次性令牌（URL Fragment <span class="mono">#token=...</span>），<br>确认后立即兑换 <span class="mono">HttpOnly; Path=/admin</span> 同源 Cookie 并作废原交接码。</div>
  <div class="row g10" style="margin-top:16px"><button class="cc-btn cc-btn-md cc-btn-sec">取消返回</button><button class="cc-btn cc-btn-md cc-btn-pri">{I("check",14,2.6)}确认进入 /admin 控制台</button></div>''')

    t4 = tile(4, "私有部署冷启动 · 首位超管强制改密拦截态", "INIT_ADMIN 登录后持有 pwd_change_only 短期令牌", f'''
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
# 3. PC-设置-项目-流程模板（T-08b + D1：React Flow 画布 + 节点级 Skills）
# =====================================================================
def build_project_workflow():
    def rf_node(idx, x_pct, y_px, phase, name, badge_txt, skills, on=False, chk=True):
        ptag = '<span class="tag tg-t" style="height:16px;font-size:9.5px;padding:0 5px">AI</span>' if phase == "exec" else '<span class="tag tg-b" style="height:16px;font-size:9.5px;padding:0 5px">交付</span>'
        bd = "border-color:var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo);background:var(--glass-2)" if on else ("opacity:.68;background:var(--well)" if not chk else "background:var(--glass-2)")
        sk_h = "".join(f'<span class="tag tg-p" style="height:16px;font-size:9.5px;padding:0 5px">{s}</span>' for s in skills[:2])
        b_tag = f'<span class="tag tg-n" style="height:16px;font-size:9px;padding:0 5px">{badge_txt}</span>' if badge_txt else ""
        h_dot = "position:absolute;top:50%;width:8px;height:8px;border-radius:50%;transform:translateY(-50%);background:var(--blue);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.22)"
        return f'''<div class="card" style="position:absolute;left:{x_pct}%;top:{y_px}px;width:21.6%;height:76px;padding:7px 10px;gap:3px;border-radius:13px;justify-content:space-between;{bd}">
  <span style="{h_dot};left:-4px"></span><span style="{h_dot};right:-4px"></span>
  <div class="row g5" style="min-width:0">{ptag}<span class="f10 w7 t2">{idx}</span><span class="grow"></span>{b_tag}</div>
  <div class="f12 w7 ell">{name}</div>
  <div class="row g4" style="flex-wrap:nowrap;overflow:hidden">{sk_h}</div>
</div>'''

    canvas = f'''<div style="position:relative;height:430px;flex:none;border-radius:16px;border:1px solid var(--hair);background:radial-gradient(color-mix(in srgb,var(--text) 16%,transparent) 1px, transparent 1px) 0 0 / 16px 16px, var(--well);overflow:hidden">
  <svg viewBox="0 0 1000 430" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
    <defs>
      <marker id="rf-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--teal)"/></marker>
      <marker id="rf-del" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--blue)"/></marker>
      <marker id="rf-org" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--orange)"/></marker>
      <marker id="rf-gry" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--text-3)"/></marker>
    </defs>
    <!-- Row 1 execution edges (nodes top=64 height=76 => center y=102) -->
    <path d="M238 102 L264 102" stroke="var(--teal)" stroke-width="2" fill="none" marker-end="url(#rf-arr)"/>
    <path d="M484 102 L510 102" stroke="var(--teal)" stroke-width="2" fill="none" marker-end="url(#rf-arr)"/>
    <path d="M730 102 L756 102" stroke="var(--teal)" stroke-width="2" fill="none" marker-end="url(#rf-arr)"/>
    <!-- run_when bypass above node 3 (Node 2 top 376,64 -> Node 4 top 868,60) -->
    <path d="M376 64 C 376 14, 868 14, 868 60" stroke="var(--text-3)" stroke-width="1.6" stroke-dasharray="5 4" fill="none" marker-end="url(#rf-gry)"/>
    <!-- Cross-phase Z connector 4 -> 5 in clean y=214 aisle -->
    <path d="M976 102 C 994 102, 994 214, 956 214 L 44 214 C 6 214, 6 312, 18 312" stroke="var(--blue)" stroke-width="2" fill="none" marker-end="url(#rf-del)"/>
    <!-- Row 2 delivery edges (nodes top=274 height=76 => center y=312) -->
    <path d="M238 312 L264 312" stroke="var(--blue)" stroke-width="2" fill="none" marker-end="url(#rf-del)"/>
    <path d="M484 312 L510 312" stroke="var(--blue)" stroke-width="2" fill="none" marker-end="url(#rf-del)"/>
    <path d="M730 312 L756 312" stroke="var(--text-3)" stroke-width="1.6" stroke-dasharray="4 3" fill="none" marker-end="url(#rf-gry)"/>
    <!-- Rollback default dashed curve (Node 6 top 376,274 -> Node 2 bottom 376,144) -->
    <path d="M376 274 L376 144" stroke="var(--orange)" stroke-width="2.2" stroke-dasharray="6 4" fill="none" marker-end="url(#rf-org)"/>
  </svg>
  <span class="tag tg-n" style="position:absolute;left:62.2%;top:12px;transform:translateX(-50%);height:19px;font-size:10px;background:var(--glass-elev)">run_when: 非前端/SDK 自动跳过 3</span>
  <span class="tag tg-o" style="position:absolute;left:37.6%;top:168px;transform:translateX(-50%);height:20px;font-size:10px;background:var(--glass-elev)">打回默认 → 2（全节点下拉可选）</span>
  <span class="f10 w7 t3" style="position:absolute;left:22px;top:16px">阶段一 · execution</span>
  {rf_node(1,2.2,64,"exec","读单与复现","ai_phase",["最小改动 v2","权限上下文"])}
  {rf_node(2,26.8,64,"exec","改码与构建","ai_phase",["禁弱化断言","Token 规范"])}
  {rf_node(3,51.4,64,"exec","修后浏览器验证","run_when",["交互回归 v1","金额核验"],on=True)}
  {rf_node(4,76.0,64,"exec","交付与硬门禁","per_repo",["交付摘要 v1"])}
  <span class="f10 w7 t3" style="position:absolute;left:22px;top:248px">阶段二 · delivery</span>
  {rf_node(5,2.2,274,"del","代码审查","L0-L2",["高危路径清单"])}
  {rf_node(6,26.8,274,"del","MR 合入与复测","per_repo",["TEST 发版核验"])}
  {rf_node(7,51.4,274,"del","主干合入与发布","PROD",["不倒退校验"])}
  {rf_node(8,76.0,274,"del","合规会签(可选)","未启用",["会签说明"],chk=False)}
  <div class="row g8" style="position:absolute;left:12px;bottom:10px;padding:4px 10px;border-radius:10px;background:var(--glass-elev);border:1px solid var(--stroke);font-size:10.5px;color:var(--text-2)">
    <span class="w7 mono" style="color:var(--ink-blue)">@xyflow/react</span><span>+  −  ⊡</span>
  </div>
  <div class="row g8" style="position:absolute;right:12px;bottom:10px;padding:4px 10px;border-radius:10px;background:var(--glass-elev);border:1px solid var(--stroke);font-size:10px;color:var(--text-3)">
    <span>实线 主链 · 灰虚 run_when · 橙虚 回退预设</span>
  </div>
</div>'''

    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead">
  <div class="row g10">
    <div class="col grow">
      <div class="row g10"><h1>项目 · OKR</h1><span class="cc-seg cc-seg-xs"><span>开工条件</span><span class="on">流程画布与节点 Skills</span></span></div>
      <div class="f12 t3" style="margin-top:3px">配置优先于写死 · 前端 <span class="mono">@xyflow/react</span> 可视化编排 + 后端 PG/<span class="mono">pg-boss</span> 同事务步进（下一轮生效）</div>
    </div>
    <button class="cc-btn cc-btn-sm cc-btn-glass">{I("plus",13,2.4)}新增节点</button>
    <button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.6)}发布新版本 v4</button>
  </div>
</header>
<div class="col g10 grow" style="padding:12px 20px;min-height:0;overflow:hidden">
  <div class="row g8" style="padding:8px 12px;border-radius:12px;background:var(--fill);white-space:nowrap">
    <span class="f12 w7 t2" style="white-space:nowrap">预设模板：</span>
    <span class="pill p-blue" style="height:26px;font-size:12px">标准前端（当前）</span>
    <span class="pill p-gray" style="height:26px;font-size:12px">后端 / SDK 单测</span>
    <span class="pill p-gray" style="height:26px;font-size:12px">极简单主干 MR</span>
    <span class="pill p-gray" style="height:26px;font-size:12px">企业高合规定制</span>
    <span class="grow"></span>
    <span class="f11 t3">v3 在用 · 修改将生成 v4</span>
  </div>
  {canvas}
  <div class="card" style="padding:10px 14px;gap:8px">
    <div class="row g8">
      <span class="f12 w7">默认回退起跑规则与证据继承</span>
      <span class="f11 t3 grow">每项下拉均展示全部 8 个流程节点（仅作默认预选 · 打回或提交时仍可手动改选任意节点）</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      <div class="col g4"><span class="f11 t3">审核 / 复测打回默认</span><div class="cc-select cc-select-xs"><span class="cc-sel-val">2 · 代码改动与构建</span><span class="cc-sel-caret">{I("chevd",11)}</span></div></div>
      <div class="col g4"><span class="f11 t3">机审 Gate 失败默认</span><div class="cc-select cc-select-xs"><span class="cc-sel-val">2 · 同轮回改码节点</span><span class="cc-sel-caret">{I("chevd",11)}</span></div></div>
      <div class="col g4"><span class="f11 t3">人工接手回交默认</span><div class="cc-select cc-select-xs"><span class="cc-sel-val">4 · 确定性硬门禁</span><span class="cc-sel-caret">{I("chevd",11)}</span></div></div>
      <div class="col g4"><span class="f11 t3">跳过上游证据继承</span><div class="cc-select cc-select-xs is-blue"><span class="cc-sel-val">代码不变则沿用</span><span class="cc-sel-caret">{I("chevd",11)}</span></div></div>
    </div>
  </div>
</div></main>'''

    right = f'''<aside class="glass pn" style="width:316px;flex:none;padding:15px 16px;display:flex;flex-direction:column;gap:9px">
  <div class="row g8"><span class="tag tg-t">节点配置</span><span class="f15 w7 grow">3 · 修后浏览器验证</span></div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>上下文传递模式 &amp; 跳过条件（<span class="mono">run_when</span>）</span></div>
    <div class="cc-seg cc-seg-xs" style="width:100%;display:flex"><span class="on" style="flex:1">共享 KV + Handoff</span><span style="flex:1">独立检查点</span></div>
    <div class="mono f10 t2" style="margin-top:5px;padding:6px 8px;border-radius:8px;background:var(--well);border:1px solid var(--hair)">run_when: repo.verify_strategy == "browser_dist_replace"</div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>本节点挂载专属 Skills（P3 节点优先）</span><span class="lnk f11">+ 选 Skill</span></div>
    <div class="col g6" style="padding:8px 10px;border-radius:11px;background:var(--well);border:1px solid var(--hair)">
      <div class="row g6 f12"><span class="cbx on">{I("check",11,3)}</span><span class="w6 grow ell">页面交互回归 v1</span><span class="tag tg-p" style="height:16px;font-size:9.5px;padding:0 5px">override 替换</span><span class="f11 t3 mono">320t</span></div>
      <div class="row g6 f12"><span class="cbx on">{I("check",11,3)}</span><span class="w6 grow ell">金额精度核验红线</span><span class="tag tg-n" style="height:16px;font-size:9.5px;padding:0 5px">merge 叠加</span><span class="f11 t3 mono">210t</span></div>
      <div class="row g6 f12 t3"><span class="cbx"></span><span class="grow ell">后端 SQL 索引审查</span><span class="f11 mono">未绑</span></div>
    </div>
    <div class="f10 t3" style="line-height:1.45;margin-top:2px">优先级：<b>P5 底座红线 &gt; P4 本轮人工 &gt; P3 本节点 &gt; P2 项目 &gt; P1 部门</b>；切出即卸载正文。</div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>节点指令补充（<span class="mono">node_instructions</span>）</span></div>
    <div style="padding:8px 10px;border-radius:10px;background:var(--well);border:1px solid var(--hair);font-size:11.5px;line-height:1.5;color:var(--text-2)">
      必须验证切换分组后 Console 0 新增报错及导出文件名合法；无浏览器仓自动跳过。
    </div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>允许工具白名单（<span class="mono">allowed_tools</span>）</span></div>
    <div class="row g6" style="flex-wrap:wrap">
      <span class="tag tg-b">browser_login</span><span class="tag tg-b">browser_action</span><span class="tag tg-b">save_evidence</span><span class="tag tg-g">submit_delivery</span>
    </div>
  </div>
  <span class="grow"></span>
  <div class="row g8 f11 t2" style="padding:9px 10px;border-radius:10px;background:color-mix(in srgb,var(--orange) 9%,transparent);border:1px solid color-mix(in srgb,var(--orange) 28%,transparent);line-height:1.5">
    {I("clock",13,style="color:var(--ink-orange);flex:none")}
    <span><b>生效时机：</b>发布后从<b>下一轮（next_round）</b>开始生效；当前运行中轮次仍锁定启动时的模板快照 v3。</span>
  </div>
</aside>'''
    return pc_shell("项目流程画布与节点 Skills · 云匠", "set", set_left("项目") + main + right)


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

    t1 = tile(1, "Hard Gate 连续 2 次失败 · 阻断入审", "转需要协助并保留受控豁免出口", f'''
  <div class="row g8"><span class="tag tg-r">Hard Gate 未通过（3 次尝试均失败）</span><span class="mono f12 t3 grow">TK-20855 · 第 2 轮</span><span class="tag tg-o">禁止入审</span></div>
  <div class="log" style="padding:10px 12px;border-radius:10px;background:var(--terminal-bg);color:#E5E7EB;font-size:11.5px;line-height:1.55">
    <div class="ln"><span class="ts" style="color:#9CA3AF">尝试#3</span><span style="color:#FCA5A5">[FAIL]</span> typecheck src/utils/export.ts:42 · string | undefined mismatch</div>
    <div class="ln"><span class="ts" style="color:#9CA3AF">策略</span><span style="color:#7DD3FC">[GATE]</span> verify_strategy=browser_dist_replace · entry_js_replaced=true</div>
  </div>
  <div class="card" style="padding:9px 12px;gap:6px;background:color-mix(in srgb,var(--orange) 8%,var(--glass-2));border-color:color-mix(in srgb,var(--orange) 30%,transparent)">
    <div class="f12 w7" style="color:var(--ink-orange)">受控审计豁免说明（强制升 L2 · 禁手机速过）</div>
    <div class="f12 t2">如属已有历史类型债可填写理由豁免进入审核：<span class="mono">「仅修复兼容层，历史 DTO 类型另单追踪」</span></div>
  </div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec">查看 Diff 与 3 次报错</button><span class="grow"></span><button class="cc-btn cc-btn-sm cc-btn-glass">填写理由审计豁免</button><button class="cc-btn cc-btn-sm cc-btn-pri">补充提示让 Bot 继续修</button></div>''')

    t2 = tile(2, "我来接手 (human_takeover) · 受门禁交付", "fence_token 防并发覆写 · 提交全节点可选（默认 gate_check）", f'''
  <div class="row g8"><span class="tag tg-b">human_takeover 已接管</span><span class="mono f12 t3 grow">fix/TK-20840 · fence_token #4</span><span class="tag tg-g">Bot 已释放</span></div>
  <div class="card" style="padding:9px 12px;gap:4px">
    <div class="f13 w7">本地继续修改并提交受门禁交付（self_delivery）</div>
    <div class="f12 t2" style="line-height:1.5">① <span class="mono">git fetch && git checkout fix/TK-20840</span>（保留 Bot 半成品 <span class="mono">7c2e1a9</span>）<br>② 本地推送最新提交后选定接入节点——默认预选 <span class="mono">gate_check</span> 与 <span class="mono">L0~L2</span> 评定，下拉含全部流程节点。</div>
  </div>
  <div class="row g8"><span class="f11 w6 t2">提交后接入节点：</span><div class="cc-select cc-select-xs grow"><span class="cc-sel-val">4 · 结构化交付与硬门禁</span><span class="cc-sel-sub">默认 · 下拉含全部节点</span><span class="cc-sel-caret">{I("chevd",12)}</span></div></div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec">放弃接手，退回 AI 重跑</button><span class="grow"></span><button class="cc-btn cc-btn-sm cc-btn-glass">本地 Dist 预览</button><button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.5)}提交人工交付</button></div>''')

    t3 = tile(3, "无代码改动结单 (no_code_fix)", "阻断空分支进入代码审查与发布流", f'''
  <div class="row g8"><span class="tag tg-p">AI 诊断结论 · 无需改代码</span><span class="mono f12 t3 grow">TK-20901 · Zero Diff</span><span class="tag tg-n">发布已阻断</span></div>
  <div class="card" style="padding:10px 12px;gap:6px">
    <div class="f13 w7">根因判定：测试环境第三方回调域名未加入配置白名单</div>
    <div class="f12 t2" style="line-height:1.55">Bot 已复现并保存 2 份请求抓包证据，确认源码逻辑正确。按安全策略：<b>已自动禁用「合入测试/主分支」与「发版」后续节点</b>，避免空包上生产。</div>
  </div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec">提供新线索重查</button><span class="grow"></span><button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.5)}确认无改动关闭（close_reason: no_code_fix）</button></div>''')

    t4 = tile(4, "ask_user 底栏消歧 + 独立凭据框", "AUTH_REQUIRED 明文绝不进 messages", f'''
  <div class="card" style="padding:10px 12px;gap:6px;background:color-mix(in srgb,var(--orange) 9%,var(--glass-2));border-color:color-mix(in srgb,var(--orange) 34%,transparent)">
    <div class="row g8"><span class="tag tg-o">AUTH_REQUIRED · 独立安全录入口</span><span class="f12 w6 grow">管理员测试账号登录态过期</span></div>
    <div class="f11 t2">输入的 Cookie / 口令直通宿主机 <span class="mono">credential_envelopes</span> 公钥加密，<b>绝不写入对话 messages 与大模型上下文</b>。</div>
    <div class="row g8"><div class="cc-input cc-input-sm grow"><span class="mono f11 t3">Cookie：session_id=••••••••••••（独立密文框）</span></div><button class="cc-btn cc-btn-xs cc-btn-pri">更新并恢复</button></div>
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
    css = '''
.eb{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px;width:100%;height:100%}
.et{display:flex;flex-direction:column;gap:8px;min-height:0}
.el{display:flex;align-items:baseline;gap:10px;padding:0 4px}
.el .no{width:22px;height:22px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}
.el b{font-size:15px}.el em{font-style:normal;font-size:12.5px;color:var(--text-3)}
.ep{flex:1;min-height:0;border-radius:22px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
'''
    def tile(no, name, when, body):
        return f'<div class="et"><div class="el"><span class="no">{no}</span><b>{name}</b><em>{when}</em></div><section class="glass ep">{body}</section></div>'

    t1 = tile(1, "已停用插件 · 历史审计记录只读追溯", "停用只拦截写动作，不误杀 reviews/rollbacks 历史快照", f'''
  <div class="card" style="padding:11px 13px;gap:6px;opacity:.85;background:var(--well)">
    <div class="row g8">{I("history",15,style="color:var(--text-3)")}<span class="f13 w7 grow">历史紧急回滚记录 · RB-091（已停用插件）</span><span class="tag tg-o">历史只读</span></div>
    <div class="f12 t2">11-18 19:42 由林某执行回滚至 3.8.1 · 回读检验通过。当前工作空间已停用回滚插件，隐藏写入口但<b>永久保留可查审计快照</b>。</div>
  </div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec is-disabled">{I("lock",12)}再次执行回滚（已停用）</button><span class="grow"></span><span class="lnk f12">管理员去插件市场启用 ›</span></div>''')

    t2 = tile(2, "插件视图 / MCP 5 秒超时 · 零拖垮核心", "独立插座故障隔离，核心修单与内置发布 100% 正常", f'''
  <div class="card" style="padding:18px 16px;align-items:center;text-align:center;gap:8px;flex:1;justify-content:center">
    <span class="ic-box" style="width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,var(--orange) 16%,transparent);color:var(--ink-orange)">{I("alert",20,2.2)}</span>
    <div class="f14 w7">扩展视图「灰度放量看板」响应超时（&gt; 5s）</div>
    <div class="f12 t3">仅影响当前 <span class="mono">ticket.tabs</span> 插座加载，核心对话、Diff 审核与发布主流程不受任何影响。</div>
    <button class="cc-btn cc-btn-sm cc-btn-glass" style="margin-top:4px">{I("refresh",13)}重试加载插座</button>
  </div>''')

    t3 = tile(3, "防菜单膨胀 · Dock > 4 与顶栏 > 2 超限自动折叠", "manifest.contributes.views 硬上限防栏位撑爆", f'''
  <div class="col g10" style="flex:1;justify-content:center">
    <div class="card" style="padding:9px 12px;gap:6px">
      <div class="f11 t3 w7">顶栏右区扩展槽（<span class="mono">topbar.widgets ≤ 2</span>）</div>
      <div class="row g6"><span class="pill glass tpill" style="height:26px;font-size:11px">今日费用 $4.2</span><span class="pill glass tpill" style="height:26px;font-size:11px">灰度 30%</span><span class="pill p-blue" style="height:26px;font-size:11px">更多微件 +2 ▾</span></div>
    </div>
    <div class="card" style="padding:9px 12px;gap:6px">
      <div class="f11 t3 w7">左侧 Dock 扩展槽（<span class="mono">dock.items ≤ 4</span>）</div>
      <div class="row g8"><span class="tag tg-b">AI</span><span class="tag tg-b">工单</span><span class="tag tg-b">发布</span><span class="tag tg-r">回滚</span><span class="tag tg-p">Skills</span><span class="tag tg-o">+2 扩展抽屉 ▾</span><span class="f11 t3">（Token 费用 / 绩效大盘）</span></div>
    </div>
  </div>''')

    t4 = tile(4, "插件 AI A2UI 原语卡 + 站内铃铛通知收件箱", "MCP 自动发现 · 真实参数防 TOCTOU · 通知 5m 防轰炸合并", f'''
  <div class="card" style="padding:9px 12px;gap:6px">
    <div class="row g8"><span class="tag tg-p">kv_card · 扩展插件</span><span class="f12 w7 grow">灰度放量插件 · 审批中心</span><span class="tag tg-b">当前 30%</span><button class="cc-btn cc-btn-xs cc-btn-glass">打开 72% L3 抽屉 ›</button></div>
    <div class="f11 t2">由标准 MCP + <span class="mono">assistant_actions(state_digest)</span> 自动生成确认卡，未触发流内嵌 iframe。</div>
  </div>
  <div class="card" style="padding:9px 12px;gap:5px;background:var(--well)">
    <div class="row g8"><span class="pill glass tpill" style="height:24px;padding:0 8px;font-size:11px">{I("bell",12)} 通知收件箱 (2)</span><span class="tag tg-r">PROD 失败 · 穿透免打扰</span><span class="tag tg-n">他人已抢审 · 只读消退</span></div>
    <div class="f11 t3">顶栏头像旁 34px 铃铛展开 400px 收件箱（不占 Dock/8 项设置），5m 窗口合并防轰炸。</div>
  </div>''')

    return board_page("动态插件运行态与防膨胀边界规范 · 云匠", f'<div class="eb">{t1}{t2}{t3}{t4}</div>', css)


# =====================================================================
# 6. 移动端-运行态与异常补齐（T-15：3 屏，1440×1000）
# =====================================================================
def build_mobile_runtime():
    def phone_wrap(inner, sheet=""):
        return f'<div class="phone"><div class="scr">{status}{inner}{sheet}<div class="home"></div></div></div>'

    def mnav(back, title, right=""):
        return f'<div class="mnav"><span class="bk" style="gap:3px;min-width:64px">{I("chevl",16,2.5)} {back}</span><b>{title}</b><span class="rt" style="min-width:64px">{right}</span></div>'

    # 屏 1：移动端首次操作触发 <PersonalCredentialPrompt>（USER_CREDENTIAL_MISSING）
    bg1 = f'''{mnav("发布","TK-20871 · 第 2 轮")}
<div class="pad" style="opacity:.45">
  <div class="lgt" style="font-size:24px;margin-top:4px">发布到测试环境</div>
  <div class="card2" style="margin-top:10px;padding:12px"><div class="f13 w6">MR !318 已准备</div><div class="f12 t3">点击发测试时校验个人执行凭据…</div></div>
</div>'''
    sh1 = f'''<div class="scrim"></div>
<div class="sheet">
  <div class="grab"></div>
  <div class="row g10">
    <span class="ii" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(160deg,#FFC15A,#F08A00);color:#fff;display:flex;align-items:center;justify-content:center">{I("key",18,2.2)}</span>
    <div class="col grow"><div class="f16 w7">先配你的个人发布账号</div><div class="f11 t3"><span class="mono">USER_CREDENTIAL_MISSING</span> · scope='user'</div></div>
  </div>
  <div class="flb" style="margin-top:12px">账号 / 令牌</div>
  <div class="cc-m-input"><span class="mono grow">lin.x</span></div>
  <div class="flb" style="margin-top:8px">密码 / PAT</div>
  <div class="cc-m-input is-focus"><span class="mono grow">••••••••••••</span></div>
  <div class="f11 t3" style="margin-top:8px;line-height:1.5">加密存进本人「设置 → 我的账号」，仅由本人操作鉴权，管理者不可代填或继承。</div>
  <button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;margin-top:12px;font-size:15px">{I("check",16,2.6)}保存凭据并继续发布到测试</button>
</div>'''
    p1 = phone_wrap(bg1, sh1)

    # 屏 2：移动端独立「无权查看」页（换号或掉权点推送进入）
    p2 = phone_wrap(f'''{mnav("返回","工单详情")}
<div class="pad" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:690px">
  <span class="ii" style="width:60px;height:60px;border-radius:18px;background:linear-gradient(160deg,#FF8A7A,#E0281E);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px -10px rgba(224,40,30,.5)">{I("lock",26,2.2)}</span>
  <div class="f20 w7" style="margin-top:14px">当前账号无权查看这张工单</div>
  <div class="f13 t2" style="margin-top:6px;line-height:1.6">可能已切换账号或项目成员权限被移除。<br>出于安全隔离，不显示工单标题与正文内容。</div>
  <div class="grp glass" style="width:100%;margin-top:16px;padding:10px 14px;text-align:left">
    <div class="f11 t3">当前已登录账号</div>
    <div class="row g10" style="margin-top:4px">{av("林","#FFC9A8,#F08F7A","green",26)}<span class="mono f13 w6 grow">lin@personal.com</span><span class="lnk f12">切换账号</span></div>
  </div>
  <button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;width:100%;margin-top:18px;font-size:15px">回到我的工单</button>
</div>''')

    # 屏 3：移动端 L2 高危锁默认锁定 vs 项目授权后完整浏览滑块模式
    p3 = phone_wrap(f'''{mnav("工单","TK-20871 · 审核")}
<div class="pad">
  <div class="cc-m-l2-lock" style="margin-top:4px;flex-direction:column;align-items:stretch;gap:6px">
    <div class="row g8">{I("shield",16,2.2)}<span class="f14 w7">L2 高危改动 · 默认禁用 10 秒速过</span></div>
    <div class="f12 t2" style="line-height:1.5">命中高危路径规则（<span class="mono">rbac/auth</span> 权限逻辑与 7 个文件）。默认锁定手机快速通过，建议发到 PC 逐行审 Diff。</div>
  </div>
  <div class="card2" style="margin-top:12px;padding:12px 14px">
    <div class="row g8"><span class="f13 w7 grow">项目高级策略 · 移动全量展开模式</span><span class="tag tg-b">可配</span></div>
    <div class="f12 t2" style="margin-top:6px;line-height:1.5">当管理员在项目配置允许时，手动<b>逐文件展开查看全部 7 个文件 Diff</b> 后，滑块确认将解锁。</div>
    <div class="row g6" style="margin-top:8px"><span class="tag tg-g">已展开 7/7 完整 Diff</span><span class="f11 t3 grow">或点下方发到 PC 处理</span></div>
  </div>
  <div class="card2" style="margin-top:10px;padding:10px 14px;background:var(--well)">
    <div class="row g8"><span class="f13 w6">发送当前预览到我的桌面端</span><span class="grow"></span><span class="lnk f13 w6">在 PC 逐行审 ›</span></div>
  </div>
</div>
<div class="dock2 glass">
  <div class="row g12">
    <button class="bigbtn" style="flex:1;height:var(--m-btn-sm-h);background:color-mix(in srgb,var(--red) 12%,transparent);color:var(--ink-red);font-size:14.5px">打回</button>
    <button class="cc-m-btn-locked bigbtn" style="flex:1.6;height:var(--m-btn-sm-h);font-size:13.5px;white-space:nowrap">{I("lock",14)}已锁 · 展全 Diff 解锁</button>
  </div>
</div>''')

    cols = (
        f'<div class="col3">{p1}<div class="lbl">就地补配个人凭据 Sheet<em>ActionGate 返回 USER_CREDENTIAL_MISSING</em></div></div>'
        f'<div class="col3">{p2}<div class="lbl">独立「无权查看」拦截页<em>不泄露任何标题与附件，支持切换账号</em></div></div>'
        f'<div class="col3">{p3}<div class="lbl">L2 高危锁 × 可配全量展Diff<em>默认锁定速过；按项目规则展开全Diff可解锁</em></div></div>'
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
    "pc-edge-extra.html": build_edge_extra(),
    "pc-plugin-runtime.html": build_plugin_runtime(),
    "m-runtime-extra.html": build_mobile_runtime(),
}

for fn, html in FILES.items():
    p = OUT / fn
    p.write_text(html, encoding="utf-8")
    print("→", p)
