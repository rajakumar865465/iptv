-- Migration 067: Add current_screen column to devices table for in-app tracking

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'current_screen') THEN
        ALTER TABLE devices ADD COLUMN current_screen VARCHAR(100) DEFAULT 'Home';
    END IF;
END $$;
