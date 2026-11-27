import type { User } from '../types';

/** 迷你版不做登录，当前用户固定为张三 */
export const CURRENT_USER: User = { id: 'u1', name: '张三' };
