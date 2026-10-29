export const STATUS_META = {
  "Äang chÄƒm sÃ³c": { key: "dang_cham_soc", bg: "#EAF8EF", fg: "#1F8A4C", dot: "#22C55E", border: "#CDEFD8" },
  "ChÆ°a liÃªn há»‡": { key: "chua_lien_he", bg: "#EFF4FF", fg: "#245FE5", dot: "#3B82F6", border: "#D7E4FF" },
  "KhÃ´ng nghe mÃ¡y": { key: "khong_nghe_may", bg: "#FFF7E8", fg: "#B7791F", dot: "#F59E0B", border: "#FBE3B0" },
  "Háº¹n gá»i láº¡i": { key: "hen_goi_lai", bg: "#F3ECFF", fg: "#7C3AED", dot: "#8B5CF6", border: "#E3D4FF" },
  "CÃ³ nhu cáº§u": { key: "co_nhu_cau", bg: "#E9F9F0", fg: "#15803D", dot: "#16A34A", border: "#C8EDD5" },
  "KhÃ´ng phÃ¹ há»£p": { key: "khong_phu_hop", bg: "#FFF0F0", fg: "#D14343", dot: "#EF4444", border: "#F8CDCD" },
  "ÄÃ£ chá»‘t": { key: "da_chot", bg: "#ECFDF3", fg: "#047857", dot: "#10B981", border: "#C8F2DF" },
  "Má»›i táº¡o": { key: "moi_tao", bg: "#F4F7FB", fg: "#5B6B82", dot: "#94A3B8", border: "#DFE7F1" },
  "PhÃ¢n bá»•": { key: "phan_bo", bg: "#EEF4FF", fg: "#325DFF", dot: "#3B82F6", border: "#D9E6FF" },
  "Cuá»™c gá»i": { key: "cuoc_goi", bg: "#EAF8EF", fg: "#15803D", dot: "#22C55E", border: "#CDEFD8" },
  "Ghi chÃº": { key: "ghi_chu", bg: "#FFF7E8", fg: "#B7791F", dot: "#F59E0B", border: "#FBE3B0" }
};

export function getStatusMeta(label) {
  if (!label) {
    return { key: "unknown", bg: "#F5F7FA", fg: "#5B6B82", dot: "#94A3B8", border: "#E3E8EF" };
  }
  return STATUS_META[label] || { key: "unknown", bg: "#F5F7FA", fg: "#5B6B82", dot: "#94A3B8", border: "#E3E8EF" };
}