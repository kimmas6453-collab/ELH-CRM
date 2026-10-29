# 03 — NGUYÊN TẮC BẮT BUỘC CHO CHAT MỚI

## An toàn Production / dữ liệu
1. Chỉ can thiệp đúng scope; UI thì UI, không migration, Auth, RPC, RLS hoặc dữ liệu nếu người dùng chưa yêu cầu.
2. Không tự khóa/bỏ chức năng phân quyền để che lỗi; không tự tạo fake/stub RPC hoặc mở rộng `SECURITY DEFINER`/EXECUTE/RLS.
3. Không chạy lại migrations TLS production, không bật Supabase Cron/reminder hay worker tự động.
4. Không đụng dữ liệu `leads`, CRM, Callio khi build tính năng không liên quan.
5. Luôn backup source trước khi sửa; không xóa backups; script có kiểm tra preflight, test/build, rollback; Cloudflare rollback chỉ frontend, không rollback DB.
6. `VITE_SUPABASE_URL` phải đúng Production `https://qmzmkijlarwdlslipaou.supabase.co` khi build production. Test ref `ynbtzjccosnukxtxyxxf` không được lẫn trong bundle. Publishable key phải lấy từ cấu hình hiện có, **không ghi service_role/secret key vào frontend/handoff**.
7. Không kết luận PASS chỉ từ HTTP 200, test unit hoặc screenshot; phân biệt HTTP smoke, visual acceptance, authenticated runtime UAT.
8. Backup app 32/32 KHÔNG phải full disaster recovery; restore test, Auth/Storage pending.
9. Không tạo user thử nghiệm Production hoặc check-in ca giả ngoài khung giờ.

## Kỹ thuật & quy trình
10. Người dùng sử dụng Windows PowerShell trong VS Code; **PSReadLine thường bị lỗi console buffer khi paste nhiều dòng**. Ưu tiên script ngắn, một khối, có thể tạo file và chạy 1 lần; không chia 10 bước lặt vặt.
11. Không dùng brittle exact-string anchors trong `main.js` (đã thất bại 2 lần), không dùng dynamic `MutationObserver` để vá UI như giải pháp mặc định.
12. Không dùng `$()` bên trong double-quoted PowerShell khi muốn literal JS; gây string interpolation và lỗi patch.
13. Không tự sửa/sao chép từ ZIP `reference_pre_H1A` như current source; đọc source trên máy hiện hành trước khi sửa.
14. Nếu test/build fail, rollback source và báo rõ; nếu deploy xong nhưng smoke fail, **không deploy lại ngay**, xác minh trạng thái trước.
15. Sau mỗi PASS, báo cáo tiến độ và đưa bước tiếp theo hoàn chỉnh; không hỏi lại dữ kiện đã rõ.
16. UI giữ phong cách Ellie Homes **navy/gold**, sạch, dễ đọc, responsive mobile-first; không neon, không glassmorphism, không motion quá mức. Mobile giữ navigation/card layout hiện hành.

## Delivery của feature mới
- Định nghĩa acceptance criteria + file/module bị ảnh hưởng + migration nếu thực sự cần.
- Rà dependencies, chạy `npm.cmd test`, `npm.cmd run build`, cần kiểm tra authenticated UAT đúng role.
- Kiểm tra CSS Desktop 1366/1440/1920 và Mobile, overlay dialogs, focus, scrolling, account/logout.
- Chỉ deploy Cloudflare khi được phê duyệt, xác nhận URL & CSS/JS live; lưu manifest/report, rollback instructions.
- Ghi rõ TODO/open issues; tuyệt đối không nói “full UAT PASS” khi Attendance runtime còn TODO.

## Backlog mang sang chat mới
P1: Missing `crm_permission_users` + full permission backend design review (không che bằng disable).
P1: Authenticated Attendance real-time UAT (valid registered shift window & approved check-in edge case).
P2: Test restoration của backup ứng dụng, Auth/Storage DR plan.
Next feature: chờ người dùng nêu; tạo sprint riêng trên baseline H1A đã release.
