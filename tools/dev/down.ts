// pnpm dev:down：停掉本地基础设施，数据保留。
import { compose, loadConfigOrExit, must } from './lib.ts';

must('停止容器', compose(loadConfigOrExit(), ['down']));
console.log('✓ 已停止（数据保留在数据目录，dev:up 可恢复）');
