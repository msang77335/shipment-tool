import { inject, injectable } from "inversify";
import { isNull } from "lodash";
import { EventsHandler, IEventHandler } from "ts-simple-cqrs";
import { SVC_ENV } from "../../../../../svc-env";
import { Logger } from "../../../../lib";
import { ShipmentAPIHandler } from "../../../apis";
import { LOGISTIC_PROVIDER, LOGISTIC_PROVIDER_CODES, STATUS } from "../../../domain/constants";
import { ShipmentRepository } from "../../../domain/repository";
import { LogisticsInfoDto } from "../../../interface/dtos/shipment/LookupShipment.dto";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { lookupQueue } from "./lookupQueue";
import { ProcessLookupShipmentsEvent } from "./processLookupShipment.events";

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
		const queueStatus = lookupQueue.getStatus();
		this.loggerExecuteName = `ProcessLookupShipmentsEventHandler`;
		
		try {
			if(queueStatus === 'LOCKED') return;
			this.logger.info(`Start ${this.loggerExecuteName}`);

			const processNext = () => {
				const logistics = lookupQueue.dequeue();

				// Queue LOCKED thì không làm gì
				if(isNull(logistics)) return;

				this.processLookupShipment(logistics);

				// Call API
				setTimeout(processNext, +SVC_ENV.get().LOOKUP_API_CALL_INTERVAL);
			};

			// Start processing
			processNext();
		} catch (error) {
			this.logger.error(`${this.loggerExecuteName} => failed with error: ${JSON.stringify(error)}`);
		}
	}

	private async processLookupShipment(logistics: LogisticsInfoDto): Promise<any> {
		// Xác định Provider
		const providerAPI = new ShipmentAPIHandler(this.logger).createProvider(this.getProviderCode(logistics));
		if (!providerAPI) {
			this.logger.warn(`No provider found for logistics provider: ${logistics.provider}`);
			return {};
		}

		// Tra cứu Shipment theo từng Provider
		const lookupResp = await providerAPI.getShipment(logistics.trackingCode);

		// Lấy Shipment đã khởi tạo. Lookup status => PROCESSING
		const shipment = await this.shipmentRepository.findOne({
			"logistics.provider": logistics.provider,
			"logistics.trackingCode": logistics.trackingCode,
			"lookupStatus": STATUS.PROCESSING,
		});

		if(!shipment) return;

		// Cập nhật kết quả tra cứu vào Shipment
		shipment.updateLookupResult(lookupResp);

		// Lưu thông tin Shipment
		await this.shipmentRepository.save(shipment);
	}

	private getProviderCode(logistics: LogisticsInfoDto): string {
		return LOGISTIC_PROVIDER_CODES[LOGISTIC_PROVIDER[logistics.provider]] ?? "";
	}
}
