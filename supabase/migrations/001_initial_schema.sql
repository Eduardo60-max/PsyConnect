-- PsyConnect — Fase 2: Esquema inicial no Supabase (Postgres)
-- Executar no SQL Editor do Supabase ou via `supabase db push`

create extension if not exists pgcrypto;

-- 1. Perfis de usuários (espelha auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'paciente' check (role in ('paciente', 'medico', 'admin')),
  birth_date date,
  anonymous_code text not null unique,
  accepted_terms_at timestamptz,
  accepted_health_data_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Perfis profissionais (médicos com CRM e fluxo de aprovação)
create table if not exists public.professional_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  crm text not null,
  crm_uf text not null,
  specialty text not null,
  role_title text not null default 'Médico(a)',
  bio text not null default '',
  experience text not null default '',
  price_label text not null default 'Gratuito (teste)',
  accent text not null default '#7c3aed',
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  accepted_truth_at timestamptz,
  created_at timestamptz not null default now()
);

-- 3. Grupos e desafios da comunidade
create table if not exists public.groups (
  id text primary key,
  name text not null,
  description text not null,
  theme text not null,
  admin_id uuid references public.profiles(id) on delete set null,
  is_temporary boolean not null default false,
  duration_days integer check (duration_days is null or (duration_days >= 1 and duration_days <= 365)),
  accent text not null default '#7c3aed',
  created_at timestamptz not null default now()
);

-- 4. Participação por usuário em cada grupo
create table if not exists public.group_members (
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 5. Publicações dos grupos
create table if not exists public.posts (
  id text primary key,
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_handle text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_group_created_idx on public.posts (group_id, created_at desc);

-- 6. Curtidas por usuário
create table if not exists public.likes (
  post_id text not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 7. Comentários
create table if not exists public.comments (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_handle text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_created_idx on public.comments (post_id, created_at asc);

-- 8. Progresso em desafios por usuário
create table if not exists public.challenge_progress (
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day integer not null check (day >= 1 and day <= 365),
  completed_at timestamptz not null default now(),
  primary key (group_id, user_id, day)
);

-- 9. Diário de humor por usuário
create table if not exists public.mood_entries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  mood integer not null check (mood between 1 and 5),
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- 10. Disponibilidade real de cada médico aprovado
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  slot_label text not null,
  starts_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (doctor_id, slot_label)
);

create index if not exists availability_doctor_active_idx on public.availability (doctor_id, is_active);

-- 11. Agendamentos (índice único impede dois pacientes no mesmo horário do médico)
create table if not exists public.bookings (
  id text primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  availability_id uuid references public.availability(id) on delete set null,
  slot text not null,
  preference text not null check (preference in ('Online', 'Presencial')),
  reason text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'rescheduled', 'canceled')),
  created_at timestamptz not null default now()
);

create unique index if not exists bookings_doctor_slot_active_idx
  on public.bookings (doctor_id, slot)
  where status != 'canceled';

create index if not exists bookings_patient_idx on public.bookings (patient_id, created_at desc);
create index if not exists bookings_doctor_idx on public.bookings (doctor_id, created_at desc);

-- 12. Conversas reais paciente <-> médico
create table if not exists public.conversations (
  id bigint generated by default as identity primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (patient_id, doctor_id)
);

-- 13. Mensagens das conversas
create table if not exists public.messages (
  id bigint generated by default as identity primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at asc, id asc);

-- 14. Respostas de métricas de IHC (PANAS / SUS)
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  anonymous_code text not null,
  instrument text not null check (instrument in ('PANAS', 'SUS')),
  session_id text not null,
  moment text not null check (moment in ('before', 'after', 'final')),
  answers jsonb not null,
  score_positive integer,
  score_negative integer,
  score_total numeric,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists survey_responses_unique_session_moment_idx
  on public.survey_responses (user_id, instrument, session_id, moment);

create index if not exists survey_responses_instrument_created_idx
  on public.survey_responses (instrument, created_at desc);

-- 15. Bloqueio de usuários
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

-- 16. Denúncias de conteúdo ou usuário
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'message')),
  target_id text not null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

-- Trigger automático ao criar conta no Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  raw_role text := coalesce(meta ->> 'role', 'paciente');
  safe_role text := case when raw_role = 'medico' then 'medico' else 'paciente' end;
  safe_name text := coalesce(nullif(trim(meta ->> 'name'), ''), split_part(coalesce(new.email, 'usuario'), '@', 1));
  anon_code text := 'P-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  birth_val date := null;
  terms_val timestamptz := null;
  health_val timestamptz := null;
  truth_val timestamptz := null;
begin
  if coalesce(meta ->> 'birthDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    birth_val := (meta ->> 'birthDate')::date;
  end if;

  begin
    if coalesce(meta ->> 'acceptedTermsAt', '') != '' then
      terms_val := (meta ->> 'acceptedTermsAt')::timestamptz;
    end if;
  exception when others then
    terms_val := null;
  end;

  begin
    if coalesce(meta ->> 'acceptedHealthDataAt', '') != '' then
      health_val := (meta ->> 'acceptedHealthDataAt')::timestamptz;
    end if;
  exception when others then
    health_val := null;
  end;

  begin
    if coalesce(meta ->> 'acceptedTruthAt', '') != '' then
      truth_val := (meta ->> 'acceptedTruthAt')::timestamptz;
    end if;
  exception when others then
    truth_val := null;
  end;

  insert into public.profiles (
    id, email, name, role, birth_date, anonymous_code, accepted_terms_at, accepted_health_data_at
  )
  values (
    new.id,
    lower(trim(coalesce(new.email, ''))),
    safe_name,
    safe_role,
    birth_val,
    anon_code,
    terms_val,
    health_val
  )
  on conflict (id) do nothing;

  if safe_role = 'medico' then
    insert into public.professional_profiles (
      user_id, crm, crm_uf, specialty, status, accepted_truth_at
    )
    values (
      new.id,
      coalesce(nullif(trim(meta ->> 'crm'), ''), '000000'),
      coalesce(nullif(trim(meta ->> 'crmUf'), ''), 'SP'),
      coalesce(nullif(trim(meta ->> 'specialty'), ''), 'Outra'),
      'pendente',
      truth_val
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Grupos iniciais (sem dados fictícios de participantes ou mensagens)
insert into public.groups (id, name, description, theme, admin_id, is_temporary, duration_days, accent)
values
  ('grp-1', 'Respirar Antes de Reagir', 'Um espaço para trocar técnicas de respiração e regulação da ansiedade no dia a dia.', 'ansiedade', null, false, null, '#8b5cf6'),
  ('grp-2', 'Autoconhecimento em Prática', 'Reflexões guiadas e exercícios semanais para entender seus próprios padrões.', 'autoconhecimento', null, false, null, '#0f766e'),
  ('grp-3', 'Limites com Leveza', 'Comunicação não violenta e limites saudáveis nos relacionamentos.', 'relacionamentos', null, false, null, '#db2777'),
  ('grp-4', 'Noites Mais Leves', 'Rotinas de sono e higiene do descanso para quem sofre com insônia.', 'sono', null, false, null, '#f59e0b'),
  ('grp-5', 'Desafio 5 Dias Sem Ansiedade', 'Um programa curto e guiado com práticas diárias para reduzir picos de ansiedade.', 'ansiedade', null, true, 5, '#7c3aed'),
  ('grp-6', 'Desafio 21 Dias de Movimento', 'Programa de exercícios progressivos para criar o hábito de se movimentar.', 'exercicio', null, true, 21, '#2563eb'),
  ('grp-7', 'Reeducação Alimentar em 10 Dias', 'Pequenas mudanças diárias para uma relação mais saudável com a comida.', 'emagrecimento', null, true, 10, '#16a34a')
on conflict (id) do nothing;

-- Ativar Row Level Security em todas as tabelas (a API Bun usa service_role; bloqueia acesso direto anônimo)
alter table public.profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.mood_entries enable row level security;
alter table public.availability enable row level security;
alter table public.bookings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.survey_responses enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;

-- Política mínima de leitura do próprio perfil e próprias respostas (opcional, caso algum fluxo consulte)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "survey_select_own" on public.survey_responses;
create policy "survey_select_own" on public.survey_responses
  for select using (auth.uid() = user_id);
