// Converter.jsx
import React, { useEffect, useRef, useState } from "react";
import CurrencySelector from "./CurrencySelector";
import { gsap } from "gsap";

/**
 * Robust converter:
 * - tries exchangerate.host (/convert -> /latest)
 * - falls back to frankfurter.app
 * - debounce, abort on change, logs raw API responses to console
 */

export default function Converter() {
  const [amount, setAmount] = useState("1"); // store as string for controlled input
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [currencies, setCurrencies] = useState([]);
  const [result, setResult] = useState(null);
  const [rate, setRate] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(cardRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
    }
  }, []);

  // --- fetch currency list (try exchangerate.host then frankfurter)
  useEffect(() => {
    let cancelled = false;

    async function loadCurrencies() {
      setError("");
      // try exchangerate.host symbols
      try {
        const r = await fetch("https://api.exchangerate.host/symbols?v=" + Date.now());
        const d = await r.json();
        console.debug("symbols (exchangerate.host):", r.status, d);
        if (!cancelled && d && d.symbols) {
          const list = Object.keys(d.symbols).sort();
          setCurrencies(list);
          // ensure defaults exist
          if (!list.includes(from)) setFrom(list[0] || "");
          if (!list.includes(to)) setTo(list[1] || list[0] || "");
          return;
        }
      } catch (err) {
        console.debug("exchangerate.host symbols failed:", err);
      }

      // fallback: Frankfurter currencies (two hostnames tried)
      const frankUrls = [
        "https://api.frankfurter.app/v1/currencies",
        "https://api.frankfurter.dev/v1/currencies",
        "https://api.frankfurter.app/currencies",
      ];
      for (const url of frankUrls) {
        try {
          const r = await fetch(url + "?v=" + Date.now());
          const d = await r.json();
          console.debug("symbols (frankfurter):", url, r.status, d);
          if (!cancelled && d && typeof d === "object" && Object.keys(d).length > 0) {
            const list = Object.keys(d).sort();
            setCurrencies(list);
            if (!list.includes(from)) setFrom(list[0] || "");
            if (!list.includes(to)) setTo(list[1] || list[0] || "");
            return;
          }
        } catch (err) {
          console.debug("frankfurter currencies failed for", url, err);
        }
      }

      if (!cancelled) setError("Unable to load currency list (network / API).");
    }

    loadCurrencies();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- conversion with debounce, AbortController and provider fallbacks
  useEffect(() => {
    // cleanup previous inflight request
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
      abortRef.current = null;
    }

    const num = parseFloat(amount);
    if (!from || !to || isNaN(num) || num <= 0) {
      setResult(null);
      setRate(null);
      if (amount !== "") setError("Enter a valid amount (> 0) and pick currencies.");
      else setError("");
      return;
    }

    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      (async () => {
        setLoading(true);
        const controller = new AbortController();
        abortRef.current = controller;
        const signal = controller.signal;

        try {
          const converted = await convertWithFallback(num, from, to, signal);
          console.debug("conversion final result:", converted);
          if (converted && typeof converted.result === "number") {
            setResult(converted.result);
            setRate(converted.rate ?? converted.result / num);
            setError("");
            // small pop animation
            gsap.fromTo(
              ".result-text",
              { scale: 0.92, opacity: 0.6 },
              { scale: 1, opacity: 1, duration: 0.45, ease: "elastic.out(1,0.6)" }
            );
          } else {
            setResult(null);
            setRate(null);
            setError("Conversion failed (unexpected response).");
          }
        } catch (err) {
          console.error("convertWithFallback error:", err);
          if (err.name === "AbortError") {
            // ignore
          } else {
            setResult(null);
            setRate(null);
            setError(err.message || "Conversion failed (network/API).");
          }
        } finally {
          setLoading(false);
          abortRef.current = null;
        }
      })();
    }, 420);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
        abortRef.current = null;
      }
    };
  }, [amount, from, to]);

  const handleSwap = () => {
    setFrom((prevFrom) => {
      setTo(prevFrom);
      return to;
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-pink-50 via-white to-indigo-50">
      <div ref={cardRef} className="max-w-lg w-full bg-white/90 p-6 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-2xl font-bold text-pink-600 mb-4">Reliable Currency Converter</h2>

        <label className="block mb-3">
          <div className="text-xs text-gray-500 mb-1">Amount</div>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-100"
            aria-label="amount"
          />
        </label>

        <div className="flex gap-2 items-center mb-4">
          <CurrencySelector currencies={currencies} selected={from} onChange={setFrom} ariaLabel="from currency" />
          <button
            onClick={handleSwap}
            className="px-3 py-2 bg-pink-50 rounded-lg border border-pink-100 hover:bg-pink-100 transition"
            title="Swap"
          >
            🔁
          </button>
          <CurrencySelector currencies={currencies} selected={to} onChange={setTo} ariaLabel="to currency" />
        </div>

        <div className="result-text text-center text-lg font-semibold text-pink-700 min-h-[2.2rem]">
          {loading ? (
            "⏳ Converting..."
          ) : error ? (
            <span className="text-red-500">⚠️ {error}</span>
          ) : result !== null ? (
            <>
              {Number(amount).toLocaleString()} {from} = <span className="text-2xl">{parseFloat(result).toFixed(2)}</span> {to}
              {rate !== null && (
                <div className="text-xs text-gray-400 mt-1">Rate: {rate.toFixed(6)} {to} per {from}</div>
              )}
            </>
          ) : (
            "Enter amount & pick currencies"
          )}
        </div>

        <div className="mt-4 text-xs text-gray-400">
          If this still fails: open DevTools → Console and paste the `convert response` / `latest response` logs here and I’ll debug them.
        </div>
      </div>
    </div>
  );
}

/* -------- convertWithFallback --------
   tries exchangerate.host (/convert -> /latest) then frankfurter.app
   returns { result: number, rate: number, provider: string, raw: object }
*/
async function convertWithFallback(num, from, to, signal) {
  const cacheBuster = `v=${Date.now()}`;
  // 1) exchangerate.host /convert
  try {
    const url = `https://api.exchangerate.host/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(num)}&${cacheBuster}`;
    const res = await fetch(url, { signal });
    const data = await safeJson(res);
    console.debug("convert response (exchangerate.host):", res.status, url, data);
    if (data && data.success === true && typeof data.result === "number") {
      return { result: data.result, rate: data.info?.rate ?? data.result / num, provider: "exchangerate.host", raw: data };
    }
  } catch (err) {
    console.debug("exchangerate.host /convert failed:", err);
  }

  // 2) exchangerate.host /latest (fallback)
  try {
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}&${cacheBuster}`;
    const res = await fetch(url, { signal });
    const data = await safeJson(res);
    console.debug("latest response (exchangerate.host):", res.status, url, data);
    if (data && data.success === true && data.rates && typeof data.rates[to] === "number") {
      const r = data.rates[to];
      return { result: num * r, rate: r, provider: "exchangerate.host-latest", raw: data };
    }
  } catch (err) {
    console.debug("exchangerate.host /latest failed:", err);
  }

  // 3) Frankfurter - try a couple of host variants
  const frankUrls = [
    `https://api.frankfurter.app/latest?amount=${encodeURIComponent(num)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    `https://api.frankfurter.dev/latest?amount=${encodeURIComponent(num)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    // fallback: ask rate and multiply
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  ];

  for (const url of frankUrls) {
    try {
      const res = await fetch(url, { signal });
      const data = await safeJson(res);
      console.debug("frankfurter response:", url, res.status, data);
      if (data && data.rates && typeof data.rates[to] === "number") {
        const r = data.rates[to];
        // frankfurter may include 'amount' but rates[to] is the exchange rate we use
        return { result: num * r, rate: r, provider: "frankfurter", raw: data };
      }
      // Some frankfurter variants might return { amount, base, rates } where rates[to] gives converted amount if 'amount' used,
      // but using rates[to] * num is safe.
    } catch (err) {
      console.debug("frankfurter attempt failed for", url, err);
    }
  }

  // All attempts failed
  throw new Error("All providers failed (network, CORS, or API returned unexpected structure).");
}

// parse JSON safely with status awareness
async function safeJson(res) {
  let text;
  try {
    text = await res.text();
    // try parse
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.debug("JSON parse error, raw text:", text, err);
    throw err;
  }
}
