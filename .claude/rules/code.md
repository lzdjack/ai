---
paths:
  - "apps/**"
  - "packages/**"
  - "plugins/**"
  - "sim/**"
  - "fixtures/**"
  - "infra/**"
  - "tools/**"
  - "e2e/**"
  - "package.json"
  - "pnpm-workspace.yaml"
  - "turbo.json"
---

# 编码规则（写代码时适用；细节见 `docs/07` §2～§8）

## 结构与边界

- 依赖边界按 `07` §2.3，由自定义 ESLint 规则 `cc/boundaries` 强制：`apps/*`、`packages/*` 不静态 import `plugins/*`；`sim/` 不依赖任何产品代码；纯浏览器包不用 Node 内置模块。
- 不写按插件名分支的代码（如 `if (engine === 'pi')`），只读 `AdapterCapabilities` 能力位（`06` §11.4）。
- 后端分 `routes / service / repo` 三层；接口定义只用 TypeBox，放 `packages/core-protocol`。
- 租户表一律用建表助手创建（一次生成 `workspace_id`、`project_id`、复合外键、RLS 策略、`rev`、`deleted_at`）；直接写 SQL 只在 repo 层，不绕过 RLS。
- 写事务里不做网络调用；外部副作用走 Outbox / `work_items`（`06` §3.6）。
- 聚合状态用 SQL 现算，不双写冗余字段（`06` §13.3）。

## 复用优先（`07` §2.4）

- 新增函数、组件、类型前先在 `packages/*` 里搜；有就用，不够就扩展，不另起一份。
- 通用能力用成熟的库，`06` 已选定的直接用；只有 `06` 明确要自己做的才自己写。
- 前后端共用的类型和校验只在 `core-protocol` 定义；连接器共用的重试、退避、分页放共享包。

## 界面严格按定稿图（`07` §2.5）

- `ui-kit` 直接引用 `tokens/theme.css` 和 `tokens/components.css` 的 `.cc-*` 类，React 组件只是包一层，不重写样式；颜色、圆角、尺寸只用 token 变量；滚动区域用 `<ScrollArea>`。
- 布局、间距、字号、颜色、图标、文案都照 `reference/images/` 定稿图，不自行发挥。定稿图没有的状态先补设计图、经用户确认，再写代码。
- 界面任务交付时附亮暗两张对照截图（实际页面与定稿图并排）。

## 契约与命名

- 接口返回强类型 DTO，集合用 `{items, next_cursor, has_more}`；错误统一 `ApiError { code, message, data? }`，`code` 写成 `领域.原因`（如 `ticket.not_found`），`message` 按 locale 渲染。
- 数据库和接口报文的字段用 snake_case（与 `06` 一致）；文件名 kebab-case；React 组件 PascalCase。
- 界面文案和后端报错从第一天起走 `i18n/zh-CN.json` 词条，不在代码里写死中文句子。
- 生成物（`openapi.json`、TS 客户端、迁移 SQL）用 `pnpm gen` 生成，不手改。

## 测试取舍（`07` §7.2，省时间、省 token）

- 只给出错代价高的部分写测试：`advance()` 与状态机、隔离与权限、去重与找人、外部副作用的幂等与重试、发布与合并。界面和简单的增删改查靠端到端冒烟和人工验收。
- 按功能写场景测试（一个测试走完一段流程），不给每个小函数各写一个。
- 开发中只跑和改动相关的测试；全量 `pnpm verify` 只在提交前跑一次。
- `pnpm verify` 不调用真实模型；真实模型只在 `pnpm eval` 里跑。

## 防跑偏自查（交付前逐条过）

1. 只做当前任务：不顺手重构，不加任务外的功能；看到的其他问题记进交接栏或提出来。
2. 不自己发明：`06`、`07` 没写的接口、表、字段、状态不造；先查对应章节，查不到就问。
3. 测试失败先查实现，不改断言、不加 mock 绕过。
4. 不为方便测试改生产代码结构（新增仅供测试的导出、参数、开关）。
5. 不留 TODO 空壳冒充完成；没做完的写进验收单「没做」。
6. 不提前抽象：`06` 没要求、也没有两处以上实现的，不加工厂、基类、适配器。
7. 新增依赖先看已有的，PR 里写明理由。
8. 配置优先于写死：阈值、命令、超时、策略走配置，并带推荐默认值。

## 完成与回写

- 完成标准见 `07` §7.3：verify 全绿、关键部分有测试、`06` 已回写、台账已更新、有验收单。
- 实现了 `06` 某节，在该节标题下加一行 `> 实现：<路径>`；实现和 `06` 不一致时在同一提交里改 `06`。

## 本地环境

- 运行时数据只放 `~/.cloudcraft-dev/`；密钥只在 `~/.cloudcraft-dev/.env`，不进仓库、不打印到日志。
- 内网系统（GitLab、Jira、Tita、Apollo、`tita` CLI）只连 `sim/` 模拟服务；连接器只靠 baseUrl 区分真实与模拟。
