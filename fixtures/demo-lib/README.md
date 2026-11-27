# @demo/lib

审批中心共用的组件与工具。

- `formatAmount(value, locale)`：金额，保留两位小数、千分位
- `formatDate(iso, locale)` / `formatDateTime(iso, locale)`：日期
- `statusMeta(status, locale)` 与 `<StatusTag>`：审批状态的文字和颜色

```bash
pnpm install
pnpm test
pnpm build   # 类型检查
```
