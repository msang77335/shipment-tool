import { getModelForClass, index, modelOptions, plugin, prop } from "@typegoose/typegoose";
import { Exclude, Expose, Type } from "class-transformer";
import { FilterQuery, PaginateOptions, PaginateResult } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import { STATUS } from "../../domain/constants";
import { DocumentCT } from "./base.model";
import { DB_COLLECTION_NAMES } from "./constants";

type PaginateMethod<T> = (
	query?: FilterQuery<T>,
	options?: PaginateOptions,
	callback?: (err: any, result: PaginateResult<T>) => void
) => Promise<PaginateResult<T>>;

class Event {
	@prop()
	@Expose()
	public time: Date;

	@prop()
	@Expose()
	public message: string;
}

class Logistics {
	@prop()
	@Expose()
	public provider: string;

	@prop()
	@Expose()
	public trackingCode: string;
}

@Exclude()
@index({ id: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: DB_COLLECTION_NAMES.shipments, timestamps: true } })
@plugin(mongoosePaginate)
export class ShipmentSchema extends DocumentCT {
	public static readonly paginate: PaginateMethod<ShipmentSchema>;

	@prop()
	@Expose()
	public id: string;

	@prop({ _id: false }) 
	@Expose()
	@Type(() => Logistics)
	public logistics: Logistics;

	@prop()
	@Expose()
	public lookupStatus: keyof typeof STATUS;

	@prop()
	@Expose()
	public note: string;

	@prop()
	@Expose()
	public status: string;

	@prop()
	@Expose()
	public events: Event[];

	@prop()
	@Expose()
	public resp: any;

	@prop()
	@Expose()
	public createdAt: Date;

	@prop()
	@Expose()
	public updatedAt: Date;
}

export const ShipmentModel = getModelForClass(ShipmentSchema);
ShipmentModel.syncIndexes({ background: true });
