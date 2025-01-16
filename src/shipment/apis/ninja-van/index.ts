import axios, { AxiosError } from "axios";
import { orderBy, toString } from "lodash";
import { ERROR_MESSAGES, GetShipmentResp } from "..";
import { SVC_ENV } from "../../../../svc-env";
import { Logger } from "../../../lib";
import { Event } from "../../domain/Shipment";
import { ERROR_CODES, EVENT_CODES, EVENT_MESSAGES } from "./constants";

export class NinjaVanApiHelper {
  private readonly logger: Logger;
  public constructor(
    logger: Logger,
  ) {
    this.logger = logger;
  }
  public async getShipment(trackingCode): Promise<any> {

    const axiosConfig = {
      method: "GET",
      url: `${SVC_ENV.get().NINJA_VAN_API_ENDPOINT}?tracking_id=${trackingCode}`,
    };

    const shipment: GetShipmentResp = {
      lookupStatus: "PROCESSING",
    }

    try {
      this.logger.info(`NinjaVanApiHelper getShipment with trackingCode: ${trackingCode}`);
      const response = await axios.request(axiosConfig);
      this.logger.info(`NinjaVanApiHelper getShipment with response: ${JSON.stringify(response.data)}`);
      const respData = response?.data ?? {};

      const trackingList = respData?.events ?? [];

      const events: Event[] = trackingList?.map((tracking) => {
        // Map event message
        let eventMess = (EVENT_MESSAGES[tracking?.type] ?? tracking?.type);

        if (tracking?.data?.hub_name) {
          eventMess = eventMess + ` - ${tracking?.data?.hub_name}`;
        }

        return {
          message: eventMess,
          time: new Date(tracking?.time)
        }
      })

      // Trạng thái lô hàng
      shipment.status = toString(respData?.status)?.toUpperCase();

      // Map thành DELIVERED
      if (trackingList?.length > 0) {
        const lastEvent = trackingList?.pop();

        // Event cuối là DELIVERY_SUCCESS thì cho Status là DELIVERED.
        if (lastEvent?.type === EVENT_CODES.DELIVERY_SUCCESS) {
          shipment.status = "DELIVERED";
        }
      }

      shipment.lookupStatus = "SUCCESS";
      shipment.events = events ? orderBy(events, ['time'], ['desc']) : [];
      shipment.resp = response?.data;

      return shipment;
    } catch (error) {

      shipment.lookupStatus = "FAILED";
      const errorMessage = this.getMessageError(error);
      shipment.note = errorMessage;

      this.logger.error(`NinjaVanApiHelper getShipment return error: ${JSON.stringify(error)}`);
      return shipment;
    }
  }

  private getMessageError(error: AxiosError<any>): string {
    if (error?.response?.data?.error?.code === ERROR_CODES.NOT_FOUND) {
      return ERROR_MESSAGES.NINJA_VAN_NOT_FOUND;
    } else {
      return error?.response?.data?.error?.message ?? "";
    }
  }
}
