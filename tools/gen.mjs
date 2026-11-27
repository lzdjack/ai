// pnpm gen：重新生成所有生成物（docs/07 §3.2）。生成器随任务加入，verify 会检查生成物是否最新。
// 每项：{ name, run: () => Promise<void> | void, outputs: string[] }（outputs 为相对仓库根的路径）
export const GENERATORS = [];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const g of GENERATORS) await g.run();
}
