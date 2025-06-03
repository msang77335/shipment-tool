import { inject, injectable } from "inversify";
import { EventsHandler, IEventHandler } from "ts-simple-cqrs";
import { Logger } from "../../../../lib";
import { sleep } from "../../../../utils";
import { JTEApiHelper } from "../../../apis/jte";
import { LOGISTIC_PROVIDERS, SYS_KEYS } from "../../../domain/constants";
import { ConfigRepository, ShipmentRepository } from "../../../domain/repository";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { ProcessLookupJTEShipmentsEvent } from "./processLookupJTEShipment.events";

let eventStatus: 'READY' | 'LOCKED' = 'READY';

const DEFAULT_SECOND_PER_LOOKUP_JTE = 80;

@injectable()
@EventsHandler(ProcessLookupJTEShipmentsEvent)
export class ProcessLookupJTEShipmentsEventHandler implements IEventHandler<ProcessLookupJTEShipmentsEvent> {
	private loggerExecuteName: string;
	public constructor(
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceLogger)
		private readonly logger: Logger,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentRepository)
		private shipmentRepository: ShipmentRepository,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ConfigRepository)
		private configRepository: ConfigRepository,
	) { }

	public async handle(): Promise<void> {
		this.loggerExecuteName = `ProcessLookupJTEShipmentsEventHandler`;

		this.logger.info(`${this.loggerExecuteName} eventStatus: ${eventStatus}`);

		try {
			if (eventStatus === 'LOCKED') return;
			// CLOCK event
			eventStatus = 'LOCKED';

			const sysConfig = await this.configRepository.getShipmentTrackingConfig();
			const secondPerLookup = +(sysConfig.find(x => x.key === SYS_KEYS.SECOND_PER_LOOKUP_JTE)?.value ?? DEFAULT_SECOND_PER_LOOKUP_JTE);

			this.logger.info(`Start ${this.loggerExecuteName}`);

			while (true) {
				await sleep(secondPerLookup * 1000);

				const shipment = await this.shipmentRepository.findOneReadyLookup([
					LOGISTIC_PROVIDERS["J&T Express"]
				]);

				if (!shipment) {
					// Không có Shipment nào PROCESSING không làm gì UN CLOCK event
					eventStatus = 'READY';
					// Đóng vòng lặp tại đây
					return;
				}

				this.processLookupShipments(shipment.properties().logistics?.cellPhone);
			}

		} catch (error) {
			this.logger.error(`${this.loggerExecuteName} => failed with error: ${JSON.stringify(error)}`);
		}
	}

	private async processLookupShipments(cellPhone: string): Promise<any> {
		const shipments = await this.shipmentRepository.findReadyLookup(LOGISTIC_PROVIDERS["J&T Express"], 9, cellPhone);

		this.logger.info(`${this.loggerExecuteName} with shipments: ${shipments?.map(shipment => shipment.properties().logistics.trackingCode).join(" | ")}`);

		if (shipments?.length === 0) return;

		const apiHelper = new JTEApiHelper(this.logger);

		const trackingCodes = shipments?.map((shipment) => shipment?.properties()?.logistics?.trackingCode);

		const lookupResults = await apiHelper.getShipments(trackingCodes, cellPhone);

		shipments.forEach((shipment) => {
			const result = lookupResults[shipment?.properties()?.logistics?.trackingCode];

			shipment.updateLookupResult(result);

			this.shipmentRepository.save(shipment);
		})
	}
}
