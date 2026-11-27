// 模拟接口：GET /api/approvals、GET /api/approvals/:id、POST /api/approvals、POST /api/approvals/:id/withdraw
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { canWithdraw } from '../src/auth/permissions';
import { CURRENT_USER } from '../src/auth/current-user';
import { validateApproval } from '../src/pages/approvals/validate';
import type { Approval, NewApproval } from '../src/types';
import { seedApprovals } from './data';

export function mockApi(): Plugin {
  const approvals = seedApprovals();
  return {
    name: 'demo-mock-api',
    configureServer(server) {
      server.middlewares.use('/api/approvals', (req, res) => {
        void handle(approvals, req, res);
      });
    },
  };
}

async function handle(list: Approval[], req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? '/').split('?')[0]!;
  const [, id, action] = path.split('/');
  if (req.method === 'GET' && !id) return json(res, 200, list);
  const item = list.find((a) => a.id === id);
  if (req.method === 'GET' && id) return item ? json(res, 200, item) : json(res, 404, { error: 'not_found' });
  if (req.method === 'POST' && !id) {
    const body = (await readJson(req)) as NewApproval;
    const errors = validateApproval(body);
    if (Object.keys(errors).length) return json(res, 400, { errors });
    const created: Approval = {
      ...body,
      id: `A${String(list.length + 1).padStart(3, '0')}`,
      applicant_id: CURRENT_USER.id,
      applicant_name: CURRENT_USER.name,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      nodes: [
        { name: '直属主管', approver_name: '周经理', result: 'waiting' },
        { name: '财务', approver_name: '吴会计', result: 'waiting' },
      ],
    };
    list.push(created);
    return json(res, 201, created);
  }
  if (req.method === 'POST' && item && action === 'withdraw') {
    if (!canWithdraw(CURRENT_USER, item)) return json(res, 403, { error: 'forbidden' });
    item.status = 'withdrawn';
    return json(res, 200, item);
  }
  return json(res, 404, { error: 'not_found' });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let data = '';
  for await (const chunk of req) data += chunk;
  return data ? JSON.parse(data) : {};
}
