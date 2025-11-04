-- Initial schema setup
-- Creates all required schemas: staging_ingest, core_warehouse, reporting, app_dashboard

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS staging_ingest;
CREATE SCHEMA IF NOT EXISTS core_warehouse;
CREATE SCHEMA IF NOT EXISTS reporting;
CREATE SCHEMA IF NOT EXISTS app_dashboard;

-- Grant permissions
GRANT USAGE ON SCHEMA staging_ingest TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA core_warehouse TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA reporting TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app_dashboard TO postgres, anon, authenticated, service_role;

