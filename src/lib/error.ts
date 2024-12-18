import { Errors } from "moleculer";

export class NeoPayError extends Errors.MoleculerError {
	public constructor(message: string, code?: number, type?: string, data?: any) {
		super(message, code || 500, type || "UNKNOWN_ERROR", data);
	}
}

export class ValidationError extends NeoPayError {
	public constructor(message: string, type?: string, data?: any) {
		super(message, 422, type || "VALIDATION_ERROR", data);
	}
}

export class NotFoundError extends NeoPayError {
	public constructor(message: string, type?: string, data?: any) {
		super(message, 404, type || "NOT_FOUND_ERROR", data);
	}
}

export class PermissionDeniedError extends NeoPayError {
	public constructor(message: string, type?: string, data?: any) {
		super(message, 403, type || "PERMISSION_DENIED_ERROR", data);
	}
}

export class DuplicateError extends NeoPayError {
	public constructor(message: string, type?: string, data?: any) {
		super(message, 409, type || "DUPLICATE_ERROR", data);
	}
}
