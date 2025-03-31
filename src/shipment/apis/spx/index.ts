import axios from "axios";
import crypto from 'crypto';
import { injectable } from "inversify";
import { isEmpty, orderBy, toString } from "lodash";
import { GetShipmentResp } from "..";
import { SVC_ENV } from "../../../../svc-env";
import { Logger } from "../../../lib";
import { Event } from "../../domain/Shipment";

@injectable()
export class SPXApiHelper {

  public constructor(
    private readonly logger: Logger
  ) {}

  public async getShipment(trackingCode): Promise<any> {

    const timestamps = Math.floor(Date.now() / 1e3);
    const sign = crypto.createHash('sha256').update(trackingCode + timestamps + SVC_ENV.get().SPX_API_KEY).digest('hex')
    const trackingNumber = `${trackingCode}|${timestamps}${sign}`

    const axiosConfig = {
      method: "GET",
      url: `${SVC_ENV.get().SPX_API_ENDPOINT}?sls_tracking_number=${trackingNumber}`,
      headers: {
        "x-language": "vi",
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    const shipment: GetShipmentResp = {
      lookupStatus: "PROCESSING",
    }

    try {
      this.logger.info(`SPXApiHelper getShipment with trackingCode: ${trackingNumber}`);
      const response = await axios.request(axiosConfig);
      this.logger.info(`SPXApiHelper getShipment with response: ${JSON.stringify(response.data)}`);

      const respData = response?.data?.data ?? {};

      // Không tìm thấy dữ liệu => FAILED
      if (isEmpty(respData)) {
        shipment.lookupStatus = "FAILED";
        return shipment;
      }

      const trackingList = respData?.tracking_list ?? [];

      const events: Event[] = trackingList?.map((tracking) => ({
        message: tracking?.message,
        time: new Date(tracking?.timestamp * 1000)
      }))

      shipment.lookupStatus = "SUCCESS";
      shipment.status = toString(respData?.current_status)?.toUpperCase();
      shipment.events = events ? orderBy(events, ['time'], ['desc']) : [];
      shipment.resp = response?.data;

      return shipment;
    } catch (error) {

      shipment.lookupStatus = "FAILED";
      const errorMessage = JSON.stringify(error.response.data ?? {});
      shipment.note = errorMessage;

      this.logger.error(`SPXApiHelper getShipment return error: ${JSON.stringify(error)}`);
      return shipment
    }
  }
}
