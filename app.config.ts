import { IEnvironmentField } from "./svc-env";

export interface ENV {
	[key: string]: string;
}

export class AppConfig {
	public SERVICE_NAME: string;
	public PORT: string;
	public MONGO_URI: string;

	public loadConfig(env: ENV | IEnvironmentField) {
		Object.assign(this, env);
	}
}
