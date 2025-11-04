-- App dashboard tables
-- User preferences, saved reports, etc.
-- Frontend has R/W access

CREATE TABLE IF NOT EXISTS app_dashboard.user_preferences (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id text,
    preferences jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_dashboard.saved_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    report_type text NOT NULL,
    filters jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON app_dashboard.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id ON app_dashboard.saved_reports(user_id);

-- RLS policies (if needed)
ALTER TABLE app_dashboard.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_dashboard.saved_reports ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own data
CREATE POLICY "Users can view own preferences"
    ON app_dashboard.user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON app_dashboard.user_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON app_dashboard.user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reports"
    ON app_dashboard.saved_reports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own reports"
    ON app_dashboard.saved_reports FOR ALL
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_dashboard TO postgres, service_role, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA app_dashboard TO anon;

