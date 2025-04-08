import _ from "lodash";
import { ServiceBroker } from "moleculer";

export const REQUIRED_KEY = [
	"SERVICE_NAME",
	"PORT",
	"MONGO_URI",

	"CONFIG_SERVICE",

	"SPX_API_ENDPOINT",
	"SPX_API_KEY",
	"GHN_API_ENDPOINT",
	"NINJA_VAN_API_ENDPOINT",
	"JTE_API_ENDPOINT",
	"LOOKUP_API_CALL_INTERVAL",

	"VAULT_ENDPOINT",
	"VAULT_VERSION",
	"VAULT_ROLE_ID",
	"VAULT_SECRET_ID",
	"VAULT_KV_PATH",
];

export interface IEnvironmentField {
	readonly SERVICE_NAME: string;
	readonly PORT: string;
	readonly MONGO_URI: string;

	readonly CONFIG_SERVICE: string;

	readonly SPX_API_ENDPOINT: string;
	readonly SPX_API_KEY: string;
	readonly GHN_API_ENDPOINT: string;
	readonly NINJA_VAN_API_ENDPOINT: string;
	readonly JTE_API_ENDPOINT: string;
	readonly LOOKUP_API_CALL_INTERVAL: string;

	readonly VAULT_ENDPOINT: string;
	readonly VAULT_VERSION: string;
	readonly VAULT_ROLE_ID: string;
	readonly VAULT_SECRET_ID: string;
	readonly VAULT_KV_PATH: string;
}

export class SVC_ENV {
	public static _env: any = {};

	public static setEnvForTesting(env: any): void {
		this._env = env;
	}

	public static set(key: string, val: any): void {
		this._env[key] = val;
	}

	public static get(): IEnvironmentField {
		return this._env;
	}

	public static setEnvironmentsFromEnv(broker: ServiceBroker, serviceName: string) {
		let envServices = broker.services.find(x => x.name === serviceName)?.settings?.envServices;
		if (_.isEmpty(envServices)) {
			console.log("Load Env Service From Broker.EnvServices");
			envServices = broker.envServices ? broker.envServices[serviceName] : null;
		}
		if (_.isEmpty(envServices)) {
			console.log("Load Env Service From Process.Env");
			envServices = JSON.parse(JSON.stringify(process.env));
		}
		Object.keys(envServices).forEach(item => {
			SVC_ENV.set(item, envServices[item] || "");
		});
	}
}
