import { AggregateRoot, IEvent } from "ts-simple-cqrs";
import { GetShipmentResp } from "../apis";
import { STATUS } from "./constants";

export interface Event {
  time: Date;
  message: string;
}

export interface Logistics {
  provider: string;
  trackingCode: string;
}

export interface ShipmentProperties {
  readonly id: string;
  readonly logistics: Logistics;
  readonly lookupStatus: keyof typeof STATUS;
  readonly note?: string;
  readonly status?: string;
  readonly events?: Event[];
  readonly resp?: any;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
}

export interface Shipment {
  properties: () => ShipmentProperties;
  commit: () => void;
  publishEvent: (event: IEvent) => void;
  updateLookupResult: (lookupResult: GetShipmentResp) => void;
}

export class ShipmentImplement extends AggregateRoot implements Shipment {
  public id: string;
  public logistics: Logistics;
  public lookupStatus: keyof typeof STATUS;
  public note?: string;
  public status?: string;
  public events?: Event[];
  public resp?: any;
  public createdAt: Date;
  public updatedAt?: Date;

  public constructor(properties: ShipmentProperties) {
    super();
    Object.assign(this, properties);
  }

  public properties(): ShipmentProperties {
    return {
      id: this.id,
      logistics: this.logistics,
      lookupStatus: this.lookupStatus,
      note: this.note,
      status: this.status,
      events: this.events,
      resp: this.resp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  public updateLookupResult(lookupResult: GetShipmentResp) {
    this.lookupStatus = lookupResult.lookupStatus;
    this.status = lookupResult.status;
    this.note = lookupResult.note;
    this.events = lookupResult.events;
    this.resp = lookupResult.resp;
  }

  public publishEvent(event: IEvent): void {
    this.publish(event);
  }
}
