import { Service, ServiceBroker } from "moleculer";
import "reflect-metadata";
import { CQRSContainer } from "ts-simple-cqrs/container";
import { APP_TYPES } from "./APP_TYPES";
import { ShipmentTrackingConnectorServiceSchema } from "./src/services/shipment-tracking-connector.service";

const ServiceName = "shipment-tracking-connector-service";

class ShipmentTrackingConnectorService extends Service {
	public constructor(broker: ServiceBroker) {
		super(broker);
		this.broker = broker;
		this.initAppContainer();
		const serviceSchema = ShipmentTrackingConnectorServiceSchema(ServiceName, broker);
		this.parseServiceSchema(serviceSchema);
	}

	private serviceCreated() {
		this.logger.info(`${ServiceName} created.`);
	}

	private serviceStarted() {
		this.logger.info(`${ServiceName} started.`);
	}

	private serviceStopped() {
		this.logger.info(`${ServiceName} stopped.`);
	}

	private initAppContainer() {
		CQRSContainer.bind<ServiceBroker>(APP_TYPES.MoleculerBroker).toDynamicValue(() => this.broker);
	}
}

export = ShipmentTrackingConnectorService;
