-- Migration 044: Add unique constraints for plans and categories to allow seed.sql ON CONFLICT to work properly.

ALTER TABLE plans ADD CONSTRAINT plans_name_key UNIQUE (name);
ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
