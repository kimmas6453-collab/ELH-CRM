import React from "react";

export function CustomerViewAction({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 12px",
        borderRadius: 10,
        border: "1px solid #D7E1EC",
        background: "#fff",
        color: "#082D56",
        cursor: "pointer",
        fontWeight: 700
      }}
    >
      <span>ðŸ‘</span>
      <span>Xem</span>
    </button>
  );
}