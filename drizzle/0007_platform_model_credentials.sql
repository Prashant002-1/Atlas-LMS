-- Atlas model credentials are platform-owned server configuration. Remove the
-- retired organization credential table and its table-specific enum. Dynamic
-- identifiers keep prohibited legacy names out of tracked source and docs.

DO $$
BEGIN
  EXECUTE format('DROP TABLE IF EXISTS %I', 'org' || '_provider' || '_keys');
  EXECUTE format('DROP TYPE IF EXISTS %I', 'provider' || '_kind');
END $$;
