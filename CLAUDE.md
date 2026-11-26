# 云匠（CLOUDCRAFT）· UI 设计与方案项目

这个项目存放「**云匠（CLOUDCRAFT）**」（一期聚焦 AI Bug 修复工作台，未来扩展至更广的 AI 研发与交付场景）的 **UI 设计主题定稿与技术方案**。凡是为这个产品设计或实现界面的 AI，都必须遵守下面的规定。

## 开工前必读（按顺序）

> **唯一总览集合是 `index.html`**（7 个标签页：需求、方案与链路、设计主题、PC 界面、移动端、技术设计、决策与后续）。它由 `scripts/build-index.py` 从 `scripts/index.template.html` 及 `docs/` 下的核心文档（`00-一期产品需求.md`、`04-修复流转方案.md`、`05-链路流转.md`、`06-技术设计方案.md`）统一生成。**以后所有新文档、技术设计更新、新页面图、方案和决策都必须汇入这一个 `index.html`，不要另建散落的 HTML 文件**；改完文档、模板或补图后都要重新运行 `python3 scripts/build-index.py`。

1. `docs/01-设计主题.md`：主题、token、PC 和移动端布局、组件规范
2. `docs/02-决策记录与禁区.md`：已经被否掉的方向和工作方式。**不要再走回头路**
3. `docs/04-修复流转方案.md`：系统实际怎么跑（收单、分支、MR 审核、tita build / release、回滚）。画涉及流程的界面前先看
4. `docs/05-链路流转.md`：**一张单的完整链路总索引**（0 开工准备 → 14 完成），每步写开始、谁做、结果、分支、对应设计图和来源，配总图 `reference/images/flow/链路总图`。做任何一步的界面或功能，先在这里找到它的位置和前后步骤；改了链路要同时改 `scripts/gen-flow.py` 重新出图
5. `docs/06-技术设计方案.md`：一期技术架构、数据模型、状态机、收单、Bot 执行、审核与 MR、发布与回滚等技术方案（已同步汇入 `index.html` 的「技术设计」标签页）
6. 看定稿图 `reference/images/`（主界面）、`reference/images/pages/`（其余全部页面）、`logo/`（应用图标）、`splash/`（闪屏），亮色和暗色都有

## 硬性规则

- 风格固定为「苹果系 · 毛玻璃 · 对话流」，亮色和暗色两套都要。不要换风格，也不要另起一套主题。
- 颜色、圆角、毛玻璃参数一律从 `tokens/theme.css` 取，不要自己编新的值。
- **组件库铁律（2026-11-24 · PC + 移动端各 3 路多 Agent 审定）**：全部双端通用 UI 组件与 4 档 PC 标尺（`--ctl-xs 28 / sm 32 / md 36 / lg 40`）+ 移动端 44pt/48dp 标尺（`--m-input-h 46 / --m-row-h 48 / --m-btn-h 48`）、WCAG 2.1 AA 文字层（`--ink-*` / `--btn-pri-bg` / `--btn-ok-bg` / `--btn-danger-bg`）、Z-Index 契约（`10→90`）统一收口在 `tokens/theme.css` + `tokens/components.css` 与 `docs/01-设计主题.md` §16（高保真三板见 `PC-组件库规范`、`PC-组件库规范-2`、`移动端-组件库规范` 与 `index.html`「设计主题 → 标准组件库模块」）。**新增或修改任何 PC / 移动端页面必须严格复用 `.cc-*` / `.cc-m-*` 类名与标尺，严禁单页自造变体、严禁裸用 `--green/--orange/--blue` 写小字或白字实底按钮、严禁下拉箭头贴字或加小方盒、严禁移动端压缩行高低于 44pt**。
- **滚动条全局规范**：滚动条一律**不占容器宽度（0px 悬浮）**，默认隐藏、鼠标移入或滚动时淡入、静止自动隐藏；PC 代码统一用 `<ScrollArea>`（禁裸用 Windows 占位滚动条），静态设计图默认隐藏滚动条、不画多余「框中框」外框，可滚区域用底部透明羽化遮罩暗示（见 `docs/01-设计主题.md` §2.6）。
- 左侧菜单只放彩色 Dock 图标，不放文字；选中态只用「放大加悬浮」。
- 工单列表用「提单人头像加状态点」；选中行用蓝色渐变实底。
- 应用图标只用 `reference/src/v5/logo.svg`（顶栏 logo 的精修版），不要另画。
- 账号体系为**独立注册与登录 + 多租户 / 组织双平面（2026-11-26 两轮多 Agent 审定）**：全局邮箱 + 密码登录，个人注册无感创建 `personal` 空间并可原地升级 `organization`，受邀走 `workspace_invitations`（含预填部门/预设包），并按「OTP 验证后待处理邀请拦截 → DNS 域认领（防枚举）→ `workspaces >= 2` 动态切换器」防同事孤岛；GitLab / GitHub / Jira / Tita / Apollo 解耦为连接器（个人写凭据 DB 强锁 `scope='user'`，严禁组织继承）。
- **双端分层共生与「厚核心 + 轻插件」边界**：前端源码抽成纯渲染包 `packages/ui-kit`、`packages/admin-ui`、`packages/workbench-ui`（CI 禁 import `electron` / `node:*`）。**工作台客户端**（PC Electron + 手机 Flutter）聚焦高频修单与小团队敏捷协同，**设置左栏 8 项永久冻结**（「外观与语言」收口进「我的账号」）；**重型组织架构树、企微/飞书 SCIM、SAML SSO、DNS 域、账单配额、审计导出与实例运维**拆出至 **Web 管理控制台（`apps/web /admin`，M2/M3 套薄壳复用 `admin-ui` 上线，桌面设置底部仅对管理员露出免登直达链，M1 不单起第二套前端工程）**。核心包仍严禁静态 `import plugins/*`；**MR 审核合入与「发布」主流程（发测试、复测、合回主分支、发正式，含 Dock「发布」与工单「发布」标签）永远内置为 Core 一等能力**（外部部署命令如 `tita release` / Apollo / K8s 通过 `craft` 槽与连接器适配），**仅将「紧急回滚（Apollo）」、第三方连接器、扩展 AI 引擎、主题皮肤、Token 费用检测与灰度微应用作为插件市场可选插件**，按 5 个正交贡献点自动归位。
- **全局上下文关联与动态插件边界铁律（2026-11-26 三路专家审计锁定 · 严禁违反）**：**凡设计或修改任何页面、权限矩阵、设置表单、空态或数据库表结构，必须先关联全项目上下文核对能力归属（`Core 厚核心永久内置` vs `连接器 / 插件市场动态模块`），严禁把可选插件（如 `Apollo 紧急回滚`、`Token 费用监控`、具体三方连接器）或具体厂商名称（`GitLab PAT / Jira / Tita / Apollo`）静态写死为 Core 必填字段、固定表格列或硬编码权限开关**；Core RBAC、我的账号、部门继承、成员映射必须由「Core 固有底座（含修单、MR 审核与内置发布流水线）+ 已启用插件/连接器通过 `manifest.permissions` / `authSchema` 动态注册」驱动；新插件对既有克隆/受限角色与部门默认包一律默认 `Fail-Closed`（纯靠角色权限点与作用域控制，严禁写死特定角色名或身份分支）；`scope='user'` 凭据硬锁通过通用语义字段 `credential_class = 'personal_exec'` 在 DB 兜底。
- **配置优先于内置写死铁律（2026-11-26 用户明确锁定 · 严禁违反）**：**本项目不建议系统内置写死任何业务流程、节点顺序、门禁开关、审批/复测策略、分支/环境拓扑、角色特判、工具链命令、重试/超时/通知阈值或外部厂商规则；凡涉及此类逻辑一律支持用户/团队自定义配置（包括可定制节点工作流与每节点独立挂载专属 Skills / 行为约束 / 工具范围、并如实记录节点过程供前端动态渲染），同时内置一套安全合理的推荐默认值与开箱预设模板**。仅多租户数据隔离（RLS）、敏感密文隔离（防止越权偷取他人凭据）等系统底座安全边界不可由业务配置破坏；工作流门禁、代码审核、自动合入/发布开关、风险分级等默认开启保护并允许用户按需关闭或调整（对高危降级仅做明确风险提示）。
- **M1 反膨胀与零露出红线**：一期（M1）聚焦修 Bug 闭环 + 手动新建工单 + 免 SMTP 邀请 + 轻量 `roles/role_bindings`（`TEXT` 命名空间权限 + 模板克隆） + 手工多级 `org_units` + Hard/Soft Gate 与 L0-L2 分级审 + 二期最小底座预留；**一期 UI 严禁提前露出二期跨项目变更集、切片筛选、L3 微应用导入或重型 `/admin` 后台界面**（二期演进见 `docs/06-技术设计方案.md` 第 14 节）。
- **设计图与文档强同步铁律**：凡修改导航图标、交互结构或技术边界，必须同步重绘受影响的双端 PNG 并更新 `docs/` 与 `index.html`，严禁留下「文档改了、旧图未更」的错配。
- 全局 AI 是独立页面，入口是菜单第一个图标；本单 AI 是工单对话底部的输入框，始终带工单号。
- 交付的是高保真 UI 设计图（本地 HTML 渲染成 PNG），不是原型，不上传网络。
- 先出一张精细图让用户确认，再铺开其余页面。用户要修改时只改他指出的位置。
- 交付前自己检查渲染结果：有没有换行、重叠、遮挡、残留的旧元素。
- 新页面复用 `reference/src/v5/pc.css`、`m.css` 和外壳生成脚本，不要另写一套顶栏、Dock 或手机外壳。
- **全部给人看的文档和设计统一收口到一个 `index.html`**：产品需求、方案与链路、设计主题、PC / 移动端设计图、技术设计方案、决策记录都在 `index.html` 里查看，不要再另建分散的 HTML 文档；更新任意文档或新增页面图后，同步更新 `scripts/index.template.html` / `scripts/build-index.py` 并重新生成 `index.html`。

## 目录

```
docs/        需求原文、设计主题、决策记录、出图流程、修复流转方案、链路流转、技术设计方案
tokens/      theme.css（全部颜色和组件 token）、components.css（标准组件库唯一样式真相源）
reference/   源文件（src/v4 主界面、src/v5 其余页面）和图（images/、images/pages/）
scripts/     render.sh（HTML → PNG）；gen-components.py（标准组件库规范板）；gen-pages.py + shell_pc.py + pages_pc.py（PC 页面）；gen-market.py（插件市场）；gen-phase2.py（二期 M4 隔离蓝图）；gen-runner-select.py / gen-runner-init.py / gen-runner-server.py / gen-runner-pro.py（执行环境三路径）；gen-flow.py（链路总图）；gen-splash.py（闪屏）；gen-login.py（登录与注册）；gen-onboard.py + onboard_steps.py、gen-onboard-m.py（第一次使用的步骤器）；gen-mobile.py、gen-mobile-pages.py + shell_m.py（移动端）；build-index.py + tech_diagrams.py + index.template.html（生成唯一的 index.html 集合）
index.html   唯一总览集合页（生成产物，不要直接改；全部文档与设计统一汇入此处）
```
