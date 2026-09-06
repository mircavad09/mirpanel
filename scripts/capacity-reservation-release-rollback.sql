begin;
do $$declare r record;begin
  for r in select function_def from mirpanel_capacity_backup_20260906.function_defs order by identity_args loop
    execute r.function_def;
  end loop;
end$$;
commit;
