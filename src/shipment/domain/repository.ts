import { PagingResult } from "../application/queries/commons";
import { Shipment } from "./Shipment";
export interface ShipmentRepository {
	newId: () => Promise<string>;
	create(entity: Shipment): Promise<Shipment>;
	save(entity: Shipment): Promise<any>;
	findById(id: string): Promise<Shipment>;
	findOne(filter: object): Promise<Shipment>;
	findOnReadyLookup(): Promise<Shipment>;
	find(filter: object): Promise<Shipment[]>;
	listPaging(filter: object, options: object): Promise<PagingResult<Shipment>>;
}