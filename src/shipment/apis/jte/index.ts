import axios from "axios";
import DomSerializer from "dom-serializer";
import { DomUtils, parseDocument } from "htmlparser2";
import { isEmpty } from "lodash";
import moment from "moment-timezone";
import { ERROR_MESSAGES, GetShipmentResp, HCM_TIMEZONE } from "..";
import { SVC_ENV } from "../../../../svc-env";
import { Logger } from "../../../lib";

const DELIVERY_CONFIRMED_MESSAGE = "Đơn hàng đã ký nhận";

export class JTEApiHelper {
  public constructor(
    private readonly logger: Logger
  ) {}
  
  public async getShipment(trackingCode, cellphone): Promise<any> {

    const axiosConfig = {
      method: "GET",
      url: `${SVC_ENV.get().JTE_API_ENDPOINT}&billcode=${trackingCode}&cellphone=${cellphone}`,
    };

    const shipment: GetShipmentResp = {
      lookupStatus: "PROCESSING",
    }

    try {
      this.logger.info(`JTEApiHelper getShipment with trackingCode: ${trackingCode}, cellPhone=${cellphone}`);
      const response = await axios.request(axiosConfig);
      const respData = response?.data ?? {};

      const htmlData = this.parseHTML(respData)

      // Không tìm thấy dữ liệu => FAILED
      if (isEmpty(htmlData.events)) {
        shipment.lookupStatus = "FAILED";
        shipment.note = ERROR_MESSAGES.JTE_NOT_FOUND
        return shipment;
      }

      // Map thành DELIVERED
      if (htmlData.events?.length > 0) {
        const lastEvent = htmlData.events[0];

        // Event cuối là DELIVERY_SUCCESS thì cho Status là DELIVERED.
        if (lastEvent?.message?.includes(DELIVERY_CONFIRMED_MESSAGE)) {
          shipment.status = "DELIVERED";
        }
      }

      shipment.events = htmlData.events;
      shipment.lookupStatus = "SUCCESS";
      shipment.resp = htmlData.resp;

      return shipment;
    } catch (error) {

      if (error.message === ERROR_MESSAGES.JTE_PARSE_HTML) {
        shipment.note = ERROR_MESSAGES.JTE_PARSE_HTML
      }
      shipment.lookupStatus = "FAILED";

      this.logger.error(`JTEApiHelper getShipment return error: ${JSON.stringify(error)}`);
      return shipment
    }
  }

  private parseHTML = (html: string) => {
    try {
      const document = parseDocument(html);

      const eventElements = DomUtils.findAll(
        (el) =>
          el?.name === "div" && el?.attribs?.class?.includes("result-vandon-item"),
        document?.children
      );

      const events = eventElements?.map((eventEl) => {
        // Lấy thời gian
        const timeSpan = DomUtils.findOne(
          (el) =>
            el?.name === "span" &&
            (el?.children[0] as any)?.data?.trim().match(/^\d{2}:\d{2}:\d{2}$/),
          eventEl?.children
        );
        const time = timeSpan ? DomUtils.textContent(timeSpan).trim() : null;

        // Lấy ngày
        const dateSpan = DomUtils.findOne(
          (el) =>
            el?.name === "span" &&
            (el?.children[0] as any)?.data?.trim().match(/^\d{4}-\d{2}-\d{2}$/),
          eventEl?.children
        );
        const date = dateSpan ? DomUtils.textContent(dateSpan).trim() : null;

        // Lấy nội dung
        const fontTag = DomUtils.findOne((el) => el?.name === "font", eventEl);
        let fullText = ""
        if (fontTag) {
          fullText = DomUtils.textContent(fontTag?.parent).trim();
        }

        return {
          time: moment.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm:ss", HCM_TIMEZONE).toDate(),
          message: fullText?.replace(/\s+/g, " ").trim()
        };
      });

      return {
        events: events,
        resp: eventElements.map((el) => DomSerializer(el)).join("\n")
      }
    } catch (error) {
      throw Error(ERROR_MESSAGES.JTE_PARSE_HTML)
    }
  }
}
