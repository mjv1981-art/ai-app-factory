CREATE TABLE IF NOT EXISTS factory_records (
  collection text NOT NULL,
  id text NOT NULL,
  owner text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS factory_records_owner ON factory_records(collection, owner);
CREATE INDEX IF NOT EXISTS factory_run_status ON factory_records((data->>'status')) WHERE collection = 'runs';
CREATE TABLE IF NOT EXISTS factory_locks (id text PRIMARY KEY);
INSERT INTO factory_locks(id) VALUES ('transaction') ON CONFLICT DO NOTHING;
