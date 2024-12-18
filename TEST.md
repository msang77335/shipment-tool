## I. Shimpent Connector Service actions.

### 1. lookupShipments
call 'shipment-tracking-connector-service.lookupShipments' '{"logistics":[{"provider":"SPX Express","logisticsTrackingCode":"SPXVN04622996132B"},{"provider":"Giao Hàng Nhanh","logisticsTrackingCode":"G8XYDY7A"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"SPX Express","trackingCode":"SPXVN04622996132B"},{"provider":"SPX Express","trackingCode":"SPXVN04354335241B"},{"provider":"SPX Express","trackingCode":"SPXVN04204711673B"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"Giao Hàng Nhanh","trackingCode":"G8XYDY7AB"},{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952610"},{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952510"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952610"},{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952510"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952610"}]}'

### 2. getShipments
call 'shipment-tracking-connector-service.getShipments' '{"logisticsProvider": "SPX Express"}'
