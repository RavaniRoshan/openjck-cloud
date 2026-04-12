CREATE TABLE api_key_usage (
  key_id        UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start  TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key_id, window_start)
);
