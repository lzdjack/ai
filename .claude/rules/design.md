---
paths:
  - "reference/**"
  - "tokens/**"
  - "scripts/gen-*.py"
  - "scripts/shell_*.py"
  - "scripts/pages_*.py"
  - "scripts/onboard_*.py"
  - "scripts/build-all.py"
  - "scripts/render.sh"
  - "docs/01-设计主题.md"
  - "docs/03-出图流程.md"
---

# 设计规则（出设计图、改页面时适用）

## 风格与组件

- 风格固定为「苹果系 · 毛玻璃 · 对话流」，亮色和暗色都要。不换风格，不另起主题。
- 颜色、圆角、毛玻璃、尺寸一律取 `tokens/theme.css`；组件一律复用 `tokens/components.css` 的 `.cc-*`（PC）/ `.cc-m-*`（移动端）。不要单页自造变体，也不要在页面脚本里直接写语义色十六进制（状态实底见 `01` §16.3）。
- 尺寸标尺：PC 控件 `--ctl-xs/sm/md/lg` = 28/32/36/40；移动端触控 ≥ 44pt，行高和按钮 48。
- 彩色小字、白字实底按钮用 `--ink-*` / `--btn-*-bg`，不要直接用 `--green/--orange/--blue`（WCAG AA）。
- 下拉箭头不贴字、不加小方盒。滚动条 0px 悬浮、默认隐藏；静态图不画滚动条，用底部羽化遮罩表示可滚（`01` §2.6）。
- 左侧菜单只放彩色 Dock 图标，不放文字；选中态只用「放大加悬浮」。
- 工单列表用「提单人头像 + 状态点」，选中行用蓝色渐变实底。
- 应用图标只用 `reference/src/v5/logo.svg`。
- 全局 AI 是独立页面，入口是菜单第一个图标；本单 AI 是工单对话底部的输入框，始终带工单号。
- 设置左栏固定 8 项（全局 AI、执行器、连接器、项目、来源采集、成员与身份、我的账号、通知），新能力不加菜单项。
- 数据库表名 / 字段（如 `state_digest`）、攻击术语（如 TOCTOU）、技术栈（如 `@xyflow/react`）和设计说明（如「左栏保持 8 项不变」）不画进界面，写到 `06` 或 `01` 的图注里。

## 出图工作方式

- 交付高保真设计图（本地 HTML 渲染成 PNG），不是原型，不上传网络。
- 先出一张精细图给用户确认，再铺开其余页面；用户要改时只改他指出的位置。
- 交付前自己看渲染结果：有没有换行、重叠、遮挡、残留的旧元素。
- 新页面复用 `reference/src/v5/pc.css`、`m.css` 和外壳脚本（`shell_pc.py`、`shell_m.py`），不另写顶栏、Dock 或手机外壳。
- 改了导航图标、交互结构或技术边界，要同步重出受影响的亮暗 PNG，并更新 `docs/` 和 `index.html`。

## 生成与出图

- 页面 HTML 由 `scripts/gen-*.py` 生成，**不要手改 `reference/src/v5/` 下的生成产物**。
- **统一用 `python3 scripts/build-all.py` 生成和出图**：按依赖顺序跑生成脚本 → 出亮暗 PNG → 生成 `index.html`。改完一般用 `--changed` 只重出有改动的页面；`--only <关键字>` 出指定页面；`--check` 核对对照表（`docs/03-出图流程.md`）。
- 新增页面：在 `build-all.py` 的 `GENERATORS` 登记生成脚本、在 `RENDERS` 登记「HTML → 图名 → 尺寸」，然后跑 `--check`，不要只手动跑 `render.sh` 而不登记。
- 脚本分工：`gen-pages.py` + `shell_pc.py` + `pages_pc.py`（PC 页面）；`gen-mobile-pages.py` + `shell_m.py`（移动端）；`gen-components*.py` / `gen-mobile-components.py`（组件库规范板）；`gen-onboard*.py` + `onboard_steps.py`（开工步骤器）；`gen-flow.py`（链路总图）；`build-index.py` + `tech_diagrams.py` + `ui_flow_map.py` + `index.template.html`（生成 `index.html`）。
