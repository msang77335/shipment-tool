import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsDefined, IsNotEmpty, ValidateNested } from "class-validator";

export class LookupShipmentsDto {
	@IsNotEmpty()
	@IsArray()
	@ArrayNotEmpty()
  @ValidateNested({ each: true }) 
	@Type(() => LogisticsInfoDto)
	public logisticsInfo: LogisticsInfoDto[];
}

export class LogisticsInfoDto {
	@IsNotEmpty()
	public provider: string;

	@IsNotEmpty()
	public trackingCode: string;
}


