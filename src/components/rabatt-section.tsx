"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SlimMerchant = {
  merchantId: number;
  name: string;
  merchantDomain: string;
  cashbackRate: string;
  squareLogoUrl: string;
};

type MerchantDetail = SlimMerchant & {
  largeLogoUrl: string;
  offers: { Title: string; CashbackRate: string; ExpiryDate: string; Category: string | null }[];
  deals: Record<string, unknown>[];
  discountCodes: { Title: string; CashbackRate: string; Code: string; ExpiryDate: string }[];
  terms: string[];
  exclusions: string[];
  additionalInformation: string | null;
};

const LOGO_BASE = "https://dep.tcb-cdn.com";
const PAGE_LIMIT = 24;

function toLogoUrl(path: string): string {
  return path.startsWith("http") ? path : `${LOGO_BASE}${path}`;
}

function halfNum(value: string): string {
  const num = parseFloat(value.replace(",", "."));
  if (isNaN(num)) return value;
  const half = num / 2;
  return half.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseRate(rate: string): { value: string; unit: string } {
  const withoutBis = rate.replace(/^Bis zu\s*/i, "").trim();
  const matchPct = withoutBis.match(/^([\d,]+)\s*%$/);
  if (matchPct) return { value: halfNum(matchPct[1]), unit: "%" };
  const matchEuro = withoutBis.match(/^€?\s*([\d.,]+)\s*€?$/);
  if (matchEuro) return { value: halfNum(matchEuro[1]), unit: "€" };
  return { value: rate, unit: "" };
}

function SplitBadge({ rate }: { rate: string }) {
  const { value, unit } = parseRate(rate);
  if (!unit) return <span className="rabatt-badge-plain">{rate}</span>;
  return <span className="rabatt-split-badge"><span className="rabatt-split-value">{value}</span><span className="rabatt-split-unit">{unit}</span></span>;
}

function CashbackPill({ rate }: { rate: string }) {
  const isBis = /^Bis zu/i.test(rate);
  return <span className="rabatt-pill">{isBis ? <span className="rabatt-pill-bis">Bis zu</span> : null}<SplitBadge rate={rate} /></span>;
}

function MerchantCard({ merchant, onSelect }: { merchant: SlimMerchant; onSelect: (id: number) => void }) {
  return (
    <button className="rabatt-card" onClick={() => onSelect(merchant.merchantId)} type="button">
      <div className="rabatt-card-top">
        <img alt="" className="rabatt-card-logo" src={toLogoUrl(merchant.squareLogoUrl)} loading="lazy" />
        <CashbackPill rate={merchant.cashbackRate} />
      </div>
      <div className="rabatt-card-body">
        <strong className="rabatt-card-name">{merchant.name}</strong>
        <a className="rabatt-card-domain" href={merchant.merchantDomain} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{merchant.merchantDomain}</a>
      </div>
    </button>
  );
}

function DetailModal({ merchantId, onClose }: { merchantId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current(); }
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", handleKey); };
  }, []);

  useEffect(() => {
    setLoading(true); setError("");
    fetch(`/api/rabatt/merchant/${merchantId}`)
      .then((r) => r.json())
      .then((data) => { if (data.error) setError(data.error); else setDetail(data as MerchantDetail); })
      .catch(() => setError("Details konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [merchantId]);

  const logoUrl = detail?.squareLogoUrl ? toLogoUrl(detail.squareLogoUrl) : "";

  const modal = (
    <div className="rabatt-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="rabatt-modal-title">
      <div className="rabatt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rabatt-modal-header">
          <div className="rabatt-modal-headline">
            <p className="muted">Rabatt-Details</p>
            <h3 id="rabatt-modal-title">{detail?.name ?? "Laden..."}</h3>
          </div>
          <button aria-label="Schließen" className="rabatt-modal-close" onClick={onClose} type="button">&times;</button>
        </div>

        {loading ? (
          <div className="rabatt-modal-loading"><div className="rabatt-spinner" /><p>Details werden geladen...</p></div>
        ) : error ? (
          <p className="status-danger">{error}</p>
        ) : detail ? (
          <div className="rabatt-modal-body">
            <div className="rabatt-modal-summary">
              {logoUrl ? <img alt="" className="rabatt-modal-logo" src={logoUrl} /> : null}
              <div>
                <strong>{detail.name}</strong>
                <a className="rabatt-modal-domain" href={detail.merchantDomain} target="_blank" rel="noopener noreferrer">{detail.merchantDomain}</a>
                <span className="rabatt-modal-rate"><CashbackPill rate={detail.cashbackRate} /></span>
              </div>
            </div>

            {detail.offers.length > 0 ? (
              <section className="rabatt-modal-section"><h4>Cashback-Angebote</h4>
                <div className="rabatt-modal-list">{detail.offers.map((o, i) => (
                  <div key={i} className="rabatt-modal-item">
                    <div className="rabatt-modal-item-top"><span className="rabatt-modal-offer-title">{o.Title}</span><SplitBadge rate={o.CashbackRate} /></div>
                    {o.ExpiryDate ? <p className="rabatt-modal-item-meta">Gültig bis: {new Date(o.ExpiryDate).toLocaleDateString("de-DE")}</p> : null}
                  </div>
                ))}</div>
              </section>
            ) : null}

            {detail.discountCodes.length > 0 ? (
              <section className="rabatt-modal-section"><h4>Rabattcodes</h4>
                <div className="rabatt-modal-list">{detail.discountCodes.map((dc, i) => (
                  <div key={i} className="rabatt-modal-item">
                    <div className="rabatt-modal-item-top"><span className="rabatt-modal-offer-title">{dc.Title}</span><code className="rabatt-code">{dc.Code}</code></div>
                    {dc.ExpiryDate ? <p className="rabatt-modal-item-meta">Gültig bis: {new Date(dc.ExpiryDate).toLocaleDateString("de-DE")}</p> : null}
                  </div>
                ))}</div>
              </section>
            ) : null}

            {detail.terms.length > 0 ? (
              <section className="rabatt-modal-section"><h4>Bedingungen</h4>
                <div className="rabatt-modal-list">{detail.terms.map((t, i) => <p key={i} className="rabatt-modal-text">{t}</p>)}</div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

export function RabattSection() {
  const [merchants, setMerchants] = useState<SlimMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("rate-desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const currentSearchRef = useRef(search);
  const currentSortRef = useRef(sort);

  const fetchMerchants = useCallback(async (p: number, s: string, o: string, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_LIMIT), sort: o });
      if (s) params.set("search", s);
      const res = await fetch(`/api/rabatt/merchants?${params}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        if (append) setMerchants((prev) => [...prev, ...data.items]); else setMerchants(data.items);
        setPage(data.page);
        setHasMore(data.page < data.totalPages);
      }
    } catch { setError("Daten konnten nicht geladen werden."); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchMerchants(1, search, sort, false); }, [search, sort, fetchMerchants]);
  useEffect(() => { currentSearchRef.current = search; currentSortRef.current = sort; }, [search, sort]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) fetchMerchants(page + 1, currentSearchRef.current, currentSortRef.current, true); },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchMerchants]);

  return (
    <section className="rabatt-section">
      <div className="rabatt-controls">
        <input className="rabatt-search" type="search" placeholder="Shop suchen..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setHasMore(false); }} />
        <select className="rabatt-sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); setHasMore(false); }}>
          <option value="rate-desc">Rabatt ∨</option>
          <option value="rate-asc">Rabatt ∧</option>
          <option value="name-asc">A–Z</option>
          <option value="name-desc">Z–A</option>
        </select>
      </div>

      {loading ? (
        <div className="rabatt-loading"><div className="rabatt-spinner" /><p>Shops werden geladen...</p></div>
      ) : error ? (
        <p className="status-danger">{error}</p>
      ) : merchants.length === 0 ? (
        <div className="empty-state"><p>Keine Shops gefunden.</p></div>
      ) : (
        <div>
          <div className="rabatt-grid">
            {merchants.map((m) => <MerchantCard key={m.merchantId} merchant={m} onSelect={setSelectedId} />)}
          </div>
          {loadingMore ? <div className="rabatt-loading"><div className="rabatt-spinner" /><p>Weitere Shops werden geladen...</p></div> : null}
          {hasMore ? <div ref={sentinelRef} className="rabatt-sentinel" /> : <p className="rabatt-end muted">Alle Shops geladen</p>}
        </div>
      )}

      {selectedId ? <DetailModal merchantId={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </section>
  );
}
