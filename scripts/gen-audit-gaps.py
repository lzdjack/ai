#!/usr/bin/env python3
"""全链路终审补齐 7 张高清设计板（T-08b / T-13 / T-14 / T-15 / 操作记录回滚）：
1. reference/src/v5/pc-ws-switch.html        (1440×900)  → PC-顶栏空间切换与邀请抽屉
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
<div class="col g12 grow" style="padding:20px 26px"><div class="card flat" style="padding:14px 16px"><div class="f13 w7">已切换至工作空间：星辰研发中心（团队）</div><div class="f12 t2" style="margin-top:4px">当前工单、连接器、Skills 与个人账号只在你自己的空间里可用。</div></div></div></main>'''

    ws_menu = f'''<div class="cc-menu" style="position:fixed;left:188px;top:58px;width:328px;z-index:var(--z-popover);padding:8px">
  <div class="f11 t3 w7" style="padding:4px 8px 6px">我的工作空间</div>
  <div class="cc-menu-item is-selected" style="padding:8px 10px">
    <span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">星</span>
    <div class="cc-mi-main"><b>星辰研发中心</b><em>团队 · 研发成员（24 人）</em></div>
    <span class="cc-tag cc-tag-g">当前</span>
  </div>
  <div class="cc-menu-item" style="padding:8px 10px;margin-top:3px">
    <span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:linear-gradient(155deg,#A5B4FC,#6366F1)">个</span>
    <div class="cc-mi-main"><b>林某的个人工作台</b><em>个人 · 本机执行器（3 个私有项目）</em></div>
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
      <div class="f12 t3" style="margin-top:2px">把个人工作台升级为多人协同空间，已有数据和进行中的工单都不受影响</div>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:12px">
    <div class="cc-field">
      <div class="cc-field-hd"><span>团队 / 组织显示名称</span><span class="cc-field-hint">仅内部成员可见</span></div>
      <div class="cc-input cc-input-md is-focus"><span class="grow w6">云匠开源协同组</span></div>
    </div>
    <div class="card" style="padding:12px 14px;gap:8px;background:color-mix(in srgb,var(--green) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--green) 24%,transparent)">
      <div class="row g8">{I("shield",15,2.2,"color:var(--ink-green)")}<span class="f13 w7" style="color:var(--ink-green)">这些内容原样保留</span></div>
      <div class="f12 t2" style="line-height:1.65">
        • 已配置 3 个项目仓、工作流模板与 4 条 Skills <b>100% 保留</b>；<br>
        • 已授权连接器沿用原密文，可选择是否共享给新邀请团队成员；<br>
        • <b style="color:var(--ink-red)">你的个人账号和令牌只有你能用</b>，新加入的成员不会继承。
      </div>
    </div>
    <div class="card" style="padding:11px 14px;gap:8px">
      <div class="row g8"><span class="f13 w7 grow">顺便生成第一条成员邀请（不用发邮件）</span><span class="tag tg-b">24 小时有效 · 12 位口令</span></div>
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
  <span class="tag tg-n" style="position:absolute;left:62.2%;top:12px;transform:translateX(-50%);height:19px;font-size:10px;background:var(--glass-elev)">非前端仓库自动跳过第 3 步</span>
  <span class="tag tg-o" style="position:absolute;left:37.6%;top:168px;transform:translateX(-50%);height:20px;font-size:10px;background:var(--glass-elev)">打回默认 → 2（全节点下拉可选）</span>
  <span class="f10 w7 t3" style="position:absolute;left:22px;top:16px">阶段一 · AI 修复</span>
  {rf_node(1,2.2,64,"exec","读单与复现","",["最小改动 v2","权限上下文"])}
  {rf_node(2,26.8,64,"exec","改码与构建","",["禁弱化断言","Token 规范"])}
  {rf_node(3,51.4,64,"exec","修后浏览器验证","按条件",["交互回归 v1","金额核验"],on=True)}
  {rf_node(4,76.0,64,"exec","交付与硬门禁","逐仓库",["交付摘要 v1"])}
  <span class="f10 w7 t3" style="position:absolute;left:22px;top:248px">阶段二 · 交付</span>
  {rf_node(5,2.2,274,"del","代码审查","L0-L2",["高危路径清单"])}
  {rf_node(6,26.8,274,"del","MR 合入与复测","逐仓库",["TEST 发版核验"])}
  {rf_node(7,51.4,274,"del","主干合入与发布","PROD",["不倒退校验"])}
  {rf_node(8,76.0,274,"del","合规会签(可选)","未启用",["会签说明"],chk=False)}
  <div class="row g8" style="position:absolute;left:12px;bottom:10px;padding:4px 10px;border-radius:10px;background:var(--glass-elev);border:1px solid var(--stroke);font-size:10.5px;color:var(--text-2)">
    <span class="w7" style="color:var(--ink-blue)">缩放</span><span>+  −  ⊡</span>
  </div>
  <div class="row g8" style="position:absolute;right:12px;bottom:10px;padding:4px 10px;border-radius:10px;background:var(--glass-elev);border:1px solid var(--stroke);font-size:10px;color:var(--text-3)">
    <span>实线 主流程 · 灰虚线 按条件跳过 · 橙虚线 打回后回到</span>
  </div>
</div>'''

    main = f'''<main class="glass pn grow" style="min-width:0">
<header class="thead">
  <div class="row g10">
    <div class="col grow">
      <div class="row g10"><h1>项目 · OKR</h1><span class="cc-seg cc-seg-xs"><span>开工条件</span><span class="on">流程画布与节点 Skills</span></span></div>
      <div class="f12 t3" style="margin-top:3px">拖动节点调整顺序，每个节点可以单独挂 Skills、限定能用的工具 · 发布新版本后从下一轮修复开始生效</div>
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
      <div class="col g4"><span class="f11 t3">机审门禁失败默认</span><div class="cc-select cc-select-xs"><span class="cc-sel-val">2 · 同轮回改码节点</span><span class="cc-sel-caret">{I("chevd",11)}</span></div></div>
      <div class="col g4"><span class="f11 t3">人工接手回交默认</span><div class="cc-select cc-select-xs"><span class="cc-sel-val">4 · 确定性硬门禁</span><span class="cc-sel-caret">{I("chevd",11)}</span></div></div>
      <div class="col g4"><span class="f11 t3">跳过上游证据继承</span><div class="cc-select cc-select-xs is-blue"><span class="cc-sel-val">代码不变则沿用</span><span class="cc-sel-caret">{I("chevd",11)}</span></div></div>
    </div>
  </div>
</div></main>'''

    right = f'''<aside class="glass pn" style="width:316px;flex:none;padding:15px 16px;display:flex;flex-direction:column;gap:9px">
  <div class="row g8"><span class="tag tg-t">节点配置</span><span class="f15 w7 grow">3 · 修后浏览器验证</span></div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>上下文怎么传 &amp; 什么时候跳过</span></div>
    <div class="cc-seg cc-seg-xs" style="width:100%;display:flex"><span class="on" style="flex:1">接着上一步继续</span><span style="flex:1">每步重新开始</span></div>
    <div class="f11 t2" style="margin-top:5px;padding:6px 8px;border-radius:8px;background:var(--well);border:1px solid var(--hair)">前端仓库执行，其他仓库自动跳过</div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>本节点专用 Skills</span><span class="lnk f11">+ 选 Skill</span></div>
    <div class="col g6" style="padding:8px 10px;border-radius:11px;background:var(--well);border:1px solid var(--hair)">
      <div class="row g6 f12"><span class="cbx on">{I("check",11,3)}</span><span class="w6 grow ell">页面交互回归 v1</span><span class="tag tg-p" style="height:16px;font-size:9.5px;padding:0 5px">替换同名规则</span><span class="f11 t3 mono">320t</span></div>
      <div class="row g6 f12"><span class="cbx on">{I("check",11,3)}</span><span class="w6 grow ell">金额精度核验红线</span><span class="tag tg-n" style="height:16px;font-size:9.5px;padding:0 5px">叠加</span><span class="f11 t3 mono">210t</span></div>
      <div class="row g6 f12 t3"><span class="cbx"></span><span class="grow ell">后端 SQL 索引审查</span><span class="f11 mono">未绑</span></div>
    </div>
    <div class="f10 t3" style="line-height:1.45;margin-top:2px">规则冲突时：<b>安全红线 &gt; 本轮人工要求 &gt; 本节点 &gt; 项目 &gt; 部门</b>；离开这个节点就不再加载。</div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>给这个节点的补充要求</span></div>
    <div style="padding:8px 10px;border-radius:10px;background:var(--well);border:1px solid var(--hair);font-size:11.5px;line-height:1.5;color:var(--text-2)">
      必须验证切换分组后 Console 0 新增报错及导出文件名合法；无浏览器仓自动跳过。
    </div>
  </div>
  <div class="cc-field">
    <div class="cc-field-hd"><span>这个节点能用的工具</span></div>
    <div class="row g6" style="flex-wrap:wrap">
      <span class="tag tg-b">登录被测系统</span><span class="tag tg-b">浏览器操作</span><span class="tag tg-b">保存证据</span><span class="tag tg-g">提交交付</span>
    </div>
  </div>
  <span class="grow"></span>
  <div class="row g8 f11 t2" style="padding:9px 10px;border-radius:10px;background:color-mix(in srgb,var(--orange) 9%,transparent);border:1px solid color-mix(in srgb,var(--orange) 28%,transparent);line-height:1.5">
    {I("clock",13,style="color:var(--ink-orange);flex:none")}
    <span><b>生效时机：</b>发布后从<b>下一轮修复</b>开始生效；当前运行中轮次仍锁定启动时的模板快照 v3。</span>
  </div>
</aside>'''
    return pc_shell("项目流程画布与节点 Skills · 云匠", "set", set_left("项目") + main + right)


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

    drawer = f'''<div class="scrim"></div>
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
        {op_row("1842", "已删除", "tg-r", "连接器 · GitLab 审批仓", "陈某 · PC · 12 分钟前", "在回收站 · 可以完整恢复", "t2", on=True)}
        {op_row("1840", "改版本", "tg-p", "流程模板 · 标准前端 v3 → v4", "林某 · 通过 AI 助手 · 38 分钟前", "可以切回 v3 · 下一轮修复生效")}
        {op_row("1837", "已修改", "tg-b", "环境 · staging 超时 10 → 5 分钟", "林某 · PC · 2 小时前", "可以改回修改前的值")}
        {op_row("1831", "仅记录", "tg-n", "GitLab 换令牌 · MR !318 合入", "林某 · PC · 昨天 19:10", "已在外部生效 · 只能查看，不能撤回")}
        <div class="f11 t3" style="margin-top:auto;padding:4px 2px">只显示你有权限查看的记录</div>
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
        <div class="card" style="padding:10px 12px;gap:6px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--blue) 24%,transparent)">
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
    <span class="f11 t3 grow">恢复本身也会记一条记录 · 已有同名连接器时会先让你改名</span>
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

    t1 = tile(1, "已停用插件 · 历史审计记录只读追溯", "停用后不能再执行，历史记录照常可查", f'''
  <div class="card" style="padding:11px 13px;gap:6px;opacity:.85;background:var(--well)">
    <div class="row g8">{I("history",15,style="color:var(--text-3)")}<span class="f13 w7 grow">历史紧急回滚记录 · RB-091（已停用插件）</span><span class="tag tg-o">历史只读</span></div>
    <div class="f12 t2">11-18 19:42 由林某执行回滚至 3.8.1 · 回读检验通过。当前工作空间已停用回滚插件，隐藏写入口但<b>永久保留可查审计快照</b>。</div>
  </div>
  <div class="row g8" style="margin-top:auto"><button class="cc-btn cc-btn-sm cc-btn-sec is-disabled">{I("lock",12)}再次执行回滚（已停用）</button><span class="grow"></span><span class="lnk f12">管理员去插件市场启用 ›</span></div>''')

    t2 = tile(2, "插件 5 秒没响应 · 不影响核心功能", "插件出错只影响它自己的位置，修单和发布照常可用", f'''
  <div class="card" style="padding:18px 16px;align-items:center;text-align:center;gap:8px;flex:1;justify-content:center">
    <span class="ic-box" style="width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,var(--orange) 16%,transparent);color:var(--ink-orange)">{I("alert",20,2.2)}</span>
    <div class="f14 w7">扩展视图「灰度放量看板」响应超时（&gt; 5s）</div>
    <div class="f12 t3">只影响这个标签页，对话、代码审核和发布都不受影响。</div>
    <button class="cc-btn cc-btn-sm cc-btn-glass" style="margin-top:4px">{I("refresh",13)}重新加载</button>
  </div>''')

    t3 = tile(3, "防菜单膨胀 · Dock > 4 与顶栏 > 2 超限自动折叠", "插件放进来的入口有数量上限，超出自动收起", f'''
  <div class="col g10" style="flex:1;justify-content:center">
    <div class="card" style="padding:9px 12px;gap:6px">
      <div class="f11 t3 w7">顶栏右侧插件位（最多 2 个）</div>
      <div class="row g6"><span class="pill glass tpill" style="height:26px;font-size:11px">今日费用 $4.2</span><span class="pill glass tpill" style="height:26px;font-size:11px">灰度 30%</span><span class="pill p-blue" style="height:26px;font-size:11px">更多微件 +2 ▾</span></div>
    </div>
    <div class="card" style="padding:9px 12px;gap:6px">
      <div class="f11 t3 w7">左侧 Dock 插件位（最多 4 个）</div>
      <div class="row g8"><span class="tag tg-b">AI</span><span class="tag tg-b">工单</span><span class="tag tg-b">发布</span><span class="tag tg-r">回滚</span><span class="tag tg-p">Skills</span><span class="tag tg-o">+2 扩展抽屉 ▾</span><span class="f11 t3">（Token 费用 / 绩效大盘）</span></div>
    </div>
  </div>''')

    t4 = tile(4, "插件确认卡 + 站内通知收件箱", "确认时按最新数据再校验 · 同类通知 5 分钟合并", f'''
  <div class="card" style="padding:9px 12px;gap:6px">
    <div class="row g8"><span class="tag tg-p">扩展插件</span><span class="f12 w7 grow">灰度放量插件 · 审批中心</span><span class="tag tg-b">当前 30%</span><button class="cc-btn cc-btn-xs cc-btn-glass">打开详情 ›</button></div>
    <div class="f11 t2">插件提供的操作会自动生成确认卡；点确认时按最新数据再校验一次，数据变了会提示。</div>
  </div>
  <div class="card" style="padding:9px 12px;gap:5px;background:var(--well)">
    <div class="row g8"><span class="pill glass tpill" style="height:24px;padding:0 8px;font-size:11px">{I("bell",12)} 通知收件箱 (2)</span><span class="tag tg-r">正式发布失败 · 免打扰也提醒</span><span class="tag tg-n">已由他人审核 · 自动消失</span></div>
    <div class="f11 t3">点顶栏头像旁的铃铛打开收件箱，不占 Dock 和设置菜单；5 分钟内的同类通知合并成一条。</div>
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
    <div class="col grow"><div class="f16 w7">先配你的个人发布账号</div><div class="f11 t3">发布要用你自己的账号，只需填一次，只有你能用</div></div>
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
        f'<div class="col3">{p1}<div class="lbl">就地补填个人账号<em>用到个人账号但还没填时弹出</em></div></div>'
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
    "pc-operation-log.html": build_operation_log(),
    "pc-edge-extra.html": build_edge_extra(),
    "pc-plugin-runtime.html": build_plugin_runtime(),
    "m-runtime-extra.html": build_mobile_runtime(),
}

for fn, html in FILES.items():
    p = OUT / fn
    p.write_text(html, encoding="utf-8")
    print("→", p)
