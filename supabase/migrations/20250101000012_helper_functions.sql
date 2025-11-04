-- Helper functions for Edge Functions and API access

-- Function to insert ETL run (for Edge Functions)
CREATE OR REPLACE FUNCTION core_warehouse.insert_etl_run(
    p_shop_id text,
    p_status text,
    p_job_type text,
    p_platform text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_run_id uuid;
BEGIN
    INSERT INTO core_warehouse.etl_runs (
        shop_id, status, job_type, platform
    ) VALUES (
        p_shop_id, p_status, p_job_type, p_platform
    )
    RETURNING id INTO v_run_id;
    
    RETURN v_run_id;
END;
$$;

-- Grant execute to service_role and authenticated users
GRANT EXECUTE ON FUNCTION core_warehouse.insert_etl_run(text, text, text, text) 
    TO postgres, service_role, authenticated;

