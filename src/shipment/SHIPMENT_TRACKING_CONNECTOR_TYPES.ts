export const SHIPMENT_TRACKING_CONNECTOR_TYPES = {
	ShipmentTrackingConnectorServiceLogger: Symbol.for("ShipmentTrackingConnectorServiceLogger"),
	ShipmentTrackingConnectorServiceEventPublisher: Symbol.for("ShipmentTrackingConnectorServiceEventPublisher"),

	ShipmentRepository: Symbol.for("ShipmentRepository"),
	ShipmentFactory: Symbol.for("ShipmentFactory"),
	ConfigRepository: Symbol.for("ConfigRepository"),
};
