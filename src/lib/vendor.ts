type VendorLike = {
  sellerName?: string | null;
  displayName?: string | null;
};

export function getVendorName(vendor: VendorLike) {
  return vendor.sellerName?.trim() || vendor.displayName?.trim() || "Unbekannt";
}

export function getVendorHref(vendor: VendorLike) {
  return `/vendor/${encodeURIComponent(getVendorName(vendor))}`;
}
