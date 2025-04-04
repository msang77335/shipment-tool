import { PagingResult } from "../application/queries/commons";
import { Shipment } from "./Shipment";
export interface ShipmentRepository {
	newId: () => Promise<string>;
	create(entity: Shipment): Promise<Shipment>;
	save(entity: Shipment): Promise<any>;
	findById(id: string): Promise<Shipment>;
	findOne(filter: object): Promise<Shipment>;
	findOneReadyLookup(providers: string[]): Promise<Shipment>;
	findReadyLookup(provider: string, limit: number, cellPhone?: string): Promise<Shipment[]>;
	find(filter: object): Promise<Shipment[]>;
	listPaging(filter: object, options: object): Promise<PagingResult<Shipment>>;
}

export interface ConfigRepository {
  getShipmentTrackingConfig: () => Promise<any[]>;
}