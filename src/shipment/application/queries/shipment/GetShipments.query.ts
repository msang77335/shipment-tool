import { BaseQuery } from "../Base.query";

export class GetShipmentsQuery extends BaseQuery {
  public readonly pageIndex: number;
  public readonly pageSize: number;
  public readonly sortBy: string;
  public readonly sortType: number;
  public readonly lookupStatus: "SUCCESS" | "FAILED";
  public readonly logisticsProvider: string;
  public readonly logisticsTrackingCode: string;
  public readonly dateFr: string;
  public readonly dateTo: string;

  public constructor(props: GetShipmentsQuery) {
    super();
    Object.assign(this, props);

		if (!props.pageIndex) {
			this.pageIndex = 1;
		}

		if (!props.pageSize) {
			this.pageSize = 20;
		}

    if(!props.sortBy && !props.sortType) {
      this.sortBy = "createdAt";
      this.sortType = -1
    }
  }
}
