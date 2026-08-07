-- Removing a calendar connection (e.g. disconnecting a Google account) should
-- also remove the meetings that were synced from that account, instead of
-- leaving them orphaned with a null calendar_connection_id. Child rows
-- (participants, bots, transcript segments, summaries, embeddings, ingestion
-- events) already cascade from meetings, so this propagates cleanly.

alter table public.meetings
  drop constraint if exists meetings_calendar_connection_id_fkey;

alter table public.meetings
  add constraint meetings_calendar_connection_id_fkey
  foreign key (calendar_connection_id)
  references public.calendar_connections(id)
  on delete cascade;
