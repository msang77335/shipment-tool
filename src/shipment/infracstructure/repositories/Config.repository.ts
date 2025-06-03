import { inject, injectable } from "inversify";
import { ServiceBroker } from "moleculer";
import { APP_TYPES } from "../../../../APP_TYPES";
import { SVC_ENV } from "../../../../svc-env";
import { ConfigRepository } from "../../domain/repository";
import { IResponseBase } from "./interface";

@injectable()
export class ConfigRepositoryImplement implements ConfigRepository {
	public constructor(
		@inject(APP_TYPES.MoleculerBroker) private readonly broker: ServiceBroker
	) { }
	public async getShipmentTrackingConfig(): Promise<string[]> {
		const requestParams = {
			keyType: "SHIPMENT_TRACKING_SYS",
		};
		console.log(`Calling to ${SVC_ENV.get().CONFIG_SERVICE}.getListSystemConfigs with params ${JSON.stringify({ requestParams })}`);
		try {
			const result: IResponseBase<any> = await this.broker.call(
				`${SVC_ENV.get().CONFIG_SERVICE}.getListByKeyTypes`,
				{ keyType: "SHIPMENT_TRACKING_SYS" },
			);
			return result?.data ?? [];
		} catch (error) {
			console.log(`Calling to ${SVC_ENV.get().CONFIG_SERVICE}.getListSystemConfigs with error: ${JSON.stringify(error)}`);
		}
	}
}
