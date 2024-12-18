import { Context } from "moleculer";
import { LoggerHelper } from "neopay-lib/helpers";

import { LOG_HIDDEN_FIELDS } from "./constant";

export function trackingIn(
	ctx: Context<any, { correlationId: string; requestTime: Date; clientIP: string; userName: string; user: any }>
) {
	const inObj = {
		correlationId: ctx.meta.correlationId || ctx.id,
		requestTime: ctx.meta.requestTime,
		clientIP: ctx.meta.clientIP,
		caller: ctx.caller,
		action: ctx.action.name,
		params: ctx.params,
		userName: ctx.meta.user && ctx.meta.user.userName ? ctx.meta.user.userName : "GUEST",
		ignoreFields: LOG_HIDDEN_FIELDS,
	};
	const inLog = LoggerHelper.getFormatLogSvIN(inObj);
	this.logger.info(inLog);
}

export function trackingOut(
	ctx: Context<any, { correlationId: string; requestTime: Date; clientIP: string; userName: string; user: any }>,
	data: any
) {
	const outObj = {
		correlationId: ctx.meta.correlationId || ctx.id,
		requestTime: ctx.meta.requestTime,
		clientIP: ctx.meta.clientIP,
		caller: ctx.caller,
		action: ctx.action.name,
		params: ctx.params,
		userName: ctx.meta.user && ctx.meta.user.userName ? ctx.meta.user.userName : "GUEST",
		ignoreFields: LOG_HIDDEN_FIELDS,
		data,
	};
	const inLog = LoggerHelper.getFormatLogSvOUT(outObj);
	this.logger.info(inLog);
	return data;
}
