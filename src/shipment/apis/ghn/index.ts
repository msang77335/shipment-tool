import axios from "axios";
import { orderBy, toString } from "lodash";
import { ERROR_STATUS_CODES, GetShipmentResp } from "..";
import { SVC_ENV } from "../../../../svc-env";
import { Logger } from "../../../lib";
import { Event } from "../../domain/Shipment";
export class GHNApiHelper {
  private readonly logger: Logger;
  public constructor(
    logger: Logger,
  ) {
    this.logger = logger;
  }
  public async getShipment(trackingCode): Promise<any> {

    const axiosConfig = {
      method: "POST",
      maxBodyLength: Infinity,
      url: SVC_ENV.get().GHN_API_ENDPOINT,
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      data: {
        order_code: trackingCode
      }
    };

    const shipment: GetShipmentResp = {
      lookupStatus: "PROCESSING",
    }

    try {
      this.logger.info(`GHNApiHelper getShipment with trackingCode: ${trackingCode}`);
      const response = await axios.request(axiosConfig);
      this.logger.info(`GHNApiHelper getShipment with response: ${JSON.stringify(response.data)}`);

      const respData = response?.data?.data ?? {};

      const trackingList = respData?.tracking_logs ?? [];

      const events: Event[] = trackingList?.map((tracking) => ({
        message: tracking?.location?.address,
        time: new Date(tracking?.action_at)
      }))

      shipment.status = toString(respData?.order_info?.status)?.toUpperCase();
      shipment.lookupStatus = "SUCCESS";
      shipment.events = events ? orderBy(events, ['time'], ['desc']) : [];
      shipment.resp = response?.data;
      shipment.note = ""

      return shipment;
    } catch (error) {

      if (error?.response?.status === ERROR_STATUS_CODES.TOO_MANY_REQUESTS) {
        shipment.note = "Quá nhiều yêu cầu";
        shipment.lookupStatus = "FAILED";
      } else if (error?.response?.status === ERROR_STATUS_CODES.FORBIDDEN) {
        shipment.note = "Tra cứu bị từ chối";
        shipment.lookupStatus = "FAILED";
      } else {
        shipment.lookupStatus = "FAILED";
        const errorMessage = error?.response?.data?.code_message_value || error?.response?.data?.message || "";
        shipment.note = errorMessage;
      }

      this.logger.error(`GHNApiHelper getShipment return error: ${JSON.stringify(error)}`);
      return shipment
    }
  }

}