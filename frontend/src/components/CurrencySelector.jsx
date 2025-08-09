// CurrencySelector.jsx
import React from "react";

export default function CurrencySelector({ currencies = [], selected = "", onChange, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 p-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-300"
    >
      {currencies.length === 0 ? (
        <option value="">Loading...</option>
      ) : (
        currencies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))
      )}
    </select>
  );
}
