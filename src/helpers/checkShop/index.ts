export enum ShopSiteEnum {
  Lazada = 'lazada',
  Shopee = 'shopee',
  Tiktok = 'tiktok',
}

export interface ScreenshotResult {
  site: ShopSiteEnum;
  status: "AVAILABLE" | "UNAVAILABLE";
  shopTile?: string;
  screenshot: Buffer;
}

export abstract class CheckShop {
  abstract readonly site: ShopSiteEnum;

  abstract matches(url: string): boolean;

  abstract screenshot(url: string): Promise<ScreenshotResult>;
}

export { LazadaCheckShop } from './lazadaCheckShop';

import { LazadaCheckShop } from './lazadaCheckShop';

const shopCheckers: CheckShop[] = [new LazadaCheckShop()];

export function checkShop(url: string): CheckShop | null {
  return shopCheckers.find((checker) => checker.matches(url)) ?? null;
}