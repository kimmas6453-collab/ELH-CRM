# Báo cáo kiểm kê backend ELH CRM — snapshot 29/10/2026

**Nguồn:** `production_structure_20261029_SANITIZED.json` (xuất bởi người dùng từ project Supabase có ref `qmzmkijlarwdlslipaou`). Không sử dụng dữ liệu khách hàng, SQL bodies hay token.

## Kết quả đã xác minh trong snapshot

- 12/12 nhóm metadata được manifest đánh dấu OK. File sanitized lưu chi tiết **8 nhóm**, còn 4 nhóm có số đếm tổng hợp và không chứa danh sách chi tiết (views: 0, enums: 0, extensions: 8, grants: 0).
- 32 tables; 220 columns; 124 constraints; 58 indexes; 15 RLS policies; 74 routines; 2 application triggers; 9 sequences.
- 32/32 tables trong danh sách bật `rlsEnabled=true`.
- Có **18/32 tables** không có policy trực tiếp được liệt kê trong snapshot. Đây không mặc nhiên là lỗ hổng hoặc lỗi: ứng dụng có thể chỉ truy cập qua RPC/SECURITY DEFINER, và bảng private có cơ chế khác. Tuy nhiên phải xác minh quyền GRANT và logic truy cập.
- **52/74** routine được đánh dấu `securityDefiner=true`; trong đó **44** thuộc schema `public`. Nên ưu tiên rà soát `EXECUTE` privileges, xác thực người dùng, quyền trên từng RPC và `search_path`.
- Đối chiếu trực tiếp 41 tên RPC gọi bằng chuỗi hằng trong `src/` với 74 tên routine trong snapshot: có **3 RPC chưa xuất hiện** trong catalog: `crm_permission_users`, `crm_permission_get`, `crm_permission_save`. Cả `src/admin-settings.js` và `src/admin-console.js` đang gọi các hàm này (danh sách người dùng và tải/lưu phân quyền). Điều này có thể gây lỗi tại tính năng phân quyền theo tài khoản. Chỉ xác nhận sau khi kiểm tra chức năng/API trên môi trường test; **không tự thêm RPC lên Production**.

## Đối chiếu tên RPC từ source

- Số RPC tên hằng được phát hiện trong `src/`: **41**.
- Có trong snapshot: **38**.
- Chưa có trong snapshot: **3** (`crm_permission_users`, `crm_permission_get`, `crm_permission_save`).
- Đây chỉ là kiểm tra tĩnh tên hàm, không chứng minh đầy đủ tham số, cơ chế bảo mật hoặc quyền gọi thực tế.

## Giới hạn quan trọng

1. File hiện tại **không có** các định nghĩa SQL hoàn chỉnh (`CREATE TABLE`, default/generated expressions, RLS `USING/WITH CHECK`, SQL function body, trigger definitions, GRANT, ownership hay extension versions).
2. Chỉ có **tên** của constraints/indexes, nên không đủ dựng lại relationship, index expressions hay constraint semantics.
3. Không chứa `auth.users`, database rows, sequence current values, Edge Secrets, scheduler/cron state hay cấu hình hosting.
4. `restoreReady=false`: **KHÔNG** dùng file này như backup database có thể phục hồi.
5. Số đếm `grants=0` trong catalog **không chứng minh** hệ thống không có GRANT; có thể xuất metadata chưa đủ phạm vi.
6. Edge Functions source gồm `callio-sync` và `crm-accounts` đang được lưu riêng dưới `supabase/functions/`, chưa bảo gồm secrets.

## Việc tiếp theo trước khi khẳng định có backup/backend đầy đủ

- Xuất DDL schema dạng read-only bằng công cụ chuẩn `pg_dump --schema-only` trên một môi trường tin cậy (không cần Docker nếu dùng PostgreSQL client phù hợp) **hoặc** hoàn thiện thông tin từ API catalog an toàn; rà soát bí mật trước commit.
- Xuất snapshot Auth/data đã mã hóa vào kho backup riêng; không commit lên GitHub.
- Kiểm thử tái tạo database trên môi trường test, xác minh quyền/RLS và Edge Functions trước khi triển khai.
- Không chạy migrations ngày 19/10 lên Production. Chúng đang được giữ dưới `docs/legacy_backend_20261019/` làm tham chiếu lịch sử.

## Các bảng chưa có policy trực tiếp trong catalog (để review, không kết luận lỗi)

- `private.callio_sync_lease`
- `private.crm_settings`
- `public.crm_access_audit`
- `public.crm_access_group_members`
- `public.crm_access_group_rules`
- `public.crm_access_groups`
- `public.elh_autopilot_audit`
- `public.elh_autopilot_settings`
- `public.tls_attendance`
- `public.tls_attendance_adjustments`
- `public.tls_attendance_audit`
- `public.tls_attendance_periods`
- `public.tls_attendance_policy`
- `public.tls_reminder_deliveries`
- `public.tls_shift_audit_logs`
- `public.tls_shift_policies`
- `public.tls_shift_registrations`
- `public.tls_shift_slots`

## Kiểm tra tính đúng của metadata

Tất cả danh sách được bao gồm trong JSON khớp số lượng tổng hợp được khai báo. Quá trình đối chiếu này chỉ chứng minh cấu trúc file nhất quán, **không** xác nhận hệ thống khôi phục thành công.
