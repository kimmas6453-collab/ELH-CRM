# 02 — SOURCE CODE: GIỮ / ẨN / KHÔNG TỰ KÍCH HOẠT

> Danh sách bên dưới dựa trên file user đã gửi, log, và ảnh. **Chưa có source tree đầy đủ hiện hành trong package này.** `reference_pre_H1A` là snapshot 28/10 trước khi tạo CSS H1A.

## GIỮ NGUYÊN (đã hoạt động / đã có regression)
- `src/main.js` (shell, login, navigation, CRM entry points); **không patch DOM sidebar bằng MutationObserver**; H1A đã sửa CSS-only.
- `src/api.js`, `src/domain.js`: Supabase client, RPC wrapper, validate/escape; giữ logic auth/data/RLS.
- `src/style.css`, `src/responsive.css`: CSS nền; sửa H1A được tách thành `src/elh-s57-h1a.css` (file mới) và link từ `index.html`. Khi làm tính năng mới, không xóa link này.
- `src/shifts.js`, `src/shifts.css`; `src/attendance.js`, `src/attendance.css`: TLS Shift/Attendance, giữ ràng buộc thời gian/role, locking, adjustment.
- `src/staff-workspace-v3.js`, `src/telesales-workspace-v4.js`, `src/customer-detail-page.js`, `src/customer-tabs.js`, `src/team.js`, `src/dashboard.js`, `src/reports.js`, `src/daily.js`, `src/notifications.js`, `src/password.js`, `src/callio.js` và các module liên quan mà `main.js` đang import — KHÔNG xóa nếu chưa xác nhận dependency graph. Các module nêu từ imports hoặc log build; không chứng minh tất cả đã có trong source ZIP.
- `src/admin-console.js`, `src/admin-console.css`: màn hình Cài đặt hệ thống **đang được gọi thực tế** từ `main.js` qua `openAdminConsole`; giữ nguyên logic hiện tại.
- `index.html`, `package.json`, `package-lock.json`, `tests/*.test.mjs`, `release/S5.7/*`, `.env.example`, `.gitignore`; giữ test, release manifests, archive, rollback.
- `autopilot-admin.html`: chỉ giữ nguyên; không bật worker/cron tự động.
- `leads` và CRM/Callio production records: dữ liệu nghiệp vụ giữ nguyên.

## ẨN / BỎ / KHÔNG TỰ BẬT — PHẢI PHÂN BIỆT
- **KHÔNG được khóa ẩn chức năng phân quyền hiện tại.** `crm_permission_users` thiếu là lỗi cần xử lý riêng theo schema/security, không phải lý do disable tab/hardcode mock.
- `admin-settings.js`: giao diện settings **cũ/legacy**, `main.js` hiện dùng `admin-console.js`. **Không gọi song song cả hai**. Chưa xác minh không còn import ở module khác => chỉ coi là legacy candidate, **không xóa file vội**.
- `Nhóm quyền & CRUD` trong admin-console: hiện là **bảng tham chiếu 'chưa triển khai'**, không phải phân quyền có hiệu lực; không bật lưu nhóm, không show quyền giả như đang enforce. Có thể rút gọn UI nếu có yêu cầu riêng.
- `Autopilot`: tab giải thích/không bật tác vụ ghi dữ liệu. Không tự bật Cron, reminder, allocation/recycling worker, hoặc quyền CRUD chưa enforce.
- `Allocation`: phải giữ preview và xác nhận trước khi phân bổ; không tự bật background mutations.
- `main.js.*.bak`, `shifts.js.*.bak` và các script release cũ: bản backup/reference, không import hay deploy như source chính; lưu cho phục hồi/điều tra, chỉ dọn dẹp sau khi kiểm tra.
- Các scripts `ELH_S57_*.cjs`, `S57_BACKUP_FINAL.ps1` là công cụ release/backup, không nhầm thành runtime và không tự chạy lại.

## H1A CSS-only — bản đang chạy
Tạo `src/elh-s57-h1a.css`, link `<link rel="stylesheet" href="/src/elh-s57-h1a.css">` vào `index.html`; CSS scoped `@media(min-width:768px)`: sidebar width 224px, `height/max-height:100dvh`, `overflow-y:auto`, nền navy `#102a40`, `.sidebar-bottom` sticky/bottom, chữ trắng rõ; `content` padding 28px.
H1A **không thay đổi** JS, Auth, permission logic, DB. Restore source: `release\S5.7\H1A-backup-20261028-162619`. Rollback frontend trên Cloudflare Pages Deployments nếu cần.

## Điều cần xác minh trước bất kỳ tính năng mới
1. Check current `src` + `index.html` (không dùng snapshot pre-H1A overwrite).
2. Search callsites/imports để xác định module active; không xóa theo tên 'legacy' mà chưa trace.
3. Check Production vs Test env đúng; không kéo cấu hình Test vào Production.
4. Viết gate/test cho feature mới; giữ 55 existing PASS và 2 TODO rõ ràng.
