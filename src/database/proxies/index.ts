import { join } from 'node:path';

export const DB_NAMES = {
  PROXIES: 'proxies',
};
export const DB_PATH = join(process.cwd(), 'data', 'sqlite.db');

export { proxiesDb, type ProxyRecord } from './proxiesDb';
