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

- 依赖边界按 `07` §2.3，由 `eslint-plugin-boundaries` 强制：`apps/*`、`packages/*` 不静态 import `plugins/*`；`sim/` 不依赖任何产品代码；纯浏览器包不用 Node 内置模块。
- 不写按插件名分支的代码（如 `if (engine === 'pi')`），只读 `AdapterCapabilities` 能力位（`06` §11.4）。
- 后端分 `routes / service / repo` 三层；接口定义只用 TypeBox，放 `packages/core-protocol`。
- 租户表一律用建表助手创建（一次生成 `workspace_id`、`project_id`、复合外键、RLS 策略、`rev`、`deleted_at`）；不手写绕过 RLS 的查询。
- 写事务里不做网络调用；外部副作用走 Outbox / `work_items`（`06` §3.6）。
- 聚合状态用 SQL 现算，不双写冗余字段（`06` §13.3）。

## 契约与生成物

- 接口返回强类型 DTO，集合用 `{items, next_cursor, has_more}`；错误统一 `ApiError { code, message, data? }`，`message` 按 locale 渲染。
- 界面文案和后端报错从第一天起走 `i18n/zh-CN.json` 词条，不在代码里写死中文句子。
- 生成物（`openapi.json`、TS 客户端、迁移 SQL）用 `pnpm gen` 生成，不手改；`pnpm verify` 会检查是否最新。
- 前端颜色、圆角、尺寸只用 `tokens/theme.css` 的变量；组件复用 `ui-kit`，对照 `reference/images/` 定稿图实现。滚动区域统一用 `<ScrollArea>`。

## 测试与完成

- 单元测试 `*.test.ts` 与源码同目录；数据库集成测试 `*.int.test.ts` 跑真实 PG。
- `pnpm verify` 不调用真实模型；真实模型只在 `pnpm eval` 里跑。
- 完成标准见 `07` §7.2：verify 全绿、有测试、`06` 已回写、台账已更新、有验收单。
- 实现了 `06` 某节，在该节标题下加一行 `> 实现：<路径>`；实现和 `06` 不一致时在同一提交里改 `06`。

## 本地环境

- 运行时数据只放 `~/.cloudcraft-dev/`；密钥只在 `~/.cloudcraft-dev/.env`，不进仓库、不打印到日志。
- 内网系统（GitLab、Jira、Tita、Apollo、`tita` CLI）只连 `sim/` 模拟服务；连接器只靠 baseUrl 区分真实与模拟。
