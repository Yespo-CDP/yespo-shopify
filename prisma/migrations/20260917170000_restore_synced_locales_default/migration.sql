-- 20260713085529 dropped the array default; createShop omits syncedLocales
-- and Postgres then rejects NULL on a NOT NULL column.
ALTER TABLE "Shop" ALTER COLUMN "syncedLocales" SET DEFAULT '{}';
