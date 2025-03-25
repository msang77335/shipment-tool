import { inject, injectable } from "inversify";
import { ResponseHelper } from "neopay-lib/helpers";
import { IQueryHandler, QueryHandler } from "ts-simple-cqrs";
import { Logger } from "../../../../lib/logger";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { ShipmentRepository } from "../../../domain/repository";
import { filterMapping } from "../../../infracstructure/queries/filter-mapping";
import { FilterOperator } from "../../../infracstructure/queries/filter-operator";
import { FilterAndData, FilterBuilder } from "../commons";
import { createPaginationOptions } from "../commons/paging";
import { GetShipmentsQuery } from "./GetShipments.query";
import { GetShipmentsResult } from "./GetShipments.result";

@injectable()
@QueryHandler(GetShipmentsQuery)
export class GetShipmentsHandler implements IQueryHandler<GetShipmentsQuery, GetShipmentsResult> {
	private loggerExecuteName: string;
	public constructor(
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceLogger)
		private logger: Logger,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentRepository)
		private shipmentRepository: ShipmentRepository
	) { }

	public async execute(query: GetShipmentsQuery): Promise<GetShipmentsResult> {
		this.loggerExecuteName = "GetShipmentsHandler"
		this.logger.info(`Start ${this.loggerExecuteName} - query:`, JSON.stringify(query));
		const { lookupStatus, logisticsTrackingCode, logisticsProvider, ftCode } = query;

		const pagingOptions = createPaginationOptions(query);

		const FilterAndData: { modelValue; operator }[] = [
			{
				modelValue: query.dateFr,
				operator: FilterOperator.GREATER_THAN_N_EQUAL,
			},
			{
				modelValue: query.dateTo,
				operator: FilterOperator.LESS_THAN_N_EQUAL,
			},
		];

		const filter = FilterBuilder.init<FilterAndData>()
			.withAnd("createdAt", FilterAndData)
			.withData("lookupStatus", lookupStatus, FilterOperator.EQUAL)
			.withData("logistics.trackingCode", logisticsTrackingCode, FilterOperator.EQUAL)
			.withData("logistics.provider", logisticsProvider, FilterOperator.EQUAL)
			.withData("ftCode", ftCode, FilterOperator.EQUAL)
			.build();

		const filterMapped = filterMapping(filter);

		try {
			const result = await this.shipmentRepository.listPaging(filterMapped, pagingOptions);

			return ResponseHelper.resOK(result);
		} catch (error) {
			this.logger.error(`${this.loggerExecuteName} => failed with error: ${JSON.stringify(error)}`);
		}
	}
}
