# Chính sách backup CRM (tách riêng GitHub)

- Source: GitHub Private, commit mỗi lần chốt thay đổi, tag các phiên bản release.
- Schema: catalog read-only có timestamp và snapshots đã kiểm duyệt, không nhầm catalog với `pg_dump` khôi phục.
- Dữ liệu hoạt động (leads, activities, callio, notifications...) và Auth: bản sao lưu mã hóa tách biệt, phân quyền, lưu ở 2 vị trí, kiểm thử phục hồi trên project TEST.
- Edge secret/Cloudflare environment: lưu trong secret manager riêng. `.env.example` chỉ có tên biến.
- Bảo vệ mục tiêu: không chạy migration, import dữ liệu, refresh hoặc db reset lên Production khi đang tạo backup.
- Tần suất khuyến nghị: source sau từng thay đổi; database mỗi ngày hoặc thường xuyên hơn nếu lượng giao dịch lớn; kiểm tra restore hàng tháng.
- Khôi phục hoàn chỉnh cần cả dữ liệu, roles, RLS, SQL routines, Auth, secrets, cấu hình triển khai, phiên bản frontend/Edge Functions, và kiểm tra đối chiếu.
