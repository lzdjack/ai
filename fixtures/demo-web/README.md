# 审批中心（demo-web）

迷你版审批中心：审批列表（筛选、排序、分页）、详情与流程节点、发起审批、撤回、中英文切换。
接口是仓内的模拟数据（`mock/`，由 Vite 中间件提供），不依赖后端。依赖同级目录的 `demo-lib`。

```bash
pnpm install
pnpm dev     # http://localhost:5173/#/approvals
pnpm test
pnpm build
```

当前登录人固定为张三（`u1`），见 `src/auth/current-user.ts`。
