-- User-shop relationship table for access validation
-- This table links users to shops they have access to

CREATE TABLE IF NOT EXISTS app_dashboard.user_shops (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id text NOT NULL,
    role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, shop_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_user_shops_user_id ON app_dashboard.user_shops(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shops_shop_id ON app_dashboard.user_shops(shop_id);

-- RLS policies
ALTER TABLE app_dashboard.user_shops ENABLE ROW LEVEL SECURITY;

-- Users can view their own shop associations
CREATE POLICY "Users can view own shop associations"
    ON app_dashboard.user_shops FOR SELECT
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON app_dashboard.user_shops TO postgres, service_role;
GRANT SELECT ON app_dashboard.user_shops TO authenticated;

