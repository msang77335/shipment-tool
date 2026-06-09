# Tracking J&T Bằng SĐT

Tài liệu này mô tả cách hệ thống tracking J&T sử dụng số điện thoại (SĐT), bao gồm luồng chính, luồng scan/brute-force và các lưu ý vận hành.

## 1) Mục tiêu

J&T yêu cầu thêm thông tin SĐT để tra cứu một số mã vận đơn.
Hệ thống dùng SĐT theo tên tài khoản (bankAccountName) để tăng tỷ lệ lấy được dữ liệu tracking.

## 2) Luồng chính (tracking bằng SĐT)

Luồng chạy khi gọi endpoint tracking chung:

- Endpoint: POST /api/v1/tracking
- Body: provider = J&T, codes, bankAccountName (khuyến nghị có)

Flow tổng quát:

1. trackingRoutes nhận provider J&T và chuyển vào jntShipmentTrackingShipment.
2. jntShipmentTrackingShipment gọi trackingJnTPage.
3. trackingJnTPage lấy danh sách SĐT từ phoneManager.getPhonesByName(bankAccountName).
4. Hệ thống thử lần lượt các SĐT với API J&T:
   - URL: https://jtexpress.vn/vi/tracking
   - Query: type=track, billcode, cellphone
5. Nếu đủ dữ liệu cho toàn bộ mã vận đơn, hệ thống render ảnh kết quả.
6. Nếu thiếu dữ liệu, hệ thống fallback sang flow AfterShip theo điều kiện.

## 3) Cơ chế thử SĐT

Trong luồng J&T hiện tại:

- Dữ liệu SĐT được nhóm theo name trong SQLite.
- Mỗi lần tracking, hệ thống lấy SĐT theo đúng name đã chuẩn hóa.
- Kiểm tra theo batch (mặc định 5 số/batch).
- Có delay giữa các lần thử để giảm nguy cơ bị chặn.
- Kết quả được dedupe theo trackingNumber.

## 4) Proxy trong tracking J&T

Luồng J&T HTTP có hỗ trợ proxy:

- Lấy proxy từ proxyManager.
- Gắn vào HttpProxyAgent/HttpsProxyAgent khi request API J&T.
- Nếu không có proxy, hệ thống vẫn chạy trực tiếp.

## 5) Fallback khi không đủ dữ liệu

Nếu tracking J&T không thành công hoàn toàn:

- Nhiều mã vận đơn (codes có dấu phẩy):
  - Ghi lịch sử fallback.
  - Trả ảnh fallback (aftership quota exceeded image), status UNKNOWN.
- Một mã vận đơn:
  - Fallback sang aftershipTrackingShipment với provider J&T.

## 6) Luồng scan SĐT (bổ trợ)

Khi chưa có SĐT hợp lệ cho mã vận đơn, dùng scan job:

- Tạo job scan: POST /api/v1/jnt/scan-phone
- Xem trạng thái job: GET /api/v1/jnt/scan-phone/:id

Cách scan hoạt động:

1. Thử danh sách SĐT đã có trước.
2. Nếu không trúng, brute-force 0000 -> 9999 (hoặc từ startFrom).
3. Mỗi lần thử gọi API J&T với billcode + 4 số cuối SĐT.
4. Dừng khi tìm thấy số hợp lệ hoặc khi hết ngưỡng.

## 7) Quản lý pool SĐT

Các endpoint chính:

- GET /api/v1/jnt/phone
- POST /api/v1/jnt/phone
- GET /api/v1/jnt/phone/:name
- DELETE /api/v1/jnt/phone/:name
- GET /api/v1/jnt/phone/export

Khuyến nghị:

- Chuẩn hóa name theo đúng account thực tế.
- Cập nhật pool SĐT định kỳ.
- Theo dõi scan job để bổ sung số mới vào pool.

## 8) Lưu ý vận hành

- Thiếu bankAccountName: dễ không lấy được SĐT phù hợp.
- Pool SĐT trống: tracking J&T theo SĐT sẽ thất bại và fallback.
- Quá nhiều request liên tục: dễ timeout/chặn, nên chạy theo batch và có delay.
- Proxy kém chất lượng: có thể làm giảm tỷ lệ thành công.

## 9) File liên quan

- src/helpers/trackingShipment/jntTrackingShipment.ts
- src/helpers/jnt/phone.ts
- src/helpers/jnt/scanPhone.ts
- src/helpers/jnt/scanPhoneJobManager.ts
- src/routes/jntRoutes.ts
- src/routes/trackingRoutes.ts
