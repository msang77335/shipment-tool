import { join } from 'node:path';

export const DB_NAMES = {
  SCAN_PHONE_JOBS: 'scan_phone_jobs',
  SCAN_PHONE_JOB_REF: 'scan_phone_job_ref'
}
export const DB_PATH = join(process.cwd(), 'data', 'sqlite.db');

export { scanPhoneJobsDb, type ScanPhoneJobEntry } from './scanPhoneJobsDb';
export { scanPhoneJobRefDb, type ScanPhoneJobRefEntry } from './scanPhoneJobRefDb';
