import { IsOptional } from "class-validator";

export class BasePagingDto {
  @IsOptional()
  public pageIndex: number;

  @IsOptional()
  public pageSize: number;

  @IsOptional()
  public sortBy: string;

  @IsOptional()
  public sortType: number;
}


