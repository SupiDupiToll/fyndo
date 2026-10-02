-- Billiger Change-Check (?since=) und kleinere Scope-Abfragen für /api/pos/groups
CREATE INDEX IF NOT EXISTS "Order_status_updatedAt_idx" ON "Order"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Order_updatedAt_idx" ON "Order"("updatedAt");
