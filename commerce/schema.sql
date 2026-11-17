CREATE TABLE IF NOT EXISTS inventory (
  sku text PRIMARY KEY,
  available integer NOT NULL DEFAULT 0 CHECK (available >= 0)
);
INSERT INTO inventory(sku, available) VALUES ('iwb-journal',0) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  request_key uuid UNIQUE NOT NULL,
  quantity integer NOT NULL CHECK(quantity = 1),
  region text NOT NULL,
  total_cents integer NOT NULL CHECK(total_cents >= 3800),
  status text NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','pending','paid','packing','dispatched','expired','failed','review')),
  reserved boolean NOT NULL DEFAULT true,
  stripe_session_id text UNIQUE,
  payment_intent_id text UNIQUE,
  expires_at bigint NOT NULL,
  customer_email text,
  delivery jsonb,
  tracking text,
  refunded_cents integer NOT NULL DEFAULT 0 CHECK(refunded_cents>=0),
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  action text NOT NULL,
  actor text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notification_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  kind text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,kind)
);
CREATE TABLE IF NOT EXISTS inventory_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_key uuid UNIQUE NOT NULL,
 adjustment integer NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'stripe' CHECK(payment_provider IN ('stripe','paypal'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id text UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id text UNIQUE;
CREATE TABLE IF NOT EXISTS paypal_events(id text PRIMARY KEY,type text NOT NULL,processed_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS paypal_refunds(id text PRIMARY KEY,order_id uuid NOT NULL REFERENCES orders(id),amount_cents integer NOT NULL CHECK(amount_cents>0));
