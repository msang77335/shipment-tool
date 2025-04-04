import { inject, injectable } from "inversify";
import { isEmpty, uniqWith } from "lodash";
import { ResponseHelper } from "neopay-lib/helpers";
import { CommandHandler, ICommandHandler, IEventBus } from "ts-simple-cqrs";
import { APP_TYPES } from "../../../../../APP_TYPES";
import { Logger } from "../../../../lib/logger";
import { LOGISTIC_PROVIDERS } from "../../../domain/constants";
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
			const { logisticsInfo, ftCode } = command;

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
			const lookedShipments = await this.shipmentRepository.find(filter);

			const matchedLogisticsSet = new Set();
			const matchedShipmentsMap = new Map();

			lookedShipments.forEach(shipment => {
				const { provider, trackingCode, cellPhone } = shipment.properties().logistics;
				let key = `${provider}-${trackingCode}`
				if ([LOGISTIC_PROVIDERS["J&T Express"]].includes(provider) && cellPhone) {
					key = `${provider}-${trackingCode}-${cellPhone}`
				}

				matchedLogisticsSet.add(key);
				matchedShipmentsMap.set(key, shipment);
			});

			const needUpdateFTCodeShipments = [];

			uniqLogistics.forEach(logistics => {
				const { provider, trackingCode, cellPhone } = logistics;
				let key = `${provider}-${trackingCode}`
				if ([LOGISTIC_PROVIDERS["J&T Express"]].includes(provider) && cellPhone) {
					key = `${provider}-${trackingCode}-${cellPhone}`
				}
				const shipment = matchedShipmentsMap.get(key);

				if (!isEmpty(ftCode) && shipment && shipment.properties().ftCode !== ftCode) {
					shipment.updateFTCode(ftCode);
					needUpdateFTCodeShipments.push(shipment);
				}
			});

			// Cập nhật Shipments khác FT code
			await Promise.all(needUpdateFTCodeShipments.map((shipment) => this.shipmentRepository.save(shipment)))

			// Filter shipment chưa tra cứu
			const unmatchedShipments = uniqLogistics.filter(
				({ provider, trackingCode, cellPhone }) => {
					let key = `${provider}-${trackingCode}`
					if ([LOGISTIC_PROVIDERS["J&T Express"]].includes(provider) && cellPhone) {
						key = `${provider}-${trackingCode}-${cellPhone}`
					}
					return !matchedLogisticsSet.has(key)
				}
			);

			// Khởi tạo shipments
			await Promise.all(unmatchedShipments.map(async shipment => this.processInitShipment(shipment, ftCode)));

			// Trigger event tra cứu
			this.eventBus.publish(new ProcessLookupShipmentsEvent());

			return ResponseHelper.resOK(true);
		} catch (error) {
			this.logger.error(`${this.loggerExecuteName} => failed with error: ${JSON.stringify(error)}`);
		}
	}

	private async processInitShipment(logistics: LogisticsInfoDto, ftCode: string): Promise<any> {
		// Khởi tạo Shipment trạng thái PROCESSING
		const shipmentId = await this.shipmentRepository.newId();

		const shipment = this.shipmentFactory.create({
			id: shipmentId,
			lookupStatus: "PROCESSING",
			logistics: {
				provider: logistics.provider,
				trackingCode: logistics.trackingCode,
				cellPhone: logistics.cellPhone
			},
			ftCode: ftCode,
			updatedAt: new Date(),
			createdAt: new Date(),
		})

		// Lưu thông tin Shipment
		await this.shipmentRepository.save(shipment);

		return shipment;
	}
}


