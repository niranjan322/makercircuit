-- ─── MakerCircuit – Supabase Schema ──────────────────────────────────────────
-- Run this once in the Supabase SQL Editor to set up your tables.
-- Dashboard → SQL Editor → New query → paste & run.

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    mobile_number TEXT        NOT NULL,
    password      TEXT        NOT NULL,       -- bcrypt hash
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── requests ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    user_name   TEXT,
    user_email  TEXT,
    type        TEXT,
    cause       TEXT,
    details     TEXT,
    review      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── otp_tokens ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT        NOT NULL UNIQUE,
    otp        TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- We use the service-role key on the server, so RLS won't block us.
-- Still good practice to enable it and deny anon access.
ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;

-- Deny all access to anon / authenticated roles (server uses service_role which bypasses RLS)
CREATE POLICY "no_anon_users"       ON users       FOR ALL TO anon USING (false);
CREATE POLICY "no_anon_requests"    ON requests    FOR ALL TO anon USING (false);
CREATE POLICY "no_anon_otp_tokens"  ON otp_tokens  FOR ALL TO anon USING (false);
