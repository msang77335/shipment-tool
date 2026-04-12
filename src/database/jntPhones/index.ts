import { join } from 'node:path';

export const DB_NAMES = {
  JNT_PHONES: 'jnt_phones',
}
export const DB_PATH = join(process.cwd(), 'data', 'sqlite.db');

export { jntPhonesDb, type JNTPhoneEntry } from './jntPhonesDb';
