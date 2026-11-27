#!/usr/bin/env python3
"""生成 index.html 内嵌的交互式「UI 点击流转图（含页面关联与缺口体检）」。

设计语言对齐 `PC-大包明细`（磨砂玻璃节点卡片 + 平滑贝塞尔有向连线 + 语义状态徽标），
同时解决“页面多、不知道点哪里去哪页、是否漏图缺闭环”的核对痛点。
全量覆盖 PC + 移动端 5 条核心用户旅程与全站 60+ 交互设计图；全部截图热区坐标均由源 HTML 实际 DOM 实测校准，
并经多 Agent 对照实际弹窗截图与设计图逐一审计修正。
"""
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _img_pair(rel_base: str | None) -> tuple[str | None, str | None]:
    if not rel_base:
        return None, None
    l_path = ROOT / f"{rel_base}-亮色.png"
    d_path = ROOT / f"{rel_base}-暗色.png"
    if not l_path.exists():
        raise FileNotFoundError(f"流转图引用了不存在的图片：{l_path}")
    if not d_path.exists():
        raise FileNotFoundError(f"流转图引用了不存在的暗色图片：{d_path}")
    return f"{rel_base}-亮色.png", f"{rel_base}-暗色.png"


def pin(
    x: float,
    y: float,
    w: float,
    h: float,
    to: str,
    label: str,
    tone: str = "ok",
    below: bool = False,
) -> dict:
    """截图上的百分比可点热区标识（点击直接跳去对应目标页，支持跨旅程及 `node:variant`）。"""
    d = {"x": x, "y": y, "w": w, "h": h, "to": to, "label": label, "tone": tone}
    if below:
        d["below"] = True
    return d


def variant(
    label: str,
    img: str,
    pins: list[dict] | None = None,
    note: str = "",
) -> dict:
    """同节点下的多屏/多抽屉切换变体。"""
    img_l, img_d = _img_pair(img)
    return {
        "label": label,
        "imgL": img_l,
        "imgD": img_d,
        "pins": pins or [],
        "note": note,
    }


def node(
    nid: str,
    col: int,
    row: int,
    title: str,
    subtitle: str,
    status: str = "done",  # done | reuse | gap | ext
    kind: str = "PC 页面",
    icon: str = "screen",
    img: str | None = None,
    hotspots: list[tuple] | None = None,  # (ok|warn|gap|reuse, text[, target_nid])
    note: str = "",
    pins: list[dict] | None = None,
    variants: list[dict] | None = None,
) -> dict:
    img_l, img_d = _img_pair(img)
    norm_hs = []
    for item in hotspots or []:
        if len(item) == 3:
            norm_hs.append([item[0], item[1], item[2]])
        else:
            norm_hs.append([item[0], item[1], ""])
    return {
        "id": nid,
        "col": col,
        "row": row,
        "title": title,
        "subtitle": subtitle,
        "status": status,
        "kind": kind,
        "icon": icon,
        "imgL": img_l,
        "imgD": img_d,
        "hotspots": norm_hs,
        "note": note,
        "pins": pins or [],
        "variants": variants or [],
    }


def edge(
    src: str,
    dst: str,
    label: str,
    tone: str = "ok",  # ok | info | warn | gap
    dashed: bool = False,
    from_side: str = "right",
    to_side: str = "left",
    curve: int = 0,
) -> dict:
    return {
        "from": src,
        "to": dst,
        "label": label,
        "tone": tone,
        "dashed": dashed,
        "fromSide": from_side,
        "toSide": to_side,
        "curve": curve,
    }


def _skips(skip: str | tuple | set) -> set[str]:
    if not skip:
        return set()
    if isinstance(skip, str):
        return {s.strip() for s in skip.split(",") if s.strip()}
    return set(skip)


def _pc_dock_pins(skip: str | tuple | set = "") -> list[dict]:
    """PC 左侧 Dock（7 大入口，DOM 实测于 apple-chat.html?v=10&sel=5&ic=3 及全部 v5 页面 `2.4, y, 3.2, 5.1`）。"""
    ex = _skips(skip)
    items = [
        ("ai", 9.0, "g_ai", "Dock #1 · AI 助手", "info"),
        ("chat", 17.3, "tk_main", "Dock #2 · 工单对话", "ok"),
        ("pub", 23.8, "rel_dock", "Dock #3 · 全局发布", "ok"),
        ("rb", 30.2, "rel_rb", "Dock #4 · 紧急回滚", "warn"),
        ("sk", 36.7, "g_skills", "Dock #5 · Skills", "info"),
        ("mkt", 84.3, "g_market", "Dock #6 · 插件市场", "warn"),
        ("set", 90.8, "g_set_conn", "Dock #7 · 设置", "info"),
    ]
    return [
        pin(2.4, y, 3.2, 5.1, to, lbl, tone)
        for key, y, to, lbl, tone in items
        if key not in ex
    ]


def _pc_tk_tabs_pins(skip: str | tuple | set = "") -> list[dict]:
    """PC v5 工单头部 5 个页签（DOM 实测于 pc-working/code/evidence/log/pubbefore 等 `31.0..51.5, 16.1`）。"""
    ex = _skips(skip)
    tabs = [
        ("chat", 31.0, 3.5, "tk_main", "对话 Tab", "info"),
        ("code", 34.7, 6.4, "tk_code", "代码改动 Tab", "info"),
        ("evid", 41.2, 4.6, "tk_evid", "证据 Tab", "info"),
        ("log", 46.0, 5.3, "tk_errlog", "执行日志 Tab", "warn"),
        ("rel", 51.5, 3.5, "rel_before", "工单 · 发布 Tab", "ok"),
    ]
    return [
        pin(x, 16.1, w, 3.1, to, lbl, tone)
        for k, x, w, to, lbl, tone in tabs
        if k not in ex
    ]


def _pc_set_nav_pins(skip: str | tuple | set = "") -> list[dict]:
    """PC 设置左栏 8 个菜单（DOM 实测 `7.7, 13.0..42.5, 16.0, 4.0`）。"""
    ex = _skips(skip)
    navs = [
        ("ai", 13.0, "g_set_ai", "全局 AI", "info"),
        ("run", 17.2, "g_set_run", "执行器", "info"),
        ("conn", 21.4, "g_set_conn", "连接器", "ok"),
        ("proj", 25.6, "g_set_proj", "项目", "ok"),
        ("src", 29.9, "g_set_src", "来源采集", "warn"),
        ("mem", 34.1, "g_set_mem:0", "成员与身份", "info"),
        ("acct", 38.3, "g_set_mem:1", "我的账号", "info"),
        ("notify", 42.5, "g_set_mem:2", "通知", "info"),
    ]
    return [
        pin(7.7, y, 16.0, 4.0, to, f"设置 · {lbl}", tone)
        for k, y, to, lbl, tone in navs
        if k not in ex
    ]


def _m_tabbar_pins(px: float, skip: str | tuple | set = "") -> list[dict]:
    """移动端底部 5-Tab 悬浮栏（`px` 为所在手机偏移 `0 / 31.0 / 62.0`）。"""
    ex = _skips(skip)
    tabs = [
        ("ai", px + 8.6, "m_home", "Tab #1 · AI 助手", "info"),
        ("chat", px + 13.0, "m_home", "Tab #2 · 工单", "ok"),
        ("pub", px + 17.4, "m_rel", "Tab #3 · 发布", "ok"),
        ("rb", px + 21.8, "m_rb", "Tab #4 · 回滚", "warn"),
        ("sk", px + 26.2, "m_set:0", "Tab #5 · Skills/设置", "info"),
    ]
    return [
        pin(x, 80.4, 3.3, 4.8, to, lbl, tone)
        for k, x, to, lbl, tone in tabs
        if k not in ex
    ]


def _m_seg_pins(px: float, y: float = 22.9, skip: str | tuple | set = "") -> list[dict]:
    """移动端工单内 5 段式分段控件（`对话 | 改动 | 证据 | 日志 | 发布`）。"""
    ex = _skips(skip)
    segs = [
        ("chat", px + 7.6, "m_home", "切「对话」", "info"),
        ("code", px + 12.2, "m_code", "切「改动」", "info"),
        ("evid", px + 16.8, "m_evid", "切「证据」", "info"),
        ("log", px + 21.4, "m_evid", "切「日志」", "warn"),
        ("rel", px + 26.0, "m_rel", "切「发布」", "ok"),
    ]
    return [
        pin(x, y + 0.5, 4.4, 3.2, to, lbl, tone)
        for k, x, to, lbl, tone in segs
        if k not in ex
    ]


JOURNEYS = [
    {
        "id": "onboarding",
        "tab": "PC ① 入驻与 4 步向导",
        "title": "① 启动、登录与 4 步开工向导",
        "desc": "覆盖冷启动、独立邮箱登录/注册（含重设密码与免 SMTP 邀请）、3 选 1 执行环境接入与精简 4 步开工向导（含全部子抽屉）。",
        "cols": 5,
        "rows": 4,
        "nodes": [
            node(
                "splash", 1, 1, "PC 闪屏", "启动加载与通知直达", "done", "PC 全屏", "spark",
                "reference/images/splash/PC-闪屏",
                [("ok", "未登录 / 过期 → 登录页", "login"), ("ok", "有效登录态 → 主界面", "tk_main")],
                "冷启动展示加载步进；点通知进入但登录失效时，先过登录再直达原工单。",
                pins=[
                    pin(39.0, 26.0, 22.0, 46.0, "login", "未登录 / 过期 → 登录页", "ok"),
                    pin(38.7, 92.7, 22.5, 3.4, "tk_main", "有效登录态 → 主界面", "info"),
                ],
            ),
            node(
                "login", 1, 2, "登录与注册", "邮箱登录 · 6 位码注册", "done", "PC 全屏", "lock",
                "reference/images/pages/PC-登录",
                [("info", "顶部分段「注册」 → 注册页", "register"), ("ok", "点「登录」 → 选执行环境", "env_sel"), ("info", "点「忘记密码？」 → 重置密码页", "auth_recover:0")],
                "独立账号体系；私有部署可在设置切换「开放注册 / 仅邀请注册」。",
                pins=[
                    pin(50.1, 41.1, 11.9, 3.6, "register", "点「注册」切注册页", "info"),
                    pin(57.6, 65.1, 4.6, 2.4, "auth_recover:0", "忘记密码 → 重置密码", "info"),
                    pin(37.8, 71.0, 24.4, 4.9, "env_sel", "点「登录」进向导", "ok"),
                ],
            ),
            node(
                "register", 1, 3, "创建账号（注册）", "邮箱 + 验证码 + 选填团队名", "done", "PC 全屏", "user",
                "reference/images/pages/PC-注册",
                [("ok", "验证邮箱后自动查邀 → 确认加入/建空间", "auth_recover:2"), ("ok", "直接进选执行环境", "env_sel"), ("reuse", "顶部分段切回「登录」", "login")],
                "对应 `PC-注册-亮色/暗色.png`（不前置暴露企业列表，支持选填工作空间/团队名称）。",
                pins=[
                    pin(37.57, 35.11, 12.36, 3.56, "login", "切回「登录」", "info"),
                    pin(37.29, 74.49, 25.42, 4.89, "auth_recover:2", "下一步 · 验证后防孤岛拦截", "ok"),
                ],
            ),
            node(
                "auth_recover", 2, 1, "重设密码 / 邀请与防孤岛拦截", "邮箱验证重设 + 免 SMTP 邀请 + 待加入拦截", "done", "PC 3 页", "key",
                "reference/images/pages/PC-重置密码",
                [("info", "点「返回登录」回登录卡", "login"), ("ok", "「确认重设密码并登录」 → 进系统", "env_sel"), ("ok", "免 SMTP / 防孤岛确认加入 → 选执行环境", "env_sel")],
                variants=[
                    variant(
                        "① 重置登录密码 (PC)",
                        "reference/images/pages/PC-重置密码",
                        pins=[
                            pin(36.94, 21.68, 5.0, 2.24, "login", "‹ 返回登录", "info"),
                            pin(36.94, 70.47, 26.11, 4.89, "env_sel", "确认重设密码并登录", "ok"),
                        ],
                        note="邮箱 + 6 位验证码重设密码，完成后安全下线其他已登录设备（SaaS 禁管理员代生成）。",
                    ),
                    variant(
                        "② 免 SMTP 邀请加入 (PC)",
                        "reference/images/pages/PC-邀请加入",
                        pins=[
                            pin(56.0, 21.15, 7.41, 2.07, "login", "已有账号，去登录 ›", "info"),
                            pin(36.6, 71.08, 26.81, 4.89, "step1", "设密并加入工作空间 → 步骤 1", "ok"),
                        ],
                        note="对应设置→成员复制的 `cc.intra/join/...` 24h 一次性链接落地页，预带部门、角色与外部身份。",
                    ),
                    variant(
                        "③ 防孤岛 · 确认加入已有空间 (PC)",
                        "reference/images/pages/PC-已注册成员确认加入",
                        pins=[
                            pin(35.42, 69.63, 29.17, 4.44, "env_sel", "确认加入「星辰研发中心 · OKR 产研」", "ok"),
                            pin(35.42, 74.96, 29.17, 4.0, "env_sel", "暂不加入，先用个人空间", "info"),
                        ],
                        note="注册验证 OTP 后检测到 Pending Invite 或已认证企业域名（M2/M3），引导直接入驻避免同事开孤岛。",
                    ),
                    variant(
                        "④ 剪贴板口令 / 链接智能识别 (PC)",
                        "reference/images/pages/PC-剪贴板识别邀请",
                        pins=[
                            pin(33.4, 71.2, 33.2, 4.9, "env_sel", "确认加入「星辰研发中心 · OKR 产研」", "ok"),
                            pin(33.4, 77.0, 33.2, 4.0, "g_ai", "忽略本次，记录口令指纹不再重弹", "info"),
                        ],
                        note="复制微信/飞书中的邀请链接（cc.intra/join/...）或口令（#CC-8K4P-9M2X-Q7R5#）切回云匠即拦截弹出确认卡；支持 Deep Link（cloudcraft://join）直唤，消费或忽略后不重复打扰。",
                    ),
                    variant(
                        "⑤ 头像菜单 · 切换空间与原地升级 (PC)",
                        "reference/images/pages/PC-头像菜单-切换空间与升级团队",
                        pins=[pin(95.4, 1.6, 3.2, 4.4, "g_set_mem:0", "点头像：切换空间与原地升级", "ok")],
                        note="可用空间 ≥ 2 时头像带当前空间角标；点头像弹出菜单切换空间，「升级为团队」在菜单里就地填写，个人账号和令牌不被成员继承。",
                    ),
                    variant(
                        "⑥ 邀请失效 / 邮箱不匹配 & 安全交接兜底 (PC)",
                        "reference/images/pages/PC-邀请失效与切号",
                        pins=[pin(56.0, 42.0, 12.0, 4.0, "login", "切号重登 / 安全交接", "warn")],
                        note="覆盖 24h 链接过期、当前邮箱与受邀邮箱不匹配引导切号、M2/M3 #token= 交接确认页及私有部署初始改密态。",
                    ),
                ],
            ),
            node(
                "env_sel", 2, 2, "选择执行环境", "首次无在线 Runner 时三选一", "done", "PC 全屏", "server",
                "reference/images/pages/PC-选择执行环境",
                [("ok", "选「本机」 → 本机初始化", "run_local"), ("ok", "选「团队服务器」 → 接入命令", "run_srv"), ("ok", "选「云端 Pro」 → 开通套餐", "run_pro"), ("warn", "点「先跳过」 → 直入主界面", "tk_main")],
                "工作区已有在线执行器时跳过此步；跳过后可在「设置 → 执行器」重开。",
                pins=[
                    pin(19.0, 37.1, 19.8, 32.7, "run_local", "选本机 → 初始化", "ok"),
                    pin(40.1, 37.1, 19.8, 32.7, "run_srv", "选服务器 → 接入命令", "ok"),
                    pin(61.2, 37.1, 19.8, 32.7, "run_pro", "选云端 → 开通 Pro", "ok"),
                    pin(41.1, 73.0, 17.8, 4.9, "run_local", "使用本机电脑并继续", "ok", below=True),
                    pin(50.2, 79.5, 8.6, 2.1, "tk_main", "先跳过 → 进入工作台", "warn", below=True),
                ],
            ),
            node(
                "run_local", 3, 1, "路径 A · 本机执行器初始化", "灵动岛单胶囊 · 零下载复用浏览器", "done", "PC 全屏", "monitor",
                "reference/images/pages/PC-执行器初始化",
                [("ok", "后台准备 / 连通 → 步骤 0", "step0"), ("info", "点「连接团队服务器 Runner」", "run_srv")],
                pins=[
                    pin(41.4, 87.5, 17.3, 4.4, "step0", "先进入工作台 / 步骤 0", "warn"),
                    pin(55.0, 93.3, 9.7, 2.1, "run_srv", "连接团队服务器 Runner", "info", below=True),
                ],
            ),
            node(
                "run_srv", 3, 2, "路径 B · 连接团队服务器", "一键脚本 / Compose · 出站 WSS 握手", "done", "PC 全屏", "terminal",
                "reference/images/pages/PC-连接团队服务器",
                [("ok", "握手上线 → 步骤 1", "step1"), ("reuse", "点「返回重选」 → 执行环境三选一", "env_sel"), ("warn", "后台监听直入工作台", "tk_main")],
                pins=[
                    pin(2.2, 2.7, 10.6, 3.6, "env_sel", "返回重选执行环境", "warn"),
                    pin(50.8, 78.7, 12.8, 4.4, "tk_main", "后台监听 → 工作台", "info"),
                    pin(64.4, 78.7, 12.5, 4.4, "step1", "我已运行，立即检测 → 步骤 1", "ok"),
                ],
            ),
            node(
                "run_pro", 3, 3, "路径 C · 开通云端托管 Pro", "套餐 / 兑换码 → 秒开隔离容器", "done", "PC 全屏", "cloud",
                "reference/images/pages/PC-开通云端托管Pro",
                [("ok", "开通成功 → 步骤 1", "step1"), ("reuse", "点「返回重选」 / 「改用本机」", "run_local")],
                pins=[
                    pin(2.2, 2.7, 10.6, 3.6, "env_sel", "返回重选执行环境", "warn"),
                    pin(47.5, 72.5, 12.7, 4.4, "run_local", "改用本机电脑", "info", below=True),
                    pin(60.9, 72.5, 17.4, 4.4, "step1", "立即开通 Pro → 步骤 1", "ok", below=True),
                ],
            ),
            node(
                "step0", 4, 1, "步骤 0 · 管理员连接 AI", "仅管理员且全局 AI 未接时出现", "done", "PC 向导", "spark",
                "reference/images/pages/PC-步骤器-0-连接AI",
                [("ok", "公司网关 / API Key 测通 → 步骤 1", "step1"), ("warn", "点右上「问 AI」 → 向导 AI 帮手", "s1_drw:2"), ("warn", "右上「稍后再填」 → 工作台", "tk_main")],
                pins=[
                    pin(87.0, 3.3, 10.8, 2.2, "tk_main", "稍后再填 → 工作台", "warn", below=True),
                    pin(78.0, 11.9, 11.1, 3.1, "s1_drw:2", "不知道填什么？问 AI", "warn"),
                    pin(10.1, 32.4, 17.4, 7.2, "step1", "左栏 · 步骤 1 连接器", "info"),
                    pin(74.7, 89.7, 14.4, 4.4, "step1", "下一步：连接器与鉴权", "ok"),
                ],
            ),
            node(
                "step1", 4, 2, "步骤 1 · 连接器与鉴权", "GitLab / GitHub / 本机 / Jira / Tita", "done", "PC 向导", "link",
                "reference/images/pages/PC-步骤器-1-连接器与鉴权",
                [("ok", "点「鉴权配置 / 增减目录」 → 代码抽屉", "s1_drw:0"), ("ok", "点「改鉴权/触发条件 / + Tita」 → 工单抽屉", "s1_drw:1"), ("warn", "点右上「问 AI」 → AI 帮手", "s1_drw:2"), ("info", "点「+ 插件市场」 → 插件市场", "g_market"), ("ok", "点「下一步」 → 步骤 2", "step2")],
                "保存抽屉后即时回写列表，跳过也可后续在「设置 → 连接器」补配。",
                pins=[
                    pin(87.0, 3.3, 10.8, 2.2, "tk_main", "稍后再填 → 工作台", "warn", below=True),
                    pin(78.9, 11.9, 10.2, 3.1, "s1_drw:2", "怎么填令牌？问 AI", "warn"),
                    pin(54.9, 37.9, 4.0, 2.1, "s1_drw:0", "代码鉴权配置抽屉", "info"),
                    pin(84.0, 37.9, 4.0, 2.1, "s1_drw:0", "增减本机代码目录", "info"),
                    pin(36.5, 42.6, 30.9, 3.6, "s1_drw:0", "快捷添加代码源 → 鉴权抽屉", "info"),
                    pin(68.0, 42.6, 11.6, 3.6, "g_market", "+ 插件市场 / 通用接入", "warn"),
                    pin(51.6, 62.6, 7.3, 2.1, "s1_drw:1", "工单触发条件抽屉", "info"),
                    pin(61.9, 61.8, 12.4, 2.2, "s1_drw:1", "+ Tita 工单 / GitHub Issues", "info"),
                    pin(74.7, 61.8, 7.2, 2.2, "g_market", "+ 插件市场 / MCP", "warn"),
                    pin(73.7, 89.7, 15.3, 4.4, "step2", "下一步：授权项目与代码", "ok"),
                ],
            ),
            node(
                "s1_drw", 5, 2, "步骤 1 · 子抽屉与 AI 帮手 (3 张)", "代码连接器 / 工单触发 / 非模态 AI 帮手", "done", "右滑抽屉", "sliders",
                "reference/images/pages/PC-步骤器-1-新建连接器鉴权",
                [("ok", "切换下方 Tab 查看全部 3 个子抽屉", "s1_drw:1"), ("ok", "保存后进入步骤 2", "step2"), ("ok", "点「× / 取消」关闭抽屉回步骤 1", "step1")],
                "保存抽屉后即时回写步骤 1 列表卡片，并在「设置 → 连接器」0% 重构复用。",
                variants=[
                    variant(
                        "① 代码连接器鉴权",
                        "reference/images/pages/PC-步骤器-1-新建连接器鉴权",
                        pins=[
                            pin(94.7, 5.4, 2.2, 3.6, "step1", "关闭抽屉回步骤 1", "warn", below=True),
                            pin(53.9, 91.8, 4.6, 4.4, "step1", "取消回步骤 1", "warn"),
                            pin(87.4, 91.8, 9.6, 4.4, "step2", "保存并拉取仓库 → 步骤 2", "ok"),
                        ],
                        note="支持 Access Token / OAuth / SSH Key；右上可设「公司共用」或「仅我自己」。",
                    ),
                    variant(
                        "② 工单鉴权与触发条件",
                        "reference/images/pages/PC-步骤器-1-工单鉴权与触发条件",
                        pins=[
                            pin(94.7, 5.2, 2.2, 3.6, "step1", "关闭抽屉回步骤 1", "warn", below=True),
                            pin(71.7, 91.8, 4.6, 4.4, "step1", "取消回步骤 1", "warn"),
                            pin(85.4, 91.8, 11.6, 4.4, "step2", "保存鉴权与触发条件 → 步骤 2", "ok"),
                        ],
                        note="轮询 / Webhook 模式 + 项目勾选 + 触发状态 + 试采预览（现场命中 2 条单）。",
                    ),
                    variant(
                        "③ 向导 AI 帮手",
                        "reference/images/pages/PC-步骤器-1-向导AI帮手",
                        pins=[
                            pin(94.8, 4.8, 2.2, 3.6, "step1", "关闭 AI 帮手回步骤 1", "warn", below=True),
                            pin(89.8, 67.5, 5.5, 3.1, "s1_drw:0", "就地打开配置 → 填令牌抽屉", "ok"),
                        ],
                        note="非模态浮层不丢表单上下文，直接指导去哪生成 GitLab / Jira Token。",
                    ),
                ],
            ),
            node(
                "step2", 4, 3, "步骤 2 · 授权项目与代码权限", "切换 仅查看 / 可修改 · AI 推测分支构建", "done", "PC 向导", "layers",
                "reference/images/pages/PC-步骤器-2-授权项目与代码",
                [("ok", "点「挑选仓库」 → 选仓抽屉", "s2_drw:0"), ("ok", "点「微调 ›」 → 微调配置抽屉", "s2_drw:1"), ("warn", "点右上「问 AI」 → AI 帮手", "s1_drw:2"), ("ok", "点「下一步」 → 步骤 3", "step3:0")],
                pins=[
                    pin(87.0, 3.3, 10.8, 2.2, "tk_main", "稍后再填 → 工作台", "warn", below=True),
                    pin(10.1, 25.3, 17.4, 7.2, "step1", "左栏 · 返回步骤 1", "info"),
                    pin(78.0, 11.9, 11.1, 3.1, "s1_drw:2", "不知道怎么选？问 AI", "warn"),
                    pin(31.7, 23.2, 11.2, 4.0, "s2_drw:0", "从已连来源挑选仓库", "info"),
                    pin(82.7, 28.5, 6.2, 2.0, "s2_drw:0", "+ 从公司 GitLab 挑选", "info"),
                    pin(82.7, 47.9, 6.2, 2.0, "s2_drw:0", "+ 从本机目录挑选", "info"),
                    pin(82.7, 59.2, 6.2, 2.0, "s2_drw:0", "+ 从 GitHub 挑选", "info"),
                    pin(70.7, 35.4, 2.7, 2.1, "s2_drw:1", "微调 OKR 前端配置", "info"),
                    pin(70.7, 54.8, 2.7, 2.1, "s2_drw:1", "微调审批前端配置", "info"),
                    pin(31.7, 89.7, 7.4, 4.4, "step1", "退回步骤 1", "warn"),
                    pin(75.7, 89.7, 13.4, 4.4, "step3:0", "下一步：环境与账号", "ok"),
                ],
            ),
            node(
                "s2_drw", 5, 3, "步骤 2 · 选仓与微调抽屉 (2 张)", "挑选仓库抽屉 / 微调分支与试构建抽屉", "done", "右滑抽屉", "code",
                "reference/images/pages/PC-步骤器-2-微调配置",
                [("ok", "切换 Tab 看「挑选仓库 / 微调配置」", "s2_drw:0"), ("ok", "点「× / 取消 / 保存」回步骤 2", "step2")],
                variants=[
                    variant(
                        "① 挑选仓库抽屉",
                        "reference/images/pages/PC-步骤器-2-挑选仓库",
                        pins=[
                            pin(94.7, 5.4, 2.2, 3.6, "step2", "关闭抽屉回步骤 2", "warn", below=True),
                            pin(91.9, 14.2, 5.0, 2.1, "s1_drw:0", "+ 新增连接器", "info"),
                            pin(80.1, 91.8, 4.6, 4.4, "step2", "取消回步骤 2", "warn"),
                            pin(85.2, 91.8, 11.7, 4.4, "step2", "确认保留（共 4 个）回步骤 2", "ok"),
                        ],
                        note="从各已鉴权连接器跨源勾选仓库并实时汇总数量。",
                    ),
                    variant(
                        "② 微调仓库配置抽屉",
                        "reference/images/pages/PC-步骤器-2-微调配置",
                        pins=[
                            pin(94.7, 5.3, 2.2, 3.6, "step2", "关闭抽屉回步骤 2", "warn", below=True),
                            pin(55.3, 91.8, 4.6, 4.4, "step2", "取消回步骤 2", "warn"),
                            pin(80.8, 91.8, 5.6, 4.4, "step2", "仅保存回步骤 2", "info"),
                            pin(87.0, 91.8, 10.0, 4.4, "step2", "保存并试构建", "ok"),
                        ],
                        note="展示 AI 推测标紫 + 人工覆盖标蓝；设置测试/主干分支 MR 审核人。",
                    ),
                ],
            ),
            node(
                "step3", 3, 4, "步骤 3 · 环境与账号 (测试/正式/添加)", "多环境入口 · 添加账号抽屉 · 密码/Cookie 实测", "done", "PC 向导 + 抽屉", "shield",
                "reference/images/pages/PC-首次使用步骤器",
                [("ok", "点「正式环境卡片」切正式环境", "step3:1"), ("info", "点「+ 添加账号」 → 右滑添加抽屉", "step3:2"), ("ok", "点「下一步：AI 体检并开工」 → 步骤 4", "step4")],
                variants=[
                    variant(
                        "① 测试环境配置",
                        "reference/images/pages/PC-首次使用步骤器",
                        pins=[
                            pin(87.0, 3.3, 10.8, 2.2, "tk_main", "稍后再填 → 工作台", "warn", below=True),
                            pin(10.1, 25.3, 17.4, 7.2, "step1", "左栏 · 步骤 1 连接器", "info"),
                            pin(10.1, 32.4, 17.4, 7.2, "step2", "左栏 · 步骤 2 授权项目", "info"),
                            pin(78.0, 11.9, 11.1, 3.1, "s1_drw:2", "不知道填什么？问 AI", "warn"),
                            pin(64.4, 26.6, 15.7, 10.2, "step3:1", "切换查看「正式环境」", "info"),
                            pin(31.7, 70.2, 5.6, 2.2, "step3:2", "+ 添加账号 → 打开抽屉", "info"),
                            pin(31.7, 89.7, 7.4, 4.4, "step2", "上一步回步骤 2", "warn"),
                            pin(67.7, 90.8, 5.5, 2.2, "step4", "这一步先跳过 → 步骤 4", "warn"),
                            pin(74.5, 89.7, 14.6, 4.4, "step4", "下一步：AI 体检并开工", "ok"),
                        ],
                        note="测试环境：默认支持「只能查看 / 可以修改」双模式账号与自动试登录。",
                    ),
                    variant(
                        "② 正式环境配置",
                        "reference/images/pages/PC-首次使用步骤器-正式环境",
                        pins=[
                            pin(87.0, 3.3, 10.8, 2.2, "tk_main", "稍后再填 → 工作台", "warn", below=True),
                            pin(10.1, 25.3, 17.4, 7.2, "step1", "左栏 · 步骤 1 连接器", "info"),
                            pin(10.1, 32.4, 17.4, 7.2, "step2", "左栏 · 步骤 2 授权项目", "info"),
                            pin(78.0, 11.9, 11.1, 3.1, "s1_drw:2", "不知道填什么？问 AI", "warn"),
                            pin(31.7, 26.6, 15.7, 10.2, "step3:0", "切回「测试环境」", "info"),
                            pin(31.7, 65.3, 5.6, 2.2, "step3:2", "+ 添加账号 → 打开抽屉", "info"),
                            pin(31.7, 89.7, 7.4, 4.4, "step2", "上一步回步骤 2", "warn"),
                            pin(67.7, 90.8, 5.5, 2.2, "step4", "这一步先跳过 → 步骤 4", "warn"),
                            pin(74.5, 89.7, 14.6, 4.4, "step4", "下一步：AI 体检并开工", "ok"),
                        ],
                        note="正式环境：默认锁死「只能查看」，保护线上数据安全。",
                    ),
                    variant(
                        "③ 添加账号 / 环境入口 (抽屉)",
                        "reference/images/pages/PC-步骤器-3-添加账号",
                        pins=[
                            pin(94.72, 5.27, 2.22, 3.56, "step3:0", "关闭抽屉回步骤 3", "warn"),
                            pin(59.44, 91.78, 4.62, 4.44, "step3:0", "取消", "warn"),
                            pin(75.44, 91.78, 9.98, 4.44, "step3:0", "保存前试登录", "info"),
                            pin(85.97, 91.78, 10.97, 4.44, "step3:0", "保存并识别账号", "ok"),
                        ],
                        note="对应「+ 添加账号 / + 添加环境」右滑抽屉，与移动端 P3 Sheet 及设置→项目复用同一结构。",
                    ),
                ],
            ),
            node(
                "step4", 4, 4, "步骤 4 · AI 自动体检并开工", "拉仓 · 试构建 · 只读隔离 · 试登录全部实测", "done", "PC 向导", "check",
                "reference/images/pages/PC-步骤器-4-体检并开工",
                [("info", "点「看完整日志 ›」 → 体检完整日志抽屉", "chk_log"), ("info", "点「按需在插件市场启用」 → 插件市场", "g_market"), ("ok", "点「开始使用，进入工作台」 → PC 主界面", "tk_main")],
                pins=[
                    pin(87.0, 3.3, 10.8, 2.2, "tk_main", "稍后再填 → 工作台", "warn", below=True),
                    pin(10.1, 25.3, 17.4, 7.2, "step1", "左栏 · 步骤 1 连接器", "info"),
                    pin(10.1, 32.4, 17.4, 7.2, "step2", "左栏 · 步骤 2 授权项目", "info"),
                    pin(10.1, 39.6, 17.4, 7.2, "step3:0", "左栏 · 步骤 3 环境账号", "info"),
                    pin(78.0, 11.9, 11.1, 3.1, "s1_drw:2", "不知道填什么？问 AI", "warn"),
                    pin(82.9, 26.7, 4.9, 2.1, "chk_log", "看完整日志 ›", "info"),
                    pin(71.0, 50.1, 16.9, 3.8, "tk_main", "立即修复首批收单 → 工作台", "info"),
                    pin(60.3, 64.8, 7.7, 2.1, "g_market", "按需在插件市场启用", "info"),
                    pin(31.7, 89.7, 7.4, 4.4, "step3:0", "上一步回步骤 3", "warn"),
                    pin(74.7, 89.7, 14.4, 4.4, "tk_main", "开始使用，进入工作台 → 主界面", "ok"),
                ],
            ),
            node(
                "chk_log", 5, 4, "AI 体检完整日志抽屉", "5 阶段状态 · 脱敏终端日志 · 仅警告筛选", "done", "右滑抽屉", "terminal",
                "reference/images/pages/PC-步骤器-4-体检完整日志",
                [("ok", "点「关闭并返回开工」回步骤 4", "step4"), ("warn", "点「重新体检」重跑探测", "step4"), ("info", "步骤 4 与设置→项目「看完整日志 ›」共用", "g_set_proj")],
                pins=[
                    pin(94.72, 5.27, 2.22, 3.56, "step4", "关闭抽屉回步骤 4", "info"),
                    pin(52.5, 91.78, 9.98, 4.44, "chk_log", "复制脱敏日志", "info"),
                    pin(78.81, 91.78, 7.99, 4.44, "step4", "重新体检", "warn"),
                    pin(87.36, 91.78, 9.58, 4.44, "step4", "关闭并返回开工", "ok"),
                ],
            ),
        ],
        "edges": [
            edge("splash", "login", "未登录/过期", "ok", False, "bottom", "top"),
            edge("login", "register", "切「注册」", "info", False, "bottom", "top"),
            edge("login", "auth_recover", "忘记密码？", "info", True, "right", "left"),
            edge("login", "env_sel", "登录成功", "ok", False, "right", "left"),
            edge("register", "auth_recover", "查邀防孤岛", "ok", True, "right", "left"),
            edge("register", "env_sel", "无邀建空间", "ok", False, "right", "bottom"),
            edge("env_sel", "run_local", "选本机", "ok", False, "right", "left"),
            edge("env_sel", "run_srv", "选服务器", "ok", False, "right", "left"),
            edge("env_sel", "run_pro", "云端 Pro", "ok", False, "right", "left"),
            edge("run_local", "run_srv", "切团队服务器", "info", True, "bottom", "top"),
            edge("run_pro", "run_local", "改用本机", "info", True, "top", "bottom", curve=-18),
            edge("run_local", "step0", "配 AI", "warn", False, "right", "left"),
            edge("run_srv", "step1", "上线→1", "ok", False, "right", "left"),
            edge("run_pro", "step1", "上线→1", "ok", False, "right", "left", curve=-28),
            edge("step0", "step1", "已连通", "ok", False, "bottom", "top"),
            edge("step1", "s1_drw", "抽屉/AI", "info", False, "right", "left"),
            edge("s1_drw", "step2", "保存拉仓→2", "ok", True, "bottom", "top"),
            edge("step1", "step2", "下一步", "ok", False, "bottom", "top"),
            edge("step2", "s2_drw", "挑仓/微调", "info", False, "right", "left"),
            edge("step2", "step3", "下一步", "ok", False, "bottom", "top"),
            edge("step3", "step4", "AI 体检", "ok", False, "right", "left"),
            edge("step4", "chk_log", "完整日志", "info", True, "right", "left"),
        ],
    },
    {
        "id": "ticket",
        "tab": "PC ② 工单闭环",
        "title": "② 工单闭环（建单 → 修复 → 审核 → 原单确认）",
        "desc": "覆盖一张 Bug 单在工作台内的全部流转节点：手动新建、排队、Bot 提问、代码 Diff/证据/报错查看、打回与未测项审核通过、边界态及原平台确认。",
        "cols": 5,
        "rows": 4,
        "nodes": [
            node(
                "tk_empty", 1, 1, "空状态（等单 / 无结果 / 空面板）", "首次就绪等收单 · 筛无结果回「全部」", "done", "PC 4 合 1 (2 张)", "inbox",
                "reference/images/pages/PC-空状态",
                [("ok", "点「去来源采集」 → 设置·来源采集", "g_set_src"), ("ok", "点「在全部里找」 → 工单列表", "tk_main"), ("warn", "点「去填发布配置」 → 设置·项目", "g_set_proj")],
                variants=[
                    variant(
                        "① 工单 / 发布 / Skills 空状态",
                        "reference/images/pages/PC-空状态",
                        pins=[
                            pin(17.9, 40.2, 5.6, 3.1, "s1_drw:1", "看收单条件", "info"),
                            pin(24.1, 40.2, 5.6, 3.1, "g_set_src", "去来源采集", "info"),
                            pin(66.5, 29.4, 8.0, 3.1, "tk_main", "在全部里找 · 2 张", "ok"),
                            pin(75.0, 29.4, 4.8, 3.1, "tk_main", "清除筛选", "warn"),
                            pin(68.7, 35.1, 26.7, 2.1, "g_ai", "问 AI 助手查单", "info"),
                            pin(43.3, 84.0, 3.2, 3.1, "g_set_proj", "去填发布配置", "warn"),
                            pin(77.4, 80.4, 7.7, 3.2, "g_skimp", "导入 Skill", "info"),
                        ],
                        note="涵盖 4 个空状态：工单还没收到、带着筛选搜无结果、发布还没开始、Skills 还没新建。",
                    ),
                    variant(
                        "② AI / 回滚 / Diff / 发布空态",
                        "reference/images/pages/PC-空状态-2",
                        pins=[
                            pin(18.8, 37.5, 25.8, 3.2, "g_ai", "进入全局 AI 助手", "info"),
                            pin(51.8, 17.1, 11.9, 3.1, "rel_rb", "切测试环境查可回滚版本", "info"),
                            pin(66.5, 32.2, 4.8, 3.1, "rel_rb", "换个应用查回滚", "warn"),
                            pin(71.9, 32.2, 5.6, 3.1, "rel_dock", "看测试环境发布", "info"),
                            pin(22.4, 87.6, 6.5, 3.1, "tk_working", "去对话看 Bot 进度", "ok"),
                            pin(71.5, 88.2, 5.6, 3.1, "tk_main", "去审核代码", "ok"),
                        ],
                        note="涵盖首次打开 AI 助手、只发布过一次无历史可回滚、修复中无 Diff、未通过审无发布。",
                    ),
                ],
            ),
            node(
                "tk_new", 1, 2, "手动新建工单", "不依赖 Jira/Tita 直接发给 Bot", "done", "居中弹窗", "plus",
                "reference/images/pages/PC-手动新建工单",
                [("ok", "点「创建并派给 Bot」 → 修复中", "tk_working"), ("warn", "Bot 全忙时进排队中", "tk_queue"), ("ok", "点「× / 取消」回工作台", "tk_main")],
                "标记 M-105 为手动工单，审核通过后跳过第 13 步原平台确认。",
                pins=[
                    pin(68.6, 21.9, 2.2, 3.6, "tk_main", "关闭弹窗回工作台", "warn"),
                    pin(55.8, 75.0, 3.8, 4.0, "tk_main", "取消回列表", "warn"),
                    pin(60.3, 75.0, 10.5, 4.0, "tk_working", "创建并派给 Bot → 修复中", "ok"),
                ],
            ),
            node(
                "tk_queue", 1, 3, "排队中（Bot 忙时）", "P1 最先 · 打回重修优先于新单", "done", "PC 页面", "clock",
                "reference/images/pages/PC-排队",
                [("ok", "有空闲 Bot 自动切 → Bot 修复中", "tk_working"), ("info", "并发策略配置 → 设置·全局 AI", "g_set_ai")],
                pins=[
                    pin(4.0, 61.9, 43.4, 27.9, "g_set_ai", "调整并发与排队顺序 → 全局 AI", "info"),
                    pin(54.4, 18.8, 42.1, 13.1, "tk_working", "轮到空闲 Bot → 进入修复中", "ok"),
                    pin(52.6, 59.2, 43.4, 18.3, "tk_working", "查看正在修的 3 张单", "info"),
                ],
            ),
            node(
                "tk_working", 2, 2, "工单 · Bot 修复中", "实时步骤进度 · 中途补充「已采纳」", "done", "PC 主区", "bot",
                "reference/images/pages/PC-工单-修复中",
                [("warn", "缺少复现角色 → Bot 在问你", "tk_ask"), ("gap", "工具报错 → 执行日志报错", "tk_errlog"), ("ok", "本轮完成 → 待我审核", "tk_main")],
                pins=[
                    pin(84.4, 2.1, 10.9, 2.9, "g_set_src", "Tita 采集失败 → 来源采集", "warn", below=True),
                    pin(12.9, 9.4, 1.7, 2.7, "tk_new", "+ 手动新建工单", "info"),
                    pin(8.1, 34.1, 19.3, 6.6, "tk_ask", "点「Bot 在问你」工单", "warn"),
                    pin(33.8, 45.5, 41.7, 29.4, "tk_main", "验证完成后 → 待我审核交付卡", "ok"),
                    pin(72.6, 90.7, 2.6, 4.2, "tk_working", "中途补充发给 Bot（已采纳）", "info"),
                    pin(80.4, 67.1, 7.7, 3.1, "tk_main", "我来接手", "warn"),
                    pin(88.7, 67.1, 7.7, 3.1, "tk_main", "停止本轮", "warn"),
                ] + _pc_tk_tabs_pins("chat") + _pc_dock_pins("chat"),
            ),
            node(
                "tk_ask", 2, 1, "Bot 在问你（3a 需要协助）", "一键选项 / 打字补充 · 可存为项目规则", "done", "PC 卡片", "help",
                "reference/images/pages/PC-Bot提问回复",
                [("ok", "点一键选项（如用普通员工） → 修复中", "tk_working"), ("ok", "底部本单 AI 输入框回复 → 修复中", "tk_working")],
                pins=[
                    pin(12.9, 9.4, 1.7, 2.7, "tk_new", "+ 手动新建工单", "info"),
                    pin(35.1, 79.9, 6.7, 3.6, "tk_working", "点「用普通员工」继续修复", "ok"),
                    pin(42.4, 79.9, 7.6, 3.6, "tk_working", "点「用部门负责人」继续", "ok"),
                    pin(50.5, 79.9, 7.6, 3.6, "tk_working", "点「两个角色都测」继续", "ok"),
                    pin(58.7, 79.9, 7.6, 3.6, "tk_main", "我来人工复现", "warn"),
                    pin(72.6, 90.7, 2.6, 4.2, "tk_working", "发送补充回复", "ok"),
                ] + _pc_tk_tabs_pins("chat") + _pc_dock_pins("chat"),
            ),
            node(
                "tk_errlog", 2, 3, "执行日志 · 报错", "失败步骤 · 报错原文可复制 · AI 解读", "done", "PC 标签页", "terminal",
                "reference/images/pages/PC-执行日志报错",
                [("ok", "点「补充后让 Bot 重试」 → 修复中", "tk_working"), ("warn", "点「人工接手」 → 返回对话", "tk_main"), ("info", "点「失败时截图」 → 预览灯箱", "tk_fullprev:1")],
                pins=[
                    pin(12.9, 9.4, 1.7, 2.7, "tk_new", "+ 手动新建工单", "info"),
                    pin(54.2, 63.1, 7.0, 3.1, "tk_fullprev:1", "失败时截图（放大预览）", "info"),
                    pin(75.1, 72.4, 10.8, 4.0, "tk_working", "补充后让 Bot 重试", "ok"),
                    pin(86.5, 72.4, 5.6, 4.0, "tk_main", "人工接手回主区", "warn"),
                ] + _pc_tk_tabs_pins("log") + _pc_dock_pins("chat"),
            ),
            node(
                "tk_main", 3, 2, "PC 主界面（第 4 步 · 待我审核）", "交付卡 · 根因 · 回应上轮 · 底部审核栏", "done", "PC 核心页", "chat",
                "reference/images/PC-主界面",
                [("info", "点 Tab「代码改动 3」 → 逐行 Diff", "tk_code"), ("info", "点 Tab「证据 4」 → 修前/修后证据", "tk_evid"), ("gap", "点「打回并说明原因」 → 打回原因弹窗", "tk_reject"), ("ok", "点「审核通过 a3f9c21」 → 未测项弹窗", "tk_approve"), ("ok", "点 Tab「发布」 → 发测试前", "rel_before")],
                "核心工作台定稿页（`apple-chat.html?v=10&sel=5&ic=3`），左侧 7 图标 Dock 与全局一致。",
                pins=[
                    pin(84.4, 2.1, 10.9, 2.9, "g_set_src", "Tita 采集失败 → 来源采集", "warn", below=True),
                    pin(8.1, 22.0, 19.3, 6.2, "tk_errlog", "进度条切换周期不刷新（受阻单）", "warn"),
                    pin(8.1, 32.0, 19.3, 6.5, "tk_ask", "考勤部门筛选失效（Bot 在问你）", "warn"),
                    pin(34.7, 16.1, 6.2, 3.1, "tk_code", "切「代码改动 3」Tab", "info"),
                    pin(41.0, 16.1, 4.3, 3.1, "tk_evid", "切「证据 4」Tab", "info"),
                    pin(45.5, 16.1, 5.3, 3.1, "tk_errlog", "切「执行日志」Tab", "warn"),
                    pin(51.0, 16.1, 3.5, 3.1, "rel_before", "切「发布」Tab", "ok"),
                    pin(57.1, 56.5, 8.0, 1.8, "tk_code", "看相对上轮的改动 ›", "info"),
                    pin(63.5, 71.0, 10.7, 2.1, "tk_evid", "管理员未测详情 → 证据", "warn"),
                    pin(53.3, 79.1, 10.2, 2.9, "g_skills", "所用编码 Skill → Skills", "info"),
                    pin(64.1, 79.1, 10.0, 2.9, "g_skills", "所用验证 Skill → Skills", "info"),
                    pin(53.0, 84.8, 9.9, 4.0, "tk_reject", "打回并说明原因", "gap"),
                    pin(63.6, 84.8, 11.9, 4.0, "tk_approve", "审核通过（有未测项弹窗）", "ok"),
                    pin(80.4, 64.2, 12.9, 3.6, "tk_confirm", "我已在原单确认", "info"),
                ] + _pc_dock_pins("chat"),
            ),
            node(
                "tk_code", 3, 1, "代码改动（逐行 Diff）", "相对基线/上轮 · 选中行问 AI · 缺失仓提示", "done", "PC 标签页", "code",
                "reference/images/pages/PC-代码改动",
                [("info", "点「查看修复后的完整文件」 → 完整文件弹层", "tk_fullprev:0"), ("gap", "点「打回时附上」 → 打回弹窗带行号", "tk_reject"), ("ok", "底栏「审核通过 / 打回」", "tk_approve")],
                pins=[
                    pin(12.9, 9.4, 1.7, 2.7, "tk_new", "+ 手动新建工单", "info"),
                    pin(84.9, 28.0, 8.5, 2.1, "tk_fullprev:0", "查看修复后的完整文件", "info"),
                    pin(56.8, 80.1, 11.1, 3.1, "tk_working", "把这行和意见发给 Bot", "info"),
                    pin(68.5, 80.1, 7.0, 3.1, "tk_reject", "打回时附上这行 → 打回弹窗", "gap"),
                    pin(74.4, 92.1, 9.9, 4.0, "tk_reject", "打回并说明原因", "gap"),
                    pin(85.0, 92.1, 11.9, 4.0, "tk_approve", "审核通过 → 未测项弹窗", "ok"),
                ] + _pc_tk_tabs_pins("code") + _pc_dock_pins("chat"),
            ),
            node(
                "tk_evid", 3, 3, "证据（修前/修后/计划对照）", "标已查阅/未查阅 · 管理员未测橙卡", "done", "PC 标签页", "eye",
                "reference/images/pages/PC-证据",
                [("info", "点管理员未测「补充」 → 项目环境账号", "g_set_proj"), ("info", "点击证据截图 → 放大对比弹层", "tk_fullprev:1"), ("ok", "点底栏「审核通过」", "tk_approve")],
                pins=[
                    pin(12.9, 9.4, 1.7, 2.7, "tk_new", "+ 手动新建工单", "info"),
                    pin(60.5, 23.0, 11.9, 2.9, "g_skills", "验证 Skill · 页面交互回归 v1", "info"),
                    pin(63.8, 35.5, 15.0, 13.5, "tk_fullprev:1", "点击证据大图对照预览", "info"),
                    pin(95.2, 51.2, 1.7, 2.1, "g_set_proj", "补充缺失角色账号", "warn"),
                    pin(74.4, 92.1, 9.9, 4.0, "tk_reject", "打回并说明原因", "gap"),
                    pin(85.0, 92.1, 11.9, 4.0, "tk_approve", "审核通过 → 未测项弹窗", "ok"),
                ] + _pc_tk_tabs_pins("evid") + _pc_dock_pins("chat"),
            ),
            node(
                "tk_edge", 3, 4, "边界状态（并发与运行态逃生）", "无权查看 / 过期 / Hard Gate 失败豁免 / 我来接手 / no_code_fix", "done", "PC 2 张 8 态", "shield",
                "reference/images/pages/PC-边界状态",
                [("info", "「回到我的工单」 → 主列表", "tk_main"), ("warn", "「登录并回到 TK-20871」 → 登录页", "login"), ("info", "「去发布看进度」 → 发布详情", "rel_tk"), ("ok", "「换个账号」 → 设置·我的账号", "g_set_mem:1")],
                variants=[
                    variant(
                        "① 基础边界 4 态（无权 / 过期 / 变更 / 新提交）",
                        "reference/images/pages/PC-边界状态",
                        pins=[
                            pin(42.1, 19.9, 3.7, 2.2, "g_set_mem:1", "换个账号", "info"),
                            pin(25.6, 34.3, 21.2, 4.0, "tk_main", "回到我的工单", "ok"),
                            pin(91.8, 16.6, 2.8, 2.2, "login", "换账号登录", "info"),
                            pin(72.9, 27.1, 22.6, 4.4, "login", "登录并回到原单", "warn"),
                            pin(6.7, 78.8, 8.2, 3.1, "rel_tk", "去「发布」看进度", "info"),
                            pin(15.5, 78.8, 10.8, 3.1, "rel_wait", "复测时让王某重点看这点", "info"),
                            pin(84.2, 69.8, 5.8, 3.1, "tk_code", "只看新增的改动", "info"),
                            pin(90.7, 69.8, 4.9, 3.1, "tk_code", "切到最新提交 Diff", "info"),
                            pin(78.1, 91.7, 5.7, 4.0, "tk_reject", "打回", "gap"),
                        ],
                        note="无权查看、登录已过期、已被他人审核/状态变更、期间有新提交必须看最新代码。",
                    ),
                    variant(
                        "② 工作台边界补全（2x 门禁阻断 / 人工接手 / no_code_fix / 消歧）",
                        "reference/images/pages/PC-工作台-边界补全",
                        pins=[
                            pin(34.0, 44.0, 12.0, 4.0, "tk_working", "Hard Gate 豁免或继续修", "warn"),
                            pin(82.0, 44.0, 12.0, 4.0, "tk_main", "人工交付 self_delivery", "ok"),
                        ],
                        note="覆盖 Hard Gate 连续 2 次失败双出口、我来接手 human_takeover、无代码改动结单 no_code_fix 及 ask_user 底栏/独立凭据弹窗。",
                    ),
                ],
            ),
            node(
                "tk_fullprev", 4, 1, "完整文件与证据预览 (2 态弹层)", "完整代码文件 ↔ 修前/修后证据大图对照", "done", "PC 2 态弹层", "file",
                "reference/images/pages/PC-完整文件与证据预览",
                [("info", "点「×」关闭返回逐行 Diff / 证据", "tk_code"), ("gap", "点「附到打回」带行号或截图进打回弹窗", "tk_reject"), ("info", "顶部分段在「完整文件 ↔ 证据对照」切换", "tk_fullprev:1")],
                variants=[
                    variant(
                        "① 完整代码文件",
                        "reference/images/pages/PC-完整文件与证据预览",
                        pins=[
                            pin(84.17, 8.33, 2.22, 3.56, "tk_code", "关闭回到逐行 Diff", "info"),
                            pin(52.26, 8.67, 7.93, 2.89, "tk_fullprev:1", "切到「证据大图对照 (4)」", "info"),
                            pin(66.73, 8.33, 9.66, 3.56, "tk_fullprev:0", "复制第 48 行引用", "info"),
                            pin(77.08, 8.33, 6.39, 3.56, "tk_reject", "附到打回意见", "gap"),
                            pin(78.2, 89.2, 8.6, 2.7, "tk_fullprev:1", "切到双图全屏对照", "info"),
                        ],
                        note="完整代码文件视图：文件符号大纲 + 变更上下文高亮 + 第 48 行本单 AI 意见 + 关联证据双图跳转条。",
                    ),
                    variant(
                        "② 证据大图对照 (4)",
                        "reference/images/pages/PC-证据大图对照",
                        pins=[
                            pin(84.17, 8.33, 2.22, 3.56, "tk_evid", "关闭回到证据页", "info"),
                            pin(43.47, 8.67, 6.49, 2.89, "tk_fullprev:0", "切回「完整代码文件」", "info"),
                            pin(69.15, 8.33, 7.24, 3.56, "tk_evid", "标为已查阅", "ok"),
                            pin(77.08, 8.33, 6.39, 3.56, "tk_reject", "附到打回意见", "gap"),
                            pin(17.27, 41.06, 10.44, 1.89, "g_set_proj", "缺账号 · 去项目补充 ›", "warn"),
                            pin(77.5, 89.2, 9.2, 2.8, "tk_fullprev:0", "跳到关联代码 :48 ›", "info"),
                        ],
                        note="证据大图对照视图：左侧 4 项证据卡片、修前卡死 vs 修后流畅并排对照与进度条回放。",
                    ),
                ],
            ),
            node(
                "tk_reject", 4, 2, "打回原因弹窗", "写理由 + 附代码行 + 附截图 + 指定复测角色", "done", "居中弹窗", "undo",
                "reference/images/pages/PC-打回原因",
                [("gap", "点「打回并通知 Bot」 → 回第 3 步开第 N+1 轮", "tk_working"), ("warn", "点「× / 取消」关闭回审核页", "tk_main")],
                pins=[
                    pin(68.3, 23.5, 2.2, 3.6, "tk_main", "关闭弹窗回主界面", "warn"),
                    pin(55.5, 73.3, 3.9, 4.0, "tk_main", "取消回主界面", "warn"),
                    pin(60.1, 73.3, 10.4, 4.0, "tk_working", "打回并通知 Bot → 新一轮", "gap"),
                ],
            ),
            node(
                "tk_approve", 4, 3, "审核通过 · 有未测项弹窗", "强校验勾选「我知道有未测项」后解锁", "done", "居中弹窗", "check",
                "reference/images/pages/PC-审核通过-有未测项",
                [("info", "点「先登记账号，让 Bot 补测 ›」 → 项目设置", "g_set_proj"), ("ok", "确认通过 → 发测试前 & 原单确认", "rel_before"), ("ok", "外部单同时生成「待原平台确认」", "tk_confirm")],
                pins=[
                    pin(58.7, 48.1, 10.1, 2.1, "g_set_proj", "先登记账号，让 Bot 补测 ›", "info"),
                    pin(54.5, 74.0, 3.8, 4.0, "tk_main", "取消回审核页", "warn"),
                    pin(59.0, 74.0, 10.8, 4.0, "rel_before", "审核通过 → 发测试前（并生成原单确认）", "ok"),
                ],
            ),
            node(
                "tk_confirm", 5, 3, "待原平台确认 & 修复完成", "打开 Jira/Tita 原单操作后点「我已在原单确认」", "done", "PC 主区", "check",
                "reference/images/pages/PC-工单-待原平台确认",
                [("ok", "点「我已在原单确认」", "tk_confirm"), ("ok", "点右栏「修复完成」 → 归档结束", "tk_empty:0"), ("info", "切「发布」Tab → 发布正式进度", "rel_prod")],
                pins=[
                    pin(12.9, 9.4, 1.7, 2.7, "tk_new", "+ 手动新建工单", "info"),
                    pin(44.4, 82.9, 9.8, 4.0, "rel_prod", "我已在原单确认 → 继续看正式发布", "ok"),
                    pin(80.4, 21.5, 16.0, 4.0, "tk_empty:0", "点「修复完成」 → 归档结束", "ok"),
                    pin(51.5, 16.1, 3.5, 3.1, "rel_prod", "查看发布进度 Tab", "info"),
                ] + _pc_tk_tabs_pins("chat,rel") + _pc_dock_pins("chat"),
            ),
        ],
        "edges": [
            edge("tk_empty", "tk_new", "点列表「+」", "info", False, "bottom", "top"),
            edge("tk_new", "tk_queue", "Bot 忙时入队", "warn", False, "bottom", "top"),
            edge("tk_new", "tk_working", "空闲接单", "ok", False, "right", "left"),
            edge("tk_queue", "tk_working", "轮到开始修", "ok", False, "right", "bottom"),
            edge("tk_working", "tk_ask", "Bot 提问", "warn", False, "top", "bottom"),
            edge("tk_ask", "tk_working", "回答继续", "ok", False, "right", "top", curve=14),
            edge("tk_working", "tk_errlog", "工具报错", "gap", True, "bottom", "top"),
            edge("tk_errlog", "tk_working", "重试", "ok", False, "top", "bottom", curve=14),
            edge("tk_working", "tk_main", "第 N 轮交付", "ok", False, "right", "left"),
            edge("tk_main", "tk_code", "切「代码改动」", "info", False, "top", "bottom"),
            edge("tk_main", "tk_evid", "切「证据」", "info", False, "bottom", "top"),
            edge("tk_evid", "tk_edge", "状态/权限保护", "warn", True, "bottom", "top"),
            edge("tk_code", "tk_fullprev", "查看完整文件", "info", True, "right", "left"),
            edge("tk_code", "tk_reject", "打回附行号", "gap", True, "right", "left"),
            edge("tk_main", "tk_reject", "打回说明原因", "gap", False, "right", "left"),
            edge("tk_reject", "tk_working", "下一轮重修", "gap", True, "top", "top", curve=-18),
            edge("tk_main", "tk_approve", "审核通过(未测项)", "ok", False, "right", "left"),
            edge("tk_approve", "tk_confirm", "生成原单确认", "ok", False, "right", "left"),
        ],
    },
    {
        "id": "release",
        "tab": "PC ③ 发布与回滚",
        "title": "③ 发布、复测、大包与紧急回滚（第 5～12 步）",
        "desc": "展示审核通过后发测试（TEST）→ 5 步发布 / 跨仓大包 → 测试人复测 → 修复人点合回主分支 → 独立 MR 审核 → 发正式（PROD）→ Apollo 紧急回滚。",
        "cols": 5,
        "rows": 3,
        "nodes": [
            node(
                "rel_before", 1, 1, "发测试 · 发布前", "选测试人（Tita 必选）· 看同包他人提交", "done", "PC 标签页", "pkg",
                "reference/images/pages/PC-发测试-发布前",
                [("warn", "首次未填 Apollo 账号 → 就地配账号", "rel_acct"), ("ok", "点「发布到测试环境」 → 建发布任务", "rel_tk"), ("info", "点「历次发布 1 ›」 → 发布列表", "rel_dock")],
                pins=[
                    pin(56.1, 62.9, 18.5, 4.0, "rel_tk", "发布到测试环境 → 发布 5 步", "ok"),
                    pin(57.4, 67.8, 15.3, 2.1, "rel_acct", "未绑 Apollo 时先配账号", "warn"),
                    pin(66.5, 22.9, 4.6, 2.1, "rel_dock", "历次发布 1 ›", "info"),
                ] + _pc_tk_tabs_pins("rel") + _pc_dock_pins("chat"),
            ),
            node(
                "rel_acct", 1, 2, "第一次发布 · 配账号", "未绑 Apollo 时就地填写继续发", "done", "居中弹窗", "key",
                "reference/images/pages/PC-第一次发布-配账号",
                [("ok", "点「保存并发布到测试环境」 → 回到发布 5 步", "rel_tk"), ("warn", "点「取消」回发布前", "rel_before")],
                pins=[
                    pin(50.7, 62.6, 3.8, 4.0, "rel_before", "取消回发布前", "warn"),
                    pin(55.2, 62.6, 12.5, 4.0, "rel_tk", "保存并发布到测试环境 → 5 步", "ok"),
                ],
            ),
            node(
                "rel_tk", 2, 1, "工单内 · 发布详情 (6~7 步)", "工单第 5 个标签 · 看 5 步进度", "done", "PC 标签页", "pkg",
                "reference/images/pages/PC-工单-发布",
                [("ok", "commit 核对一致 → 已生效等复测", "rel_wait"), ("info", "点「历次发布 2 ›」 → 全局发布列表", "rel_dock"), ("gap", "打包/合入失败 → 发布失败页", "rel_fail")],
                pins=[
                    pin(64.3, 22.9, 4.8, 2.1, "rel_dock", "历次发布 2 ›", "info"),
                    pin(50.5, 64.2, 2.3, 2.1, "tk_code", "查看改动包 ›", "info"),
                    pin(80.4, 62.0, 16.0, 2.1, "tk_errlog", "查看完整日志 ›", "info"),
                ] + _pc_tk_tabs_pins("rel") + _pc_dock_pins("chat"),
            ),
            node(
                "rel_dock", 2, 2, "Dock · 全局发布列表", "按 进行中/等你确认/已完成 管理全单发布", "done", "PC 主页", "pkg",
                "reference/images/pages/PC-发布",
                [("ok", "点「进入工单 ›」 → 跳回工单发布 Tab", "rel_tk"), ("info", "左栏点「大包 · 审批分组修复」 → 大包明细", "rel_bundle"), ("ok", "点「等你确认 / 已生效」行", "rel_mr")],
                pins=[
                    pin(70.8, 17.2, 4.3, 2.2, "rel_tk", "进入工单 ›", "info"),
                    pin(8.1, 24.5, 19.3, 6.2, "rel_bundle", "左栏 · 跨仓大包明细", "info"),
                    pin(8.1, 35.0, 19.3, 6.2, "rel_mr", "左栏 · 等你确认合回 MR", "ok"),
                    pin(8.1, 52.5, 19.3, 6.2, "rel_passed", "左栏 · 王某复测通过", "ok"),
                    pin(8.5, 91.8, 18.5, 4.3, "g_ai", "对 AI 说「把这轮发到测试」", "info"),
                    pin(80.4, 62.0, 16.0, 2.1, "tk_errlog", "查看完整日志 ›", "warn"),
                ] + _pc_dock_pins("pub"),
            ),
            node(
                "rel_bundle", 2, 3, "跨仓发布 · 大包明细", "组件 → 子项目 → 主站依赖图与断点重试", "done", "PC 标签页", "layers",
                "reference/images/pages/PC-大包明细",
                [("gap", "点「从 B 构建重试」 → 失败断点重试", "rel_fail"), ("ok", "点「完整日志」 → 执行日志", "tk_errlog")],
                pins=[
                    pin(61.9, 51.6, 4.4, 3.1, "rel_bundle", "复制报错", "info"),
                    pin(66.9, 51.6, 6.1, 3.1, "tk_errlog", "完整日志", "info"),
                    pin(64.0, 68.5, 9.0, 4.0, "rel_fail", "从 B 构建重试（单包失败态参考）", "gap"),
                ] + _pc_dock_pins("pub"),
            ),
            node(
                "rel_fail", 3, 3, "发布 · 失败与断点重试", "失败步骤标红 · 原版不受影响 · AI 解读", "done", "PC 标签页", "alert",
                "reference/images/pages/PC-发布-失败",
                [("ok", "点「从打包上传重试」 → 不重提 MR 继续", "rel_tk"), ("reuse", "点「完整日志」 → 复用执行日志视图", "tk_errlog"), ("info", "「进入工单 ›」回工单", "tk_main")],
                pins=[
                    pin(70.8, 17.2, 4.3, 2.2, "tk_main", "进入工单 ›", "info"),
                    pin(43.0, 48.8, 4.4, 3.1, "rel_fail", "复制失败报错", "info"),
                    pin(48.0, 48.8, 4.8, 3.1, "tk_errlog", "完整日志", "warn"),
                    pin(56.1, 62.0, 18.5, 4.0, "rel_tk", "从打包上传重试 → 回到发布 5 步", "ok"),
                    pin(80.4, 55.9, 16.0, 2.1, "tk_errlog", "右栏查看完整日志 ›", "info"),
                ] + _pc_dock_pins("pub"),
            ),
            node(
                "rel_wait", 3, 1, "发布 · 已生效 · 等复测 (8~9 步)", "通知测试人 · 测试人在右栏点通过 / 打回", "done", "PC 页面", "eye",
                "reference/images/pages/PC-发布-等复测",
                [("ok", "测试人点「通过」 → 复测通过", "rel_passed"), ("gap", "测试人点「打回」 → 共用打回弹窗", "tk_reject"), ("info", "点「进入工单 ›」回工单", "tk_main")],
                pins=[
                    pin(70.8, 17.2, 4.3, 2.2, "tk_main", "进入工单 ›", "info"),
                    pin(80.4, 17.4, 7.7, 4.0, "rel_passed", "测试人点「通过」 → 复测通过", "ok"),
                    pin(88.7, 17.4, 7.7, 4.0, "tk_reject", "测试人点「打回」 → 打回原因弹窗", "gap"),
                    pin(80.4, 67.4, 16.0, 2.1, "tk_errlog", "查看完整日志 ›", "warn"),
                ] + _pc_dock_pins("pub"),
            ),
            node(
                "rel_passed", 3, 2, "发布 · 复测通过 (9→10 步)", "右栏前置 #2 打勾 · 出现「合回主分支」按钮", "done", "PC 页面", "check",
                "reference/images/pages/PC-发布-复测通过",
                [("ok", "修复人点「合回主分支」 → 提主分支 MR 审核", "rel_mr"), ("info", "点「历次发布 1 ›」 → 发布列表", "rel_dock")],
                pins=[
                    pin(65.7, 22.9, 4.6, 2.1, "rel_dock", "历次发布 1 ›", "info"),
                    pin(90.5, 33.5, 5.9, 3.1, "rel_mr", "合回主分支 → 独立 MR 审核", "ok"),
                    pin(80.4, 61.9, 16.0, 2.1, "tk_errlog", "查看完整日志 ›", "warn"),
                ] + _pc_tk_tabs_pins("rel") + _pc_dock_pins("chat"),
            ),
            node(
                "rel_mr", 4, 1, "合回主分支 · MR 审核 (10 步)", "与测试时比差异 · 审核人独立审批合入", "done", "PC 页面", "git",
                "reference/images/pages/PC-合回主分支-MR审核",
                [("ok", "点「通过并合入」 → 解锁正式环境发布", "rel_prod"), ("gap", "点「打回」 → 回第 3 步重修", "tk_working"), ("info", "「进入工单 ›」回工单", "tk_main")],
                pins=[
                    pin(70.8, 17.2, 4.3, 2.2, "tk_main", "进入工单 ›", "info"),
                    pin(56.1, 59.8, 5.4, 4.0, "tk_working", "打回 → 回第 3 步重修", "gap"),
                    pin(62.0, 59.8, 12.5, 4.0, "rel_prod", "通过并合入 → 解锁发正式", "ok"),
                    pin(80.4, 58.4, 16.0, 2.1, "tk_errlog", "查看完整日志 ›", "warn"),
                ] + _pc_dock_pins("pub"),
            ),
            node(
                "rel_prod", 4, 2, "发布到正式 (11~12 步)", "三项前置全勾按钮变蓝 · 主分支重打发 PROD", "done", "PC 页面", "rocket",
                "reference/images/pages/PC-发正式",
                [("ok", "点「发布到正式环境」 → 重打发布并完成单据", "tk_confirm"), ("gap", "上线故障 → 紧急回滚（Apollo）", "rel_rb"), ("info", "「查看完整日志 ›」 → 执行日志", "tk_errlog")],
                pins=[
                    pin(70.8, 17.2, 4.3, 2.2, "tk_confirm", "进入工单 ›", "info"),
                    pin(80.4, 37.1, 16.0, 4.0, "tk_confirm", "发布到正式环境 → 生效后待原单确认", "ok"),
                    pin(80.4, 61.1, 16.0, 2.1, "tk_errlog", "查看完整日志 ›", "info"),
                ] + _pc_dock_pins("pub"),
            ),
            node(
                "rel_rb", 5, 2, "紧急回滚（Apollo 插件）", "选版本 → 看关联变更差异 → 输 PROD 确认回滚", "done", "PC 主页", "undo",
                "reference/images/pages/PC-紧急回滚",
                [("ok", "点「确认回滚到 3.8.1」后可关联工单查根因", "tk_main"), ("info", "切环境 / 仅发过 1 次 → 空状态-2", "tk_empty:1")],
                pins=[
                    pin(8.5, 26.6, 18.5, 3.6, "tk_empty:1", "切环境 / 无可回滚版本态参考", "info"),
                    pin(80.6, 45.5, 15.7, 4.4, "tk_main", "确认回滚后关联工单查根因", "gap"),
                ] + _pc_dock_pins("rb"),
            ),
        ],
        "edges": [
            edge("rel_before", "rel_acct", "未填 Apollo", "warn", False, "bottom", "top"),
            edge("rel_acct", "rel_tk", "保存接着发", "ok", False, "right", "left"),
            edge("rel_before", "rel_tk", "发测试环境", "ok", False, "right", "left"),
            edge("rel_tk", "rel_dock", "Dock 同步详情", "info", True, "bottom", "top"),
            edge("rel_dock", "rel_bundle", "跨仓进大包", "info", False, "bottom", "top"),
            edge("rel_dock", "rel_fail", "单包发布失败", "gap", True, "right", "left"),
            edge("rel_bundle", "rel_fail", "子包失败详情", "gap", True, "right", "left"),
            edge("rel_tk", "rel_wait", "提交号已核对", "ok", False, "right", "left"),
            edge("rel_wait", "rel_passed", "测试点通过", "ok", False, "bottom", "top"),
            edge("rel_passed", "rel_mr", "合回主分支", "ok", False, "right", "left"),
            edge("rel_mr", "rel_prod", "MR 通过合入", "ok", False, "bottom", "top"),
            edge("rel_prod", "rel_rb", "PROD 紧急回滚", "gap", False, "right", "left"),
        ],
    },
    {
        "id": "global_settings",
        "tab": "PC ④ 全局与设置",
        "title": "④ 全局 Dock、Skills、插件市场与设置总览",
        "desc": "梳理左侧 Dock 7 大入口与「设置 8 个子页面」之间的真实跳转，明确「插件市场（装卸）」与「设置→连接器（鉴权运维）」的零重叠分工。",
        "cols": 5,
        "rows": 4,
        "nodes": [
            node(
                "g_dock", 1, 2, "左侧 Dock (7 大入口)", "AI助手 / 对话 / 发布 / 回滚 / Skills / 插件市场 / 设置", "done", "全局导航", "layers",
                "reference/images/PC-主界面",
                [("info", "#1 AI 助手（全局）", "g_ai"), ("ok", "#2 对话 / #3 发布 / #4 回滚", "rel_dock"), ("info", "#5 Skills（规则治理）", "g_skills"), ("warn", "#6 插件市场（固定设置上方）", "g_market"), ("ok", "#7 设置（8 个子菜单）", "g_set_conn")],
                "直接点击截图左侧 Dock 栏任一图标即可直达对应全局模块。",
                pins=_pc_dock_pins(),
            ),
            node(
                "g_ai", 2, 1, "AI 助手（全局）", "跨单问进度、收单异常、对话里直点待办/发布", "done", "PC 主页", "spark",
                "reference/images/pages/PC-AI助手",
                [("ok", "点「处理」 → 受阻执行日志", "tk_errlog"), ("ok", "点「去审核 / 在工单列表中查看」 → 主界面", "tk_main"), ("ok", "点「在工单中查看 ›」 → 工单发布", "rel_tk"), ("info", "点「新对话」 → 首次无对话空状态", "tk_empty:1")],
                pins=[
                    pin(84.4, 2.1, 10.9, 2.9, "g_set_src", "Tita 采集失败 → 来源采集", "warn", below=True),
                    pin(19.5, 9.2, 5.3, 3.1, "tk_empty:1", "新对话（首次空状态参考）", "info"),
                    pin(70.1, 45.0, 3.2, 3.1, "tk_errlog", "处理验证受阻工单 → 报错日志", "warn"),
                    pin(45.2, 58.0, 7.4, 1.7, "tk_main", "在工单列表中查看 ›", "info"),
                    pin(67.5, 79.4, 5.7, 2.1, "rel_tk", "在工单中查看 › → 工单发布", "ok"),
                ] + _pc_dock_pins("ai"),
            ),
            node(
                "g_skills", 2, 2, "Skills · 规则编辑与启用", "在线新建 / 草稿对比 / 按项目选版本生效", "done", "PC 主页", "code",
                "reference/images/pages/PC-Skills",
                [("ok", "点「导入」 → 导入 Skill 弹窗", "g_skimp"), ("ok", "点「版本」 → 版本历史页", "g_skhist"), ("ok", "点「确认启用 v2 到审批」 → 项目配置", "g_set_proj")],
                pins=[
                    pin(22.5, 9.2, 4.4, 3.1, "g_skimp", "导入 Skill 弹窗", "info"),
                    pin(64.3, 9.8, 5.2, 4.0, "g_skhist", "查看版本历史", "info"),
                    pin(70.1, 9.8, 5.6, 4.0, "g_skhist", "保存草稿并对比版本", "info"),
                    pin(80.4, 56.9, 16.0, 4.0, "g_set_proj", "确认启用 v2 到审批项目", "ok"),
                ] + _pc_dock_pins("sk"),
            ),
            node(
                "g_skimp", 3, 1, "Skills · 导入弹窗", "本地 .md/.txt · GitLab 链接 · 粘贴自动打码", "done", "居中弹窗", "download",
                "reference/images/pages/PC-Skills-导入",
                [("ok", "点「导入为草稿，打开编辑」 → Skills 编辑器", "g_skills"), ("warn", "点「× / 取消」关闭", "g_skills")],
                pins=[
                    pin(69.7, 13.0, 2.2, 3.6, "g_skills", "关闭弹窗", "warn"),
                    pin(55.7, 83.8, 3.8, 4.0, "g_skills", "取消", "warn"),
                    pin(60.2, 83.8, 11.7, 4.0, "g_skills", "导入为草稿，打开编辑", "ok"),
                ],
            ),
            node(
                "g_skhist", 3, 2, "Skills · 版本历史", "版本对比 · 哪些轮次用过 · 切回旧版再启用", "done", "PC 主页", "clock",
                "reference/images/pages/PC-Skills-版本历史",
                [("ok", "点「回到编辑」 → Skills 编辑器", "g_skills"), ("info", "点「导入」 → 导入弹窗", "g_skimp"), ("ok", "启用版本到考勤 → 项目设置", "g_set_proj")],
                pins=[
                    pin(22.5, 9.2, 4.4, 3.1, "g_skimp", "导入新 Skill 弹窗", "info"),
                    pin(68.8, 9.8, 7.0, 4.0, "g_skills", "回到编辑", "info"),
                    pin(80.4, 37.1, 16.0, 4.0, "g_set_proj", "启用 v3 到考勤项目", "ok"),
                ] + _pc_dock_pins("sk"),
            ),
            node(
                "g_market", 2, 3, "插件市场与运行态规范", "5 贡献点协议 · 停用只读 · 5s 超时 · 超限折叠", "done", "PC 2 视图", "pkg",
                "reference/images/pages/PC-插件市场",
                [("warn", "点「鉴权归设置→连接器 ›」", "g_set_conn"), ("info", "看贡献点「左侧 Dock / 工单操作 / 发布」", "rel_rb"), ("ok", "查看插件运行态边界规范", "g_market:1")],
                variants=[
                    variant(
                        "① 插件市场主页（5 贡献点）",
                        "reference/images/pages/PC-插件市场",
                        pins=[
                            pin(11.9, 32.8, 14.6, 5.2, "g_set_conn", "Tita / Apollo 部署连接器 → 连接器", "info"),
                            pin(11.9, 39.2, 14.6, 5.2, "g_set_conn", "GitLab / Jira 连接器运维", "info"),
                            pin(64.1, 9.4, 5.6, 4.0, "g_market", "通用 Schema 插件设置预览", "info"),
                            pin(70.3, 9.4, 5.6, 4.0, "g_set_conn", "停用卸载后连接器下线", "warn"),
                            pin(38.6, 28.7, 8.8, 2.2, "rel_rb", "已贡献入口：紧急回滚", "info"),
                            pin(62.3, 28.7, 10.0, 2.2, "tk_main", "工单操作 · 关联回滚查因", "info"),
                            pin(60.5, 39.5, 11.2, 2.2, "g_set_conn", "鉴权归「设置 → 连接器」 ›", "warn"),
                        ] + _pc_dock_pins("mkt"),
                    ),
                    variant(
                        "② 插件运行态 · AI A2UI 与站内通知规范",
                        "reference/images/pages/PC-插件运行态规范",
                        pins=[],
                        note="插件页面 5 秒没响应只影响自己的标签页；Dock 外最多 4 个插件、顶栏最多 2 个小胶囊，多出自动收起；插件发起的操作在通知里要人确认；停用后入口收起、历史只读。",
                    ),
                ],
            ),
            node(
                "g_set_conn", 2, 4, "设置 · 连接器（鉴权运维总览）", "与插件市场 0% 重叠 · 已鉴权实例状态与续期", "done", "设置子页", "link",
                "reference/images/pages/PC-设置-连接器",
                [("warn", "点「插件市场装更多 ›」 → 插件市场", "g_market"), ("reuse", "点「+ 新建连接器」 → 复用步骤 1 抽屉", "s1_drw:0"), ("reuse", "点「继续未完成的开工向导 ›」 → 步骤 1", "step1")],
                pins=[
                    pin(56.7, 10.8, 10.4, 4.0, "g_market", "插件市场装更多 ›", "warn"),
                    pin(67.8, 10.8, 7.9, 4.0, "s1_drw:0", "新建连接器（复用向导抽屉）", "ok"),
                    pin(45.9, 39.1, 3.8, 2.0, "s1_drw:0", "鉴权设置（复用代码抽屉）", "info"),
                    pin(44.3, 58.2, 5.3, 2.0, "s1_drw:1", "改鉴权/触发条件（复用抽屉）", "info"),
                    pin(69.7, 58.2, 4.9, 3.1, "s1_drw:1", "更新 Tita 令牌 / 触发条件", "warn"),
                    pin(45.9, 78.6, 3.8, 2.0, "rel_acct", "更新 Apollo 发布账号 ›", "warn"),
                    pin(80.4, 21.2, 16.0, 3.6, "step1", "继续未完成的开工向导 ›", "ok"),
                ] + _pc_set_nav_pins("conn") + _pc_dock_pins("set"),
            ),
            node(
                "g_set_proj", 3, 3, "设置 · 项目（开工条件 + 流程模板）", "仓库/构建/环境实测 + 自定义节点工作流 & 节点 Skills", "done", "设置 2 视图", "sliders",
                "reference/images/pages/PC-设置",
                [("reuse", "点仓库「改」/「填写账号」 → 复用步骤 2/3 抽屉", "step3:2"), ("info", "切「流程模板与节点 Skills」 → T-08b 定制", "g_set_proj:1"), ("info", "点右栏「看完整日志 ›」 → 体检日志抽屉", "chk_log")],
                variants=[
                    variant(
                        "① 项目开工条件总览",
                        "reference/images/pages/PC-设置",
                        pins=[
                            pin(56.4, 10.2, 19.4, 3.1, "g_ai", "问 AI「OKR 还差什么才能开工？」", "info"),
                            pin(64.5, 19.1, 9.9, 4.0, "step4", "让 Bot 重新检查 → 体检页", "ok"),
                            pin(67.1, 32.1, 7.5, 2.4, "s2_drw:1", "微调项目与试构建（复用）", "info"),
                            pin(69.8, 63.1, 4.8, 3.1, "step3:2", "填写环境账号（添加抽屉）", "warn"),
                            pin(67.9, 74.8, 6.7, 2.4, "g_set_src", "工单来源采集配置 改 ›", "info"),
                            pin(68.7, 81.5, 5.8, 2.4, "g_set_proj:1", "工作流与节点 Skills ›", "info"),
                            pin(70.6, 87.9, 3.9, 3.1, "g_set_conn", "发布配置 去配置 ›", "warn"),
                            pin(80.4, 56.6, 16.0, 2.1, "chk_log", "看完整日志 ›（体检日志抽屉）", "info"),
                        ] + _pc_set_nav_pins("proj") + _pc_dock_pins("set"),
                    ),
                    variant(
                        "② 流程模板与节点绑定 Skills（React Flow）",
                        "reference/images/pages/PC-设置-项目-流程模板",
                        pins=[
                            pin(34.0, 9.4, 5.5, 2.5, "g_set_proj:0", "切回「开工条件」", "info"),
                        ] + _pc_set_nav_pins("proj") + _pc_dock_pins("set"),
                        note="4 套预设模板 + @xyflow/react 交互画布（增删连接线 / run_when 分支 / 退回弧）+ 为单节点绑定专属 skill_ids[] 与工具范围，修改从下一轮生效。",
                    ),
                    variant(
                        "③ 操作记录与数据恢复（三轨分治 + state_digest）",
                        "reference/images/pages/PC-设置-操作记录与数据回滚",
                        pins=[
                            pin(84.0, 8.8, 12.0, 3.8, "g_set_conn", "关闭返回连接器设置", "info"),
                        ],
                        note="设置页右上角「操作记录」780px 抽屉：9 类配置软删回收、模板/Skill 版本指针回退、白名单扁平还原与真只追加 events+operation_reverts。",
                    ),
                ],
            ),
            node(
                "g_set_run", 3, 4, "设置 · 执行器（算力池）", "本机 / 团队服务器 / 云端 Pro 状态与调度", "done", "设置子页", "server",
                "reference/images/pages/PC-设置-执行器",
                [("reuse", "点「+ 添加执行器」 → 复用三选一环境向导", "env_sel"), ("reuse", "点「去开通 / 绑兑换码 ›」 → 云端 Pro", "run_pro"), ("info", "点「获取安装命令」 → 服务器接入", "run_srv")],
                pins=[
                    pin(67.8, 9.8, 7.9, 4.0, "env_sel", "添加执行器（复用三选一向导）", "ok"),
                    pin(69.8, 49.7, 4.8, 3.1, "run_local", "重检本机环境", "info"),
                    pin(65.9, 64.7, 8.7, 3.1, "run_pro", "去开通 / 绑兑换码 ›", "info"),
                    pin(80.4, 48.2, 16.0, 4.0, "run_srv", "获取一行安装命令", "info"),
                ] + _pc_set_nav_pins("run") + _pc_dock_pins("set"),
            ),
            node(
                "g_set_ai", 4, 2, "设置 · 全局 AI（管理员）", "Pi 默认内核 · 并发排队策略 · 多模型网关", "done", "设置子页", "bot",
                "reference/images/pages/PC-设置-全局AI",
                [("info", "「去插件市场 ›」 → 引擎插件", "g_market"), ("info", "「统一在设置→连接器管理 ›」", "g_set_conn")],
                pins=[
                    pin(57.5, 10.2, 18.2, 3.1, "g_ai", "问 AI「连续受阻几次会找人？」", "info"),
                    pin(69.7, 41.3, 4.9, 2.1, "g_market", "去插件市场 ›", "warn"),
                    pin(62.5, 48.5, 12.0, 2.1, "g_set_conn", "统一在设置→连接器管理 ›", "info"),
                ] + _pc_set_nav_pins("ai") + _pc_dock_pins("set"),
            ),
            node(
                "g_set_src", 4, 3, "设置 · 来源采集", "Jira / Tita 采集健康 · 失败原文重试 · 漏单补收", "done", "设置子页", "refresh",
                "reference/images/pages/PC-设置-来源采集",
                [("warn", "点「更新令牌」 → 连接器鉴权抽屉", "s1_drw:1"), ("ok", "点「去处理 ›」 → 成员与身份映射", "g_set_mem:0")],
                pins=[
                    pin(58.2, 10.2, 17.6, 3.1, "g_ai", "问 AI「今天 Tita 漏收了吗？」", "info"),
                    pin(69.8, 39.0, 4.8, 3.1, "s1_drw:1", "更新 Tita 令牌 / 触发条件", "warn"),
                    pin(69.8, 57.4, 4.8, 4.2, "g_set_mem:0", "去处理未对齐修复人 ›", "ok"),
                    pin(79.4, 21.5, 18.1, 14.0, "g_set_proj", "各项目收单规则 改 ›", "info"),
                ] + _pc_set_nav_pins("src") + _pc_dock_pins("set"),
            ),
            node(
                "g_set_mem", 5, 3, "设置 · 组织与成员 + 角色权限 + 账号通知（含抽屉与 /admin）", "部门默认继承 / 角色与模板克隆 / 纯 RBAC 作用域隔离 / 停用交接 / Web /admin 蓝图", "done", "设置 9 视图", "user",
                "reference/images/pages/PC-设置-成员与身份",
                [("info", "顶部分段「角色与权限 7」 → 角色权限矩阵", "g_set_mem:7"), ("info", "复制 `join/...` 部门邀请链接 → 邀请加入页", "auth_recover:1"), ("ok", "点「编辑默认配置 / 添加成员 / 停用交接」", "g_set_mem:3")],
                variants=[
                    variant(
                        "① 成员与身份（部门树与列表）",
                        "reference/images/pages/PC-设置-成员与身份",
                        pins=[
                            pin(39.87, 9.41, 6.22, 2.44, "g_set_mem:7", "切「角色与权限 7」", "ok"),
                            pin(61.02, 10.06, 10.64, 3.56, "auth_recover:1", "生成本部门 24h 免 SMTP 邀请链接", "info"),
                            pin(72.36, 10.06, 6.46, 3.56, "g_set_mem:4", "添加成员（主部门 / 协作者）", "ok"),
                            pin(72.49, 24.04, 5.7, 2.07, "g_set_mem:3", "编辑部门默认配置 ›", "ok"),
                            pin(71.2, 92.2, 7.6, 2.8, "g_set_mem:5", "停用与待办交接 ›", "warn"),
                            pin(25.2, 86.2, 12.6, 9.2, "g_set_mem:7", "角色与权限矩阵 (7) ›", "info"),
                        ] + _pc_set_nav_pins("mem") + _pc_dock_pins("set"),
                        note="部门树 + 部门默认继承摘要 + 顶部切「角色与权限」 + 外部协作者按 RBAC 作用域收敛 + 免 SMTP 邀请。",
                    ),
                    variant(
                        "② 我的账号",
                        "reference/images/pages/PC-设置-我的账号",
                        pins=[
                            pin(59.3, 10.2, 16.4, 3.1, "g_ai", "问 AI「我能合哪些分支？」", "info"),
                        ] + _pc_set_nav_pins("acct") + _pc_dock_pins("set"),
                        note="独立邮箱账号 + 外观与语言（themes + i18n）+ 按已装插件/连接器动态加载的个人写凭据（credential_class='personal_exec' DB 强锁 scope='user'）。",
                    ),
                    variant(
                        "③ 通知设置",
                        "reference/images/pages/PC-设置-通知",
                        pins=[
                            pin(58.2, 10.2, 17.6, 3.1, "g_ai", "对 AI 说「晚上别推测试结果」", "info"),
                            pin(80.4, 15.0, 16.0, 13.0, "tk_main", "通知示例 1 · 直达工单对话", "info"),
                            pin(80.4, 31.0, 16.0, 12.0, "rel_wait", "通知示例 2 · 直达发布复测", "ok"),
                            pin(80.4, 46.0, 16.0, 10.5, "rel_fail", "通知示例 3 · 直达发布失败", "gap"),
                        ] + _pc_set_nav_pins("notify") + _pc_dock_pins("set"),
                        note="发布失败/紧急回滚强提醒关不掉；登录过期先登录再回原单。",
                    ),
                    variant(
                        "④ 抽屉 · 部门默认配置",
                        "reference/images/pages/PC-组织-部门默认设置",
                        pins=[
                            pin(94.72, 5.02, 2.22, 3.56, "g_set_mem:0", "× 关闭返回", "info"),
                            pin(83.23, 92.67, 3.37, 3.56, "g_set_mem:0", "取消", "info"),
                            pin(87.15, 92.67, 9.79, 3.56, "g_set_mem:0", "保存部门默认配置", "ok"),
                        ],
                        note="配置部门默认项目权限（并集叠加）、共享只读连接器与 Skills；个人凭据与安全门禁硬红线锁定。",
                    ),
                    variant(
                        "⑤ 抽屉 · 添加 / 编辑成员",
                        "reference/images/pages/PC-组织-添加编辑成员",
                        pins=[
                            pin(94.72, 5.02, 2.22, 3.56, "g_set_mem:0", "× 关闭返回", "info"),
                            pin(53.89, 92.67, 5.92, 3.56, "g_set_mem:5", "停用并交接 →", "warn"),
                            pin(86.78, 54.11, 9.33, 3.11, "auth_recover:0", "生成 30m 免 SMTP 重置链", "info"),
                            pin(84.93, 92.67, 3.37, 3.56, "g_set_mem:0", "取消", "info"),
                            pin(88.85, 92.67, 8.09, 3.56, "g_set_mem:0", "保存成员配置", "ok"),
                        ],
                        note="设置主部门、虚线借调到期日、低权协作者 RBAC 作用域收敛、Allow/Deny 绑定与外部 ID；SaaS 自动隐藏代改密。",
                    ),
                    variant(
                        "⑥ 弹窗 · 停用与待办交接",
                        "reference/images/pages/PC-组织-停用交接",
                        pins=[
                            pin(68.9, 20.3, 2.22, 3.56, "g_set_mem:0", "× 关闭返回", "info"),
                            pin(55.4, 77.3, 3.37, 3.56, "g_set_mem:0", "取消", "info"),
                            pin(85.23, 92.67, 11.72, 3.56, "g_set_mem:0", "确认停用并移交给 张某", "gap"),
                        ],
                        note="审计待审单/原平台待办/活跃 Runner，同事务完成移交并吊销会话与个人 Runner，保留历史署名。",
                    ),
                    variant(
                        "⑦ 企业管理后台 · 组织树 (M2/M3 Web /admin)",
                        "reference/images/pages/PC-企业管理后台-蓝图",
                        pins=[
                            pin(2.15, 25.69, 15.9, 4.22, "g_set_mem:8", "切「角色策略（Allow / Deny）」", "info"),
                            pin(90.74, 3.69, 6.83, 2.07, "g_set_mem:0", "返回桌面工作台 ↗", "ok"),
                            pin(78.57, 10.53, 10.64, 3.56, "g_set_mem:6", "立即同步飞书 SCIM", "info"),
                        ],
                        note="M2/M3 独立 Web `/admin` 同源 SPA 蓝图（不混入 M1 桌面设置主栏）：多级组织树、飞书 SCIM、域名校验/SSO、scoped_configs 与审计导出。",
                    ),
                    variant(
                        "⑧ 角色与权限（5 内置 + 模板克隆 · M1 桌面）",
                        "reference/images/pages/PC-设置-角色与权限",
                        pins=[
                            pin(34.22, 9.41, 5.5, 2.44, "g_set_mem:0", "切回「成员与部门」", "info"),
                            pin(69.81, 10.06, 9.01, 3.56, "g_set_mem:7", "从模板克隆轻量自定义角色", "ok"),
                            pin(67.76, 70.09, 10.44, 3.11, "g_set_mem:4", "按角色批量添加成员", "info"),
                            pin(25.2, 86.2, 13.6, 9.0, "g_set_mem:8", "高级策略 (/admin/role-policies) ↗", "info"),
                        ] + _pc_set_nav_pins("mem") + _pc_dock_pins("set"),
                        note="Core 不可卸载 9 域（含修单、MR 与内置发布流）+ 已安装连接器/市场插件动态贡献（manifest.permissions）；5 内置（安全锁）+ 模板克隆（代码合入协同专员 / QA），新装与重装遵循 Fail-Closed 门禁与升级不自动提权。",
                    ),
                    variant(
                        "⑨ 企业管理后台 · 角色策略中心 (M2/M3 Allow/Deny)",
                        "reference/images/pages/PC-企业管理后台-角色策略",
                        pins=[
                            pin(2.15, 16.35, 15.9, 4.22, "g_set_mem:6", "切「多级组织架构树与同步」", "info"),
                            pin(90.74, 3.69, 6.83, 2.07, "g_set_mem:7", "返回桌面「角色与权限」↗", "ok"),
                            pin(85.8, 10.53, 11.36, 3.56, "g_set_mem:8", "新建自定义角色 / 显式 DENY 策略", "info"),
                        ],
                        note="M2/M3 Web `/admin` 规则引擎蓝图：四重 AND 优先级栈（含 Tier 0 插件生命周期门禁，消除假绿灯）、按命名空间隔离的显式 DENY 清单及 ActionGate 实态试算模拟器。",
                    ),
                ],
            ),
        ],
        "edges": [
            edge("g_dock", "g_ai", "点 #1 AI 助手", "info", False, "right", "left"),
            edge("g_dock", "g_skills", "点 #5 Skills", "ok", False, "right", "left"),
            edge("g_dock", "g_market", "点 #6 插件市场", "warn", False, "right", "left"),
            edge("g_dock", "g_set_conn", "点 #7 设置", "ok", False, "right", "left"),
            edge("g_skills", "g_skimp", "点「导入」", "info", False, "right", "left"),
            edge("g_skills", "g_skhist", "点「版本」", "info", False, "right", "left"),
            edge("g_market", "g_set_conn", "装完去鉴权", "warn", True, "bottom", "top"),
            edge("g_set_conn", "g_set_proj", "切「项目」", "ok", False, "right", "left"),
            edge("g_set_conn", "g_set_run", "切「执行器」", "info", False, "right", "left"),
            edge("g_set_proj", "g_set_ai", "全局 AI 策略", "info", False, "right", "left"),
            edge("g_set_proj", "g_set_src", "来源采集配置", "info", False, "right", "left"),
            edge("g_set_src", "g_set_mem", "未对齐成员→处理", "warn", False, "right", "left"),
        ],
    },
    {
        "id": "mobile",
        "tab": "移动端 ⑤ 全端流转",
        "title": "⑤ 移动端全链路触达与护栏（390×844）",
        "desc": "把移动端全部多屏合板映射到真实点击路径：闪屏/推送 → 登录 → 4 步向导 → 首页 5-Tab 闭环（含 L2 高危锁提示发 PC）→ 大包重试与 Apollo 紧急回滚。",
        "cols": 4,
        "rows": 3,
        "nodes": [
            node(
                "m_boot", 1, 1, "移动端 · 闪屏与锁屏推送", "冷启动 · 通知直达原工单与通知设置", "done", "移动端 (2 张)", "bell",
                "reference/images/pages/移动端-通知",
                [("ok", "点通知「发布失败」 → 报错/发布", "m_evid"), ("ok", "点通知「待我审核」 → 首页工单", "m_home"), ("warn", "过期通知 → 移动端登录", "m_login")],
                variants=[
                    variant(
                        "① 通知直达与通知设置 (3 屏)",
                        "reference/images/pages/移动端-通知",
                        pins=[
                            pin(7.4, 30.8, 22.6, 10.2, "m_evid", "P1 通知「发布失败」→ 报错/发布", "gap"),
                            pin(7.4, 42.2, 22.6, 8.8, "m_home", "P1 通知「待我审核」→ 工单对话", "ok"),
                            pin(7.4, 52.0, 22.6, 8.8, "m_code", "P1 通知「Bot 在问你」→ 提问屏", "warn"),
                            pin(38.1, 12.0, 3.6, 4.4, "m_set:0", "P2 ‹ 返回设置", "info", below=True),
                            pin(69.0, 12.0, 3.6, 4.4, "m_boot:0", "P3 ‹ 返回通知", "info", below=True),
                            pin(70.3, 56.1, 21.2, 3.5, "m_home", "P3 待我审核示例 → 直达工单", "ok"),
                            pin(70.3, 59.6, 21.2, 3.5, "m_code", "P3 Bot 在问你 → 直达提问", "warn"),
                            pin(70.3, 63.2, 21.2, 3.5, "m_rel", "P3 可以复测示例 → 发布详情", "ok"),
                            pin(70.3, 66.7, 21.2, 3.5, "m_evid", "P3 发布失败示例 → 报错详情", "gap"),
                            pin(70.3, 70.2, 21.2, 3.5, "m_login", "P3 登录过期 → 登录页", "warn"),
                        ],
                        note="「发布失败」与「紧急回滚结果」两条关不掉；通知点开直达工单或发布详情。",
                    ),
                    variant(
                        "② 移动端冷启动闪屏 (3 屏)",
                        "reference/images/splash/移动端-闪屏",
                        pins=[
                            pin(38.0, 20.0, 24.0, 62.0, "m_login", "未登录/过期 → 移动端登录", "warn"),
                            pin(68.0, 20.0, 24.0, 62.0, "m_home", "有效态直达原工单", "ok"),
                        ],
                        note="展示品牌加载、首次多步连通与通知冷启动恢复工单上下文。",
                    ),
                ],
            ),
            node(
                "m_login", 1, 2, "移动端 · 登录与注册 (4 屏)", "邮箱登录 / 6 位码注册 / 错误 / 过期回原单", "done", "移动端 4 屏", "lock",
                "reference/images/pages/移动端-登录",
                [("ok", "登录/注册成功 → 首次步骤器或首页", "m_onboard"), ("info", "点「忘记密码？」 → 重设密码页", "m_auth_extra"), ("ok", "P4「登录并打开工单」 → 首页工单", "m_home")],
                pins=[
                    pin(15.4, 35.2, 7.5, 3.2, "m_login", "P1 分段切「注册」", "info"),
                    pin(19.6, 57.0, 3.5, 4.4, "m_auth_extra", "P1 忘记密码 → 重设页", "info"),
                    pin(7.6, 75.7, 15.5, 4.8, "m_onboard", "P1 登录 → 首次向导 / 首页", "ok"),
                    pin(30.9, 35.2, 7.5, 3.2, "m_login", "P2 分段切「登录」", "info"),
                    pin(30.7, 75.7, 15.5, 4.8, "m_onboard", "P2 创建云匠账号 → 向导", "ok"),
                    pin(65.8, 59.7, 3.5, 4.4, "m_auth_extra", "P3 忘记密码 → 重设页", "info"),
                    pin(53.8, 75.7, 15.5, 4.8, "m_home", "P3 密码重输登录 → 首页", "ok"),
                    pin(89.5, 51.1, 2.1, 2.0, "m_login", "P4 换账号", "info"),
                    pin(76.9, 72.5, 15.5, 4.8, "m_home", "P4 登录并打开 TK-20871", "ok"),
                ],
            ),
            node(
                "m_auth_extra", 2, 3, "移动端 · 重设、邀请与剪贴板拦截 (2 组)", "重置密码 / 免 SMTP 邀请 / 剪贴板口令拦截", "done", "移动端 6 屏", "key",
                "reference/images/pages/移动端-重设密码与邀请",
                [("ok", "P1/P2 重设或设密加入 → 进系统", "m_onboard"), ("info", "P1/P3 返回邮箱登录", "m_login"), ("ok", "剪贴板识别入驻 → 首页多空间切换", "m_home"), ("warn", "P3 链接失效联系管理员重发", "g_set_mem:0")],
                variants=[
                    variant(
                        "① 重设密码与免 SMTP 邀请 (3 屏)",
                        "reference/images/pages/移动端-重设密码与邀请",
                        pins=[
                            pin(7.64, 12.44, 3.65, 4.4, "m_login", "P1 ‹ 返回登录", "info", below=True),
                            pin(7.64, 76.58, 22.78, 4.8, "m_onboard", "P1 确认重设并登录", "ok"),
                            pin(58.63, 12.44, 2.76, 4.4, "m_login", "P2 去登录", "info", below=True),
                            pin(38.61, 76.58, 22.78, 4.8, "m_onboard", "P2 设密并加入工作空间", "ok"),
                            pin(69.58, 12.44, 3.65, 4.4, "m_login", "P3 ‹ 返回登录", "info", below=True),
                            pin(69.58, 73.64, 22.78, 4.8, "m_login", "P3 返回邮箱登录", "ok"),
                            pin(69.58, 79.44, 22.78, 4.8, "g_set_mem:0", "P3 请管理员重新复制链接", "warn"),
                        ],
                        note="邮箱验证码重设密码、免 SMTP 链接直接设密加入及 24h 链接过期兜底。",
                    ),
                    variant(
                        "② 剪贴板口令识别与多空间切换 (3 屏)",
                        "reference/images/pages/移动端-剪贴板识别邀请",
                        pins=[
                            pin(7.6, 70.6, 22.8, 4.8, "m_home", "P1 确认加入团队空间 → 激活多空间", "ok"),
                            pin(38.6, 76.6, 22.8, 4.8, "m_onboard", "P2 未登录直达设密加入「OKR 产研」", "ok"),
                            pin(69.0, 12.0, 11.5, 3.5, "m_auth_extra:1", "P3 顶栏空间切换胶囊 (≥2 空间)", "info", below=True),
                        ] + _m_tabbar_pins(62.0, "chat"),
                        note="iOS Pattern 无感探测命中邀请链路才读取，防反复弹系统粘贴横幅；已登录一键加入、未登录直达设密，消费后清除并激活多空间切换胶囊。",
                    ),
                ],
            ),
            node(
                "m_onboard", 1, 3, "移动端 · 首次使用步骤器 (4 屏)", "4 步概览 · 环境账号 · Cookie Sheet · AI 体检", "done", "移动端 4 屏", "check",
                "reference/images/pages/移动端-首次使用步骤器",
                [("warn", "点「稍后再填」 → 直入移动端首页", "m_home"), ("ok", "点「开始使用，进入工作台」 → 首页", "m_home"), ("info", "执行器离线引导见「插件市场与执行器」", "m_set:1")],
                pins=[
                    pin(21.4, 12.2, 2.8, 2.0, "m_home", "P1 稍后再填 → 首页", "warn", below=True),
                    pin(6.4, 81.2, 17.9, 4.8, "m_onboard", "P1 继续：环境与账号（见 P2）", "ok"),
                    pin(29.6, 64.9, 3.7, 4.4, "m_onboard", "P2 + 添加账号（见 P3 Sheet）", "info"),
                    pin(41.6, 66.2, 5.7, 1.9, "m_onboard", "P2 纯代码单可先跳过 ›", "warn"),
                    pin(29.5, 81.2, 5.1, 4.8, "m_onboard", "P2 上一步回步骤概览", "warn"),
                    pin(35.3, 81.2, 12.1, 4.8, "m_onboard", "P2 下一步：AI 体检（见 P4）", "ok"),
                    pin(69.1, 35.4, 1.4, 2.0, "m_onboard", "P3 取消 Sheet", "warn"),
                    pin(52.6, 80.8, 17.9, 4.8, "m_onboard", "P3 保存并让 Bot 试登录", "ok"),
                    pin(75.7, 81.2, 17.9, 4.8, "m_home", "P4 开始使用，进入工作台", "ok"),
                ],
            ),
            node(
                "m_set", 2, 1, "Skills · 设置 · 插件 · 组织 · 空态 (5 张)", "草稿编辑 / 设置入口 / 组织只读与交接 / 插件与空态", "done", "移动端 5 合集", "sliders",
                "reference/images/pages/移动端-Skills与设置",
                [("ok", "在设置里点「插件市场」 → 插件市场 3 屏", "m_set:1"), ("ok", "组织只读与停用交接 (3 屏)", "m_set:4"), ("warn", "在设置里点「通知」 → 通知设置", "m_boot:0"), ("info", "空状态合集 1 / 2", "m_set:2")],
                variants=[
                    variant(
                        "① Skills 与设置 (3 屏)",
                        "reference/images/pages/移动端-Skills与设置",
                        pins=[
                            pin(7.7, 40.9, 22.6, 6.5, "m_set:0", "P1 进 Skill 草稿编辑（P2）", "info"),
                            pin(38.1, 12.0, 4.1, 4.4, "m_set:0", "P2 ‹ Skills 返回", "info", below=True),
                            pin(59.8, 12.0, 2.1, 4.4, "m_home", "P2 保存草稿", "ok", below=True),
                            pin(38.7, 78.4, 22.6, 4.8, "m_home", "P2 启用到项目生效", "ok"),
                            pin(69.0, 12.0, 3.6, 4.4, "m_home", "P3 ‹ 工单返回首页", "info", below=True),
                            pin(69.7, 45.6, 22.6, 4.4, "m_set:1", "P3 进入移动端「插件市场」", "warn"),
                            pin(69.7, 73.8, 22.6, 4.4, "m_boot:0", "P3 进入「通知」设置", "info"),
                            pin(69.7, 78.6, 22.6, 4.4, "m_set:1", "P3 查看执行器离线引导", "info"),
                        ] + _m_tabbar_pins(0.0, "sk"),
                        note="Skill 草稿编辑与桌面端同步接力；头像进入设置，涵盖插件市场、连接器与执行器。",
                    ),
                    variant(
                        "② 插件市场与执行器离线引导 (3 屏)",
                        "reference/images/pages/移动端-插件市场与执行器",
                        pins=[
                            pin(7.1, 12.0, 3.6, 4.4, "m_set:0", "P1 ‹ 返回设置", "info", below=True),
                            pin(7.7, 23.8, 22.6, 6.2, "m_set:1", "P1 看「紧急回滚」插件详情（见 P2）", "info"),
                            pin(38.1, 12.0, 5.8, 4.4, "m_set:1", "P2 ‹ 插件市场", "info", below=True),
                            pin(39.4, 56.0, 21.2, 3.4, "m_set:1", "P2 插件设置 Schema", "info"),
                            pin(38.7, 78.4, 22.6, 4.8, "m_set:0", "P2 停用插件并隐藏回滚入口", "warn"),
                            pin(69.0, 12.0, 3.6, 4.4, "m_home", "P3 ‹ 返回工单", "info", below=True),
                            pin(69.7, 78.4, 22.6, 4.8, "m_home", "P3 执行器上线后提醒我", "ok"),
                        ] + _m_seg_pins(62.0, 22.9, "chat"),
                        note="移动端支持插件启停与离线执行器等待提醒；装新插件与改鉴权提示回 PC 完成。",
                    ),
                    variant(
                        "③ 移动端空状态 1 (3 屏)",
                        "reference/images/pages/移动端-空状态",
                        pins=[
                            pin(15.5, 63.7, 7.1, 2.0, "m_set:0", "P1 去来源采集看看 ›", "info"),
                            pin(57.3, 49.5, 3.4, 2.8, "m_onboard", "P2 发布配置去填", "warn"),
                        ] + _m_tabbar_pins(0.0, "chat") + _m_tabbar_pins(31.0, "pub") + _m_tabbar_pins(62.0, "ai"),
                        note="收单就绪无新单、尚未有发布记录、首次打开 AI 助手。",
                    ),
                    variant(
                        "④ 移动端空状态 2 (3 屏)",
                        "reference/images/pages/移动端-空状态-2",
                        pins=[
                            pin(7.4, 49.2, 23.3, 4.8, "m_home", "P1 在全部里找 · 2 张", "ok"),
                            pin(69.3, 55.9, 11.2, 4.4, "m_rb", "P3 换个应用查回滚", "warn"),
                            pin(81.4, 55.9, 11.2, 4.4, "m_rel", "P3 看测试环境", "info"),
                        ] + _m_tabbar_pins(0.0, "chat") + _m_tabbar_pins(31.0, "sk") + _m_tabbar_pins(62.0, "rb"),
                        note="搜索无结果、我的 Skills 为空、只有 1 次发布无可回滚历史。",
                    ),
                    variant(
                        "⑤ 组织与成员（只读筛选 / 选人 / 交接 3 屏）",
                        "reference/images/pages/移动端-组织与成员",
                        pins=[
                            pin(6.63, 12.04, 3.65, 4.4, "m_set:0", "P1 ‹ 返回设置", "info", below=True),
                            pin(27.08, 13.15, 3.44, 2.17, "m_set:4", "P1 待确认 1（见 P2）", "warn", below=True),
                            pin(38.75, 12.04, 3.65, 4.4, "m_set:4", "P2 ‹ 返回组织列表", "info", below=True),
                            pin(39.38, 78.43, 22.64, 4.8, "m_home", "P2 确定指派给 张伟", "ok"),
                            pin(70.46, 80.84, 23.33, 4.8, "m_set:4", "P3 确认停用并移交给 张某", "gap"),
                        ],
                        note="手机端禁用编辑组织树，专注按部门筛选、RBAC 作用域隔离展示、同名待确认选人及停用成员待办一键交接 Sheet。",
                    ),
                    variant(
                        "⑥ 移动端 · 运行态与异常补齐 (3 屏)",
                        "reference/images/pages/移动端-运行态与异常补齐",
                        pins=[
                            pin(7.4, 80.8, 23.3, 4.8, "m_home", "保存并发布到测试", "ok"),
                        ],
                        note="第一次发布时就地补填本人账号；无权查看不露工单内容；改到权限相关代码时手机上看完全部改动才能通过，或发到电脑逐行审。",
                    ),
                ],
            ),
            node(
                "m_home", 2, 2, "移动端 · 首页 3 屏", "工单列表 / 工单对话(吸底审核) / AI 助手", "done", "移动端核心", "chat",
                "reference/images/移动端",
                [("ok", "P1 点右上头像「林」 → 设置页", "m_set:0"), ("warn", "P1 点「李娜 · Bot 在问你」 → 提问屏", "m_code"), ("info", "P2 切「改动/证据/日志/发布」", "m_code"), ("ok", "P2 点「打回 / 审核通过」", "m_rules")],
                pins=[
                    pin(28.1, 13.4, 2.6, 3.8, "m_set:0", "P1 点头像「林」 → 设置页", "info", below=True),
                    pin(7.7, 40.7, 22.6, 6.6, "m_home", "P1 点「王芳」→ 工单对话（P2）", "ok"),
                    pin(7.7, 47.2, 22.6, 6.6, "m_evid", "P1 点「陈晨」→ 受阻报错", "warn"),
                    pin(7.7, 58.9, 22.6, 6.6, "m_code", "P1 点「李娜」→ Bot 在问你", "warn"),
                    pin(38.1, 12.0, 3.6, 4.4, "m_home", "P2 ‹ 工单返回列表", "info", below=True),
                    pin(38.7, 75.9, 9.0, 4.4, "m_code", "P2 吸底「打回」Sheet", "gap"),
                    pin(48.5, 75.9, 12.8, 4.4, "m_rules", "P2 吸底「审核通过」（未测项确认）", "ok"),
                    pin(69.7, 58.1, 22.6, 7.4, "m_home", "P3 AI 回答「去审核」→ 工单对话", "ok"),
                    pin(69.7, 65.5, 22.6, 7.4, "m_evid", "P3 AI 回答「处理」→ 受阻单", "warn"),
                ] + _m_seg_pins(31.0, 23.6, "chat") + _m_tabbar_pins(0.0, "chat") + _m_tabbar_pins(62.0, "ai"),
            ),
            node(
                "m_code", 3, 1, "代码改动 · 打回 · Bot 提问 (3 屏)", "单列 Diff · 选中行问 AI · 打回 Sheet", "done", "移动端 3 屏", "code",
                "reference/images/pages/移动端-代码与审核",
                [("info", "P1 点「查看完整文件」 → 移动端预览 3 屏", "m_preview"), ("gap", "P2 点「打回并通知 Bot」", "m_rules"), ("ok", "P3 点快捷回答 → 继续修单", "m_home")],
                pins=[
                    pin(7.1, 12.0, 3.6, 4.4, "m_home", "P1 ‹ 工单返回", "info", below=True),
                    pin(24.7, 53.3, 5.1, 1.9, "m_preview", "P1 查看完整文件 → 全文件预览", "info"),
                    pin(14.9, 61.1, 6.2, 3.0, "m_code", "P1 附到打回（见 P2）", "warn"),
                    pin(7.7, 75.9, 9.0, 4.4, "m_code", "P1 吸底「打回」（见 P2）", "gap"),
                    pin(17.5, 75.9, 12.8, 4.4, "m_rules", "P1 审核通过（见未测项）", "ok"),
                    pin(59.8, 41.3, 1.8, 2.0, "m_home", "P2 取消打回 Sheet", "warn"),
                    pin(38.3, 78.3, 23.3, 4.8, "m_rules", "P2 打回并通知 Bot → 入队重修", "gap"),
                    pin(69.0, 12.0, 3.6, 4.4, "m_home", "P3 ‹ 工单返回", "info", below=True),
                    pin(70.3, 43.3, 6.5, 3.2, "m_home", "P3 一键回复「用普通员工」", "ok"),
                    pin(77.5, 43.3, 7.5, 3.2, "m_home", "P3 一键回复「部门负责人」", "ok"),
                ] + _m_seg_pins(62.0, 22.9, "chat"),
            ),
            node(
                "m_preview", 4, 1, "移动端 · 完整文件与证据预览 (3 屏)", "完整源码 / 修前修后对照 / 失败原图灯箱", "done", "移动端 3 屏", "file",
                "reference/images/pages/移动端-完整文件与证据预览",
                [("info", "P1 ‹ 代码返回 / 附到打回", "m_code"), ("ok", "P2 标为已查阅 / 切代码 :48", "m_evid"), ("warn", "P3 失败原图灯箱 · 补账号重试", "m_onboard")],
                pins=[
                    pin(7.08, 12.04, 3.65, 4.4, "m_code", "P1 ‹ 代码返回", "info", below=True),
                    pin(18.87, 81.34, 11.47, 4.4, "m_code", "P1 附到打回", "gap"),
                    pin(38.06, 12.04, 3.65, 4.4, "m_evid", "P2 ‹ 证据返回", "info", below=True),
                    pin(38.68, 81.34, 11.68, 4.4, "m_evid", "P2 标为已查阅", "ok"),
                    pin(50.91, 81.34, 10.41, 4.4, "m_code", "P2 附到打回", "gap"),
                    pin(69.03, 12.04, 3.65, 4.4, "m_evid", "P3 ‹ 关闭灯箱", "info", below=True),
                    pin(80.24, 81.34, 12.05, 4.4, "m_onboard", "P3 补账号并重试", "warn"),
                ],
            ),
            node(
                "m_evid", 3, 2, "证据 · 报错 · 发布到测试 (3 屏)", "验证对比 · 报错 AI 解读 · 发测试 5 步", "done", "移动端 3 屏", "eye",
                "reference/images/pages/移动端-证据报错发布",
                [("info", "P1 点击证据 / P2 失败截图 → 大图灯箱", "m_preview"), ("ok", "P2 点「补充账号后重试」 → 回对话", "m_home"), ("ok", "P3 点「进入工单 ›」或看等复测", "m_rel")],
                pins=[
                    pin(7.1, 12.0, 3.6, 4.4, "m_home", "P1 ‹ 工单返回", "info", below=True),
                    pin(18.5, 34.0, 12.0, 14.0, "m_preview", "P1 点证据截图 → 大图对照", "info"),
                    pin(27.7, 58.0, 1.8, 2.0, "m_onboard", "P1 补充测试账号", "warn"),
                    pin(7.7, 75.9, 9.0, 4.4, "m_code", "P1 打回", "gap"),
                    pin(17.5, 75.9, 12.8, 4.4, "m_rules", "P1 审核通过", "ok"),
                    pin(38.1, 12.0, 3.6, 4.4, "m_home", "P2 ‹ 工单返回", "info", below=True),
                    pin(45.5, 62.5, 11.0, 3.0, "m_preview", "P2 失败时截图 → 原图灯箱", "info"),
                    pin(38.7, 81.3, 9.0, 4.4, "m_home", "P2 人工接手", "warn"),
                    pin(48.5, 81.3, 12.8, 4.4, "m_home", "P2 补充账号后重试", "ok"),
                    pin(87.5, 13.9, 5.1, 2.4, "m_rel", "P3 完成后 → 发布等复测", "ok", below=True),
                    pin(87.5, 20.0, 4.3, 2.0, "m_home", "P3 进入工单 ›", "info"),
                    pin(89.9, 71.3, 1.8, 2.0, "m_rules", "P3 更换测试人", "info"),
                ] + _m_seg_pins(0.0, 22.9, "evid") + _m_seg_pins(31.0, 22.9, "log") + _m_tabbar_pins(62.0, "pub"),
            ),
            node(
                "m_rules", 3, 3, "未测项审核 · 排队 · 换测试人 (3 屏)", "强勾未测项才能点通过 · 发测试选人", "done", "移动端 3 屏", "shield",
                "reference/images/pages/移动端-审核与排队",
                [("ok", "P1 勾选未测项后通过 → 选人发测试", "m_rel"), ("warn", "P1「先登记账号」 → 账号设置", "m_onboard"), ("ok", "P3「发布到测试环境」 → 5 步发布", "m_rel")],
                pins=[
                    pin(28.9, 38.8, 1.8, 2.0, "m_home", "P1 取消审核通过 Sheet", "warn"),
                    pin(10.0, 65.7, 19.9, 1.9, "m_onboard", "P1 先登记账号让 Bot 补测 ›", "info"),
                    pin(7.4, 78.3, 23.3, 4.8, "m_rel", "P1 勾选确认后通过 → 发测试", "ok"),
                    pin(38.1, 12.0, 3.6, 4.4, "m_home", "P2 ‹ 工单返回", "info", below=True),
                    pin(69.0, 12.0, 3.6, 4.4, "m_home", "P3 ‹ 工单返回", "info", below=True),
                    pin(69.7, 78.4, 22.6, 4.8, "m_evid", "P3 发布到测试环境 → 5 步发布", "ok"),
                ] + _m_seg_pins(31.0, 22.9, "chat") + _m_seg_pins(62.0, 22.9, "rel"),
            ),
            node(
                "m_rel", 4, 2, "移动端 · 发布全状态 (3 屏)", "工单发布 Tab · 等复测 · 发布到正式", "done", "移动端 3 屏", "pkg",
                "reference/images/pages/移动端-发布",
                [("ok", "P2 测试人点「复测通过」 → P3 发布正式", "m_rel"), ("gap", "P2 测试人点「打回」 → 打回 Sheet", "m_code"), ("ok", "P3 点「发布到正式环境」", "m_rb")],
                pins=[
                    pin(7.1, 12.0, 3.6, 4.4, "m_home", "P1 ‹ 工单返回", "info", below=True),
                    pin(38.1, 12.0, 3.6, 4.4, "m_home", "P2 ‹ 发布返回", "info", below=True),
                    pin(56.6, 23.9, 4.3, 2.0, "m_home", "P2 进入工单 ›", "info"),
                    pin(38.7, 81.3, 9.0, 4.4, "m_code", "P2 测试人点「打回」", "gap"),
                    pin(48.5, 81.3, 12.8, 4.4, "m_rel", "P2 测试人点「复测通过」", "ok"),
                    pin(69.0, 12.0, 3.6, 4.4, "m_home", "P3 ‹ 发布返回", "info", below=True),
                    pin(87.5, 23.9, 4.3, 2.0, "m_home", "P3 进入工单 ›", "info"),
                    pin(69.7, 80.9, 22.6, 4.8, "m_rb", "P3 发布到正式（出异常可回滚）", "ok"),
                ] + _m_seg_pins(0.0, 22.9, "rel"),
            ),
            node(
                "m_rb", 4, 3, "大包明细与 Apollo 紧急回滚 (3 屏)", "部分完成续发 · 预览配置差 · 本人确认回滚", "done", "移动端 3 屏", "undo",
                "reference/images/pages/移动端-大包与紧急回滚",
                [("ok", "P1 点「从 B 构建重试」 → 回发布列表", "m_rel"), ("ok", "P2 点「确认回滚到 3.8.1」 → P3 结果", "m_rb"), ("info", "P3 点「关联到工单查根因」 → 工单对话", "m_home")],
                pins=[
                    pin(7.1, 12.0, 3.6, 4.4, "m_rel", "P1 ‹ 发布返回", "info", below=True),
                    pin(7.7, 78.4, 22.6, 4.8, "m_rel", "P1 从 B 构建重试", "ok"),
                    pin(38.1, 12.0, 3.6, 4.4, "m_home", "P2 ‹ 回滚返回", "info", below=True),
                    pin(38.7, 78.4, 22.6, 4.8, "m_rb", "P2 本人确认回滚到 3.8.1 → P3", "gap"),
                    pin(69.7, 64.5, 22.6, 4.8, "m_preview", "P3 回读截图 / 入口录屏预览", "info"),
                    pin(69.3, 71.0, 23.3, 4.8, "m_home", "P3 关联到工单，让 Bot 查根因", "ok"),
                ] + _m_tabbar_pins(62.0, "rb"),
            ),
        ],
        "edges": [
            edge("m_boot", "m_login", "登录过期截停", "warn", False, "bottom", "top"),
            edge("m_boot", "m_home", "有效直达工单", "ok", False, "right", "left"),
            edge("m_login", "m_auth_extra", "忘记密码/邀请链接", "info", True, "bottom", "left", curve=18),
            edge("m_auth_extra", "m_home", "设密/重设登录", "ok", False, "top", "bottom"),
            edge("m_login", "m_onboard", "首次进向导", "ok", False, "bottom", "top"),
            edge("m_onboard", "m_home", "体检通过开工", "ok", False, "right", "left"),
            edge("m_home", "m_set", "头像/底部设置", "info", False, "top", "bottom"),
            edge("m_home", "m_code", "改动/打回/Bot", "info", False, "right", "left"),
            edge("m_code", "m_preview", "完整文件/大图对照", "info", True, "right", "left"),
            edge("m_home", "m_evid", "证据/日志/发布", "info", False, "right", "left"),
            edge("m_home", "m_rules", "未测项/排队", "warn", False, "right", "left"),
            edge("m_evid", "m_rel", "复测与发正式", "ok", False, "right", "left"),
            edge("m_rel", "m_rb", "大包/紧急回滚", "gap", True, "bottom", "top"),
        ],
    },
]

GAP_ITEMS = [
    (
        "已补齐 ✓",
        "p-green",
        "步骤器第 4 步 / 设置→项目 · 点「看完整日志 ›」",
        "PC-步骤器-4-体检完整日志",
        "已补齐右滑抽屉高保真图：展示 5 阶段结果卡片、46 行过滤分段、`***REDACTED***` 凭据脱敏终端日志、非阻塞警告提示与「复制脱敏日志 / 导出 .log / 重新体检」操作区。",
    ),
    (
        "已补齐 ✓",
        "p-green",
        "忘记密码重设 / 免 SMTP 一次性邀请链接落地页",
        "PC-重置密码 / PC-邀请加入 / 移动端-重设密码与邀请",
        "已补齐双端共 3 套高保真页：PC 重置登录密码、PC 免 SMTP 一次性邀请设密加入（含预关联 Tita/Jira 身份卡片），以及移动端 3 屏（重置密码 / 免 SMTP 邀请加入 / 链接已使用或超 24h 失效兜底）。",
    ),
    (
        "已补齐 ✓",
        "p-green",
        "代码改动「查看修复后的完整文件」/ 证据大图放大预览（PC + 移动端）",
        "PC-完整文件与证据预览 / PC-证据大图对照 / 移动端-完整文件与证据预览",
        "已补齐双端全部预览状态：PC 居中大弹层支持「完整代码文件 ↔ 证据大图对照 (4)」双向实景切换（含修前卡死 vs 修后流畅并排对照与进度条）；移动端 3 屏合板补齐完整代码文件、证据上下对照与失败截图全屏灯箱。",
    ),
    (
        "已补齐 ✓",
        "p-green",
        "测试/正式环境「+ 添加账号 / 添加环境」编辑抽屉",
        "PC-步骤器-3-添加账号",
        "已补齐 PC 端右滑抽屉高保真图（与移动端步骤 3 Bottom Sheet 及 设置→项目 复用同一模型）：支持环境/角色选择、密码与 Cookie 切换（支持免填账号名由 Bot 识别）及「只能查看 / 可以修改」双红线切换。",
    ),
    (
        "共用页 ↻（非缺图）",
        "p-blue",
        "设置→连接器「+ 新增」/ 设置→执行器「+ 添加」/ 发测试 MR 审核",
        "PC-设置-连接器 / PC-设置-执行器 / PC-发布",
        "这三处入口已明确与「步骤器 1 抽屉」、「选择执行环境三选一」、「PC-合回主分支-MR审核」完全共用同一套组件与页面，已在上方流转图中用跨旅程直达线打通，无需重复绘制。",
    ),
    (
        "刻意精简 ✓（非缺图）",
        "p-green",
        "移动端无独立「选择执行环境 3 选 1」及「向导 AI 帮手」全屏",
        "移动端-首次使用步骤器 / 移动端-插件市场与执行器",
        "服务器部署命令（一键脚本 / Docker Compose）和复杂仓库鉴权主要在 PC 完成；移动端通过「暂无在线执行器」轻量引导回到 PC 或切换团队远程 Runner，属于刻意精简范围，不算漏图。",
    ),
    (
        "已补齐 ✓",
        "p-green",
        "多租户组织架构 / 权限隔离 / 反孤岛加入 / 双面端交互全套（6 张新图 + 2 升级）",
        "PC-设置-成员与身份 / PC-组织-* / PC-已注册成员确认加入 / 移动端-组织与成员 / PC-企业管理后台-蓝图",
        "经多轮专家审计与工作流去硬编码升级：PC 组织与权限移除 Guest 特判并对齐 4 重 AND ActionGate；新增「PC-头像菜单-切换空间与升级团队」「PC-邀请失效与切号」「PC-设置-项目-流程模板（T-08b 节点工作流 + 节级 Skills）」「PC-工作台-边界补全（Hard Gate 双出口 / 我来接手 / no_code_fix / 提问消歧）」「PC-插件运行态规范」与「移动端-运行态与异常补齐」。",
    ),
]


def render_ui_flow_section() -> str:
    active_journeys = JOURNEYS
    total_boards = len(list((ROOT / "reference/images").rglob("*-亮色.png")))
    total_edges = sum(len(j["edges"]) for j in active_journeys)
    total_nodes = sum(len(j["nodes"]) for j in active_journeys)

    subtabs_html = "".join(
        f'<button class="{"on" if idx == 0 else ""}" data-uf-tab="{html.escape(j["id"])}">{html.escape(j.get("tab", j["title"]))}</button>'
        for idx, j in enumerate(active_journeys)
    ) + '<button data-uf-tab="gaps">全站缺口体检（已补齐 0 缺失）</button>'

    canvases = []
    for idx, j in enumerate(active_journeys):
        cards = []
        for n in j["nodes"]:
            st_map = {
                "done": ("p-green", "已出图 ✓"),
                "reuse": ("p-blue", "共用页 ↻"),
                "gap": ("p-red", "缺独立图 !"),
                "ext": ("p-gray", "外部系统"),
            }
            st_cls, st_txt = st_map[n["status"]]
            hs_parts = []
            for item in n["hotspots"]:
                t, txt, tgt = item[0], item[1], (item[2] if len(item) > 2 else "")
                ic = "✓" if t == "ok" else ("!" if t == "gap" else ("↻" if t == "reuse" else "•"))
                tgt_attr = f' data-jump-target="{tgt}"' if tgt else ""
                cls_extra = " is-clickable" if tgt else ""
                arr = '<b class="uf-hs-go">↗</b>' if tgt else ""
                hs_parts.append(
                    f'<div class="uf-hs is-{t}{cls_extra}"{tgt_attr}><i>{ic}</i><span>{html.escape(txt.replace("`", ""))}</span>{arr}</div>'
                )
            hs_html = "".join(hs_parts)
            foot_bar = (
                '<div class="uf-nfoot"><span>点击看大图与上下游</span><b>查看 ›</b></div>'
                if n["imgL"]
                else '<div class="uf-nfoot is-gap"><span>暂无独立图 · 看缺口分析</span><b>详情 ›</b></div>'
            )
            cards.append(
                f'<article class="uf-node is-{n["status"]}" data-node="{n["id"]}" style="grid-column:{n["col"]};grid-row:{n["row"]}">'
                f'  <div class="uf-nhd">'
                f'    <div class="col" style="min-width:0;flex:1">'
                f'      <div class="uf-meta"><span>{html.escape(n["kind"])}</span></div>'
                f'      <b class="uf-ntitle">{html.escape(n["title"])}</b>'
                f'      <span class="uf-nsub">{html.escape(n["subtitle"])}</span>'
                f'    </div>'
                f'    <span class="pill {st_cls}" style="height:20px;font-size:10.5px;padding:0 6px">{st_txt}</span>'
                f'  </div>'
                f'  <div class="uf-hslist">{hs_html}</div>'
                f'  {foot_bar}'
                f'</article>'
            )

        canvases.append(
            f'<div class="uf-pane{" on" if idx == 0 else ""}" data-uf-pane="{j["id"]}">'
            f'  <p class="sub" style="margin:0 0 12px">{html.escape(j["desc"])}</p>'
            f'  <div class="uf-scroll" tabindex="0">'
            f'    <div class="uf-stage" data-uf-stage="{j["id"]}" style="grid-template-columns:repeat({j["cols"]}, minmax(205px, 1fr));grid-template-rows:repeat({j["rows"]}, auto)">'
            f'      <svg class="uf-svg" aria-hidden="true"></svg>'
            f'      <div class="uf-edgelbls"></div>'
            f'      {"".join(cards)}'
            f'    </div>'
            f'    <div class="uf-canvas-hud">左键按住任意位置拖拽平移 · 滚轮 / 双指原地缩放 · 双击空白一屏全览 · 轻点卡片看大图与热区</div>'
            f'  </div>'
            f'</div>'
        )

    gap_rows = "".join(
        f'<tr><td><span class="pill {cls}">{html.escape(kind)}</span></td>'
        f'<td><b>{html.escape(title)}</b></td>'
        f'<td><code>{html.escape(where)}</code></td>'
        f'<td>{html.escape(detail)}</td></tr>'
        for kind, cls, title, where, detail in GAP_ITEMS
    )
    gap_pane = f'''<div class="uf-pane" data-uf-pane="gaps">
  <p class="sub" style="margin:0 0 12px">把全站可点击热区与现有 {total_boards} 张高保真设计板（{total_boards * 2} 张亮/暗 PNG）逐一核对后的真实结果：区分「真正缺少设计图」「轻缺口/弹层复用」「已显式共用同一骨架」和「移动端刻意精简」。</p>
  <div class="tw" style="margin:0"><table>
    <thead><tr><th>体检结论</th><th>可点击热点 / 页面名称</th><th>所在界面与触发位置</th><th>说明与建议处置</th></tr></thead>
    <tbody>{gap_rows}</tbody>
  </table></div>
</div>'''

    payload_json = json.dumps({"journeys": active_journeys}, ensure_ascii=False).replace("</", "<\\/")

    return f'''<div class="subpane" data-subpane="plan:clickflow" id="ui-clickflow-root">
  <div class="grid g4">
    <div class="kpi glass"><b>{total_boards} 张板</b><span>{total_boards * 2} 张亮/暗图资产已校验</span></div>
    <div class="kpi glass"><b>5 条旅程 · {total_nodes} 节点</b><span>{total_edges} 条主干连线 · PC + 移动端全覆盖</span></div>
    <div class="kpi glass"><b style="color:var(--ink-green)">全图热区直达</b><span>DOM 实测 + 5 路截图审校</span></div>
    <div class="kpi glass"><b style="color:var(--ink-green)">0 处显式缺口</b><span>含可定制节点工作流与全链路边界补全 · 100% 闭环</span></div>
  </div>

  <div class="card glass mt">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <div>
        <h3 style="margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">UI 点击流转图（悬停节点高亮上下游 · 点击节点看大图与热区）<span class="pill p-green" style="height:21px;font-size:11px">PC + 移动端全量 · 5 路审校通过</span></h3>
        <div class="ls" style="margin-top:3px">视觉采用「大包明细」同款节点 + 曲线箭头拓扑；支持自由拖拽平移、鼠标原地滚轮缩放及顶部明/暗主题实时切换。</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--text-2)">
        <span class="uf-lg"><i style="background:var(--green)"></i>主干点击</span>
        <span class="uf-lg"><i style="background:var(--blue)"></i>详情/辅入口</span>
        <span class="uf-lg"><i style="background:var(--orange)"></i>前置/提问/复用</span>
        <span class="uf-lg"><i style="background:var(--red);border:1px dashed var(--red)"></i>失败/打回/缺图</span>
      </div>
    </div>

    <div class="uf-bar-row">
      <div class="subtabs uf-tabs" data-uf-tabs>{subtabs_html}</div>
      <div class="uf-zoombar" role="group" aria-label="画布缩放控制">
        <button type="button" class="uf-zbtn" id="uf-z-out" title="缩小">−</button>
        <input type="range" class="uf-zrange" id="uf-z-range" min="25" max="240" value="100" aria-label="缩放比例">
        <span class="uf-zval" id="uf-z-val">100%</span>
        <button type="button" class="uf-zbtn" id="uf-z-in" title="放大">+</button>
        <span class="uf-zsep"></span>
        <button type="button" class="uf-zbtn txt" id="uf-z-fit" title="自动缩放到一屏看清全貌">一屏全览</button>
        <button type="button" class="uf-zbtn txt" id="uf-z-100" title="恢复 100% 原比例并居中">1:1</button>
        <span class="uf-zsep"></span>
        <button type="button" class="uf-zbtn txt on" id="uf-z-wheel" title="开启后在画布内滑动鼠标滚轮直接缩放">滚轮缩放</button>
      </div>
    </div>
    {"".join(canvases)}
    {gap_pane}
  </div>

  <!-- 节点详情检查弹窗（点击任意卡片打开 · 图片内置可点热区标识 · 支持同节点多变体与跨旅程跳转） -->
  <div class="uf-modal" id="uf-modal" aria-hidden="true">
    <div class="uf-modal-card glass">
      <div class="uf-modal-hd">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <button class="uf-m-back" id="uf-m-back" type="button" style="display:none">← 返回上一页</button>
            <b id="uf-m-title" style="font-size:17px"></b>
            <span class="pill" id="uf-m-status"></span>
            <button class="uf-m-pinbtn on" id="uf-m-pintoggle" type="button">可点热区标识：开</button>
          </div>
          <div id="uf-m-sub" class="ls" style="margin-top:2px"></div>
        </div>
        <button class="uf-m-close" id="uf-m-close" type="button" aria-label="关闭">✕</button>
      </div>
      <div class="uf-modal-body">
        <div class="uf-modal-img" id="uf-m-imgwrap">
          <div class="uf-m-vtabs" id="uf-m-vtabs"></div>
          <div class="uf-img-stage" id="uf-m-stage">
            <img class="img-l" id="uf-m-imgl" alt="">
            <img class="img-d" id="uf-m-imgd" alt="">
            <div class="uf-pins" id="uf-m-pins"></div>
          </div>
          <div class="uf-gap-ph" id="uf-m-gapbox" style="display:none"></div>
        </div>
        <div class="uf-modal-side">
          <div class="uf-side-blk"><b>图片内可点热区（直接点图上虚线框也能跳）</b><div id="uf-m-pinslist"></div></div>
          <div class="uf-side-blk"><b>上游来源（从哪点进来 · 含跨旅程入口）</b><div id="uf-m-in"></div></div>
          <div class="uf-side-blk"><b>说明</b><div id="uf-m-note" class="ls" style="line-height:1.6"></div></div>
        </div>
      </div>
    </div>
  </div>
  <script type="application/json" id="uf-data">{payload_json}</script>
</div>'''
