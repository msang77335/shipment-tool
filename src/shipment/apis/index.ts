import { Logger } from "../../lib";
import { LOGISTIC_PROVIDER_CODES, STATUS } from "../domain/constants";
import { Event } from "../domain/Shipment";
import { GHNApiHelper } from "./ghn";
import { NinjaVanApiHelper } from "./ninja-van";
import { SPXApiHelper } from "./spx";

export const ERROR_STATUS_CODES = {
	TOO_MANY_REQUESTS: 429
}

export interface GetShipmentResp {
	lookupStatus: keyof typeof STATUS,
	status?: string;
	events?: Event[];
	resp?: any;
	note?: string;
}

export interface ShipmentProviderAPI {
	getShipment(trackingId: string): Promise<any>;
}

export class ShipmentAPIHandler {
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	createProvider(provider: string): ShipmentProviderAPI | null {
		switch (provider) {
			case LOGISTIC_PROVIDER_CODES.SPX:
				return new SPXApiHelper(this.logger);

			case LOGISTIC_PROVIDER_CODES.GHN:
				return new GHNApiHelper(this.logger);

			case LOGISTIC_PROVIDER_CODES["NINJA-VAN"]:
				return new NinjaVanApiHelper(this.logger);

			default:
				this.logger.warn(`No provider found for: ${provider}`);
				return null;
		}
	}
}