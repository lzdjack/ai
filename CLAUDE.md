# AI 修复工作台 · UI 设计项目

这个项目存放「AI Bug 修复工作台」（一期）的 **UI 设计主题定稿**。凡是为这个产品设计或实现界面的 AI，都必须遵守下面的规定。

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
- 左侧菜单只放彩色 Dock 图标，不放文字；选中态只用「放大加悬浮」。
- 工单列表用「提单人头像加状态点」；选中行用蓝色渐变实底。
- 应用图标只用 `reference/src/v5/logo.svg`（顶栏 logo 的精修版），不要另画。
- 登录只有登录、没有注册：账号是管理员事先建好的公司内部 Jira / GitLab 账号，表单里直接输账号密码（见 `docs/01-设计主题.md` 第 9 节）。
- 全局 AI 是独立页面，入口是菜单第一个图标；本单 AI 是工单对话底部的输入框，始终带工单号。
- 交付的是高保真 UI 设计图（本地 HTML 渲染成 PNG），不是原型，不上传网络。
- 先出一张精细图让用户确认，再铺开其余页面。用户要修改时只改他指出的位置。
- 交付前自己检查渲染结果：有没有换行、重叠、遮挡、残留的旧元素。
- 新页面复用 `reference/src/v5/pc.css`、`m.css` 和外壳生成脚本，不要另写一套顶栏、Dock 或手机外壳。
- **全部给人看的文档和设计统一收口到一个 `index.html`**：产品需求、方案与链路、设计主题、PC / 移动端设计图、技术设计方案、决策记录都在 `index.html` 里查看，不要再另建分散的 HTML 文档；更新任意文档或新增页面图后，同步更新 `scripts/index.template.html` / `scripts/build-index.py` 并重新生成 `index.html`。

## 目录

```
docs/        需求原文、设计主题、决策记录、出图流程、修复流转方案、链路流转、技术设计方案
tokens/      theme.css（全部颜色和组件 token）
reference/   源文件（src/v4 主界面、src/v5 其余页面）和图（images/、images/pages/）
scripts/     render.sh（HTML → PNG）；gen-pages.py + shell_pc.py + pages_pc.py（PC 页面）；gen-splash.py（闪屏）；gen-login.py（登录）；gen-onboard.py + onboard_steps.py、gen-onboard-m.py（第一次使用的步骤器）；gen-mobile.py、gen-mobile-pages.py + shell_m.py（移动端）；build-index.py + tech_diagrams.py + index.template.html（生成唯一的 index.html 集合）
index.html   唯一总览集合页（生成产物，不要直接改；全部文档与设计统一汇入此处）
```
