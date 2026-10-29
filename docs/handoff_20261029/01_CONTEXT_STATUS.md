# 01 — BỐI CẢNH & TIẾN ĐỘ WEB

## Mục tiêu và stack
Ellie Homes CRM cho quản trị viên, telesales và vai trò Executive; frontend Vite vanilla JS/CSS (package `ellie-homes-crm@0.1.0`), backend Supabase Postgres/Auth/RPC/RLS, deploy Cloudflare Pages với Wrangler Direct Upload; Callio là tích hợp cuộc gọi. Local Windows VS Code/PowerShell.

## Lịch sử release đã có bằng chứng
| Sprint/gate | Trạng thái | Bằng chứng/ghi chú |
|---|---|---|
| S5.6F TLS development/regression | Đạt test | 55 PASS; 2 TODO runtime |
| S5.7 TLS database Production | Deployed | 10 TLS tables, 10 TLS RPCs; RLS trên 10/10; anon EXECUTE 0 theo kiểm tra trước đó; constraint Attendance đã patch |
| S5.7 TLS frontend Production | Deployed | URL release `696ae987.ellie-homes-crm.pages.dev`; không chạy lại migrations |
| S5.7 backup | 32/32 archive ứng dụng | `C:\Users\HP\ELH-CRM-PRIVATE-BACKUPS\production-20261028-145212`; backup role khóa sau khi dùng. Chưa có single transaction across all tables, chưa bao gồm full Auth/Storage, chưa restore-tested |
| S5.7 security trên Supabase Test | PASS | 7/7 authenticated tests trước đó |
| S5.7-H1A local | PASS | CSS-only; npm test 55 PASS /0 FAIL/2 TODO; Vite build 96 modules |
| S5.7-H1A Production | RELEASED & ACCEPTED | Wrangler deployment `a4a6563a`, production domain kiểm tra CSS PASS, screenshots ADMIN + TELESALES + TLS Shift + TLS Attendance PASS VISUAL |
| S5.7-H1A close record | SAVED | `release\S5.7\S57_H1A_FINAL_ACCEPTANCE.json` terminal báo success |

## Supabase Production TLS
10 bảng: `tls_shift_policies`, `tls_shift_slots`, `tls_shift_registrations`, `tls_shift_audit_logs`, `tls_attendance_policy`, `tls_attendance`, `tls_attendance_adjustments`, `tls_attendance_periods`, `tls_attendance_audit`, `tls_reminder_deliveries`.
Chấm công có ràng buộc chấp nhận `approved_in_at` kể cả khi `check_in_at` rỗng: `tls_att_checkout_effective_in_chk`, `tls_att_approved_out_effective_in_chk`, `tls_att_effective_times_order_chk`; `tls_att_action` dùng `COALESCE(approved_in_at,check_in_at)`. Đã thực thi trên Production. Không tự chạy lại migration. Reminder cron chưa bật.

## UI/luồng đã quan sát
ADMIN sidebar: Khách hàng, Lịch hôm nay, Cần chăm sóc, Kho khách chưa phân bổ, Quản lý đội ngũ, Dashboard, Báo cáo cuộc gọi, Cài đặt hệ thống, Đăng ký ca TLS, Chấm công TLS, thông tin tài khoản, Đổi mật khẩu, Đăng xuất.
TELESALES: Data của tôi, Đăng ký ca TLS, Chấm công TLS, Đổi mật khẩu, Đăng xuất; workspace khách hàng danh sách/Kanban.
TLS Shift cho TELESALES: lịch tuần + đăng ký ca; ADMIN: tổng hợp quản lý lịch tuần. TLS Attendance: đối soát cá nhân/ADMIN; ảnh Production hiển thị các kỳ không có ca đã duyệt — KHÔNG tự coi là lỗi.
Ảnh sau H1A cho thấy nút Đổi mật khẩu/Đăng xuất và tên tài khoản đã có tương phản, sidebar có scrollbar.

## Vấn đề còn mở — không đánh đồng với H1A
1. `public.crm_permission_users()` không có trên Production (đã xác minh bằng catalog pg_proc), màn hình 'Quyền theo tài khoản' báo lỗi. Cần review đủ `crm_permission_users`, `crm_permission_get`, `crm_permission_save` + RLS, thiết kế quyền hiệu lực; KHÔNG tự disable quyền, KHÔNG tạo stub dễ bị sai bảo mật.
2. Attendance runtime UAT TODO: real shift time/authenticated actions; approved check-in without raw check_in_at case. Không khẳng định nghiệp vụ hoàn tất 100%.
3. Backup restore còn pending; dữ liệu app archives 32/32 nhưng chưa restore test, không bao gồm full Auth/Storage snapshot.

## Có thể chuyển sang tính năng mới?
Có: H1A UI ổn định và chốt riêng. Tính năng mới nên tách Sprint riêng, giữ backlog 3 điểm trên theo dõi/risk register.
