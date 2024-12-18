import { IsOptional } from "class-validator";
import { BasePagingDto } from "../commons/paging";

export class GetShipmentsDto extends BasePagingDto {
	@IsOptional()
	public lookupStatus: "SUCCESS" | "FAILED";

	@IsOptional()
	public logisticsProvider: string;

	@IsOptional()
	public logisticsTrackingCode: string;

	@IsOptional()
	public dateFr: string;

	@IsOptional()
	public dateTo: string;
}


