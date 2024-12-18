import { Container } from "inversify";
import { Logger } from "../lib/logger";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "./SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { IntegrationEventPublisher } from "./application/events/integration";
import { ShipmentFactory } from "./domain/Shipment.factory";
import {
	ShipmentRepository
} from "./domain/repository";
import { LoggerImplement } from "./infracstructure/logger/logger";
import { MoleculerEventPublisherImplement } from "./infracstructure/message/moleculer-event.publisher";
import { ShipmentRepositoryImplement } from "./infracstructure/repositories/Shipment.repository";

export const initShipmentTrackingConnectorContainer = (container: Container) => {
	container.bind<Logger>(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceLogger).to(LoggerImplement);
	container.bind<IntegrationEventPublisher>(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentTrackingConnectorServiceEventPublisher).to(MoleculerEventPublisherImplement);

	container.bind<ShipmentRepository>(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentRepository).to(ShipmentRepositoryImplement);
	container.bind<ShipmentFactory>(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentFactory).to(ShipmentFactory);
};
