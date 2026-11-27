// drizzle-kit：由 src/db/schema 生成迁移 SQL（docs/07 §3.2）。只用于 generate，不连数据库。
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
});
