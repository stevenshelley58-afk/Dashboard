## Phase 0 Overview

### 1. Purpose

Phase 0 delivers a working, sellable agency dashboard:

- **Scope**
  - One Shopify store + one Meta ad account per account.
  - Daily + weekly performance.
  - Pages: Home, Shopify, Meta, Sync Status.
  - Warehouse-first: raw data stored, thin fact/aggregate layer for MVP.

- **Infra**
  - Supabase (Postgres).
  - Vercel (UI/API).
  - Railway (worker).

- **Out of scope for Phase 0**
  - Your personal mega-hub.
  - Additional sources (GA4, Klaviyo, TikTok, Google Ads, Xero, bank feeds).
  - Product-level, customer-level, cohort, creative analytics.
  - Multi-currency reporting.

### 2. Phase 0 Goals

- **Stable ingestion**
  - From Shopify + Meta.

- **Dashboard UX**
  - Simple, fast dashboards for non-technical users.

- **Sync visibility**
  - Clear sync status and data freshness.

- **Infra correctness**
  - Correct infra setup (connection pooling, RLS, rate limits).

- **Extensibility**
  - Structure that can be extended without rewriting.


