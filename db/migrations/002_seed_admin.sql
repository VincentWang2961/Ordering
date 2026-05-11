-- ============================================================
-- Seed: Create initial admin user
-- Password: OrderingAdmin2026 (bcrypt hashed)
-- ============================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert the superadmin account
INSERT INTO users (username, email, password_hash, display_name, role)
VALUES (
    'admin',
    'admin@ordering.app',
    crypt('OrderingAdmin2026', gen_salt('bf')),
    'Super Admin',
    'superadmin'
)
ON CONFLICT (username) DO NOTHING;

-- Insert a second admin account for daily use
INSERT INTO users (username, email, password_hash, display_name, role)
VALUES (
    'vincent',
    'vincent@vincentwang.au',
    crypt('OrderingAdmin2026', gen_salt('bf')),
    'Vincent Wang',
    'admin'
)
ON CONFLICT (username) DO NOTHING;
