ALTER TABLE movie_contacts ADD COLUMN IF NOT EXISTS screener_status text NOT NULL DEFAULT 'not_requested';
