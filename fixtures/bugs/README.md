# Bug 题库（docs/07 §6.2）

每道题：`<id>.yaml`（题面）、`*.inject.patch`（植入）、`*.fix.patch`（参考修复）、`<id>.test.ts`（隐藏测试）。
补丁、隐藏测试只在这里，不推进模拟 GitLab。

- 自检：`pnpm fixtures:check`（植入后隐藏测试失败、打上参考修复后通过）
- 推进模拟 GitLab：`pnpm fixtures:seed`（`dev:up` 会自动调用）

隐藏测试运行时放在被测仓的 `src/__hidden__/` 下，按这个位置写相对路径。
