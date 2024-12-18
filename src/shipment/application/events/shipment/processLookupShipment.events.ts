import { IEvent } from "ts-simple-cqrs";

export class ProcessLookupShipmentsEvent implements IEvent {
	static readonly eventName = 'ProcessLookupShipmentsEvent';
}
