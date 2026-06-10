create extension if not exists vector;

create table if not exists public.meeting_embeddings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  source text not null default 'summary',
  content text not null,
  content_hash text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, source)
);

create index if not exists meeting_embeddings_embedding_idx
  on public.meeting_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.meeting_embeddings enable row level security;

create or replace function public.match_meeting_embeddings(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (meeting_id uuid, content text, similarity float)
language sql
stable
security invoker
set search_path = public
as $$
  select e.meeting_id, e.content, 1 - (e.embedding <=> query_embedding) as similarity
  from public.meeting_embeddings e
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_meeting_embeddings(vector, int) from anon, authenticated, public;
