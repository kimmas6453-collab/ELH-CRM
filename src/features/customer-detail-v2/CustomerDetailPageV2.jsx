import React, { useMemo } from "react";
import { getStatusMeta } from "./statusMeta";

const styles = {
  page: {
    display: "grid",
    gridTemplateColumns: "1.05fr 1.15fr",
    gap: 16,
    alignItems: "start"
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E6ECF3",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)"
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0F2B46",
    margin: 0
  },
  subText: {
    color: "#6B7C93",
    fontSize: 13
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: "#16324F"
  },
  input: {
    minHeight: 48,
    border: "1px solid #D7E1EC",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    color: "#16324F",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box"
  },
  textarea: {
    minHeight: 120,
    border: "1px solid #D7E1EC",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    color: "#16324F",
    background: "#fff",
    width: "100%",
    resize: "vertical",
    boxSizing: "border-box"
  },
  hero: {
    background: "#FFFFFF",
    border: "1px solid #E6ECF3",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16
  },
  heroHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16
  },
  heroMeta: {
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
    marginTop: 12,
    color: "#24527A"
  },
  badge: (meta) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: meta.bg,
    color: meta.fg,
    border: `1px solid ${meta.border}`,
    fontSize: 14,
    fontWeight: 700
  }),
  dot: (meta) => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: meta.dot,
    display: "inline-block"
  }),
  saveBtn: {
    width: "100%",
    minHeight: 52,
    borderRadius: 12,
    border: "none",
    background: "#082D56",
    color: "#fff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer"
  },
  crmTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 8
  },
  crmTh: {
    textAlign: "left",
    fontSize: 13,
    color: "#6B7C93",
    width: "32%",
    padding: "10px 0",
    borderBottom: "1px solid #EEF2F6"
  },
  crmTd: {
    fontSize: 14,
    color: "#16324F",
    padding: "10px 0",
    borderBottom: "1px solid #EEF2F6"
  },
  historyWrap: {
    maxHeight: "calc(100vh - 270px)",
    overflowY: "auto",
    paddingRight: 4
  },
  historyFilters: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 1,
    paddingBottom: 12
  },
  historyGroupDate: {
    fontSize: 18,
    fontWeight: 800,
    color: "#16324F",
    margin: "16px 0 10px"
  },
  activityItem: {
    display: "grid",
    gridTemplateColumns: "96px 20px 1fr auto",
    gap: 12,
    alignItems: "start",
    padding: "12px 0",
    borderBottom: "1px solid #EEF2F6"
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 8
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#2F80ED",
    marginBottom: 4
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 58,
    background: "#D9E6F6"
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#16324F",
    marginBottom: 4
  },
  activityText: {
    fontSize: 14,
    color: "#4F6480",
    lineHeight: 1.55
  },
  sourcePill: {
    background: "#F2EAFE",
    color: "#7C3AED",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block"
  },
  actorText: {
    marginTop: 8,
    fontSize: 13,
    color: "#60758F"
  }
};

function formatDateTime(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return String(v);
  }
}

function groupByDay(items = []) {
  const map = {};
  items.forEach((x) => {
    const d = x?.created_at ? new Date(x.created_at) : null;
    const key = d && !Number.isNaN(d.valueOf())
      ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
      : "KhÃ¡c";
    if (!map[key]) map[key] = [];
    map[key].push(x);
  });
  return map;
}

export default function CustomerDetailPageV2({
  customer,
  form,
  onChange,
  onSave,
  historyItems = [],
  historyFilters = {},
  onHistoryFilterChange = () => {},
  projectOptions = [],
  sourceOptions = [],
  staffOptions = [],
  statusOptions = [],
  interestOptions = [],
  onBack = () => {},
  readonlyLegacy = {}
}) {
  const statusLabel = form?.status || customer?.status || "ChÆ°a liÃªn há»‡";
  const statusMeta = getStatusMeta(statusLabel);
  const groups = useMemo(() => groupByDay(historyItems), [historyItems]);

  return (
    <div style={{ padding: 16 }}>
      <div style={styles.hero}>
        <div style={styles.heroHead}>
          <div>
            <div style={{ color: "#A47B40", fontWeight: 700, letterSpacing: "0.1em", fontSize: 13, marginBottom: 8 }}>
              KHÃCH HÃ€NG / CHI TIáº¾T KHÃCH HÃ€NG
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F2B46" }}>
              {customer?.name || "KhÃ¡ch hÃ ng chÆ°a Ä‘áº·t tÃªn"}
            </div>
            <div style={styles.heroMeta}>
              <span>{form?.phone || customer?.phone || "-"}</span>
              <span>{form?.project || customer?.project || "-"}</span>
              <span>{form?.source || customer?.source || "-"}</span>
              <span>{form?.owner_name || customer?.owner_name || "-"}</span>
            </div>
          </div>

          <div style={styles.badge(statusMeta)}>
            <span style={styles.dot(statusMeta)}></span>
            {statusLabel}
          </div>
        </div>
      </div>

      <div style={styles.page}>
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div>
              <h3 style={styles.title}>Dá»¯ liá»‡u hiá»‡n táº¡i</h3>
              <div style={styles.subText}>Cáº­p nháº­t thÃ´ng tin khÃ¡ch hÃ ng vÃ  lá»‹ch chÄƒm sÃ³c</div>
            </div>
            <div style={styles.subText}>
              Cáº­p nháº­t gáº§n nháº¥t<br />
              <strong>{formatDateTime(customer?.updated_at || customer?.last_interaction_at)}</strong>
            </div>
          </div>

          <div style={styles.fieldGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Sá»‘ Ä‘iá»‡n thoáº¡i</label>
              <input
                style={styles.input}
                value={form?.phone || ""}
                onChange={(e) => onChange("phone", e.target.value)}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Tráº¡ng thÃ¡i</label>
              <select
                style={{ ...styles.input, background: statusMeta.bg, color: statusMeta.fg, borderColor: statusMeta.border }}
                value={form?.status || ""}
                onChange={(e) => onChange("status", e.target.value)}
              >
                {(statusOptions || []).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Dá»± Ã¡n quan tÃ¢m</label>
              <select
                style={styles.input}
                value={form?.project || ""}
                onChange={(e) => onChange("project", e.target.value)}
              >
                {(projectOptions || []).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Nguá»“n khÃ¡ch hÃ ng</label>
              <select
                style={styles.input}
                value={form?.source || ""}
                onChange={(e) => onChange("source", e.target.value)}
              >
                {(sourceOptions || []).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>NhÃ¢n viÃªn phá»¥ trÃ¡ch</label>
              <select
                style={styles.input}
                value={form?.owner_id || ""}
                onChange={(e) => onChange("owner_id", e.target.value)}
              >
                {(staffOptions || []).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Láº§n chÄƒm sÃ³c tiáº¿p theo</label>
              <input
                type="date"
                style={styles.input}
                value={form?.next_follow_up_at || ""}
                onChange={(e) => onChange("next_follow_up_at", e.target.value)}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Má»©c Ä‘á»™ quan tÃ¢m</label>
              <select
                style={styles.input}
                value={form?.interest_level || ""}
                onChange={(e) => onChange("interest_level", e.target.value)}
              >
                {(interestOptions || []).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>MÃ£ cÄƒn / MÃ£ lead</label>
              <input
                style={styles.input}
                value={form?.unit_code || customer?.unit_code || ""}
                onChange={(e) => onChange("unit_code", e.target.value)}
              />
            </div>
          </div>

          <div style={{ ...styles.field, marginTop: 16 }}>
            <label style={styles.label}>Ghi chÃº hiá»‡n táº¡i</label>
            <textarea
              style={styles.textarea}
              value={form?.note || ""}
              onChange={(e) => onChange("note", e.target.value)}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#16324F", marginBottom: 10 }}>
              ThÃ´ng tin gá»‘c Ä‘Ã£ chuyá»ƒn tá»« CRM cÅ©
            </div>

            <table style={styles.crmTable}>
              <tbody>
                <tr>
                  <th style={styles.crmTh}>Cháº¥t lÆ°á»£ng sá»‘</th>
                  <td style={styles.crmTd}>{readonlyLegacy?.phone_quality || customer?.phone_quality || "-"}</td>
                </tr>
                <tr>
                  <th style={styles.crmTh}>MÃ£ cÄƒn</th>
                  <td style={styles.crmTd}>{readonlyLegacy?.legacy_unit_code || customer?.legacy_unit_code || customer?.unit_code || "-"}</td>
                </tr>
                <tr>
                  <th style={styles.crmTh}>Ghi chÃº nguá»“n</th>
                  <td style={styles.crmTd}>{readonlyLegacy?.legacy_note || customer?.legacy_note || "-"}</td>
                </tr>
                <tr>
                  <th style={styles.crmTh}>Nguá»“n dá»¯ liá»‡u</th>
                  <td style={styles.crmTd}>{readonlyLegacy?.legacy_source_name || customer?.legacy_source_name || customer?.source || "-"}</td>
                </tr>
                <tr>
                  <th style={styles.crmTh}>ÄÃ¡nh giÃ¡ nguá»“n</th>
                  <td style={styles.crmTd}>{readonlyLegacy?.legacy_source_rating || customer?.legacy_source_rating || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18 }}>
            <button style={styles.saveBtn} onClick={onSave}>LÆ°u cáº­p nháº­t</button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div>
              <h3 style={styles.title}>Lá»‹ch sá»­ tÆ°Æ¡ng tÃ¡c</h3>
              <div style={styles.subText}>
                Tá»•ng {historyItems?.length || 0} hoáº¡t Ä‘á»™ng
              </div>
            </div>
          </div>

          <div style={styles.historyWrap}>
            <div style={styles.historyFilters}>
              <select
                style={styles.input}
                value={historyFilters?.status || ""}
                onChange={(e) => onHistoryFilterChange("status", e.target.value)}
              >
                <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
                {(statusOptions || []).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>

              <select
                style={styles.input}
                value={historyFilters?.channel || ""}
                onChange={(e) => onHistoryFilterChange("channel", e.target.value)}
              >
                <option value="">Táº¥t cáº£ kÃªnh</option>
                <option value="CRM">CRM</option>
                <option value="Callio">Callio</option>
                <option value="Facebook Ads">Facebook Ads</option>
              </select>

              <select
                style={styles.input}
                value={historyFilters?.sort || "desc"}
                onChange={(e) => onHistoryFilterChange("sort", e.target.value)}
              >
                <option value="desc">Má»›i nháº¥t trÆ°á»›c</option>
                <option value="asc">CÅ© nháº¥t trÆ°á»›c</option>
              </select>
            </div>

            {Object.keys(groups).length === 0 && (
              <div style={{ color: "#6B7C93", padding: "8px 0" }}>ChÆ°a cÃ³ lá»‹ch sá»­ tÆ°Æ¡ng tÃ¡c.</div>
            )}

            {Object.entries(groups).map(([day, items]) => (
              <div key={day}>
                <div style={styles.historyGroupDate}>{day}</div>

                {items.map((item, idx) => {
                  const meta = getStatusMeta(item?.status || item?.type || "Ghi chÃº");
                  return (
                    <div style={styles.activityItem} key={item?.id || `${day}-${idx}`}>
                      <div style={{ color: "#60758F", fontSize: 14, lineHeight: 1.45 }}>
                        {formatDateTime(item?.created_at)}
                      </div>

                      <div style={styles.timeline}>
                        <div style={styles.timelineDot}></div>
                        {idx < items.length - 1 && <div style={styles.timelineLine}></div>}
                      </div>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={styles.badge(meta)}>
                            <span style={styles.dot(meta)}></span>
                            {item?.status || item?.type || "TÆ°Æ¡ng tÃ¡c"}
                          </span>
                        </div>

                        <div style={styles.activityTitle}>
                          {item?.title || item?.summary || "Cáº­p nháº­t chÄƒm sÃ³c"}
                        </div>

                        <div style={styles.activityText}>
                          {item?.description || item?.note || "-"}
                        </div>

                        <div style={styles.actorText}>
                          Thá»±c hiá»‡n bá»Ÿi: <strong>{item?.actor_name || item?.performed_by || item?.owner_name || "-"}</strong>
                        </div>
                      </div>

                      <div>
                        <span style={styles.sourcePill}>{item?.channel || item?.source || "CRM"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}