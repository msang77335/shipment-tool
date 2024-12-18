import { inject, injectable } from "inversify";
import { EventPublisher } from "ts-simple-cqrs/event-publisher";
import { TYPES } from "ts-simple-cqrs/types";
import { Shipment, ShipmentImplement, ShipmentProperties } from "./Shipment";

@injectable()
export class ShipmentFactory {
	public constructor(
		@inject(TYPES.EventPublisher)
		private readonly eventPublisher: EventPublisher
	) {}
	public create(shipment: ShipmentProperties): Shipment {
		return this.eventPublisher.mergeObjectContext(new ShipmentImplement(shipment));
	}
	public reconstitute(properties: ShipmentProperties): Shipment {
		return this.eventPublisher.mergeObjectContext(new ShipmentImplement(properties));
	}
}
