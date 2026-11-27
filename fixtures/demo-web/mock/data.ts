import type { Approval } from '../src/types';

const USERS = [
  { id: 'u1', name: '张三' },
  { id: 'u2', name: '李四' },
  { id: 'u3', name: '王五' },
  { id: 'u4', name: '赵六' },
];
const TITLES = ['差旅报销', '采购申请', '请假申请', '设备领用', '合同用印', '加班申请'];
const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;

/** 24 条固定的模拟审批，按 id 生成，每次启动内容一样 */
export function seedApprovals(): Approval[] {
  return Array.from({ length: 24 }, (_, i) => {
    const applicant = USERS[i % USERS.length]!;
    const status = STATUSES[Math.floor(i / 2) % STATUSES.length]!;
    const submitted = new Date(Date.UTC(2026, 10, 1 + i, 1 + (i % 9), (i * 13) % 60));
    return {
      id: `A${String(i + 1).padStart(3, '0')}`,
      title: `${TITLES[i % TITLES.length]} #${i + 1}`,
      applicant_id: applicant.id,
      applicant_name: applicant.name,
      amount: Math.round(((i * 7919) % 500000) + 88) / 10,
      reason: '业务需要',
      status,
      submitted_at: submitted.toISOString(),
      nodes: [
        { name: '直属主管', approver_name: '周经理', result: status === 'pending' ? 'waiting' : 'approved' },
        {
          name: '财务',
          approver_name: '吴会计',
          result: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'waiting',
        },
      ],
    };
  });
}
