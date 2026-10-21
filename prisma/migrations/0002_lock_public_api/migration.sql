-- Lock every table off from Supabase's public data API (PostgREST).
--
-- Supabase exposes tables in the "public" schema through its REST and GraphQL
-- APIs to anyone holding the publishable (anon) key, which is public by design.
-- The app never uses that API: it talks to Postgres directly through Prisma as
-- the database owner, which bypasses row-level security. So:
--   1. turn on row-level security with no policies (no rows visible or writable via the API), and
--   2. revoke the API roles' table privileges, where those roles exist (they do on Supabase).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['StoreConfig', 'Order', 'AuditLog', 'Subscriber', 'User', 'Address', 'Session', 'OtpCode', '_prisma_migrations'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Tables created later by future migrations must get the same treatment;
-- add them to a new migration like this one.
