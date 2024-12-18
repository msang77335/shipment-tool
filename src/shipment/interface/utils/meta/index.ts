import { HeadersMeta } from "./headers.meta";
import { UserMeta } from "./user.meta";

interface BaseMeta {
  [key: string]: any;
}

export interface IMeta extends BaseMeta {
  user: UserMeta;
  headers: HeadersMeta;
  business: string;
  trackingId: string;
  reqId: string;
  parentId: string;
}
