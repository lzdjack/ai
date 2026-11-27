// 模型代理（docs/06 §1.2、§11.1）。S1 起：令牌校验、密钥注入、钉死上游与模型、用量统计。
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
