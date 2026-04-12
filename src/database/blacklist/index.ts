import { join } from 'node:path';

export const DB_NAMES = {
  BLACKLIST: 'blacklist',
}
export const DB_PATH = join(process.cwd(), 'data', 'sqlite.db');

export { blacklistDb, type BlacklistEntry } from './blacklistDb';
