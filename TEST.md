## I. Shimpent Connector Service actions.

### 1. lookupShipments
call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"SPX Express","trackingCode":"SPXVN04622996132B"},{"provider":"SPX Express","trackingCode":"SPXVN04354335241B"},{"provider":"SPX Express","trackingCode":"SPXVN04204711673B"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"Giao Hàng Nhanh","trackingCode":"G8XYDY7AB"},{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952610"},{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952510"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952610"},{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952510"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"Ninja Van Vietnam","trackingCode":"NJVN00045952610"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"SPX Express","trackingCode":"SPXVN04622996132B", "cellPhone":"6965"}],"ftCode":"FT25064FKLRZ"}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"SPX Express","trackingCode":"SPXVN04622996132B"}],"ftCode":"FT25064FKLRZ"}'

call 'shipment-tracking-connector-service.lookupShipments' {"logisticsInfo":[{"provider":"J&T Express","trackingCode":"851334523246","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851314493246","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851394483246","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851369163176","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851329133176","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851329143176","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851349143176","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851329123176","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851394513246","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851389123176","cellPhone":"6965"},{"provider":"J&T Express","trackingCode":"851374483246","cellPhone":"6965"},{"provider":"SPX Express","trackingCode":"SPXVN04622996132B"},{"provider":"SPX Express","trackingCode":"SPXVN04354335241B"},{"provider":"SPX Express","trackingCode":"SPXVN04204711673B"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"J&T Express","trackingCode":"SPXVN04622996132B", "cellPhone":"6965"}]}'

call 'shipment-tracking-connector-service.lookupShipments' '{"logisticsInfo":[{"provider":"J&T Express","trackingCode":"851461328721"},{"provider":"J&T Express","trackingCode":"859105193186"},{"provider":"J&T Express","trackingCode":"859106046319"},{"provider":"J&T Express","trackingCode":"859117696868z"}]}'

### 2. getShipments
call 'shipment-tracking-connector-service.getShipments' '{"logisticsProvider": "SPX Express"}'
