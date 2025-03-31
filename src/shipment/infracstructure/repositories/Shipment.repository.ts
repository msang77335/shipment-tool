import { plainToClass } from "class-transformer";
import { inject, injectable } from "inversify";
import { GUID } from "../../../lib/guid";
import { SHIPMENT_TRACKING_CONNECTOR_TYPES } from "../../SHIPMENT_TRACKING_CONNECTOR_TYPES";
import { PagingResult } from '../../application/queries/commons';
import { Shipment, ShipmentProperties } from "../../domain/Shipment";
import { ShipmentFactory } from "../../domain/Shipment.factory";
import { ShipmentRepository } from "../../domain/repository";
import { ShipmentModel, ShipmentSchema } from "../models/Shipment.model";
import { STATUS } from "../../domain/constants";

@injectable()
export class ShipmentRepositoryImplement implements ShipmentRepository {
	public constructor(
		@inject(SHIPMENT_TRACKING_CONNECTOR_TYPES.ShipmentFactory)
		private readonly shipmentFactory: ShipmentFactory
	) { }

	public async newId(): Promise<string> {
		return Promise.resolve(GUID());
	}

	public async create(entity: Shipment): Promise<Shipment> {
		const model = this.entityToModel(entity);
		const result = await ShipmentModel.create(model);
		return model ? this.modelToEntity(result) : null;
	}

	public async save(entity: Shipment): Promise<any> {
		const model = this.entityToModel(entity);
		const result = await ShipmentModel.updateOne({ id: model.id }, model, {
			upsert: true,
			new: true,
		}).lean();
		return result;
	}

	public async find(filter: object): Promise<Shipment[]> {
		const models = await ShipmentModel.find(filter).lean();
		return models.map(model => this.modelToEntity(model));
	}

	public async findById(id: string): Promise<Shipment> {
		const model = await ShipmentModel.findOne({ id }).lean();
		return model ? this.modelToEntity(model) : null;
	}

	public async findOne(filter: object): Promise<Shipment> {
		const model = await ShipmentModel.findOne(filter).lean();
		return model ? this.modelToEntity(model) : null;
	}

	public async findOnReadyLookup(): Promise<Shipment> {
		const model = await ShipmentModel.findOne({ lookupStatus: STATUS.PROCESSING })
			.sort({ createdAt: 1 })
			.lean();
		return model ? this.modelToEntity(model) : null;
	}

	public async listPaging(filter: object, options: object): Promise<PagingResult<Shipment>> {
		const result = await ShipmentModel.paginate(filter, options);
		return {
			docs: result?.docs.map(model => this.modelToEntity(model)),
			totalDocs: result?.totalDocs,
			limit: result?.limit,
			offset: result?.offset
		};
	}

	private entityToModel(entity: Shipment): ShipmentSchema {
		const properties = entity.properties();
		return plainToClass(ShipmentSchema, properties, { excludeExtraneousValues: true });
	}

	private modelToEntity(model: ShipmentSchema): Shipment {
		const data = plainToClass(ShipmentSchema, model, { excludeExtraneousValues: true }) as ShipmentProperties;
		return this.shipmentFactory.reconstitute(data);
	}
}
