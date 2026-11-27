// 模型代理（docs/06 §1.2、§11.1）：令牌校验、密钥注入、钉死上游与模型、用量统计；E2 起单独进程，
// 执行器经控制 Socket 登记每轮令牌。
export { controlSocketPath, startLlmProxy, type ProxyInfo, type RunningProxy } from './control.ts';
export {
  DEFAULT_ROUND_LIMITS,
  createLlmProxy,
  usageMeter,
  type LlmApi,
  type LlmProxy,
  type LlmUpstream,
  type RoundLimits,
  type Usage,
} from './proxy.ts';
