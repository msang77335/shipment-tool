import { join } from 'node:path';

export const DB_NAMES = {
  SCAN_PHONE_JOBS: 'scan_phone_jobs',
}
export const DB_PATH = join(process.cwd(), 'data', 'sqlite.db');

export { scanPhoneJobsDb, type ScanPhoneJobEntry } from './scanPhoneJobsDb';
