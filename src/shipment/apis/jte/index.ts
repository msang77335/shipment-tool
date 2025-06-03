import axios from "axios";
import DomSerializer from "dom-serializer";
import { DomUtils, parseDocument, } from "htmlparser2";
import { isEmpty } from "lodash";
import moment from "moment-timezone";
import { ERROR_MESSAGES, GetShipmentResp, HCM_TIMEZONE } from "..";
import { SVC_ENV } from "../../../../svc-env";
import { Logger } from "../../../lib";

const DELIVERY_CONFIRMED_MESSAGE = "Đơn hàng đã ký nhận";

export class JTEApiHelper {
  public constructor(
    private readonly logger: Logger
  ) { }

  public async getShipments(trackingCodes: string[], cellphone: string): Promise<any> {

    const axiosConfig = {
      method: "GET",
      url: `${SVC_ENV.get().JTE_API_ENDPOINT}&billcode=${trackingCodes.join(",")}&cellphone=${cellphone}`,
    };

    try {
      this.logger.info(`JTEApiHelper getShipment with trackingCodes: ${trackingCodes.join(" | ")}, cellPhone=${cellphone}`);
      const response = await axios.request(axiosConfig);
      const respData = response?.data ?? {};

      const htmlResults = this.parseHTML(respData);

      const resultsMap = {};

      htmlResults?.forEach((result) => {
        resultsMap[result?.trackingCode] = result?.shipment
      })

      return resultsMap;
    } catch (error) {
      const shipment: GetShipmentResp = {
        lookupStatus: "PROCESSING",
        note: ERROR_MESSAGES.LOOKUP_ERROR,
      }

      if (error.message === ERROR_MESSAGES.JTE_PARSE_HTML) {
        shipment.note = ERROR_MESSAGES.JTE_PARSE_HTML
      }
      shipment.lookupStatus = "FAILED";

      this.logger.error(`JTEApiHelper getShipment return error: ${JSON.stringify(error)}`);
      return trackingCodes?.map((trackingCode) => ({
        [trackingCode]: shipment,
      }))
    }
  }

  private processParseResultItem = (resultItem): { trackingCode: string, shipment: GetShipmentResp } => {
    const trackingCodeElement = DomUtils.findOne(
      (el) =>
        el?.name === "span" &&
        el?.attribs?.class?.includes(
          "text-grey-darkest font-thin text-[#AB1D23]"
        ),
      resultItem?.children
    );

    const trackingCode = trackingCodeElement
      ? DomUtils.textContent(trackingCodeElement).trim()
      : null;

    const eventElements = DomUtils.findAll(
      (el) =>
        el?.name === "div" && el?.attribs?.class?.includes("result-vandon-item"),
      resultItem?.children
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

    const shipment: GetShipmentResp = {
      lookupStatus: "PROCESSING",
    }

    // Không tìm thấy dữ liệu => FAILED
    if (isEmpty(events)) {
      shipment.lookupStatus = "FAILED";
      shipment.note = ERROR_MESSAGES.JTE_NOT_FOUND
      return {
        trackingCode: trackingCode,
        shipment: shipment
      }
    }

    // Map thành DELIVERED
    if (events?.length > 0) {
      const lastEvent = events[0];

      // Event cuối là "Đơn hàng đã ký nhận" thì cho Status là DELIVERED.
      if (lastEvent?.message?.includes(DELIVERY_CONFIRMED_MESSAGE)) {
        shipment.status = "DELIVERED";
      }
    }

    shipment.events = events;
    shipment.lookupStatus = "SUCCESS";
    shipment.resp = eventElements.map((el) => DomSerializer(el)).join("\n");

    return {
      trackingCode: trackingCode,
      shipment: shipment
    }
  }

  private parseHTML = (html: string): { trackingCode: string, shipment: GetShipmentResp }[] => {
    try {
      const document = parseDocument(html);

      const resultElements = DomUtils.findAll(
        (el) =>
          el?.name === "div" && el?.attribs?.class?.includes("result_vandon"),
        document?.children
      );

      return resultElements?.map((resultItem) => this.processParseResultItem(resultItem))
    } catch (error) {
      console.error(error);
      throw Error(ERROR_MESSAGES.JTE_PARSE_HTML)
    }
  }
}
