import { modelOptions } from "@typegoose/typegoose";
import { Expose } from "class-transformer";
import * as mongoose from "mongoose";

@modelOptions({ existingMongoose: mongoose })
export class DocumentCT {
	@Expose()
	public __v: number;
}
