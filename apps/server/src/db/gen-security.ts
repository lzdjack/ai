// pnpm gen 的一步：按建表助手登记的租户表重新生成 src/db/sql/security.sql。
import fs from 'node:fs';
import { SECURITY_SQL } from './migrate.ts';
import { securitySql } from './security.ts';

fs.writeFileSync(SECURITY_SQL, securitySql());
