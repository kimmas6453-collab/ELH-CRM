# PROMPT CHO CHAT MỚI — COPY NGUYÊN VĂN

Tôi đang tiếp tục phát triển Ellie Homes CRM trên Windows tại `C:\Users\HP\ELH-CRM-Supabase`. Hãy đọc các tài liệu trong package handoff này trước khi đề xuất hoặc sửa code.

Baseline: S5.7 TLS backend/frontend đã triển khai Production (Supabase `qmzmkijlarwdlslipaou`; Cloudflare `ellie-homes-crm.pages.dev`), S5.7-H1A CSS-only sidebar desktop đã deploy thành công và chốt nghiệm thu 29/10/2026, deployment `a4a6563a`. Regression 55 PASS, 0 FAIL, 2 TODO; build 96 modules PASS. Giữ nguyên auth/permissions/CRM/Callio/TLS; không rerun migrations, không bật Cron, không tự khóa chức năng phân quyền.

Hãy sử dụng source mới nhất trực tiếp từ máy hoặc gói source mới nhất tôi cung cấp — ZIP `reference_pre_H1A` chỉ là bản cũ, không được overwrite. Có 3 backlog mở: missing RPC `crm_permission_users`, Attendance runtime UAT (2 TODO), backup restore chưa kiểm thử; các điểm này không làm mất trạng thái H1A CLOSED.

Cách làm việc: sau mỗi PASS, báo cáo tiến độ và đưa một khối PowerShell hoàn chỉnh, ngắn gọn, có backup/rollback và kiểm thử; tránh paste script dài gây PSReadLine crash, tránh brittle JS anchors, không chỉnh dữ liệu Production nếu chưa có yêu cầu rõ ràng. Hãy đề xuất kế hoạch riêng cho tính năng mới tôi yêu cầu tiếp theo.
