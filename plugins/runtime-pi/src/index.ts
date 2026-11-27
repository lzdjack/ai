// Pi 引擎插件（docs/06 §5.4、§11.4）：实现 AgentRuntimePlugin，执行器按配置动态加载默认导出。
import { piRuntime } from './plugin.ts';

export default piRuntime;
export { piRuntime, translate } from './plugin.ts';
export { PiRpc, type PiEvent, type PiResponse } from './rpc.ts';
