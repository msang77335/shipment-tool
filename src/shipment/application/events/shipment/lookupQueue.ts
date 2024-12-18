import { LogisticsInfoDto } from "../../../interface/dtos/shipment/LookupShipment.dto";

export class LookupQueue<T> {
  private queue: T[] = [];
  private status: 'READY' | 'LOCKED';

  public constructor(initialItems: T[] = []) {
    this.queue = [...initialItems];
    this.status = 'READY';
  }

  // Thêm item vào Queue
  public enqueue(item: T): void {
    this.queue.push(item);
  }

  // Lấy 1 item từ Queue
  public dequeue(): T | null {
    if (this.isEmpty()) {
      return null;
    }

    this.status = 'LOCKED';
    const item = this.queue.shift();

    if (this.isEmpty()) {
      this.status = 'READY';
    }

    return item;
  }

  // Check queue rỗng
  private isEmpty(): boolean {
    return this.queue.length === 0;
  }

  // lấy queue Status
  public getStatus() {
    return this.status;
  }
}

export const lookupQueue = new LookupQueue<LogisticsInfoDto>([]);
