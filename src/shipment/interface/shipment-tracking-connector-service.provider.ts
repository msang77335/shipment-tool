import { injectable } from "inversify";
import { ICommandBus, IQueryBus } from "ts-simple-cqrs";
import { AppConfig } from "../../../app.config";
import { Logger } from "../../lib/logger";
import { Validate, Validator } from "../../lib/ts-class-validator";
import { LookupShipmentsCommand } from "../application/commands/shipment/LookupShipments.command";
import { LookupShipmentsResult } from "../application/commands/shipment/LookupShipments.result";
import { GetShipmentsQuery } from "../application/queries/shipment/GetShipments.query";
import { GetShipmentsResult } from "../application/queries/shipment/GetShipments.result";
import { GetShipmentsDto } from "./dtos/shipment/GetShipments.dto";
import { LookupShipmentsDto } from "./dtos/shipment/LookupShipment.dto";
import { IMeta } from "./utils/meta";

export interface ShipmentTrackingConnectorServiceProps {
	logger?: Logger;
	appConfig: AppConfig;
}

export interface ShipmentTrackingConnectorServiceOptions {
	commandBus?: ICommandBus;
	queryBus?: IQueryBus;
}

@injectable()
export class ShipmentTrackingConnectorServiceProvider {
	public readonly commandBus: ICommandBus;
	public readonly queryBus: IQueryBus;

	private readonly logger: Logger;
	private working = false;

	public constructor(protected readonly props: ShipmentTrackingConnectorServiceProps, opts?: Partial<ShipmentTrackingConnectorServiceOptions>) {
		this.logger = props.logger || console;
		this.commandBus = opts.commandBus;
		this.queryBus = opts.queryBus;
	}

	// Tra cứu Shipments
	@Validate()
	public async lookupShipments(
		@Validator() params: LookupShipmentsDto,
		meta: IMeta
	): Promise<LookupShipmentsResult> {
		const command = new LookupShipmentsCommand(params);
		const result = await this.commandBus.execute<LookupShipmentsCommand, LookupShipmentsResult>(command);
		return result;
	}

	// Lấy danh sách Shipments đã tra cứu
	@Validate()
	public async getShipment(
		@Validator() params: GetShipmentsDto,
		meta: IMeta
	): Promise<GetShipmentsResult> {
		const query = new GetShipmentsQuery(params);
		const result = await this.queryBus.execute<GetShipmentsQuery, GetShipmentsResult>(query);
		return result;
	}

	public async start() {
		if (this.working) {
			return;
		}
		this.logger.info("Shipment connector service provider has been started");
		this.working = true;
	}
	public async stop() {
		if (!this.working) {
			return;
		}
		this.logger.info("Shipment connector service has been stopped");
		this.working = false;
	}
}
