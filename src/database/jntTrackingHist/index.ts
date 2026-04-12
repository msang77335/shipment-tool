import { join } from 'node:path';

export const DB_NAMES = {
  JNT_TRACKING_HIST: 'jnt_tracking_hist',
}
export const DB_PATH = join(process.cwd(), 'data', 'sqlite.db');

export { jntTrackingHistDb, type JNTTrackingHistEntry, type PaginationParams, type PaginatedResult } from './jntTrackingHistDb';
