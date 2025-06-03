import { inject, injectable } from "inversify";
import { EventsHandler, IEventHandler } from "ts-simple-cqrs";
import { Logger } from "../../../../lib";
import { sleep } from "../../../../utils";
import { ERROR_MESSAGES } from "../../../apis";
import { JTEPublicApiHelper } from "../../../apis/jte-public";
import { LOGISTIC_PROVIDERS, SYS_KEYS } from "../../../domain/constants";
import { ConfigRepository, ShipmentRepository } from "../../../domain/repository";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { ProcessLookupJTEPublicShipmentsEvent } from "./processLookupJTEPublicShipments.events";

let eventStatus: 'READY' | 'LOCKED' = 'READY';

const DEFAULT_SECOND_PER_LOOKUP = 3;

@injectable()
@EventsHandler(ProcessLookupJTEPublicShipmentsEvent)
export class ProcessLookupJTEPublicShipmentsHandler implements IEventHandler<ProcessLookupJTEPublicShipmentsEvent> {
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
		this.loggerExecuteName = `ProcessLookupJTEPublicShipmentsEvent`;

		this.logger.info(`${this.loggerExecuteName} eventStatus: ${eventStatus}`);

		try {
			if (eventStatus === 'LOCKED') return;
			// CLOCK event
			eventStatus = 'LOCKED';

			const sysConfig = await this.configRepository.getShipmentTrackingConfig();
			const secondPerLookup = +(sysConfig.find(x => x.key === SYS_KEYS.SECOND_PER_LOOKUP_JTE_PUBLIC)?.value ?? DEFAULT_SECOND_PER_LOOKUP);

			this.logger.info(`Start ${this.loggerExecuteName}`);

			while (true) {
				await sleep(secondPerLookup * 1000);

				const shipments = await this.shipmentRepository.findReadyLookup(LOGISTIC_PROVIDERS["J&T Express"], 9);

				this.logger.info(`${this.loggerExecuteName} with shipments: ${shipments?.map(shipment => shipment.properties().logistics.trackingCode).join(" | ")}`);

				if (shipments.length === 0) {
					// Không có Shipment nào PROCESSING không làm gì UN CLOCK event
					eventStatus = 'READY';
					// Đóng vòng lặp tại đây
					return;
				}

				const apiHelper = new JTEPublicApiHelper(this.logger);

				const trackingCodes = shipments?.map((shipment) => shipment?.properties()?.logistics?.trackingCode);

				const lookupResults = await apiHelper.getShipments(trackingCodes);

				shipments.forEach((shipment) => {
					const result = lookupResults[shipment?.properties()?.logistics?.trackingCode];

					if (result) {
						shipment.updateLookupResult(result);
					} else {
						// Không có trong danh sách kết quả => không tìm thấy đơn hàng
						shipment.updateLookupResult({
							lookupStatus: "FAILED",
							note: ERROR_MESSAGES.JTE_NOT_FOUND
						})
					}

					this.shipmentRepository.save(shipment);
				})
			}

		} catch (error) {
			console.error(error);
			this.logger.error(`${this.loggerExecuteName} => failed with error: ${JSON.stringify(error)}`);
		}
	}
}
