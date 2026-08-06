-- ============================================================
-- 003 — Open client registration
--
-- Anyone can sign themselves up from the phone app. The phone number is the
-- account handle (it's what everyone in Tanzania actually has), email becomes
-- optional, and there's a flag ready for the WhatsApp OTP step that will come
-- later.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ---------- Email is no longer required ----------
ALTER TABLE clients ALTER COLUMN email DROP NOT NULL;

-- Blank strings from the old required-email era would collide under a unique
-- index, so fold them to NULL first.
UPDATE clients SET email = NULL WHERE email IS NOT NULL AND btrim(email) = '';

-- Swap the plain UNIQUE constraint for a partial, case-insensitive index so
-- several accounts can exist without an email while real ones stay unique.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_unique
  ON clients (lower(email)) WHERE email IS NOT NULL;

-- ---------- Phone becomes the account handle ----------
-- Normalise what's already there to +255… so the unique index below means
-- what it says. Anything that isn't a recognisable Tanzanian number is left
-- alone rather than mangled.
UPDATE clients
   SET phone = CASE
     WHEN regexp_replace(phone, '[^0-9+]', '', 'g') ~ '^\+255[0-9]{9}$'
       THEN regexp_replace(phone, '[^0-9+]', '', 'g')
     WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^255[0-9]{9}$'
       THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
     WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[0-9]{9}$'
       THEN '+255' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 2)
     ELSE phone
   END
 WHERE phone IS NOT NULL;

-- Only claim uniqueness if the existing data actually supports it — a seeded
-- database with two clients sharing a number shouldn't fail the migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM clients WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_unique ON clients (phone);
  ELSE
    RAISE NOTICE 'clients.phone has duplicates — unique index not created';
  END IF;
END $$;

-- ---------- Ready for the WhatsApp OTP step ----------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- ---------- Staff accounts belong to a company ----------
-- Staff are created from inside a company's console, so the company should be
-- filled in by the server. This index just keeps those lookups cheap.
CREATE INDEX IF NOT EXISTS staff_users_company_idx ON staff_users (company_id);
