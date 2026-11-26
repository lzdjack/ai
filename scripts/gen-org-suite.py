#!/usr/bin/env python3
"""生成组织架构与权限体系配套 UI 设计图（亮色 + 暗色）：
1. reference/src/v5/pc-org-defaults.html     (1440×900)  → PC-组织-部门默认设置
2. reference/src/v5/pc-member-edit.html      (1440×900)  → PC-组织-添加编辑成员
3. reference/src/v5/pc-member-handoff.html   (1440×900)  → PC-组织-停用交接
4. reference/src/v5/pc-roles.html            (1440×900)  → PC-设置-角色与权限（M1 桌面端内置 + 克隆角色矩阵）
5. reference/src/v5/join-existing-pc.html    (1440×900)  → PC-已注册成员确认加入
6. reference/src/v5/m-org-members.html       (1440×1000) → 移动端-组织与成员
7. reference/src/v5/web-admin-blueprint.html (1440×900)  → PC-企业管理后台-蓝图（M2/M3 Web /admin 组织树）
8. reference/src/v5/web-admin-roles.html     (1440×900)  → PC-企业管理后台-角色策略（M2/M3 Allow/Deny 规则）

用法：python3 scripts/gen-org-suite.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status  # noqa: E402
from shell_pc import I, page  # noqa: E402
from pages_pc import p_members, set_left, aside  # noqa: E402


# ---------- 共用包装 ----------
def overlay_pc(title, drawer_html):
    base = page(title, "set", p_members())
    return base.replace('<script src="icons.js">', f'<div class="cc-scrim"></div>{drawer_html}<script src="icons.js">', 1)


def ck_box(on=True, bg="var(--btn-pri-bg)"):
    if on:
        return (f'<span style="width:18px;height:18px;border-radius:6px;background:{bg};color:#fff;'
                f'display:inline-flex;align-items:center;justify-content:center;flex:none">{I("check",12,2.6)}</span>')
    return '<span style="width:18px;height:18px;border-radius:6px;border:1.5px solid var(--border-ctl-hover);background:var(--glass-2);flex:none"></span>'


# =====================================================================
# 1. PC-组织-部门默认设置（.cc-drawer 660px）
# =====================================================================
def build_org_defaults():
    def proj_row(name, perm, tone, note):
        return f'''<div class="row g10" style="padding:8px 10px;border-radius:10px;background:var(--fill)">
  <span class="ic-box" style="width:24px;height:24px;border-radius:7px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("layers",12)}</span>
  <span class="f13 w6" style="width:62px;flex:none">{name}</span>
  <span class="f11 t3 grow ell">{note}</span>
  <span class="cc-select cc-select-sm {tone}" style="width:130px;flex:none">
    <span class="cc-sel-val">{perm}</span><span class="cc-sel-sp"></span><span class="cc-sel-caret">{I("chevd",12)}</span>
  </span>
</div>'''

    drawer = f'''<aside class="cc-drawer" data-pin="drawer-defaults">
  <div class="cc-drawer-hd">
    <span class="ic-box" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("layers",18,2.2)}</span>
    <div class="col grow">
      <div class="f17 w7">OKR 产研 · 部门默认配置</div>
      <div class="f12 t3" style="margin-top:2px">新入驻成员自动继承 · 部门只增补或收紧，绝不继承个人高危凭据</div>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="cc-drawer-bd">
    <div class="col g6">
      <div class="row"><span class="f12 w7 t2">1. 默认授权项目与操作权限</span><span class="tag tg-b" style="height:18px;font-size:10.5px;margin-left:auto">并集继承 ADDITIVE_UNION</span></div>
      <div class="col g6">
        {proj_row("OKR", "可修改代码", "is-green", "本部门主责项目 · 默认写入 Ticket & 代码")}
        {proj_row("审批", "仅查看", "is-blue", "跨组联调对照 · 禁止修改审批仓代码")}
        {proj_row("考勤", "禁止访问", "", "非关联部门默认不可见工单与仓库")}
      </div>
    </div>

    <div class="col g6">
      <div class="row"><span class="f12 w7 t2">2. 已接入的共享连接器与测试账号</span><span class="f11 t3" style="margin-left:auto">按 <span class="mono">scope='workspace'</span> 实例动态列表</span></div>
      <div class="card" style="padding:8px 12px;gap:6px">
        <div class="row g8">{ck_box()}<span class="f12 w6 grow">代码源连接器（只读拉取与隔离试构建）</span><span class="tag tg-g" style="height:18px;font-size:10px">已继承</span></div>
        <div class="row g8" style="padding-top:6px;border-top:1px solid var(--hair)">{ck_box()}<span class="f12 w6 grow">外部工单采集（按所选项目动态收单）</span><span class="tag tg-g" style="height:18px;font-size:10px">已继承</span></div>
        <div class="row g8" style="padding-top:6px;border-top:1px solid var(--hair)">{ck_box()}<span class="f12 w6 grow">OKR 测试环境（<span class="mono">普通员工 / 观察员</span> 2 个共享账号）</span><span class="tag tg-b" style="height:18px;font-size:10px">密文托管</span></div>
      </div>
    </div>

    <div class="col g6">
      <div class="row"><span class="f12 w7 t2">3. 部门默认 Skills 规范</span><span class="f11 t3" style="margin-left:auto">随入驻自动挂载（3 项）</span></div>
      <div class="row g6" style="flex-wrap:wrap">
        <span class="tag tg-p" style="height:24px;padding:0 10px">页面交互回归 v1 · 常驻</span>
        <span class="tag tg-b" style="height:24px;padding:0 10px">OKR 权限边界校验 · 按需</span>
        <span class="tag tg-n" style="height:24px;padding:0 10px">React 表单防抖 v2 · 按需</span>
        <span class="lnk f12 w6" style="margin-left:4px">+ 挂载 Skill</span>
      </div>
    </div>

    <div class="col g6" style="padding:10px 12px;border-radius:14px;background:color-mix(in srgb,var(--red) 6%,var(--glass-2));border:1px solid color-mix(in srgb,var(--red) 28%,transparent)">
      <div class="row g6">
        {I("shield",14,2.2,"color:var(--ink-red)")}
        <span class="f12 w7" style="color:var(--ink-red)">双平面与安全锁定红线（Monotonic Tighten · 数据库硬约束）</span>
      </div>
      <div class="f11 t2" style="line-height:1.5">
        <b style="color:var(--text)">Plane B 个人执行凭据禁止继承</b>：凡声明 <span class="mono">credential_class='personal_exec'</span>（如个人代码写令牌、发布回滚凭据），均由 DB CHECK 锁定 <span class="mono">scope='user'</span>，部门与管理员严禁代填或代审。
      </div>
      <div class="row g10" style="padding-top:4px;border-top:1px solid var(--hair)">
        <span class="f12 grow">禁止外包 Guest 访问部门共享测试账号</span>
        <span class="cc-switch on is-disabled"></span>
      </div>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <span class="f11 t3 grow">保存后自动记录 <span class="mono">security_audit</span> 事件，下一轮修单实时重算生效</span>
    <button class="cc-btn cc-btn-sm cc-btn-glass">取消</button>
    <button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.6)}保存部门默认配置</button>
  </div>
</aside>'''
    return overlay_pc("部门默认配置 · 组织与成员", drawer)


# =====================================================================
# 2. PC-组织-添加编辑成员（.cc-drawer 660px）
# =====================================================================
def build_member_edit():
    drawer = f'''<aside class="cc-drawer" data-pin="drawer-member-edit">
  <div class="cc-drawer-hd">
    <span class="av" style="width:36px;height:36px;font-size:13px;background:linear-gradient(150deg,#A5B4FC,#6366F1)">宋工</span>
    <div class="col grow">
      <div class="f17 w7">编辑成员 · 宋工</div>
      <div class="f12 t3" style="margin-top:2px">独立邮箱账号 <span class="mono">song@vendor.io</span> · 支持虚线借调、外包 Fail-Closed 隔离</div>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:10px">
    <div style="display:grid;grid-template-columns:1fr 1.35fr;gap:10px">
      <div class="cc-field">
        <div class="cc-field-hd">成员类型（Membership Class）</div>
        <div class="cc-seg cc-seg-sm">
          <span>正式 Member</span>
          <span class="on" style="color:var(--ink-orange)">外包 Guest</span>
        </div>
      </div>
      <div class="cc-field">
        <div class="cc-field-hd">主部门（费用/Token 快照归属）</div>
        <div class="cc-select cc-select-sm">
          <span class="cc-sel-val">OKR 产研</span>
          <span class="cc-sel-sub">云匠研发中心</span>
          <span class="cc-sel-caret">{I("chevd",12)}</span>
        </div>
      </div>
    </div>

    <div class="row g8" style="padding:8px 11px;border-radius:11px;background:color-mix(in srgb,var(--orange) 9%,var(--glass-2));border:1px solid color-mix(in srgb,var(--orange) 35%,transparent)">
      {I("shield",15,2.1,"color:var(--ink-orange);flex:none")}
      <div class="f11 t2" style="line-height:1.5">
        <b style="color:var(--ink-orange)">Guest Fail-Closed 门禁生效：</b>外包访客自动屏蔽全空间成员名单、完整组织树、共享参考仓库与跨项目 AI 检索，<b>仅可见下方明确授予的单个项目/工单</b>。
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.2fr .9fr;gap:10px">
      <div class="cc-field">
        <div class="cc-field-hd">虚线借调部门（可选）</div>
        <div class="cc-input cc-input-sm">
          <span class="tag tg-b" style="height:20px;font-size:10.5px">审批产研 ×</span>
          <span class="f12 t3">+ 添加借调部门</span>
        </div>
      </div>
      <div class="cc-field">
        <div class="cc-field-hd">借调 / 账号到期日</div>
        <div class="cc-input cc-input-sm">
          {I("clock",13,style="color:var(--text-3)")}
          <span class="mono f12 grow">2026-12-31</span>
          <span class="f11 t3">到期自动收权</span>
        </div>
      </div>
    </div>

    <div class="cc-field">
      <div class="cc-field-hd">角色与 Deny-Overrides 权限绑定（<span class="mono">role_bindings</span>）</div>
      <div class="card" style="padding:8px 10px;gap:6px">
        <div class="row g8">
          <span class="tag tg-g" style="height:20px;font-size:10.5px">Allow</span>
          <span class="f12 w6 grow">项目级角色：OKR · 研发成员（仅修本单 & 提交审查）</span>
          <span class="f11 t3">作用域：OKR</span>
        </div>
        <div class="row g8" style="padding-top:6px;border-top:1px solid var(--hair)">
          <span class="tag tg-r" style="height:20px;font-size:10.5px">Deny</span>
          <span class="f12 w6 grow">明确拒绝：考勤跨部门仓库 · 管理全局 AI · 扩展插件写操作（<span class="mono">ext:*</span>）</span>
          <span class="lnk f11">改策略</span>
        </div>
      </div>
    </div>

    <div class="cc-field">
      <div class="cc-field-hd"><span>外部工具身份（<span class="mono">identities</span> · 按已启用工单连接器动态生成）</span><span class="cc-field-hint">0 连接器时不展示</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="cc-input cc-input-sm"><span class="sc10 sc-j">工单源 1</span><span class="mono f12 grow">song_ext</span><span class="f11" style="color:var(--ink-green)">已关联</span></div>
        <div class="cc-input cc-input-sm"><span class="sc10 sc-t">工单源 2</span><span class="f12 grow" style="color:var(--ink-orange)">未关联</span><span class="lnk f11">去匹配</span></div>
      </div>
    </div>

    <div class="row g10" style="padding:8px 11px;border-radius:11px;background:var(--well);border:1px solid var(--hair)">
      <div class="col grow">
        <span class="f12 w6">私有部署免 SMTP · 一次性重置密码链接</span>
        <span class="f11 t3">仅 <span class="mono">self_hosted</span> 无邮件服务时可见；SaaS 模式严禁管理员代改密</span>
      </div>
      <button class="cc-btn cc-btn-xs cc-btn-glass">{I("key",12)}生成 30m 重置链</button>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <button class="cc-btn cc-btn-sm cc-btn-red" style="margin-right:auto">停用并交接</button>
    <button class="cc-btn cc-btn-sm cc-btn-glass">取消</button>
    <button class="cc-btn cc-btn-sm cc-btn-pri">{I("check",13,2.6)}保存成员配置</button>
  </div>
</aside>'''
    return overlay_pc("添加/编辑成员 · 组织与成员", drawer)


# =====================================================================
# 3. PC-组织-停用交接（.cc-drawer 600px）
# =====================================================================
def build_member_handoff():
    def chk_row(title, sub):
        return f'''<div class="row g10" style="padding:8px 10px;border-radius:10px;background:var(--well)">
  {ck_box(True, "var(--btn-pri-bg)")}
  <div class="col grow"><span class="f12 w6">{title}</span><span class="f11 t3">{sub}</span></div>
</div>'''

    drawer = f'''<aside class="cc-drawer" style="width:580px" data-pin="drawer-handoff">
  <div class="cc-drawer-hd">
    <span class="av" style="width:36px;height:36px;font-size:13px;background:linear-gradient(150deg,#C8CCD4,#8A909B)">赵磊</span>
    <div class="col grow">
      <div class="f17 w7">停用成员与待办交接 · 赵磊</div>
      <div class="f12 t3" style="margin-top:2px"><span class="mono">zhao@company.com</span> · OKR 产研 · 停用同事务清退全部活跃会话</div>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>
  <div class="cc-drawer-bd">
    <div class="col g8" style="padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--orange) 10%,var(--glass-2));border:1px solid color-mix(in srgb,var(--orange) 36%,transparent)">
      <div class="row g8">
        <span class="ck" style="background:#B45309;width:18px;height:18px;font-size:11px;font-weight:800">!</span>
        <span class="f13 w7">检测到 3 项未完结在途资产，必须先指定接替人</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:2px">
        <div class="card" style="padding:8px 10px"><div class="f11 t3">待审核代码</div><div class="f15 w7" style="color:var(--ink-orange);margin-top:2px">1 张</div><div class="f11 t3">TK-20852 · 第 2 轮</div></div>
        <div class="card" style="padding:8px 10px"><div class="f11 t3">待原平台确认</div><div class="f15 w7" style="margin-top:2px">1 条</div><div class="f11 t3">Tita #4419</div></div>
        <div class="card" style="padding:8px 10px"><div class="f11 t3">本机 Runner</div><div class="f15 w7" style="color:var(--ink-red);margin-top:2px">1 台在线</div><div class="f11 t3">macbook-zhao</div></div>
      </div>
    </div>

    <div class="cc-field">
      <div class="cc-field-hd"><span>接替负责人</span><span class="cc-field-req">*</span><span class="cc-field-hint">优先推荐同部门 OKR 负责人</span></div>
      <div class="cc-select">
        <span class="av" style="width:22px;height:22px;font-size:10px;background:linear-gradient(150deg,#8FD8C9,#3FAE9A)">张某</span>
        <span class="cc-sel-val">张某</span>
        <span class="cc-sel-sub">负责人 · OKR 产研 · 当前负载 2 张单</span>
        <span class="cc-sel-caret">{I("chevd",13)}</span>
      </div>
    </div>

    <div class="col g8">
      <div class="f12 w7 t2">同一数据库事务自动执行以下动作（失败整体回滚）</div>
      {chk_row("将 1 张待审单与 1 条原平台待办移交至 张某", "ticket_assignees 写入 source='manual'，后续 Webhook 同步绝不覆写")}
      {chk_row("立即吊销赵磊全部 Refresh Token、个人 Runner 与 WebSocket 实时长连", "断开 macbook-zhao 连接并清理 personal 执行槽")}
      {chk_row("永久保留赵磊的历史审核意见、发布签署及不可篡改审计署名", "仅停用 workspace_members 与权限绑定，绝不删改历史 events / reviews")}
    </div>
  </div>
  <div class="cc-drawer-ft">
    <span class="f11 t3 grow">操作不可撤销，若日后复职可由管理员重新启用</span>
    <button class="cc-btn cc-btn-sm cc-btn-glass">取消</button>
    <button class="cc-btn cc-btn-sm cc-btn-red">{I("shield",13,2.2)}确认停用并移交给 张某</button>
  </div>
</aside>'''
    return overlay_pc("停用交接 · 组织与成员", drawer)


# =====================================================================
# 4. PC-设置-角色与权限（Core 固定权限 + 已启用连接器/插件动态注册权限）
# =====================================================================
def build_pc_roles():
    def ritem(name, cnt, sub=None, on=False, tag=None):
        tg = f'<span class="tag {tag[1]}" style="height:17px;font-size:9.5px;margin-left:auto">{tag[0]}</span>' if tag else f'<span class="ot-cnt">{cnt}</span>'
        sub_h = f'<div class="f10 t3" style="margin-top:1px;padding-left:19px">{sub}</div>' if sub else ""
        return f'''<div class="col" style="gap:1px">
  <div class="ot-item{" on" if on else ""}" style="height:30px">{I("shield" if not sub else "layers",12)}<span class="ell">{name}</span>{tg}</div>{sub_h}
</div>'''

    def perm_row(label, desc, state):
        if state == "on":
            ctl = '<span class="cc-switch on"></span>'
        elif state == "off":
            ctl = '<span class="cc-switch"></span>'
        elif state == "disabled_off":
            ctl = '<span class="cc-switch is-disabled"></span>'
        elif state == "locked_off":
            ctl = '<span class="tag tg-r" style="height:20px;font-size:10px;white-space:nowrap">' + I("lock", 10) + ' 安全锁</span>'
        else:
            ctl = '<span class="cc-switch on is-disabled"></span>'
        return f'''<div class="row g8" style="padding:6px 0;border-top:1px solid var(--hair);min-width:0">
  <div class="col grow" style="min-width:0"><span class="f12 w6 ell">{label}</span><span class="f11 t3 ell">{desc}</span></div>
  {ctl}
</div>'''

    def mcard(name, grad, dept, scope):
        return f'''<div class="row g8" style="padding:6px 10px;border-radius:10px;background:var(--well);border:1px solid var(--hair)">
  <span class="av" style="width:22px;height:22px;font-size:9.5px;background:linear-gradient(150deg,{grad})">{name}</span>
  <span class="f12 w6">{name}</span>
  <span class="f11 t3 grow ell">{dept} · {scope}</span>
  <span class="f11 lnk">移出</span>
</div>'''

    css = '''<style>
.role-wrap{display:flex;flex:1;min-height:0}
.role-side{width:214px;flex:none;border-right:1px solid var(--hair);padding:12px 9px;display:flex;flex-direction:column;gap:4px;background:color-mix(in srgb,var(--text) 1.8%,transparent)}
.ot-h{display:flex;align-items:center;padding:4px 6px;font-size:11px;font-weight:700;color:var(--text-3)}
.ot-item{display:flex;align-items:center;gap:6px;padding:0 8px;border-radius:9px;font-size:12px;color:var(--text-2);white-space:nowrap}
.ot-item.on{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue);font-weight:700}
.ot-cnt{margin-left:auto;font-size:11px;color:var(--text-3);font-weight:600}
.ot-item.on .ot-cnt{color:var(--ink-blue)}
.role-main{flex:1;min-width:0;padding:11px 16px;display:flex;flex-direction:column;gap:8px;overflow:hidden}
.grp-lbl{font-size:11px;font-weight:700;color:var(--text-3);display:flex;align-items:center;gap:6px;margin-top:2px}
.pgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.pcard{min-width:0;border-radius:14px;padding:9px 12px 4px;background:var(--glass-2);border:1px solid var(--stroke);overflow:hidden}
.pcard.dim{opacity:.68;background:var(--well)}
.pcard .ph0{font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;display:flex;align-items:center;gap:6px}
.admin-portal{padding:9px 10px;border-radius:12px;background:var(--well);border:1px solid var(--hair);display:flex;flex-direction:column;gap:3px}
</style>'''

    main = f'''{css}<main class="glass pn grow" style="min-width:0">
<header class="thead"><div class="row g10"><div class="col grow"><div class="row g10"><h1>成员与身份</h1><span class="cc-seg cc-seg-xs" data-pin="mem-role-seg"><span>成员与部门</span><span class="on">角色与权限 7</span></span></div><div class="f12 t3" style="margin-top:3px">Core 内置权限永远存在 · 连接器与市场插件通过 <span class="mono">manifest.permissions</span> 动态注册（未安装不显示）</div></div>
  <button class="cc-btn cc-btn-sm cc-btn-pri" data-pin="clone-role-btn">{I("plus",14,2.4)}从模板克隆角色</button></div></header>
<div class="role-wrap">
  <div class="role-side">
    <div class="ot-h"><span class="grow">内置角色（5 · 安全锁定）</span></div>
    {ritem("空间所有者", "1")}
    {ritem("空间管理员", "2", tag=("禁代审", "tg-r"))}
    {ritem("项目负责人", "3")}
    {ritem("研发成员", "12")}
    {ritem("外包访客 Guest", "2", tag=("隔离", "tg-o"))}
    <div class="ot-h" style="margin-top:6px"><span class="grow">轻量自定义（2 · 模板克隆）</span></div>
    {ritem("代码合入协同专员", "2", sub="克隆自 研发成员 · 仅补合入权限", on=True)}
    {ritem("QA 验收员", "2", sub="克隆自 研发成员 · 仅复测与退回")}
    <span class="grow"></span>
    <div class="admin-portal" data-pin="admin-roles-portal">
      <div class="row g6"><span class="f12 w7" style="color:var(--ink-blue)">高级策略 (Allow/Deny)</span><span class="grow"></span>{I("ext",12,style="color:var(--ink-blue)")}</div>
      <div class="t3" style="font-size:10.5px;line-height:1.4">M2 Web <span class="mono">/admin/role-policies</span></div>
    </div>
  </div>
  <div class="role-main">
    <div class="row g10" style="padding:9px 13px;border-radius:14px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border:1px solid color-mix(in srgb,var(--blue) 22%,transparent)">
      <span class="ic-box" style="width:28px;height:28px;border-radius:8px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("layers",14)}</span>
      <div class="col grow" style="min-width:0">
        <div class="row g8" style="flex-wrap:wrap;row-gap:4px"><span class="f13 w7" style="white-space:nowrap">代码合入协同专员</span><span class="tag tg-p" style="height:18px;font-size:10px">模板克隆 · base: member</span><span class="tag tg-g" style="height:18px;font-size:10px">新装插件默认 Fail-Closed</span></div>
        <div class="f11 t3" style="margin-top:2px">仅存显式白名单；安全红线（禁代审、个人写凭据隔离、Guest 门禁）永不可解锁</div>
      </div>
      <button class="cc-btn cc-btn-xs cc-btn-glass">重命名</button>
      <button class="cc-btn cc-btn-xs cc-btn-pri">{I("check",12,2.5)}保存权限</button>
    </div>

    <div class="grp-lbl"><span>一、Core 不可卸载基础权限（8 核心域 · 永远存在）</span></div>
    <div class="pgrid">
      <div class="pcard">
        <div class="ph0">{I("code",13,style="color:var(--ink-blue)")}<span>工单、代码与审核红线</span></div>
        {perm_row("查看项目与 Bug 单 (ticket:read)", "按所属部门与项目可见范围隔离", "on")}
        {perm_row("响应 Bot 提问 / 提交补充", "在授权项目中触发修改与重跑", "on")}
        {perm_row("代审他人代码 (review_code)", "始终锁死仅 ticket_assignees", "locked_off")}
      </div>
      <div class="pcard">
        <div class="ph0">{I("shield",13,style="color:var(--ink-red)")}<span>组织、全局 AI 与凭据安全锁</span></div>
        {perm_row("查看部门树与同事目录", "Fail-Closed：Guest 克隆模板永锁关闭", "on")}
        {perm_row("管理全局 AI / 部门架构 / 成员", "仅限空间管理员管理", "off")}
        {perm_row("共享/代用他人个人写凭据", "personal_exec · DB 强锁 scope='user'", "locked_off")}
      </div>
    </div>

    <div class="grp-lbl"><span>二、已安装连接器 / 市场插件动态贡献（<span class="mono">manifest.permissions</span> · 未装不显示，停用冻结）</span></div>
    <div class="pgrid">
      <div class="pcard">
        <div class="ph0">{I("branch",13,style="color:var(--ink-green)")}<span class="grow ell">代码源连接器 · GitLab</span><span class="tag tg-g" style="height:17px;font-size:9.5px">已启用</span></div>
        {perm_row("合入测试 / 主分支 MR (merge_mr)", "需操作人本人 scope='user' 写凭据双过", "on")}
        {perm_row("读取 MR 流水线状态", "只读同步检查结果", "on")}
      </div>
      <div class="pcard dim">
        <div class="ph0">{I("history",13,style="color:var(--text-3)")}<span class="grow ell">市场插件 · 紧急回滚</span><span class="tag tg-o" style="height:17px;font-size:9.5px">已停用 · 保留快照</span></div>
        {perm_row("执行高危回滚 (rollback:exec)", "插件已停用 · 第 0 层 403 拦截", "disabled_off")}
        <div class="row f11" style="padding:4px 0 6px;border-top:1px solid var(--hair)"><span class="t3 grow">去插件市场启用后恢复可配</span><span class="lnk w6">去启用 ›</span></div>
      </div>
    </div>

    <div class="card" style="padding:8px 12px;flex:1;min-height:0;gap:6px">
      <div class="row g8">
        <span class="sec grow">已绑定「代码合入协同专员」的成员（2）</span>
        <button class="cc-btn cc-btn-xs cc-btn-glass" data-pin="bind-member-btn">{I("plus",12,2.4)}按角色批量添加成员</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        {mcard("张某","#8FD8C9,#3FAE9A","OKR 产研","作用域：OKR 项目")}
        {mcard("王某","#7FB2FF,#4C7DF0","审批产研","作用域：审批 + OKR 项目")}
      </div>
    </div>
  </div>
</div>
</main>'''

    right = aside(
        '''<div class="card" style="padding:12px 14px"><div class="row"><div class="mini grow" style="margin:0">动态插件权限契约</div><span class="tag tg-b">防硬编码</span></div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">插件通过 <span class="mono">manifest.permissions</span> 声明 <span class="mono">ext:&lt;id&gt;:*</span> 键（禁止 <span class="mono">core:*</span>）。<b>未安装不渲染</b>；已停用置灰冻结不丢快照；新装插件对现有克隆角色默认 Fail-Closed。</div></div>''',
        '''<div class="card" style="padding:12px 14px"><div class="mini">五重 AND 消除假绿灯</div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">
    <b style="color:var(--text)">0. 插件状态</b>：已装且当前项目启用<br>
    <b style="color:var(--ink-red)">1. Core 安全锁</b>：代审 / scope='user'<br>
    <b style="color:var(--text)">2. Guest 拦截</b>：仅白名单项目/单<br>
    <b style="color:var(--text)">3. RBAC 绑定</b> + <b style="color:var(--text)">4. 本人个人凭据</b></div></div>''',
        '''<div class="card" style="padding:12px 14px"><div class="mini">为什么用「模板克隆」</div>
  <div class="f12 t2" style="margin-top:6px;line-height:1.6">M1 按内置模板深拷贝白名单，既能按需放开业务协作权，又确保核心安全锁与新装高危插件不静默放权。</div></div>''',
        w=246,
    )
    return page("角色与权限 · 成员与身份", "set", set_left("成员与身份") + main + right)


# =====================================================================
# 6 & 7. PC-企业管理后台（M2/M3 Web /admin 共用浏览器壳）
# =====================================================================
def web_admin_wrap(title, url_path, active_nav, body_html):
    css = '''
.root{background:var(--wall);padding:18px;display:flex;flex-direction:column;gap:12px}
.bwin{flex:1;min-height:0;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--stroke)}
.bbar{height:48px;padding:0 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--hair);background:color-mix(in srgb,var(--glass-2) 78%,transparent)}
.dots{display:flex;gap:7px}.dots i{width:11px;height:11px;border-radius:50%;display:block}
.urlbox{height:30px;padding:0 12px;border-radius:9px;background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;gap:8px;min-width:340px;font-size:12px;color:var(--text-2)}
.wbody{flex:1;min-height:0;display:flex}
.wside{width:254px;flex:none;border-right:1px solid var(--hair);padding:16px 12px;display:flex;flex-direction:column;gap:4px;background:color-mix(in srgb,var(--text) 2%,transparent)}
.wnav{height:38px;padding:0 10px;border-radius:10px;display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text-2);font-weight:500}
.wnav.on{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue);font-weight:700}
.wmain{flex:1;min-width:0;padding:18px 22px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
.wgrid{flex:1;min-height:0;display:grid;grid-template-columns:1.02fr 1.18fr;gap:14px}
.wcard{border-radius:16px;padding:14px 16px;background:var(--glass-2);border:1px solid var(--stroke);display:flex;flex-direction:column;gap:10px;min-height:0}
.tnode{display:flex;align-items:center;gap:7px;height:30px;padding:0 9px;border-radius:8px;font-size:12.5px}
.tnode.on{background:color-mix(in srgb,var(--blue) 13%,transparent);color:var(--ink-blue);font-weight:700}
'''
    nav_items = [
        ("users", "多级组织架构树与同步", "48", "org"),
        ("shield", "企业域名验证与 SSO", "2", "sso"),
        ("lock", "角色策略（Allow / Deny）", "7", "roles"),
        ("layers", "级联配置与安全锁定", "scoped", "scoped"),
        ("zap", "配额账单与安全审计", "export", "audit"),
    ]
    side_html = "".join(
        f'<div class="wnav{" on" if key == active_nav else ""}">{I(ic,15)}<span class="grow ell">{t}</span>'
        f'<span class="f11 t3 mono">{cnt}</span></div>' for ic, t, cnt, key in nav_items
    )
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{css}</style></head><body><div class="root">
  <div class="bwin glass">
    <div class="bbar">
      <div class="dots"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i></div>
      <div class="urlbox"><span class="dot" style="width:7px;height:7px;background:var(--green)"></span><span class="mono">https://craft.company.com{url_path}</span><span class="tag tg-g" style="height:18px;font-size:10px;margin-left:auto">同源 Cookie + CSRF</span></div>
      <span class="pill" style="height:26px;padding:0 12px;border-radius:13px;background:color-mix(in srgb,var(--purple) 14%,transparent);color:var(--ink-purple);font-size:11.5px;font-weight:700">{I("layers",12)}M2/M3 企业管理后台（Web /admin · 二期架构蓝图，不混入 M1 桌面设置主栏）</span>
      <span class="grow"></span>
      <span class="f12 lnk w6" style="white-space:nowrap">返回桌面工作台 ↗</span>
    </div>
    <div class="wbody">
      <aside class="wside">
        <div class="row g10" style="padding:4px 6px 12px;border-bottom:1px solid var(--hair);margin-bottom:6px">
          <span class="ic-box" style="width:32px;height:32px;border-radius:9px;background:linear-gradient(155deg,#3478F6,#5B21B6)">{I("shield",16,2)}</span>
          <div class="col"><span class="f13 w7">星辰研发中心</span><span class="f11 t3">enterprise-web · /admin</span></div>
        </div>
        {side_html}
        <span class="grow"></span>
        <div class="card" style="padding:10px 11px;gap:4px">
          <div class="f11 w7">工程分层红线</div>
          <div class="f11 t2" style="line-height:1.5">独立 Vite SPA（<span class="mono">apps/web</span>），复用 <span class="mono">packages/ui-kit + admin-ui</span>；经 URL Fragment <span class="mono">#token=...</span> + <span class="mono">POST /exchange</span> 交接。</div>
        </div>
      </aside>
      <main class="wmain">{body_html}</main>
    </div>
  </div>
</div>
<script src="icons.js"></script></body></html>'''


def build_web_admin():
    body = f'''<div class="row g10">
      <div class="col grow">
        <div class="row g8"><span class="f20 w7">组织治理与多级安全中心</span><span class="tag tg-p">企业蓝图 M2 / M3</span></div>
        <div class="f12 t3" style="margin-top:2px">集团多事业部（<span class="mono">organizations</span>）· 飞书 SCIM 组织同步 · 企业域名可信发现 · 非密钥级联配置与安全审计导出</div>
      </div>
      <button class="cc-btn cc-btn-sm cc-btn-glass">{I("refresh",13)}立即同步飞书通讯录</button>
      <button class="cc-btn cc-btn-sm cc-btn-pri">{I("plus",13,2.4)}新建子节点</button>
    </div>
    <div class="wgrid">
      <div class="wcard">
        <div class="row g8">
          <span class="f14 w7 grow">多级组织架构树（<span class="mono">org_units.path</span>）</span>
          <span class="tag tg-g">飞书 SCIM 已接入 · 12 分钟前</span>
        </div>
        <div class="col g4" style="padding:8px;border-radius:12px;background:var(--well);border:1px solid var(--hair);flex:1">
          <div class="tnode w7">{I("chevd",12)}<span>云匠集团（Organization）</span><span class="mono f11 t3" style="margin-left:auto">48 人</span></div>
          <div class="tnode" style="padding-left:22px;font-weight:600">{I("chevd",12)}<span>星辰研发中心</span><span class="tag tg-n" style="height:17px;font-size:10px;margin-left:auto">scim_feishu</span></div>
          <div class="tnode" style="padding-left:40px">{I("layers",12)}<span>基础架构与安全部</span><span class="f11 t3" style="margin-left:auto">10 人</span></div>
          <div class="tnode on" style="padding-left:40px">{I("layers",12)}<span>业务产研 · OKR 与审批</span><span class="f11" style="margin-left:auto;color:var(--ink-blue)">22 人</span></div>
          <div class="tnode" style="padding-left:60px">{I("users",12)}<span>OKR 前端一组（主部门）</span><span class="f11 t3" style="margin-left:auto">6 人</span></div>
          <div class="tnode" style="padding-left:60px">{I("users",12)}<span>审批重构虚线借调组</span><span class="tag tg-b" style="height:17px;font-size:10px;margin-left:auto">expires 12/31</span></div>
          <div class="tnode" style="padding-left:40px">{I("layers",12)}<span>外包协作专项池（Guest）</span><span class="tag tg-o" style="height:17px;font-size:10px;margin-left:auto">Fail-Closed</span></div>
          <div class="tnode" style="padding-left:22px">{I("chevd",12)}<span>商业化事业部（独立工作空间）</span><span class="f11 t3" style="margin-left:auto">16 人</span></div>
        </div>
        <div class="f11 t3" style="line-height:1.5">树节点写操作加 <span class="mono">pg_advisory_xact_lock('org_tree:'||ws_id)</span> 防并发成环；SCIM 与手工节点均标注来源与外部 ID。</div>
      </div>

      <div class="col g12" style="min-height:0">
        <div class="wcard" style="padding:12px 14px;gap:8px">
          <div class="row g8">
            <span class="f14 w7 grow">企业域名验证与 SAML / 飞书自动入驻（防孤岛二层）</span>
            <span class="tag tg-g">DNS TXT 已验证</span>
          </div>
          <div class="row g10" style="padding:8px 10px;border-radius:10px;background:var(--well)">
            <span class="mono f12 w7">company.com</span>
            <span class="tag tg-b">SAML 2.0 + 飞书 OIDC</span>
            <span class="f11 t2 grow ell">新注册同事验证后直接提示加入星辰研发中心，告别孤岛</span>
            <span class="cc-switch on"></span>
          </div>
        </div>

        <div class="wcard" style="padding:12px 14px;gap:8px">
          <div class="row g8">
            <span class="f14 w7 grow">非密钥级联配置（<span class="mono">scoped_configs</span>）与锁定键</span>
            <span class="tag tg-r">4 项硬锁定 locked_keys</span>
          </div>
          <div class="row g10" style="padding:7px 10px;border-radius:10px;background:var(--fill)">
            <span class="f12 w6 grow">1. <span class="mono">safety_policies</span>（L2 禁移动端速过 / 管理员禁代审）</span>
            <span class="tag tg-r" style="height:18px;font-size:10px">MONOTONIC_TIGHTEN</span>
          </div>
          <div class="row g10" style="padding:7px 10px;border-radius:10px;background:var(--fill)">
            <span class="f12 w6 grow">2. <span class="mono">ai_settings</span> 网关令牌与个人 PAT / Apollo PROD</span>
            <span class="tag tg-n" style="height:18px;font-size:10px">物理隔离 · 禁级联覆盖</span>
          </div>
        </div>

        <div class="wcard" style="padding:12px 14px;gap:8px;flex:1">
          <div class="row g8">
            <span class="f14 w7 grow">按部门成本归集 &amp; 防篡改安全审计流（<span class="mono">events</span>）</span>
            <span class="lnk f11 w6">导出合规 CSV ›</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div class="card" style="padding:8px 10px"><div class="f11 t3">OKR 产研（快照部门）</div><div class="f14 w7" style="margin-top:2px">$142.8 · 38 单</div></div>
            <div class="card" style="padding:8px 10px"><div class="f11 t3">基础架构部</div><div class="f14 w7" style="margin-top:2px">$68.4 · 19 单</div></div>
            <div class="card" style="padding:8px 10px"><div class="f11 t3">安全审计事件</div><div class="f14 w7" style="color:var(--ink-green);margin-top:2px">防篡改触发器开启</div></div>
          </div>
          <div class="row g8 f11 t2" style="padding:6px 8px;border-radius:8px;background:var(--well)">
            <span class="tag tg-r" style="height:17px;font-size:10px">security_audit</span>
            <span class="mono">15:02</span>
            <span class="grow ell">林某 将 宋工 设为外包 Guest（Fail-Closed）并完成赵磊待审单移交</span>
            <span class="tag tg-n" style="height:17px;font-size:10px">仅管理员</span>
          </div>
        </div>
      </div>
    </div>'''
    return web_admin_wrap("企业管理后台（Web /admin 蓝图）", "/admin/org-tree", "org", body)


def build_web_admin_roles():
    def stack_item(idx, title, desc, tone):
        return f'''<div class="row g10" style="padding:9px 11px;border-radius:11px;background:var(--well);border:1px solid var(--hair)">
  <span class="ck" style="background:var(--{tone});width:20px;height:20px;font-size:11px;font-weight:800">{idx}</span>
  <div class="col grow" style="min-width:0"><span class="f12 w7">{title}</span><span class="f11 t3">{desc}</span></div>
</div>'''

    def rule_row(rid, subject, eff, scope, detail, frozen=False):
        st_pill = '<span class="tag tg-n" style="height:18px;font-size:9.5px">插件停用·冻结</span>' if frozen else '<span class="lnk f11">编辑</span>'
        return f'''<div class="row g8" style="padding:7px 10px;border-radius:10px;background:var(--fill){";opacity:.68" if frozen else ""}">
  <span class="mono f11 t3" style="width:52px;flex:none">{rid}</span>
  <span class="tag tg-{"r" if eff=="DENY" else "g"}" style="height:18px;font-size:10px">{eff}</span>
  <div class="col grow" style="min-width:0"><span class="f12 w6 ell">{subject} · {scope}</span><span class="f11 t3 ell">{detail}</span></div>
  {st_pill}
</div>'''

    def sim_row(act, res, tone, note):
        return f'''<div class="row g8" style="padding:6px 0;border-top:1px solid var(--hair)">
  <span class="mono f11 w6" style="width:184px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{act}</span>
  <span class="tag tg-{tone}" style="height:18px;font-size:10px">{res}</span>
  <span class="f11 t2 grow ell">{note}</span>
</div>'''

    body = f'''<div class="row g10">
      <div class="col grow">
        <div class="row g8"><span class="f20 w7">角色策略中心（Allow / Deny 规则引擎）</span><span class="tag tg-p">企业蓝图 M2 / M3</span></div>
        <div class="f12 t3" style="margin-top:2px">在 M1 权限基础上叠加五重 AND 门禁、显式拒绝（<span class="mono">effect='deny'</span>）与动态插件跨作用域试算</div>
      </div>
      <button class="cc-btn cc-btn-sm cc-btn-glass">{I("shield",13)}策略合规试算</button>
      <button class="cc-btn cc-btn-sm cc-btn-pri">{I("plus",13,2.4)}新建自定义角色 / 策略</button>
    </div>
    <div class="wgrid">
      <div class="wcard">
        <div class="row g8">
          <span class="f14 w7 grow">五重 AND × Deny-Overrides 优先级栈</span>
          <span class="tag tg-r">消假绿灯</span>
        </div>
        <div class="col g6">
          {stack_item(0, "插件生命周期门禁（enabled & 项目生效范围）", "未安装/已停用插件的 ext:* 动作第 0 层 403 阻断", "ink-purple")}
          {stack_item(1, "Core 安全不变量（不可配置）", "代审仅 ticket_assignees、personal_exec 凭据强制 scope='user'", "btn-danger-bg")}
          {stack_item(2, "显式拒绝（role_bindings.effect = 'deny'）", "任一作用域命中 DENY 立即一票否决，压过部门与角色 ALLOW", "orange")}
          {stack_item(3, "外包 Guest Fail-Closed 门禁", "仅白名单允许项放行，新装插件默认全拒", "orange")}
          {stack_item(4, "角色 ALLOW ∩ 操作人个人凭据校验", "RBAC 放行后仍需本人「我的账号」有效 scope='user' 凭据", "btn-pri-bg")}
        </div>
        <div class="card" style="padding:9px 11px;gap:3px;margin-top:auto">
          <div class="f11 w7">跨阶段零重构契约</div>
          <div class="f11 t2" style="line-height:1.45">所有可选插件权限定名走 <span class="mono">ext:&lt;plugin_id&gt;:&lt;action&gt;</span>；停用不丢 <span class="mono">DENY</span> 策略，重装按签名自动恢复防御。</div>
        </div>
      </div>

      <div class="col g12" style="min-height:0">
        <div class="wcard" style="padding:12px 14px;gap:7px">
          <div class="row g8">
            <span class="f14 w7 grow">活跃策略绑定清单（<span class="mono">role_bindings</span>）</span>
            <span class="cc-seg cc-seg-xs"><span class="on">全部 4</span><span>仅 DENY 2</span><span>停用冻结 1</span></span>
          </div>
          {rule_row("POL-01", "外包访客 Guest 池", "DENY", "全空间", "禁止读取共享参考仓库、全部成员目录及 ext:* 空间级插件")}
          {rule_row("POL-02", "借调组（审批重构）", "DENY", "项目·审批", "禁止向 PROD 正式环境发起发布或变更（ext:release-*:prod） · 12/31 止")}
          {rule_row("POL-03", "紧急回滚插件（Apollo）", "ALLOW", "全空间", "ext:rollback-apollo:execute · 插件当前在工作空间停用", frozen=True)}
        </div>

        <div class="wcard" style="padding:12px 14px;gap:6px;flex:1">
          <div class="row g8">
            <span class="f14 w7 grow">有效权限合规试算器（ActionGate 实态模拟）</span>
            <span class="cc-select cc-select-sm" style="width:186px"><span class="cc-sel-val">宋工（外包 Guest）</span><span class="cc-sel-sp"></span><span class="cc-sel-caret">{I("chevd",12)}</span></span>
          </div>
          <div class="col" style="margin-top:2px">
            {sim_row("core:ticket:read", "ALLOW", "g", "命中 OKR 项目显式授权白名单")}
            {sim_row("ext:connector-gitlab:merge", "待补凭据", "o", "RBAC 允许但缺本人 scope='user' PAT（ActionGate 引导补配）")}
            {sim_row("ext:rollback-apollo:exec", "插件停用", "n", "第 0 层 PLUGIN_DISABLED 拦截（POL-03 快照保留但不放行）")}
            {sim_row("core:repo:shared_ref", "DENIED", "r", "POL-01 Explicit DENY + Guest Fail-Closed 双重拦截")}
            {sim_row("core:ticket:review_code", "LOCKED", "r", "Plane B 安全红线：仅当本人为 ticket_assignees 时允许")}
          </div>
        </div>
      </div>
    </div>'''
    return web_admin_wrap("角色策略中心（Web /admin 蓝图）", "/admin/role-policies", "roles", body)


# =====================================================================
# 5. PC-已注册成员确认加入（防孤岛二层拦截）
# =====================================================================
def build_join_existing():
    css = '''
.root{display:block;background:var(--wall)}
.aura{position:absolute;border-radius:50%;background:conic-gradient(from 210deg,#4F8BFF,#9B5CFF,#FF5FA8,#FFB14A,#4FD1FF,#4F8BFF);filter:blur(70px);opacity:.36}
html.dark .aura{opacity:.46}
.ring{position:absolute;border-radius:50%;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)}
.card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:var(--r-panel);display:flex;flex-direction:column;z-index:2}
.ft{position:absolute;left:0;right:0;bottom:28px;display:flex;justify-content:center}
.ver{position:absolute;right:30px;top:26px;font-size:12px;color:var(--text-3)}
'''
    card = f'''<div class="card glass" style="width:490px;padding:28px 34px 26px;gap:14px" data-pin="join-card">
  <div class="row g8">
    <span class="tag tg-g" style="height:22px">{I("check",12,2.6)}邮箱验证已通过 · alex@company.com</span>
    <span class="grow"></span>
    <span class="tag tg-b" style="height:22px">防孤岛邀请拦截</span>
  </div>
  <div class="col" style="align-items:center;text-align:center;margin-top:2px">
    <img src="logo.svg" width="68" height="68" alt="" style="margin:-4px 0 2px">
    <div class="f20 w7">检测到团队邀请，直接加入而非另起孤岛</div>
    <div class="f12 t2" style="margin-top:5px;line-height:1.55">同事 <b>林某</b> 已为 <span class="mono">alex@company.com</span> 预留团队席位并配齐项目默认环境，点下方确认即可免配置直接修单。</div>
  </div>
  <div style="border-radius:16px;padding:14px 16px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border:1px solid color-mix(in srgb,var(--blue) 26%,transparent)">
    <div class="row g10">
      <span class="ic-box" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("users",18,2.2)}</span>
      <div class="col grow">
        <div class="row g6"><span class="f15 w7">星辰研发中心</span><span class="tag tg-b" style="height:18px;font-size:10.5px">企业空间</span></div>
        <div class="f11 t3" style="margin-top:2px">Slug：<span class="mono">starcraft-dev</span> · 邀请有效期剩余 21 小时</div>
      </div>
    </div>
    <div class="col g6" style="margin-top:11px;padding-top:10px;border-top:1px solid var(--hair)">
      <div class="row f12"><span class="t3" style="width:92px;flex:none">预设主部门</span><span class="w6">OKR 产研</span></div>
      <div class="row f12"><span class="t3" style="width:92px;flex:none">预设角色</span><span class="w6">研发成员（可审核分配给我的工单）</span></div>
      <div class="row f12"><span class="t3" style="width:92px;flex:none">自动继承配置</span><span class="w6" style="color:var(--ink-green)">OKR(可改) · 审批(只读) · 共享连接器 · 3 项 Skills</span></div>
    </div>
  </div>
  <div class="row g8 f11 t2" style="padding:8px 11px;border-radius:11px;background:var(--well);border:1px solid var(--hair);line-height:1.5">
    {I("layers",14,style="color:var(--ink-blue);flex:none")}
    <span>加入后你将同时拥有「星辰研发中心」与个人空间（可用空间 ≥ 2），登录后顶栏自动开启工作空间切换胶囊，单空间用户 0 打扰。</span>
  </div>
  <div class="col g8" style="margin-top:2px">
    <button class="cc-btn cc-btn-lg cc-btn-pri" data-pin="confirm-join-btn" style="width:100%">{I("check",15,2.6)}确认加入「星辰研发中心 · OKR 产研」</button>
    <button class="cc-btn cc-btn-md cc-btn-glass" data-pin="keep-personal-btn" style="width:100%">暂不加入，仅进入我的个人空间（可稍后在空间切换中接受）</button>
  </div>
</div>'''
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>确认加入工作空间 · PC</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{css}</style></head><body>
<div class="root">
  <div class="ring" style="width:620px;height:620px;left:410px;top:140px"></div>
  <div class="ring" style="width:900px;height:900px;left:270px;top:0"></div>
  <div class="aura" style="width:420px;height:420px;left:510px;top:240px"></div>
  <span class="ver">v1.0 · 反孤岛拦截</span>
  {card}
  <div class="ft"><span class="pill glass" style="padding:0 14px;height:28px;font-size:12px">{I("shield",13)}未通过验证码前绝不泄露任何企业名或成员信息</span></div>
</div>
<script src="icons.js"></script></body></html>'''


# =====================================================================
# 6. 移动端-组织与成员（3 屏 1440×1000）
# =====================================================================
def phone_m(inner, extra=""):
    return f'<div class="phone"><div class="scr">{status}{inner}{extra}<div class="home"></div></div></div>'


def nav_m(back, title, right=""):
    r = f'<span style="text-align:right">{right}</span>' if right else '<span aria-hidden="true"></span>'
    return f'<div class="nav"><span class="bk">{I("chevr",20,style="transform:rotate(180deg)")}{back}</span><span style="text-align:center;font-weight:600;font-size:15px">{title}</span>{r}</div>'


def m_p1_dir():
    def mrow(name, grad, badge, sub, right):
        return f'''<div class="ir" style="min-height:54px;padding:6px 12px">
  <span class="av2" style="width:36px;height:36px;font-size:11px;background:linear-gradient(150deg,{grad})">{name}</span>
  <div class="col grow" style="min-width:0;gap:2px">
    <div class="row g6"><span class="f14 w6">{name}</span>{badge}</div>
    <span class="f12 t3 ell">{sub}</span>
  </div>
  <em>{right}</em>
</div>'''

    inner = f'''{nav_m("设置", "组织与成员", '<span class="lnk f13 w6">待确认 1</span>')}
<div class="pad">
  <div class="row g6" style="overflow:hidden;margin-top:4px">
    <span class="chip glass">全部 24</span>
    <span class="chip" style="background:var(--btn-pri-bg);color:#fff">OKR 产研 6</span>
    <span class="chip glass">审批 8</span>
  </div>
  <div class="card2" style="margin-top:10px;padding:11px 13px;background:color-mix(in srgb,var(--blue) 7%,var(--glass-2));border-color:color-mix(in srgb,var(--blue) 24%,transparent)">
    <div class="row g6"><span class="f13 w7 grow">OKR 产研 · 部门默认继承</span><span class="tag tg-b">只读概览</span></div>
    <div class="f12 t2" style="margin-top:4px;line-height:1.45">默认项目 OKR(可改) · 审批(只读) · 共享连接器 + 3 Skills（个人 write 凭据不继承）</div>
  </div>
  <div class="gh" style="padding:12px 4px 6px">部门成员<span>6</span><em>点成员可交接</em></div>
  <div class="grp glass">
    {mrow("林某","#FFC9A8,#F08F7A",'<span class="tag tg-b">管理员</span>',"lin@company.com · 外部身份 2/2","正常")}
    {mrow("张某","#8FD8C9,#3FAE9A",'<span class="tag tg-p">负责人 · OKR</span>',"zhang@company.com · 手上 2 单","正常")}
    {mrow("陈晨","#FFD27F,#F0A23C",'<span class="tag tg-g">免配置</span>',"chen@company.com · 外部身份已绑","正常")}
    {mrow("宋工","#A5B4FC,#6366F1",'<span class="tag tg-o">外包 Guest</span>',"song@vendor.io · 仅授权单（隔离）","正常")}
    {mrow("赵磊","#C8CCD4,#8A909B",'<span class="tag tg-n">已停用</span>',"1 张待审单待交接",f'<span style="color:var(--ink-orange);font-weight:600">交接</span>{I("chevr",14)}')}
  </div>
  <div class="card2" style="margin-top:12px;padding:10px 12px">
    <div class="row g8"><span class="f12 t3" style="line-height:1.5">手机端禁用编辑组织树，完整树与 SCIM / SSO 同步请至 PC「成员与身份」或 Web <span class="mono">/admin</span>。</span></div>
  </div>
</div>'''
    return phone_m(inner)


def m_p2_resolve():
    def cand(name, dept, acct, tickets, picked):
        rad = (f'<span style="width:20px;height:20px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none">{I("check",12,2.6)}</span>'
               if picked else '<span style="width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border-ctl-hover);background:var(--glass-2);flex:none"></span>')
        bg = "background:color-mix(in srgb,var(--blue) 9%,transparent)" if picked else ""
        return f'''<div class="ir" style="min-height:58px;padding:8px 12px;{bg}">
  <span class="av2" style="width:36px;height:36px;font-size:11px;background:linear-gradient(150deg,#9FD7FF,#3A8EE6)">{name}</span>
  <div class="col grow" style="min-width:0;gap:2px">
    <span class="f14 w6">{name} · {dept}</span>
    <span class="f12 t3 ell"><span class="mono">{acct}</span> · 手上 {tickets} 张单</span>
  </div>{rad}
</div>'''

    inner = f'''{nav_m("组织", "待确认归属")}
<div class="pad">
  <div class="card2" style="margin-top:6px;padding:13px 14px;border-color:color-mix(in srgb,var(--orange) 42%,transparent);background:color-mix(in srgb,var(--orange) 9%,var(--glass-2))">
    <div class="row g8"><span class="ck2" style="background:#B45309">!</span><span class="f14 w7">OKR-3320 无法自动认人</span><span class="tag tg-o" style="margin-left:auto">工单已保留</span></div>
    <div class="f12 t2" style="margin-top:6px;line-height:1.55">Jira 经办人显示「张伟（账号 <span class="mono">zw01</span>）」，工作台匹配到两位同名研发。</div>
  </div>
  <div class="gh" style="padding:14px 4px 6px">选择一位成员接收并绑定</div>
  <div class="grp glass">
    {cand("张伟", "人事产研", "zhangwei", 2, True)}
    {cand("张伟", "销售产研", "zhangwei2", 1, False)}
  </div>
  <div class="card2" style="margin-top:12px;padding:11px 13px">
    <div class="f12 t2" style="line-height:1.55"><b style="color:var(--text)">防错规则：</b>确认后按 <span class="mono">(connector_id, zw01)</span> 写入 <span class="mono">identities</span> 唯一索引，以后 <span class="mono">zw01</span> 来单直接通知他，绝不按同名展示名覆盖。</div>
  </div>
</div>
<div class="dock2 glass">
  <button class="bigbtn" style="background:var(--btn-pri-bg);color:#fff;font-size:15px">{I("check",16,2.6)}确定指派给 张伟（人事产研）</button>
  <div class="f11 t3" style="text-align:center">同时补发新单提醒 · 保留本轮完整原单记录</div>
</div>'''
    return phone_m(inner)


def m_p3_handoff():
    bg_inner = m_p1_dir().replace('<div class="phone"><div class="scr">', '').replace('<div class="home"></div></div></div>', '')
    # Clean status prefix that phone_m already adds
    if bg_inner.startswith(status):
        bg_inner = bg_inner[len(status):]

    def succ(name, dept, load, picked):
        rad = (f'<span style="width:20px;height:20px;border-radius:50%;background:var(--btn-pri-bg);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none">{I("check",12,2.6)}</span>'
               if picked else '<span style="width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border-ctl-hover);background:var(--glass-2);flex:none"></span>')
        return f'''<div class="ir" style="min-height:52px;padding:4px 12px">
  <span class="av2" style="width:32px;height:32px;font-size:10px;background:linear-gradient(150deg,#8FD8C9,#3FAE9A)">{name}</span>
  <div class="col grow"><span class="f14 w6">{name} · {dept}</span><span class="f11 t3">当前 {load} 张进行中</span></div>{rad}
</div>'''

    sheet = f'''<div class="scrim"></div>
<div class="sheet">
  <div class="grab"></div>
  <div class="row g10" style="margin-bottom:8px">
    <div class="col grow"><span class="f17 w7">停用并交接 · 赵磊</span><span class="f12 t3">OKR 产研 · 同事务清退会话与本机 Runner</span></div>
    <span class="tag tg-o">2 项待交接</span>
  </div>
  <div class="flat2" style="padding:9px 12px;margin-bottom:10px">
    <div class="f12 t2" style="line-height:1.5">待审 <b style="color:var(--text)">TK-20852</b>（第 2 轮）与原平台待确认 <b style="color:var(--text)">Tita #4419</b> 将一并移交（历史署名保留）。</div>
  </div>
  <div class="flb" style="margin-top:6px">选定接替负责人</div>
  <div class="grp glass" style="margin-bottom:12px">
    {succ("张某", "负责人 · OKR 产研", 2, True)}
    {succ("林某", "空间管理员", 3, False)}
  </div>
  <button class="bigbtn" style="background:var(--btn-danger-bg);color:#fff;font-size:15px">{I("shield",16,2.2)}确认停用并移交给 张某</button>
</div>'''
    return phone_m(bg_inner, sheet)


def build_m_org():
    phones = [
        (m_p1_dir, "只读部门与成员目录", "按部门筛选 · 外包 Guest 隔离 · 禁用手机端编树"),
        (m_p2_resolve, "同名待确认选人", "OKR-3320 对不上号，按 external_id 精准绑定"),
        (m_p3_handoff, "停用待办一键交接", "先选接替人并同事务吊销登录态与个人 Runner"),
    ]
    cols = "".join(f'<div class="col3">{fn()}<div class="lbl">{t}<em>{d}</em></div></div>' for fn, t, d in phones)
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>移动端 · 组织与成员</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="m.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
</head><body><div class="board">{cols}</div>
<script src="../v3/shots.js"></script><script src="icons.js"></script></body></html>'''


FILES = {
    "pc-org-defaults.html": build_org_defaults(),
    "pc-member-edit.html": build_member_edit(),
    "pc-member-handoff.html": build_member_handoff(),
    "pc-roles.html": build_pc_roles(),
    "join-existing-pc.html": build_join_existing(),
    "m-org-members.html": build_m_org(),
    "web-admin-blueprint.html": build_web_admin(),
    "web-admin-roles.html": build_web_admin_roles(),
}

for fn, html in FILES.items():
    p = OUT / fn
    p.write_text(html, encoding="utf-8")
    print("→", p)
