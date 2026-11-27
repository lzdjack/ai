// 宿主侧工具与事实覆写（docs/06 §5.4、§11.4）。E2：工具端与 submit_delivery。
export {
  FINISHING_TOOLS,
  HOST_TOOLS,
  SUBMIT_DELIVERY,
  SubmitDeliveryParams,
  workFile,
  type HostTool,
  type SubmitDelivery,
  type ToolResult,
  type ToolRound,
} from './tools.ts';
export { createToolHost, type ToolCallRecord, type ToolHost } from './tool-host.ts';
