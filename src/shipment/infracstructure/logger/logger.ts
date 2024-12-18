import { inject, injectable } from "inversify";
import { ServiceBroker } from "moleculer";
import { APP_TYPES } from "../../../../APP_TYPES";
import { Logger } from "../../../lib/logger";

@injectable()
export class LoggerImplement implements Logger {
	private readonly logger: Logger;

	public constructor(@inject(APP_TYPES.MoleculerBroker) private readonly broker: ServiceBroker) {
		this.logger = this.broker.getLogger("shipment-connector");
	}

	public error(...args: any[]): void {
		this.logger.error(args);
	}

	public warn(...args: any[]): void {
		this.logger.warn(args);
	}

	public info(...args: any[]): void {
		this.logger.info(args);
	}

	public debug(...args: any[]): void {
		this.logger.debug(args);
	}

	public trace(...args: any[]): void {
		this.logger.trace(args);
	}
}
