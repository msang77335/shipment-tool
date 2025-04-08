import { inject, injectable } from "inversify";
import { EventsHandler, IEventBus, IEventHandler } from "ts-simple-cqrs";
import { APP_TYPES } from "../../../../../APP_TYPES";
import { Logger } from "../../../../lib";
import { sleep } from "../../../../utils";
import { ShipmentAPIHandler } from "../../../apis";
import { LOGISTIC_PROVIDERS, LOGISTIC_PROVIDERS_MAP, LOGISTIC_PROVIDER_CODES, SYS_KEYS } from "../../../domain/constants";
import { ConfigRepository, ShipmentRepository } from "../../../domain/repository";
import { Logistics, Shipment } from "../../../domain/Shipment";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { ProcessLookupJTEShipmentsEvent } from "./processLookupJTEShipment.events";
import { ProcessLookupShipmentsEvent } from "./processLookupShipment.events";

let eventStatus: 'READY' | 'LOCKED' = 'READY';

const DEFAULT_SECOND_PER_LOOKUP = 3;

@injectable()
@EventsHandler(ProcessLookupShipmentsEvent)
export class ProcessLookupShipmentsEventHandler implements IEventHandler<ProcessLookupShipmentsEvent> {
	private loggerExecuteName: string;
	public constructor(
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceLogger)
		private readonly logger: Logger,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentRepository)
		private shipmentRepository: ShipmentRepository,
		@inject(APP_TYPES.EventBus)
		private eventBus: IEventBus,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ConfigRepository)
		private configRepository: ConfigRepository,
	) { }

	public async handle(): Promise<void> {
		this.loggerExecuteName = `ProcessLookupShipmentsEventHandler`;
		// Trigger event tra cứu
		this.eventBus.publish(new ProcessLookupJTEShipmentsEvent());

		try {
			if (eventStatus === 'LOCKED') return;
			// CLOCK event
			eventStatus = 'LOCKED';

			this.logger.info(`Start ${this.loggerExecuteName}`);
			const sysConfig = await this.configRepository.getShipmentTrackingConfig();
			const secondPerLookup = +(sysConfig.find(x => x.key === SYS_KEYS.SECOND_PER_LOOKUP)?.value ?? DEFAULT_SECOND_PER_LOOKUP);

			while(true) {
				await sleep(secondPerLookup * 1000);
				
				const shipment = await this.shipmentRepository.findOneReadyLookup([
					LOGISTIC_PROVIDERS.GHN,
					LOGISTIC_PROVIDERS["GHN - Hàng Cồng Kềnh"],
					LOGISTIC_PROVIDERS["Giao Hàng Nhanh"],
					LOGISTIC_PROVIDERS["Ninja Van"],
					LOGISTIC_PROVIDERS["Ninja Van Vietnam"],
					LOGISTIC_PROVIDERS["SPX Express"],
					LOGISTIC_PROVIDERS["SPX Instant"]
				]);

				if (!shipment) {
					// Không có Shipment nào PROCESSING không làm gì UN CLOCK event
					eventStatus = 'READY';
					return
				}

				this.processLookupShipment(shipment);
			}

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
		return LOGISTIC_PROVIDER_CODES[LOGISTIC_PROVIDERS_MAP[logistics.provider]] ?? "";
	}
}
