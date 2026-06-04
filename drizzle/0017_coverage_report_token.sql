ALTER TABLE movies ADD COLUMN IF NOT EXISTS coverage_report_token text UNIQUE;
