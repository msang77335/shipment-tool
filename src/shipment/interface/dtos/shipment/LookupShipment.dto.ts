import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, ValidateNested } from "class-validator";

export class LookupShipmentsDto {
	@IsNotEmpty()
	@IsArray()
	@ArrayNotEmpty()
  @ValidateNested({ each: true }) 
	@Type(() => LogisticsInfoDto)
	public logisticsInfo: LogisticsInfoDto[];

	@IsOptional()
	public ftCode: string;
}

export class LogisticsInfoDto {
	@IsNotEmpty()
	public provider: string;

	@IsNotEmpty()
	public trackingCode: string;

	@IsOptional()
	public cellPhone: string;
}


