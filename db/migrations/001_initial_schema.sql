-- ============================================================
-- Ordering Database: Initial Schema Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS - Admin accounts with role-based access
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. MENU ITEMS - Restaurant menu
-- ============================================================
CREATE TABLE menu_items (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    name_zh_cn VARCHAR(200) NOT NULL DEFAULT '',
    name_zh_tw VARCHAR(200) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    description_zh_cn TEXT NOT NULL DEFAULT '',
    description_zh_tw TEXT NOT NULL DEFAULT '',
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image VARCHAR(500) NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT '',
    published BOOLEAN NOT NULL DEFAULT true,
    available_start_date DATE,
    available_end_date DATE,
    available_days INTEGER[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_published ON menu_items(published);

-- ============================================================
-- 3. ORDERS - Customer orders
-- ============================================================
CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY,
    contact VARCHAR(200) NOT NULL,
    address VARCHAR(500) NOT NULL,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    pickup_time VARCHAR(20) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'cancelled', 'delivered')),
    total DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    paid BOOLEAN NOT NULL DEFAULT false,
    paid_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    delivered_photo TEXT,
    delivery_comment TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_pickup_time ON orders(pickup_time);

-- ============================================================
-- 4. ORDER ITEMS - Line items within orders
-- ============================================================
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- 5. RESTAURANT SETTINGS - Key-value configuration store
-- ============================================================
CREATE TABLE restaurant_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO restaurant_settings (key, value) VALUES
    ('name', 'Ordering'),
    ('name_zh_cn', 'Ordering'),
    ('name_zh_tw', 'Ordering'),
    ('pickup_address', 'Perth WA, Australia'),
    ('pickup_address_zh_cn', 'Perth WA, Australia'),
    ('pickup_address_zh_tw', 'Perth WA, Australia'),
    ('contact', '0488888888');

-- ============================================================
-- 6. ROUTE PLANS - Saved delivery route plans
-- ============================================================
CREATE TABLE route_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_address VARCHAR(500) NOT NULL,
    end_address VARCHAR(500),
    selected_order_ids JSONB NOT NULL DEFAULT '[]',
    route_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_route_plans_user_id ON route_plans(user_id);

-- ============================================================
-- 7. AUDIT LOG - Immutable change tracking (INSERT ONLY)
-- ============================================================
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES users(id),
    ip_address VARCHAR(45),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at);
CREATE INDEX idx_audit_log_record_id ON audit_log(record_id);

-- Revoke all modification permissions on audit_log
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_log FROM ordering_user;

-- ============================================================
-- 8. FINANCIAL RECORDS - For future financial reporting
-- ============================================================
CREATE TABLE financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(50) REFERENCES orders(id),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'order_revenue', 'delivery_fee', 'refund',
        'expense_ingredient', 'expense_operation', 'expense_other',
        'adjustment'
    )),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    recorded_by UUID REFERENCES users(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_records_type ON financial_records(type);
CREATE INDEX idx_financial_records_recorded_at ON financial_records(recorded_at);

-- ============================================================
-- Audit Trigger Function: Auto-log all changes
-- ============================================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    _user_id UUID;
    _old_json JSONB;
    _new_json JSONB;
BEGIN
    -- Get current user ID from application context (set via SET LOCAL)
    _user_id := current_setting('app.current_user_id', true)::UUID;

    IF TG_OP = 'INSERT' THEN
        _new_json := to_jsonb(NEW);
        INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id::VARCHAR, 'INSERT', _new_json, _user_id);
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        _old_json := to_jsonb(OLD);
        _new_json := to_jsonb(NEW);
        INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id::VARCHAR, 'UPDATE', _old_json, _new_json, _user_id);
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        _old_json := to_jsonb(OLD);
        INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id::VARCHAR, 'DELETE', _old_json, _user_id);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Apply audit triggers to all tracked tables
-- ============================================================
CREATE TRIGGER audit_menu_items AFTER INSERT OR UPDATE OR DELETE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_order_items AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_restaurant_settings AFTER INSERT OR UPDATE OR DELETE ON restaurant_settings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_financial_records AFTER INSERT OR UPDATE OR DELETE ON financial_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- Updated_at auto-update function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_restaurant_settings_updated_at BEFORE UPDATE ON restaurant_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Financial Reporting Views (for future)
-- ============================================================

-- Daily revenue summary view
CREATE VIEW v_daily_revenue AS
SELECT
    DATE(recorded_at) AS day,
    type,
    SUM(amount) AS total_amount,
    COUNT(*) AS transaction_count
FROM financial_records
GROUP BY DATE(recorded_at), type
ORDER BY day DESC;

-- Order performance view
CREATE VIEW v_order_performance AS
SELECT
    DATE(created_at) AS day,
    status,
    COUNT(*) AS order_count,
    SUM(total) AS total_revenue,
    AVG(total) AS avg_order_value
FROM orders
GROUP BY DATE(created_at), status
ORDER BY day DESC;
