create table if not exists analytics_events (
  id integer primary key autoincrement,
  event text not null,
  path text not null,
  plan_id text,
  billing text,
  source text,
  created_at text not null
);

create index if not exists idx_analytics_events_created_at on analytics_events(created_at);
create index if not exists idx_analytics_events_event on analytics_events(event);
create index if not exists idx_analytics_events_path on analytics_events(path);
