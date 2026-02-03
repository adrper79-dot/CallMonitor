DO $$
DECLARE
  r RECORD;
  fk_cols int[];
  pk_cols int[];
  fk_col_name text;
  pk_col_name text;
  fk_type text;
  pk_type text;
BEGIN
  FOR r IN
    SELECT c.oid AS con_oid, c.conname, c.conrelid, c.confrelid, c.conkey, c.confkey
    FROM pg_constraint c
    WHERE c.contype = 'f' AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
  LOOP
    fk_cols := r.conkey;
    pk_cols := r.confkey;
    IF array_length(fk_cols,1) = 1 THEN
      fk_col_name := (SELECT attname FROM pg_attribute WHERE attrelid = r.conrelid AND attnum = fk_cols[1]);
      pk_col_name := (SELECT attname FROM pg_attribute WHERE attrelid = r.confrelid AND attnum = pk_cols[1]);
      fk_type := pg_catalog.format_type((SELECT atttypid FROM pg_attribute WHERE attrelid = r.conrelid AND attnum = fk_cols[1]), NULL);
      pk_type := pg_catalog.format_type((SELECT atttypid FROM pg_attribute WHERE attrelid = r.confrelid AND attnum = pk_cols[1]), NULL);
      IF fk_type <> pk_type THEN
        RAISE NOTICE 'Altering % column % to type % (was %)', r.conrelid::regclass, fk_col_name, pk_type, fk_type;
        EXECUTE format('ALTER TABLE %s ALTER COLUMN %I TYPE %s USING (%I::%s);', r.conrelid::regclass, fk_col_name, pk_type, fk_col_name, pk_type);
      END IF;
    END IF;
  END LOOP;
END$$;
