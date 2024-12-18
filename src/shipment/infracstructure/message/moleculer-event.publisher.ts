import { inject, injectable } from "inversify";
import { ServiceBroker } from "moleculer";
import { APP_TYPES } from "../../../../APP_TYPES";
import { Logger } from "../../../lib/logger";
import { IntegrationEvent, IntegrationEventPublisher } from "../../application/events/integration";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../SHIPMENT_TRACKING_CONNECTOR_TYPES";

@injectable()
export class MoleculerEventPublisherImplement implements IntegrationEventPublisher {
	public constructor(
		@inject(APP_TYPES.MoleculerBroker) private readonly broker: ServiceBroker,
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceLogger) private readonly logger: Logger
	) {}
	public async publish(message: IntegrationEvent, $framworkContext?: any): Promise<void> {
		await this.broker.emit(message.subject, message.data, $framworkContext);
	}
}
