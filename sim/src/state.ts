// 模拟服务的持久状态：一个 JSON 文件（<数据目录>/sim/state.json），单进程读写。
// 故障注入不进这里（重启即清空）。
import fs from 'node:fs';
import path from 'node:path';

export type GitlabRole = 'maintainer' | 'developer';

export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  /** 假设：角色全局生效，不按项目区分 */
  role: GitlabRole;
  /** 只能推这些分支（glob，如 fix/*）；空表示不限。对应 06 §6.1 的 Bot 推送限制 */
  push_branch_patterns: string[];
  token: string;
}

export interface GitlabProject {
  id: number;
  path_with_namespace: string;
  default_branch: string;
  protected_branches: string[];
  created_at: string;
}

export interface GitlabMr {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  source_branch: string;
  target_branch: string;
  state: 'opened' | 'merged' | 'closed';
  author_id: number;
  merged_by_id: number | null;
  merge_commit_sha: string | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
}

export interface GitlabHook {
  id: number;
  project_id: number;
  url: string;
  token: string | null;
  push_events: boolean;
  merge_requests_events: boolean;
  created_at: string;
}

export interface SimState {
  seq: number;
  gitlab: {
    users: GitlabUser[];
    projects: GitlabProject[];
    merge_requests: GitlabMr[];
    hooks: GitlabHook[];
  };
}

const empty = (): SimState => ({
  seq: 0,
  gitlab: { users: [], projects: [], merge_requests: [], hooks: [] },
});

export class StateStore {
  readonly data: SimState;
  private readonly file: string;

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'state.json');
    this.data = fs.existsSync(this.file)
      ? (JSON.parse(fs.readFileSync(this.file, 'utf8')) as SimState)
      : empty();
  }

  nextId(): number {
    this.data.seq += 1;
    return this.data.seq;
  }

  /** 改完 data 后调用；先写临时文件再改名，避免写一半 */
  save(): void {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
