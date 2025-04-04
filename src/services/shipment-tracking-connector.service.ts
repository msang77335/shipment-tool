"use strict";

import { Context, ServiceBroker, ServiceSchema } from "moleculer";
import mongoose from "mongoose";
import { SimpleCQRS, SimpleCQRSType } from "ts-simple-cqrs";
import { CQRSContainer } from "ts-simple-cqrs/container";
import { APP_TYPES } from "../../APP_TYPES";
import { AppConfig } from "../../app.config";
import { VaultSecurity } from "../../security/vault.security";
import { SVC_ENV } from "../../svc-env";
import { NeoPayError } from "../lib";
import { trackingIn, trackingOut } from "../middlewares";
import { LookupShipmentsHandler } from "../shipment/application/commands/shipment/LookupShipments.handler";
import { ProcessLookupJTEShipmentsEventHandler } from "../shipment/application/events/shipment/processLookupJTEShipment.handler";
import { ProcessLookupShipmentsEventHandler } from "../shipment/application/events/shipment/processLookupShipment.handler";
import { GetShipmentsHandler } from "../shipment/application/queries/shipment/GetShipments.handler";
import { initShipmentTrackingConnectorContainer } from "../shipment/container";
import { ShipmentTrackingConnectorServiceProvider } from "../shipment/interface/shipment-tracking-connector-service.provider";

export const ShipmentTrackingConnectorServiceSchema = (ServiceName: string, serviceBroker?: ServiceBroker): ServiceSchema => {
	let shipmentTrackingConnectorServiceProvider: ShipmentTrackingConnectorServiceProvider;
	let appConfig: AppConfig;

	return {
		name: ServiceName,
		settings: {},
		mixins: [],
		created: () => {
			console.log("created");
		},
		async started() {
			SVC_ENV.setEnvironmentsFromEnv(serviceBroker, ServiceName);
			await VaultSecurity.overWriteVaultEnv();
			const isMissing = VaultSecurity.checkMissingEnvVariable();
			if (isMissing) {
				await serviceBroker.destroyService(ServiceName);
				throw Error("MIS_ENV_KEY");
			} else {
				appConfig = new AppConfig();
				appConfig.loadConfig(SVC_ENV.get());
				CQRSContainer.bind<AppConfig>(APP_TYPES.AppConfig).toDynamicValue(() => appConfig);
				await mongoose
					.connect(SVC_ENV.get().MONGO_URI)
					.then(r => r)
					.catch(err => {
						serviceBroker.logger.fatal(`Error connecting to Database ${err}`);
						serviceBroker.destroyService(ServiceName);
					});
			}

			initShipmentTrackingConnectorContainer(CQRSContainer);
			const { commandBus, queryBus, eventBus }: SimpleCQRSType = SimpleCQRS.exploreServices({
				commands: [
					LookupShipmentsHandler 
				],
				events: [
					ProcessLookupShipmentsEventHandler,
					ProcessLookupJTEShipmentsEventHandler
				],
				queries: [
					GetShipmentsHandler
				],
				sagas: [],
			});

			shipmentTrackingConnectorServiceProvider = new ShipmentTrackingConnectorServiceProvider(
				{
					logger: serviceBroker.getLogger("shipment-tracking-connector-service"),
					appConfig,
				},
				{ commandBus, queryBus, eventBus }
			);
			
			await Promise.all([
				shipmentTrackingConnectorServiceProvider?.start(),
			]);
		},
		stopped: async () => {
			await Promise.all([
				shipmentTrackingConnectorServiceProvider?.stop(),
			]);
		},

		actions: {
			lookupShipments: {
				description: "Tra cứu thông tin Shipments",
				handler: async (ctx: Context<any, any>) => {
					return await shipmentTrackingConnectorServiceProvider.lookupShipments(ctx.params, ctx.meta);
				},
			},

			getShipments: {
				description: "Lấy danh sách đơn hàng đã tra cứu",
				handler: async (ctx: Context<any, any>) => {
					return await shipmentTrackingConnectorServiceProvider.getShipment(ctx.params, ctx.meta);
				},
			},
		},

		hooks: {
			/** Verify all expression before action call */
			before: {
				"*": [trackingIn],
			},
			/** Verify data return or something jobs after action was called */
			after: {
				"*": [trackingOut],
			},
			error: {
				"*"(ctx, err: any): any {
					this.logger.error(`Error occurred when '${ctx.action.name}' action was called`, err);
					if (err instanceof NeoPayError) {
						// Handle something
					} else {
						err = new NeoPayError(err.message, err.code, err.type, err.data);
					}
					err.data = {
						...err.data,
					};
					return {
						code: err.code,
						state: 3, // Failed state
						message: err.message,
						type: err.type,
						data: err.data,
					};
				},
			},
		},
	};
};
