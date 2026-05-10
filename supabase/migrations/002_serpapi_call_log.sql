CREATE TABLE IF NOT EXISTS serpapi_call_log (
  id         bigserial PRIMARY KEY,
  called_at  timestamptz NOT NULL DEFAULT now(),
  origin     text        NOT NULL,
  destination text       NOT NULL,
  success    boolean     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS serpapi_call_log_called_at_idx ON serpapi_call_log (called_at);
