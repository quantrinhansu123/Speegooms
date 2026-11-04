-- Existing quote lines store weightKg/cbm as line totals. New pricing stores
-- those metrics per unit and multiplies them by quantity. Divide old metrics
-- by quantity so existing line totals remain unchanged after the code update.
-- Lines without a positive quantity are left unchanged because they cannot be
-- converted to per-unit metrics safely.

CREATE OR REPLACE FUNCTION app.quote_line_metrics_per_unit(line jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  quantity numeric;
BEGIN
  IF jsonb_typeof(line) IS DISTINCT FROM 'object'
     OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number' THEN
    RETURN line;
  END IF;

  quantity := (line->>'quantity')::numeric;
  IF quantity <= 0 THEN
    RETURN line;
  END IF;

  IF jsonb_typeof(line->'weightKg') = 'number' THEN
    line := jsonb_set(line, '{weightKg}', to_jsonb((line->>'weightKg')::numeric / quantity), true);
  END IF;
  IF jsonb_typeof(line->'cbm') = 'number' THEN
    line := jsonb_set(line, '{cbm}', to_jsonb((line->>'cbm')::numeric / quantity), true);
  END IF;
  RETURN line;
END;
$$;

CREATE OR REPLACE FUNCTION app.quote_lines_metrics_per_unit(lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  line jsonb;
BEGIN
  IF jsonb_typeof(lines) IS DISTINCT FROM 'array' THEN
    RETURN lines;
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(lines) WITH ORDINALITY AS elements(value, ordinality) ORDER BY ordinality LOOP
    result := result || jsonb_build_array(app.quote_line_metrics_per_unit(line));
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION app.quote_data_metrics_per_unit(data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  item jsonb;
BEGIN
  IF jsonb_typeof(data) IS DISTINCT FROM 'array' THEN
    RETURN data;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(data) AS elements(value)
    WHERE jsonb_typeof(value) = 'object' AND jsonb_typeof(value->'lines') = 'array'
  ) THEN
    FOR item IN SELECT value FROM jsonb_array_elements(data) WITH ORDINALITY AS elements(value, ordinality) ORDER BY ordinality LOOP
      IF jsonb_typeof(item) = 'object' AND jsonb_typeof(item->'lines') = 'array' THEN
        item := jsonb_set(item, '{lines}', app.quote_lines_metrics_per_unit(item->'lines'), true);
      END IF;
      result := result || jsonb_build_array(item);
    END LOOP;
    RETURN result;
  END IF;

  RETURN app.quote_lines_metrics_per_unit(data);
END;
$$;

CREATE OR REPLACE FUNCTION app.quote_sent_metrics_per_unit(snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF jsonb_typeof(snapshot) IS DISTINCT FROM 'object'
     OR jsonb_typeof(snapshot->'order') IS DISTINCT FROM 'object'
     OR jsonb_typeof(snapshot->'order'->'lines') IS DISTINCT FROM 'array' THEN
    RETURN snapshot;
  END IF;

  RETURN jsonb_set(snapshot, '{order,lines}', app.quote_lines_metrics_per_unit(snapshot->'order'->'lines'), true);
END;
$$;

UPDATE crm.bao_gia_sourcing_viet_nam
SET chi_tiet_don_hang = app.quote_data_metrics_per_unit(chi_tiet_don_hang),
    ban_da_gui = app.quote_sent_metrics_per_unit(ban_da_gui),
    bao_gia_logistics = CASE
      WHEN bao_gia_logistics IS NULL THEN NULL
      ELSE jsonb_set(
        CASE WHEN bao_gia_logistics ? 'orders'
          THEN jsonb_set(bao_gia_logistics, '{orders}', app.quote_data_metrics_per_unit(bao_gia_logistics->'orders'), true)
          ELSE bao_gia_logistics
        END,
        '{sentQuote}',
        coalesce(app.quote_sent_metrics_per_unit(bao_gia_logistics->'sentQuote'), 'null'::jsonb),
        true
      )
    END;

UPDATE crm.bao_gia_sourcing_global
SET chi_tiet_don_hang = app.quote_data_metrics_per_unit(chi_tiet_don_hang),
    ban_da_gui = app.quote_sent_metrics_per_unit(ban_da_gui),
    bao_gia_logistics = CASE
      WHEN bao_gia_logistics IS NULL THEN NULL
      ELSE jsonb_set(
        CASE WHEN bao_gia_logistics ? 'orders'
          THEN jsonb_set(bao_gia_logistics, '{orders}', app.quote_data_metrics_per_unit(bao_gia_logistics->'orders'), true)
          ELSE bao_gia_logistics
        END,
        '{sentQuote}',
        coalesce(app.quote_sent_metrics_per_unit(bao_gia_logistics->'sentQuote'), 'null'::jsonb),
        true
      )
    END;

UPDATE crm.bao_gia_logistics_viet_nam
SET chi_tiet_don_hang = app.quote_data_metrics_per_unit(chi_tiet_don_hang),
    ban_da_gui = app.quote_sent_metrics_per_unit(ban_da_gui);

UPDATE crm.bao_gia_logistics_global
SET chi_tiet_don_hang = app.quote_data_metrics_per_unit(chi_tiet_don_hang),
    ban_da_gui = app.quote_sent_metrics_per_unit(ban_da_gui);

DROP FUNCTION app.quote_sent_metrics_per_unit(jsonb);
DROP FUNCTION app.quote_data_metrics_per_unit(jsonb);
DROP FUNCTION app.quote_lines_metrics_per_unit(jsonb);
DROP FUNCTION app.quote_line_metrics_per_unit(jsonb);
