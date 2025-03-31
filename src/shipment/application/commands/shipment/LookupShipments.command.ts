import { LogisticsInfoDto } from "../../../interface/dtos/shipment/LookupShipment.dto";
import { BaseCommand } from "../Base.command";

export class LookupShipmentsCommand extends BaseCommand {
  public readonly logisticsInfo: LogisticsInfoDto[];
  public readonly ftCode: string;
  public constructor(props: LookupShipmentsCommand) {
    super();
    Object.assign(this, props);
  }
}
