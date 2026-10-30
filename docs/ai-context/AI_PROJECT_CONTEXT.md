# ELH CRM — AI PROJECT CONTEXT

**Version:** 1.0  
**Context baseline:** 29/10/2026  
**Project:** Ellie Homes CRM  
**GitHub:** https://github.com/kimmas6453-collab/ELH-CRM  
**Supabase Production candidate:** `qmzmkijlarwdlslipaou`  
**Supabase Test:** `ynbtzjccosnukxtxyxxf`  
**Status:** Working baseline — NOT production deployment approval

---

## 00. START HERE — HƯỚNG DẪN CHO AI

Bạn là AI Engineering Assistant tiếp quản dự án ELH CRM.

Trước khi đề xuất hoặc thay đổi bất kỳ chức năng nào:

1. Đọc tài liệu này.
2. Đọc `README.md`, `package.json` và cấu trúc source trong repository.
3. Đọc các tài liệu bàn giao S57/H1A hiện có trong `docs/`.
4. Kiểm tra `src/`, `tests/`, `supabase/functions/`, các tài liệu database và các migration tham khảo.
5. Xác minh trạng thái Production hiện tại trước khi đưa ra kết luận.
6. Tóm tắt ngắn gọn những gì đã xác minh, những gì chưa xác minh và phạm vi sẽ tác động.

Không được xem một bản snapshot hoặc tài liệu bàn giao cũ là trạng thái Production hiện hành nếu chưa đối chiếu.

### Nguyên tắc nguồn sự thật

- **Live Production:** trạng thái hệ thống đang vận hành, được xác minh bằng quyền đọc phù hợp.
- **Repository:** mã nguồn và lịch sử đã commit.
- **Database snapshot:** trạng thái cấu trúc ở thời điểm xuất.
- **Handoff documents:** quyết định và trạng thái được ghi nhận tại thời điểm bàn giao.
- **Conversation history:** bối cảnh hỗ trợ, không tự động được coi là nguồn xác minh Production.

Khi các nguồn mâu thuẫn, phải báo cáo sự khác biệt, không tự động ghi đè một nguồn bằng nguồn khác.

---

## 01. PROJECT OVERVIEW

ELH CRM là hệ thống quản lý quan hệ khách hàng, phục vụ quy trình Telesales, chăm sóc khách hàng, quản lý dữ liệu, nhân sự và vận hành.

Các nhóm chức năng đã có dấu vết trong mã nguồn:

| Module | Vai trò |
|---|---|
| Customer / Leads | Quản lý hồ sơ và trạng thái khách hàng |
| Customer Detail | Chi tiết khách hàng và lịch sử tương tác |
| Telesales Workspace | Không gian làm việc của nhân viên Telesales |
| Kanban | Quản lý khách hàng theo trạng thái |
| Callio Integration | Đồng bộ và hiển thị thông tin cuộc gọi |
| Allocation | Phân bổ khách hàng và xử lý công việc phân bổ |
| Dashboard / Reports | Báo cáo và theo dõi hoạt động |
| Team / Staff | Quản lý đội ngũ và nhân viên |
| Admin Console | Các chức năng quản trị |
| Access Control / RBAC | Nhóm quyền và kiểm soát truy cập |
| TLS Shift | Đăng ký và quản lý ca trực |
| Attendance | Chấm công, điều chỉnh và phê duyệt |
| Notifications | Thông báo và nhắc lịch |
| Autopilot | Cấu hình và logic hỗ trợ tự động hóa |

Danh sách trên phản ánh các module và cấu trúc đã tìm thấy, không xác nhận mọi chức năng đều hoàn thiện hoặc hoạt động thành công.

### Mục tiêu nghiệp vụ

- Tập trung dữ liệu khách hàng.
- Tổ chức, phân bổ và theo dõi người phụ trách.
- Hỗ trợ nhân viên chăm sóc khách hàng.
- Theo dõi lịch sử cuộc gọi và tương tác.
- Hỗ trợ quản trị hiệu suất và vận hành.
- Kiểm soát quyền truy cập, thao tác và lịch sử hoạt động.

---

## 02. TECHNICAL ARCHITECTURE

### Frontend

Source hiện có cho thấy ứng dụng web dựa trên Vite, JavaScript và một số thành phần JSX.

Các đường dẫn quan trọng:

- `src/main.js`
- `src/api.js`
- `src/customer-detail-page.js`
- `src/telesales-workspace-v4.js`
- `src/kanban-desktop.js`
- `src/admin-console.js`
- `src/admin-settings.js`
- `src/shifts.js`
- `src/attendance.js`
- `src/callio.js`
- `src/features/customer-detail-v2/`
- `tests/`

AI phải kiểm tra code hiện hành để biết chính xác thành phần nào đang được import và sử dụng.

Không tự động kết luận module có file trong `src/` nghĩa là module đang được kích hoạt trong Production.

### Backend

Backend chủ yếu sử dụng Supabase PostgreSQL, kết hợp:

- Database tables
- SQL functions / RPC
- Row Level Security
- Database triggers
- Edge Functions
- Supabase Authentication

### External integration

Hệ thống có tích hợp Callio, bao gồm lịch sử cuộc gọi, tài khoản, đồng bộ và các trạng thái liên quan.

### Edge Functions

Hai Edge Functions đã được xác minh trong project Supabase có dữ liệu CRM:

- `callio-sync` — phiên bản 8 tại lần kiểm tra.
- `crm-accounts` — phiên bản 2 tại lần kiểm tra.

Source tương ứng được lưu dưới:

- `supabase/functions/callio-sync/index.ts`
- `supabase/functions/crm-accounts/index.ts`

Hai file từng được đối chiếu với mã đang chạy trên Supabase. Khi triển khai về sau phải so sánh lại.

### Deployment

Dự án có dấu vết triển khai bằng Cloudflare trong các tài liệu và cuộc trao đổi trước.

Cần xác minh trước khi thay đổi:

- Project Cloudflare đang sử dụng.
- Branch hoặc source được dùng để deploy.
- Build command.
- Environment variables.
- Phiên bản Production.
- Quy trình rollback.

Không giả định push GitHub sẽ tự động cập nhật Production.

---

## 03. DATABASE BASELINE

### Snapshot ngày 29/10/2026

Project ref: `qmzmkijlarwdlslipaou`

| Metadata | Số lượng |
|---|---:|
| Tables | 32 |
| Columns | 220 |
| Constraints | 124 |
| Indexes | 58 |
| RLS Policies | 15 |
| SQL Routines | 74 |
| Application Triggers | 2 |
| Sequences | 9 |
| Extensions | 8 |
| Views | 0 |
| Enums | 0 |

Các bảng đã kiểm tra đều bật RLS.

### Nhóm bảng quan trọng

**Customer / Activities**

- `leads`
- `activities`
- `legacy_archive`
- `notifications`

**Callio**

- `callio_calls`
- `callio_accounts`
- `callio_sync_state`
- `callio_link_requests`

**Access / Admin**

- `profiles`
- `crm_access_groups`
- `crm_access_group_members`
- `crm_access_group_rules`
- `admin_events`

**Allocation / Autopilot**

- `allocation_batches`
- `allocation_jobs`
- `allocation_job_items`
- `elh_autopilot_settings`

**Shift / Attendance**

- `tls_shift_policies`
- `tls_shift_slots`
- `tls_shift_registrations`
- `tls_attendance`
- `tls_attendance_adjustments`
- `tls_attendance_periods`

Bảng đầy đủ và metadata chi tiết nằm trong tài liệu:

`docs/backend/production_structure_20261029_SANITIZED.json`

### Giới hạn của snapshot

File JSON đã lọc chỉ chứa cấu trúc tham khảo.

Không chứa đầy đủ:

- SQL definitions có thể chạy để dựng lại database.
- Toàn bộ giá trị mặc định và điều kiện kiểm tra.
- Thân hàm SQL.
- Dữ liệu khách hàng.
- Supabase Auth user records.
- Bí mật và cấu hình đăng nhập.

**Snapshot không phải bản backup có thể phục hồi.**

---

## 04. BUSINESS RULES & SECURITY

### Access Control

CRM có các cấu trúc phân quyền theo nhóm và module.

Không được tự ý:

- Bỏ kiểm tra quyền.
- Sửa role của người dùng.
- Cấp quyền quản trị.
- Bỏ RLS để khắc phục lỗi truy cập.
- Biến một RPC thành `SECURITY DEFINER` chỉ nhằm vượt lỗi permission.

Các RPC cần xác minh:

- `crm_permission_users`
- `crm_permission_get`
- `crm_permission_save`

Các RPC này từng được frontend tham chiếu nhưng chưa xuất hiện trong snapshot database Production ngày 29/10.

Không tự tạo hoặc triển khai các RPC này khi chưa xác định contract, người gọi, phạm vi quyền và tình trạng UI thực tế.

### Customer Data

Thông tin khách hàng phải được bảo vệ.

Không đưa vào GitHub:

- Dữ liệu khách hàng thật.
- Số điện thoại và lịch sử khách hàng.
- Dữ liệu Auth.
- Khóa `service_role`.
- Callio API token.
- Mật khẩu.
- Database connection credentials.
- File `.env` chứa giá trị bí mật.

### Database Safety

Mọi thay đổi schema phải:

1. Có bản backup phù hợp trước khi triển khai.
2. Có SQL migration rõ ràng.
3. Được kiểm thử trên project test.
4. Kiểm tra tác động đến các RPC hiện hành.
5. Có kế hoạch rollback.
6. Được chủ dự án chấp thuận trước khi áp dụng lên Production.

---

## 05. DECISION LOG

### ADR-001 — GitHub là nguồn quản lý source

**Decision:** Dùng repository Private `ELH-CRM` để lưu mã nguồn, tài liệu và lịch sử thay đổi.

GitHub không thay thế database backup.

### ADR-002 — Không yêu cầu Docker

**Decision:** Ưu tiên PowerShell thuần hoặc công cụ nhẹ có sẵn trên Windows.

Không bắt người dùng cài Docker để kiểm kê schema.

### ADR-003 — Không tự động deploy

**Decision:** Chưa bật tự động triển khai từ GitHub vào Production.

Mọi lần deploy phải được kiểm tra và phê duyệt riêng.

### ADR-004 — Phân biệt source mới và migration cũ

**Decision:** Frontend ngày 29/10 là baseline mã nguồn được đóng gói.

Các migration ngày 19/10 phải được coi là tài liệu lịch sử cho đến khi đối chiếu với database hiện tại.

Không chạy lại migration cũ theo thứ tự một cách máy móc.

### ADR-005 — Không đưa catalog SQL thô lên GitHub

**Decision:** Các file metadata gốc có thể chứa SQL definitions hoặc thông tin nội bộ nhạy cảm.

Chỉ đưa bản đã kiểm duyệt vào repository.

### ADR-006 — Tài liệu context là một phần của source

**Decision:** Mỗi lần thay đổi quan trọng về kiến trúc, nghiệp vụ hoặc triển khai, phải cập nhật context tương ứng.

Không để quyết định quan trọng tồn tại duy nhất trong cuộc chat.

---

## 06. CURRENT STATUS & OPEN ISSUES

### Những việc đã ghi nhận hoàn thành

- Đã đóng gói frontend vào baseline ngày 29/10.
- Đã tạo GitHub repository Private.
- Đã có lịch sử commit trên GitHub.
- Đã xuất danh mục metadata backend ngày 29/10.
- Đã đối chiếu hai Edge Functions tại thời điểm kiểm tra.
- Đã chuẩn hóa tài liệu cấu trúc Supabase để tham khảo.

### Những việc chưa xác minh hoặc chưa hoàn thành

1. Chưa xác nhận toàn bộ file trên GitHub khớp hoàn toàn với source Production hiện tại.
2. Chưa xác nhận test suite và build đều PASS.
3. Chưa có một bản SQL schema được kiểm thử phục hồi đầy đủ.
4. Chưa có backup dữ liệu khách hàng và Auth được kiểm thử khôi phục.
5. Chưa xác nhận quy trình rollback Cloudflare hoàn chỉnh.
6. Ba RPC phân quyền chưa xuất hiện trong snapshot Production ngày 29/10.
7. Cần xác minh lại các migration còn thiếu hoặc các file được tham chiếu bởi bài kiểm thử.
8. Cần kiểm toán các SQL functions chạy `SECURITY DEFINER` và quyền EXECUTE thực tế.

### Trạng thái triển khai

**DO NOT TREAT THIS BASELINE AS PRODUCTION READY.**

Không deploy chỉ vì source đã upload lên GitHub.

---

## 07. AI DEVELOPMENT GUARDRAILS

AI phải tuân theo các nguyên tắc:

**Trước khi sửa**

- Đọc file liên quan và các dependency.
- Xác định contract hiện có.
- Giữ nguyên tính năng ngoài phạm vi yêu cầu.
- Không thay đổi database trực tiếp.
- Không làm mất đường dẫn rollback.

**Trong khi sửa**

- Ưu tiên thay đổi nhỏ, dễ kiểm thử.
- Không viết lại cả module khi chỉ cần sửa lỗi nhỏ.
- Không tự ý đổi tên bảng, cột, RPC hoặc API.
- Không thay đổi cơ chế Auth/RLS ngoài phạm vi được duyệt.
- Không hardcode secret vào source.
- Không thay đổi giao diện hàng loạt khi người dùng chỉ yêu cầu một tính năng.

**Sau khi sửa**

- Kiểm tra cú pháp.
- Chạy test liên quan.
- Chạy build khi có thể.
- Ghi rõ file đã thay đổi.
- Báo cáo kết quả PASS/FAIL/SKIPPED.
- Cập nhật tài liệu context và decision log nếu có quyết định mới.
- Tách biệt trạng thái đã sửa local, đã commit, đã deploy và đã kiểm thử Production.

**Nguyên tắc tuyệt đối:** Không được báo hoàn thành nếu chưa kiểm tra được kết quả thực tế.

---

## 08. BACKUP & RECOVERY

### Source backup

GitHub lưu mã nguồn và lịch sử commit.

### Schema backup

Cần có file SQL chứa schema thực tế được xuất có kiểm soát, kiểm tra và thử khôi phục trên môi trường riêng.

### Data backup

Dữ liệu Production phải được backup riêng bằng phương án có xác thực, bảo mật và kiểm tra khả năng phục hồi.

### Secrets

Lưu ở hệ thống quản lý secret, không lưu trong GitHub.

### Recovery test

Cần thử khôi phục trên môi trường test và xác minh:

- Cấu trúc database.
- RLS và permissions.
- SQL functions.
- Edge Functions.
- Auth và các liên kết người dùng.
- Dữ liệu nghiệp vụ.
- Giao diện frontend.
- Callio integration với chế độ an toàn, không tự kích hoạt đồng bộ ngoài ý muốn.

---

## 09. NEXT PRIORITIES

**P0 — Repository integrity**

- Đối chiếu source GitHub với source đáng tin cậy.
- Rà soát secret và file nhạy cảm.
- Xác minh build và test.

**P1 — Backend consistency**

- Đối chiếu schema Production với migration history.
- Kiểm tra ba RPC phân quyền.
- Kiểm toán quyền gọi các hàm đặc quyền.

**P2 — Disaster Recovery**

- Hoàn thành database backup.
- Bảo vệ Auth và dữ liệu khách hàng.
- Kiểm thử khôi phục trên project test.
- Ghi nhận rollback procedure.

**P3 — Context maintenance**

- Cập nhật decision log.
- Cập nhật release status.
- Ghi rõ phiên bản đã triển khai.
- Đồng bộ tài liệu sau mỗi thay đổi quan trọng.

---

## 10. HANDOFF PROMPT CHO CHAT MỚI

Tôi đang tiếp tục phát triển dự án ELH CRM.

Repository:
https://github.com/kimmas6453-collab/ELH-CRM

Hãy sử dụng tài liệu AI_PROJECT_CONTEXT làm hướng dẫn tiếp quản và đối chiếu với source code thực tế.

Trước khi làm việc, hãy:

1. Xác nhận các file bạn đã thực sự đọc được.
2. Tóm tắt kiến trúc frontend, backend và database.
3. Xác định nghiệp vụ, ràng buộc và trạng thái hiện tại.
4. Phân biệt dữ liệu đã xác minh với dữ liệu lịch sử.
5. Liệt kê các rủi ro liên quan đến yêu cầu mới.
6. Chỉ đề xuất những thay đổi trong phạm vi yêu cầu.

Không tự ý deploy, sửa Production, chạy migration hoặc thay đổi dữ liệu khách hàng.

Nếu repository Private chưa thể truy cập, hãy nói rõ và sử dụng bản ZIP hoặc tài liệu được cung cấp. Không được giả định mình đã đọc source.

---

## 11. CONTEXT UPDATE PROTOCOL

Sau mỗi lần hoàn thành công việc quan trọng, AI cần ghi nhận:

- Ngày cập nhật.
- Chức năng hoặc vấn đề được xử lý.
- File đã thay đổi.
- Quyết định được đưa ra.
- Kết quả test/build.
- Trạng thái commit.
- Trạng thái deploy.
- Tác động database.
- Rủi ro còn lại.
- Bước tiếp theo.

Không xóa quyết định cũ nếu chưa thay thế bằng một quyết định mới có lý do rõ ràng.

**End of AI Project Context v1.0.**
