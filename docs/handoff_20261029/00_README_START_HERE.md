# ELLIE HOMES CRM — HANDOFF CHAT MỚI
**Ngày ghi nhận:** 29/10/2026 (Asia/Ho_Chi_Minh)  
**Dự án local:** `C:\Users\HP\ELH-CRM-Supabase`  
**Production:** https://ellie-homes-crm.pages.dev  
**Cloudflare Pages project:** `ellie-homes-crm`  
**Supabase Production ref:** `qmzmkijlarwdlslipaou`  
**Supabase Test ref:** `ynbtzjccosnukxtxyxxf`

## Trạng thái chính xác
- **S5.7 TLS Production deployment:** ĐÃ TRIỂN KHAI backend và frontend.
- **S5.7-H1A Desktop sidebar CSS-only:** **RELEASED & ACCEPTED**; deploy thành công 29/10/2026, Cloudflare deployment `a4a6563a` (`https://a4a6563a.ellie-homes-crm.pages.dev`). Chị đã kiểm tra screenshot ADMIN, TELESALES, Shift, Attendance Production.
- **55 test PASS, 0 FAIL, 2 TODO**; Vite production build PASS 96 modules (H1A).
- **H1A acceptance report:** `release\S5.7\S57_H1A_FINAL_ACCEPTANCE.json`, đã tạo thành công trên máy người dùng. Backup source: `release\S5.7\H1A-backup-20261028-162619`.
- **Chưa thể chốt toàn bộ S5.7 end-to-end**: `crm_permission_users` thiếu trên Production, 2 Attendance runtime UAT còn TODO, backup restore chưa kiểm thử.
- Không chạy lại migration TLS. Không tự tắt/chỉnh quyền tài khoản để tránh lỗi RPC; đây là nhiệm vụ riêng, cần schema/permission review.

## Dùng trong chat mới
Đọc 01_CONTEXT_STATUS.md, 02_SOURCE_KEEP_HIDE.md và 03_GUARDRAILS_NEXT.md trước khi đề xuất tính năng mới. **Ưu tiên source thật mới nhất từ máy**. Thư mục `reference_pre_H1A/` chỉ là source snippet cũ gửi ngày 28/10, KHÔNG phải bản Production hiện tại và không được dùng để overwrite.

## Lời nhắc cho assistant mới
Người dùng cần: báo cáo ngắn tiến độ sau mỗi PASS; mỗi bước chỉ 1 khối PowerShell gọn, chạy một lần, tự backup/rollback; tránh paste nhiều dòng gây PSReadLine crash; không cần hỏi lại thông tin đã biết. Cần kiểm tra source hiện hành trước khi patch, tránh regex/anchor mỏng manh, không đụng database/phân quyền nếu chỉ sửa UI.
