import { inject, injectable } from "inversify";
import { EventsHandler, IEventHandler } from "ts-simple-cqrs";
import { SVC_ENV } from "../../../../../svc-env";
import { Logger } from "../../../../lib";
import { ShipmentAPIHandler } from "../../../apis";
import { LOGISTIC_PROVIDER, LOGISTIC_PROVIDER_CODES } from "../../../domain/constants";
import { ShipmentRepository } from "../../../domain/repository";
import { Logistics, Shipment } from "../../../domain/Shipment";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { ProcessLookupShipmentsEvent } from "./processLookupShipment.events";

let eventStatus: 'READY' | 'LOCKED' = 'READY';

@injectable()
@EventsHandler(ProcessLookupShipmentsEvent)
export class ProcessLookupShipmentsEventHandler implements IEventHandler<ProcessLookupShipmentsEvent> {
	private loggerExecuteName: string;
	public constructor(
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceLogger)
		private readonly logger: Logger,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentRepository)
		private shipmentRepository: ShipmentRepository,
	) { }

	public async handle(): Promise<void> {
		this.loggerExecuteName = `ProcessLookupShipmentsEventHandler`;

		try {
			if (eventStatus === 'LOCKED') return;
			this.logger.info(`Start ${this.loggerExecuteName}`);

			const processNext = async () => {
				// CLOCK event
				eventStatus = 'LOCKED';

				const shipment = await this.shipmentRepository.findOnReadyLookup();

				if (!shipment) {
					// Không có Shipment nào PROCESSING không làm gì UN CLOCK event
					eventStatus = 'READY';
					return
				}

				this.processLookupShipment(shipment);

				// Call API
				setTimeout(processNext, +SVC_ENV.get().LOOKUP_API_CALL_INTERVAL);
			};

			// Start processing
			processNext();
		} catch (error) {
			this.logger.error(`${this.loggerExecuteName} => failed with error: ${JSON.stringify(error)}`);
		}
	}

	private async processLookupShipment(shipment: Shipment): Promise<any> {
		const logistics = shipment.properties().logistics
		// Xác định Provider
		const providerAPI = new ShipmentAPIHandler(this.logger).createProvider(this.getProviderCode(logistics));
		if (!providerAPI) {
			this.logger.warn(`No provider found for logistics provider: ${logistics.provider}`);
			return {};
		}

		// Tra cứu Shipment theo từng Provider
		const lookupResp = await providerAPI.getShipment(logistics.trackingCode, logistics.cellPhone);

		// Cập nhật kết quả tra cứu vào Shipment
		shipment.updateLookupResult(lookupResp);

		// Lưu thông tin Shipment
		await this.shipmentRepository.save(shipment);
	}

	private getProviderCode(logistics: Logistics): string {
		return LOGISTIC_PROVIDER_CODES[LOGISTIC_PROVIDER[logistics.provider]] ?? "";
	}
}
