import axios from "axios";
import DomSerializer from "dom-serializer";
import { Element, Text } from "domhandler";
import { DomUtils, parseDocument, } from "htmlparser2";
import moment from "moment-timezone";
import { ERROR_MESSAGES, GetShipmentResp, HCM_TIMEZONE } from "..";
import { SVC_ENV } from "../../../../svc-env";
import { Logger } from "../../../lib";

const DELIVERY_CONFIRMED_MESSAGE = "Đơn hàng đã ký nhận";

export class JTEPublicApiHelper {
  public constructor(
    private readonly logger: Logger
  ) { }

  public async getShipments(trackingCodes: string[]): Promise<any> {

    const axiosConfig = {
      method: "GET",
      url: `${SVC_ENV.get().JTE_LEN_DON_API_ENDPOINT}?billcode=${trackingCodes.join(",")}`,
    };

    try {
      this.logger.info(`JTEPublicApiHelper getShipment with trackingCodes: ${trackingCodes.join(" | ")}`);
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

      this.logger.error(`JTEPublicApiHelper getShipment return error: ${JSON.stringify(error)}`);
      return trackingCodes?.map((trackingCode) => ({
        [trackingCode]: shipment,
      }))
    }
  }

  private processParseResultItem = (resultItem): { trackingCode: string, shipment: GetShipmentResp } => {
    const trackingCodeElement = DomUtils.findOne(
      (el) =>
        el?.name === "p" &&
        typeof el?.attribs?.class === "string" &&
        el.attribs.class.includes("Inter-SemiBold") &&
        el.attribs.class.includes("font-bold") &&
        el.attribs.class.includes("mb-3"),
      resultItem?.children
    );

    const trackingCode = trackingCodeElement
      ? DomUtils.textContent(trackingCodeElement).replace("Mã đơn hàng:", "").trim()
      : null;

    const eventItems = DomUtils.findAll(this.isValidEventItem, resultItem?.children ?? []);
    const events = eventItems
      .map(this.extractEventData)
      .filter((event): event is NonNullable<typeof event> => !!event);
    const shipment: GetShipmentResp = {
      lookupStatus: "PROCESSING",
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
    shipment.resp = eventItems.map((el) => DomSerializer(el)).join("\n");

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
          el?.name === "div"
          && el?.attribs?.class?.includes("detail-bill")
          && el?.attribs?.class?.includes("w-3/5"),
        document?.children
      );

      return resultElements?.map((resultItem) => this.processParseResultItem(resultItem))
    } catch (error) {
      console.error(error);
      throw Error(ERROR_MESSAGES.JTE_PARSE_HTML)
    }
  }

  private extractEventData = (eventEl: Element): { time: Date; message: string | null } | null => {
    if (!this.isTag(eventEl)) return null;

    // Tìm thẻ h4 có text node con
    const h4 = DomUtils.findOne(
      (el) =>
        this.isTag(el) &&
        el.name === "h4" &&
        el.children.some(this.isTextNode),
      eventEl.children
    );

    if (!h4) return null;

    // Lấy text node đầu tiên trong h4
    const textNode = h4.children.find(this.isTextNode);
    if (!textNode) return null;

    const parts = textNode.data.trim().split(" ");
    if (parts.length !== 2) return null;

    const [time, date] = parts;
    if (!time || !date) return null;

    // Tìm div chứa nội dung (class có 'ml-5')
    const contentDiv = DomUtils.findOne(
      (el) => this.isTag(el) && el.name === "div" && el.attribs?.class?.includes("ml-5"),
      eventEl.children
    );

    // Tìm thẻ p bên trong div nội dung
    const p = contentDiv ? DomUtils.findOne((el) => this.isTag(el) && el.name === "p", contentDiv.children) : null;

    const message = p ? DomUtils.textContent(p).replace(/\s+/g, " ").trim() : null;

    return {
      time: moment.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm:ss", HCM_TIMEZONE).toDate(),
      message,
    };
  }

  private isValidEventItem = (el: Element): boolean => {
    if (!this.isTag(el) || el.name !== "li") return false;

    const hasValidH4 = DomUtils.findOne((child) => {
      if (!this.isTag(child) || child.name !== "h4") return false;

      // Tìm text node con trong h4
      const textNode = child.children.find(this.isTextNode);
      if (!textNode) return false;

      return /^\d{2}:\d{2}:\d{2} \d{4}-\d{2}-\d{2}$/.test(textNode?.data?.trim());
    }, el.children);

    const hasContentDiv = DomUtils.findOne((child) => {
      if (!this.isTag(child) || child.name !== "div") return false;

      const classAttr = child.attribs?.class || "";
      return classAttr.includes("ml-5") && classAttr.includes("pb-10");
    }, el.children);

    return Boolean(hasValidH4 && hasContentDiv);
  };

  private isTextNode = (node: any): node is Text => {
    return node?.type === "text" && typeof node?.data === "string";
  }

  private isTag = (el: any): el is Element => {
    return el?.type === "tag";
  }
}
