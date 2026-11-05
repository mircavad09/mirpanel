-- Application rollback is additive: keep mappings, stock, templates and audit intact.
-- Old application remains compatible with all added columns/tables.
select true as additive_rollback_no_data_changes;
