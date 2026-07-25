import { NextResponse } from "next/server";

const CDN_BASE = "https://dep.tcb-cdn.com/toolbarfeed/production";

type MerchantDetail = {
  MerchantId: number;
  Name: string;
  CashbackRate: string;
  MerchantDomain: string;
  SquareLogoUrl: string;
  LargeLogoUrl: string;
  Offers: { Title: string; CashbackRate: string; ClickThroughUrl: string; ExpiryDate: string; Category: string | null }[];
  Deals: Record<string, unknown>[];
  DiscountCodes: { Title: string; CashbackRate: string; ClickThroughUrl: string; ExpiryDate: string; Code: string }[];
  Terms: string[];
  Exclusions: string[];
  AdditionalInformation: string | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const merchantId = parseInt(id, 10);
    if (isNaN(merchantId)) {
      return NextResponse.json({ error: "Ungültige Merchant-ID." }, { status: 400 });
    }

    const response = await fetch(`${CDN_BASE}/${merchantId}.json`, { next: { revalidate: 300 } });
    if (!response.ok) {
      return NextResponse.json({ error: "Merchant-Detail konnten nicht geladen werden." }, { status: 502 });
    }

    const data: MerchantDetail = await response.json();
    return NextResponse.json({
      merchantId: data.MerchantId,
      name: data.Name,
      cashbackRate: data.CashbackRate,
      merchantDomain: data.MerchantDomain,
      squareLogoUrl: data.SquareLogoUrl,
      largeLogoUrl: data.LargeLogoUrl,
      offers: data.Offers,
      deals: data.Deals,
      discountCodes: data.DiscountCodes,
      terms: data.Terms,
      exclusions: data.Exclusions,
      additionalInformation: data.AdditionalInformation,
    });
  } catch {
    return NextResponse.json({ error: "Merchant-Detail konnten nicht geladen werden." }, { status: 500 });
  }
}
