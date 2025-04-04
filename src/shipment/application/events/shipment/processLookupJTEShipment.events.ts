import { IEvent } from "ts-simple-cqrs";

export class ProcessLookupJTEShipmentsEvent implements IEvent {
	static readonly eventName = 'ProcessLookupJTEShipmentsEvent';
}
