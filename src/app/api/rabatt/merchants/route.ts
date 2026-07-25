import { NextRequest, NextResponse } from "next/server";

const CDN_URL = "https://dep.tcb-cdn.com/toolbarfeed/production/slimmerchants.json";

type SlimMerchant = {
  MerchantId: number;
  Name: string;
  MerchantDomain: string;
  CashbackRate: string;
  SquareLogoUrl: string;
  LargeLogoUrl: string;
};

function parseRateNum(rate: string): number {
  const cleaned = rate.replace(/^Bis zu\s*/i, "").trim();
  const match = cleaned.match(/^([\d,]+)/);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 24));
    const search = (searchParams.get("search") || "").toLowerCase();
    const sort = (searchParams.get("sort") || "rate-desc");

    const response = await fetch(CDN_URL, { next: { revalidate: 300 } });
    if (!response.ok) {
      return NextResponse.json({ error: "Merchant-Daten konnten nicht geladen werden." }, { status: 502 });
    }

    const all: SlimMerchant[] = await response.json();
    let filtered = all;

    if (search) {
      filtered = all.filter((m) => m.Name.toLowerCase().includes(search) || m.MerchantDomain.toLowerCase().includes(search));
    }

    filtered.sort((a, b) => {
      switch (sort) {
        case "rate-asc": return parseRateNum(a.CashbackRate) - parseRateNum(b.CashbackRate);
        case "name-asc": return a.Name.localeCompare(b.Name);
        case "name-desc": return b.Name.localeCompare(a.Name);
        default: return parseRateNum(b.CashbackRate) - parseRateNum(a.CashbackRate);
      }
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit).map((m) => ({
      merchantId: m.MerchantId,
      name: m.Name,
      merchantDomain: m.MerchantDomain,
      cashbackRate: m.CashbackRate,
      squareLogoUrl: m.SquareLogoUrl,
      largeLogoUrl: m.LargeLogoUrl,
    }));

    return NextResponse.json({ items, total, page, totalPages });
  } catch {
    return NextResponse.json({ error: "Merchant-Daten konnten nicht geladen werden." }, { status: 500 });
  }
}
