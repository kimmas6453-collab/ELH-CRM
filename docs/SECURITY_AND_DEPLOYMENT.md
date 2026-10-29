# Phạm vi GitHub và an toàn triển khai

## Cho phép trên GitHub Private
`src/`, `tests/`, các file Vite, `public/` được kiểm chứng, `package.json`, `package-lock.json`, `.env.example`, `supabase/functions/`, `supabase/config.toml` không chứa khóa, tài liệu và migrations đã được review. Có thể đưa bản `docs/backend/production_structure_20261029_SANITIZED.json` lên sau khi chạy tool và xem lại.

## Tuyệt đối không đưa lên
`.env*` thực (trừ `.env.example`), database passwords, Supabase PAT, service-role key, Cloudflare secret, file chứa dữ liệu khách hàng/Callio/Auth, database dumps, raw `catalog_*.json` chưa rà soát, bản lưu ZIP, các file backup `.bak` và `node_modules/`.

## Kiểm tra trước GitHub
1. Repo Private.
2. Kiểm tra `git status --short` và `git diff --cached --name-only`.
3. Đảm bảo không có `.env`, token, dumps, raw catalog trong staged files.
4. Không bật GitHub/Cloudflare auto-deploy; chưa xác nhận Production parity và npm build/test.
5. Nên bật 2FA cho GitHub, giới hạn cộng tác viên và bảo vệ nhánh chính.

**Lưu ý:** Scan tự động theo mẫu thông dụng không đảm bảo phát hiện mọi loại secret. Nếu phát hiện secret đã commit, cần thu hồi/rotate ngay; xóa file khỏi commit mới chưa đủ để xóa khỏi lịch sử.
