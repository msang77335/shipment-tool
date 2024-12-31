import { inject, injectable } from "inversify";
import { uniqWith } from "lodash";
import { ResponseHelper } from "neopay-lib/helpers";
import { CommandHandler, ICommandHandler, IEventBus } from "ts-simple-cqrs";
import { APP_TYPES } from "../../../../../APP_TYPES";
import { Logger } from "../../../../lib/logger";
import { ShipmentRepository } from "../../../domain/repository";
import { ShipmentFactory } from "../../../domain/Shipment.factory";
import { FilterOperator } from "../../../infracstructure/queries/filter-operator";
import { LogisticsInfoDto } from "../../../interface/dtos/shipment/LookupShipment.dto";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { ProcessLookupShipmentsEvent } from "../../events/shipment/processLookupShipment.events";
import { LookupShipmentsCommand } from "./LookupShipments.command";
import { LookupShipmentsResult } from "./LookupShipments.result";

@injectable()
@CommandHandler(LookupShipmentsCommand)
export class LookupShipmentsHandler
	implements ICommandHandler<LookupShipmentsCommand, LookupShipmentsResult> {
	private loggerExecuteName: string;
	public constructor(
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceLogger)
		private logger: Logger,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentRepository)
		private shipmentRepository: ShipmentRepository,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentFactory)
		private shipmentFactory: ShipmentFactory,
		@inject(APP_TYPES.EventBus)
		private eventBus: IEventBus,
	) { }

	public async execute(command: LookupShipmentsCommand): Promise<any> {
		this.loggerExecuteName = `LookupShipmentsHandler`;
		this.logger.info(`Start ${this.loggerExecuteName} - command:`, JSON.stringify(command));
		try {
			const { logisticsInfo } = command;

			// Loại trùng
			const uniqLogistics = uniqWith(logisticsInfo, (a, b) => a.provider === b.provider && a.trackingCode === b.trackingCode);

			// Filter DB 
			const filter = {
				[FilterOperator.OR]: uniqLogistics?.map((logistics) => ({
					"logistics.provider": logistics.provider,
					"logistics.trackingCode": logistics.trackingCode
				}))
			}

			// Shipment đã tra cứu
			const matchedShipments = await this.shipmentRepository.find(filter);

			// Filter Shipment Chưa tra cứu
			const unmatchedShipments = uniqLogistics.filter(logistics =>
				matchedShipments.every(shipment => {
					const { provider, trackingCode } = shipment.properties().logistics;
					return `${provider}-${trackingCode}` !== `${logistics.provider}-${logistics.trackingCode}`;
				})
			);

			// Khởi tạo Shipments
			const shipments = await Promise.all(
				unmatchedShipments.map((logistics) => this.processInitShipment(logistics))
			);

			// Trigger event tra cứu
			this.eventBus.publish(new ProcessLookupShipmentsEvent());

			return ResponseHelper.resOK([...matchedShipments, ...shipments]);
		} catch (error) {
			this.logger.error(`${this.loggerExecuteName} => failed with error: ${JSON.stringify(error)}`);
		}
	}

	private async processInitShipment(logistics: LogisticsInfoDto): Promise<any> {
		// Khởi tạo Shipment trạng thái PROCESSING
		const shipmentId = await this.shipmentRepository.newId();

		const shipment = this.shipmentFactory.create({
			id: shipmentId,
			lookupStatus: "PROCESSING",
			logistics: logistics,
			updatedAt: new Date(),
			createdAt: new Date(),
		})

		// Lưu thông tin Shipment
		await this.shipmentRepository.save(shipment);

		return shipment;
	}
}


