import { IMeta } from "./meta";

export const generateExtraDataFromMeta = (currentExtraData: object, meta: IMeta) => ({
  ...currentExtraData,
  meta: {
    business: meta.business,
    trackingId: meta.trackingId,
    reqId: meta.reqId,
    headers: meta.headers,
    deviceId: meta.deviceId,
    clientIP: meta.clientIP,
    userAgent: meta.userAgent,
    correlationId: meta.correlationId,
    requestTime: meta.requestTime,
    user: meta.user
      ? {
          userName: meta.user.userName,
          email: meta.user.email,
          merchantId: meta.user.merchantId,
          userId: meta.user.userId,
          phone: meta.user.phone,
          fullName: meta.user.fullName
        }
      : null
  }
});
