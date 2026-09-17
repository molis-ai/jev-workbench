ALTER TABLE clients ADD COLUMN official_invoke INTEGER NOT NULL DEFAULT 0 CHECK(official_invoke IN (0,1));
