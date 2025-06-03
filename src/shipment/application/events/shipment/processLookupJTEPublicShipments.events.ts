import { IEvent } from "ts-simple-cqrs";

export class ProcessLookupJTEPublicShipmentsEvent implements IEvent {
	static readonly eventName = 'ProcessLookupJTEPublicShipmentsEvent';
}
