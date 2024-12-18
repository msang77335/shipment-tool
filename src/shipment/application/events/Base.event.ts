import { IEvent } from "ts-simple-cqrs";

export class BaseEvent implements IEvent {
	public retryTimes: number = 0;
}
