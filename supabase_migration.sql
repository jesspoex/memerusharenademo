-- =============================================================================
-- MemeRush — Supabase Scheduler Migration
-- Jalankan di: Supabase Dashboard → SQL Editor
-- Urutan: jalankan semua sekaligus (satu kali)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enable pg_cron extension (aktifkan sekali di project Supabase kamu)
--    Supabase: Dashboard → Database → Extensions → cari "pg_cron" → Enable
--    Atau jalankan SQL ini (perlu superuser — biasanya sudah aktif di Supabase):
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- Aktifkan lewat Dashboard jika SQL di atas gagal permission.

-- ---------------------------------------------------------------------------
-- 1. Pastikan kolom yang dibutuhkan ada di mr_battles
-- ---------------------------------------------------------------------------
alter table mr_battles
  add column if not exists type        text    default 'user',
  add column if not exists meta        jsonb   default '{}',
  add column if not exists ended_at    timestamptz,
  add column if not exists total_deposited numeric default 0,
  add column if not exists fee_collected   numeric default 0;

-- ---------------------------------------------------------------------------
-- 2. Tabel lock anti-duplikasi scheduler
--    Mencegah dua job berjalan bersamaan
-- ---------------------------------------------------------------------------
create table if not exists mr_scheduler_lock (
  job_name   text        primary key,
  locked_at  timestamptz not null default now(),
  locked_by  text        not null default 'pg_cron',
  expires_at timestamptz not null
);

-- RLS: hanya service role yang bisa tulis
alter table mr_scheduler_lock enable row level security;
drop policy if exists "service_role_all" on mr_scheduler_lock;
create policy "service_role_all"
  on mr_scheduler_lock for all
  to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 3. Tabel log scheduler (opsional, untuk debug)
-- ---------------------------------------------------------------------------
create table if not exists mr_scheduler_log (
  id          bigserial   primary key,
  job_name    text        not null,
  ran_at      timestamptz not null default now(),
  result      jsonb       not null default '{}',
  duration_ms integer
);

alter table mr_scheduler_log enable row level security;
drop policy if exists "service_role_all" on mr_scheduler_log;
create policy "service_role_all"
  on mr_scheduler_log for all
  to service_role using (true) with check (true);

-- Bersihkan log lama otomatis (simpan 7 hari saja)
create or replace function mr_cleanup_scheduler_log()
returns void language plpgsql security definer as $$
begin
  delete from mr_scheduler_log where ran_at < now() - interval '7 days';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Function utama: ensure_minimum_battles
--    Dipanggil oleh pg_cron setiap 1 menit
--    Proteksi: advisory lock agar tidak race condition
-- ---------------------------------------------------------------------------
create or replace function mr_ensure_minimum_battles()
returns jsonb language plpgsql security definer as $$
declare
  v_live_count    integer := 0;
  v_needed        integer := 0;
  v_created       integer := 0;
  v_expired       integer := 0;
  v_lock_key      bigint  := 123456789; -- arbitrary advisory lock key
  v_start         timestamptz := clock_timestamp();
  v_now           timestamptz := clock_timestamp();
  v_result        jsonb;

  -- Token pairs yang aman (miror dari SAFE_TOKENS di TypeScript)
  v_tokens        text[] := ARRAY[
    'BONK','WIF','POPCAT','MYRO','SOL','BOME','PEPE','MRUSH'
  ];
  v_logos         jsonb := '{
    "BONK":   "https://assets.coingecko.com/coins/images/28600/large/bonk.jpg",
    "WIF":    "https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg",
    "POPCAT": "https://assets.coingecko.com/coins/images/33908/large/popcat.png",
    "MYRO":   "https://assets.coingecko.com/coins/images/33427/large/myro.png",
    "SOL":    "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    "BOME":   "https://assets.coingecko.com/coins/images/35215/large/bome.png",
    "PEPE":   "https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg",
    "MRUSH":  "https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c"
  }'::jsonb;

  -- Durasi battle sistem: 3–10 menit (dalam detik)
  v_durations     integer[] := ARRAY[180, 240, 300, 420, 600];

  -- Minimal 5 battle aktif setiap saat
  v_min_battles   integer := 5;

  v_token_a       text;
  v_token_b       text;
  v_duration      integer;
  v_amount        numeric;
  v_end_time      timestamptz;
  v_battle_id     text;
  v_idx_a         integer;
  v_idx_b         integer;
  v_used_pairs    text[] := ARRAY[]::text[];
  v_active_pairs  record;
  v_pair_key      text;
  v_attempts      integer;
  v_max_attempts  integer := 20;
begin
  -- ── Advisory lock: hanya 1 instance berjalan ─────────────────────────────
  -- pg_try_advisory_xact_lock: auto-release saat transaksi selesai
  if not pg_try_advisory_xact_lock(v_lock_key) then
    return jsonb_build_object(
      'skipped', true,
      'reason', 'another instance is running'
    );
  end if;

  -- ── 1. Cleanup expired system battles ────────────────────────────────────
  update mr_battles
  set    status   = 'paid',
         ended_at = v_now
  where  status = 'live'
    and  mode   = 'arena'
    and  end_time < v_now;

  get diagnostics v_expired = row_count;

  -- ── 2. Count truly active (live + not expired) battles ───────────────────
  select count(*) into v_live_count
  from   mr_battles
  where  status   = 'live'
    and  end_time > v_now;

  v_needed := greatest(0, v_min_battles - v_live_count);

  if v_needed = 0 then
    v_result := jsonb_build_object(
      'existing', v_live_count,
      'needed',   0,
      'created',  0,
      'expired',  v_expired,
      'skipped',  false
    );
    -- Log
    insert into mr_scheduler_log(job_name, result, duration_ms)
    values('ensure_battles', v_result,
           extract(epoch from (clock_timestamp() - v_start)) * 1000);
    return v_result;
  end if;

  -- ── 3. Kumpulkan pasangan token yang sedang aktif (hindari duplikat) ─────
  for v_active_pairs in
    select token_a, token_b from mr_battles
    where  status = 'live' and end_time > v_now
  loop
    v_used_pairs := array_append(
      v_used_pairs,
      v_active_pairs.token_a || '_' || v_active_pairs.token_b
    );
    v_used_pairs := array_append(
      v_used_pairs,
      v_active_pairs.token_b || '_' || v_active_pairs.token_a
    );
  end loop;

  -- ── 4. Buat battle sebanyak yang dibutuhkan ───────────────────────────────
  while v_created < v_needed loop
    -- Pilih pasangan acak yang belum dipakai
    v_token_a  := null;
    v_token_b  := null;
    v_attempts := 0;

    <<pair_search>>
    while v_attempts < v_max_attempts loop
      v_attempts := v_attempts + 1;
      v_idx_a    := 1 + floor(random() * array_length(v_tokens, 1))::integer;
      v_idx_b    := 1 + floor(random() * array_length(v_tokens, 1))::integer;

      if v_idx_a = v_idx_b then continue; end if;

      v_token_a := v_tokens[v_idx_a];
      v_token_b := v_tokens[v_idx_b];
      v_pair_key := v_token_a || '_' || v_token_b;

      if not (v_pair_key = any(v_used_pairs)) then
        exit pair_search;
      end if;

      v_token_a := null;
    end loop;

    -- Fallback jika semua pasangan terpakai (28 total — tidak mungkin dengan 5 battle)
    if v_token_a is null then
      v_idx_a   := 1 + floor(random() * 7)::integer;
      v_idx_b   := v_idx_a mod 8 + 1;
      v_token_a := v_tokens[v_idx_a];
      v_token_b := v_tokens[v_idx_b];
    end if;

    -- Durasi dan amount acak
    v_duration := v_durations[1 + floor(random() * array_length(v_durations, 1))::integer];
    v_end_time := v_now + (v_duration || ' seconds')::interval;
    v_amount   := round((0.001 + random() * 0.007)::numeric, 4);

    -- Battle ID unik
    v_battle_id := 'sys_' || extract(epoch from v_now)::bigint::text
                   || '_' || to_hex(floor(random() * 1e9)::bigint);

    -- Insert battle
    begin
      insert into mr_battles (
        id, creator, mode, type,
        token_a, token_b,
        amount, prize_pool, total_deposited, fee_collected,
        status, payment, players,
        start_time, end_time, created_at,
        meta
      ) values (
        v_battle_id,
        'system', 'arena', 'system',
        v_token_a, v_token_b,
        v_amount,
        round(v_amount * 0.98, 6),
        0, 0,
        'live', 'SOL',
        1 + floor(random() * 6)::integer,
        v_now, v_end_time, v_now,
        jsonb_build_object(
          'tokenA_logo', v_logos->v_token_a,
          'tokenB_logo', v_logos->v_token_b,
          'duration_s',  v_duration,
          'created_by',  'pg_cron'
        )
      );

      -- Tandai pasangan ini sudah dipakai
      v_used_pairs := array_append(v_used_pairs, v_token_a || '_' || v_token_b);
      v_used_pairs := array_append(v_used_pairs, v_token_b || '_' || v_token_a);
      v_created    := v_created + 1;

    exception when unique_violation then
      -- ID collision (sangat jarang) — skip, coba lagi
      null;
    end;
  end loop;

  -- ── 5. Kembalikan hasil ───────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'existing', v_live_count,
    'needed',   v_needed,
    'created',  v_created,
    'expired',  v_expired,
    'skipped',  false
  );

  insert into mr_scheduler_log(job_name, result, duration_ms)
  values('ensure_battles', v_result,
         extract(epoch from (clock_timestamp() - v_start)) * 1000);

  return v_result;

exception when others then
  -- Jangan crash pg_cron — return error sebagai JSON
  return jsonb_build_object(
    'error',   SQLERRM,
    'detail',  SQLSTATE,
    'created', v_created
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Function: resolve_expired_battles
--    Tutup battle system yang sudah expired, panggil ensure setelahnya
-- ---------------------------------------------------------------------------
create or replace function mr_resolve_expired_battles()
returns jsonb language plpgsql security definer as $$
declare
  v_start      timestamptz := clock_timestamp();
  v_now        timestamptz := clock_timestamp();
  v_closed     integer := 0;
  v_result     jsonb;
begin
  -- Tutup semua battle system/arena yang sudah expired
  update mr_battles
  set    status   = 'paid',
         ended_at = v_now
  where  status   = 'live'
    and  mode     = 'arena'
    and  end_time < v_now;

  get diagnostics v_closed = row_count;

  -- Real battles: hanya mark ended, payout tetap dari Next.js API
  -- (tidak aman jalankan payout on-chain dari pg_cron)
  update mr_battles
  set    status   = 'ended',
         ended_at = v_now
  where  status   = 'live'
    and  mode     = 'real'
    and  end_time < v_now;

  v_result := jsonb_build_object(
    'closed_arena', v_closed,
    'ts',           v_now
  );

  insert into mr_scheduler_log(job_name, result, duration_ms)
  values('resolve_expired', v_result,
         extract(epoch from (clock_timestamp() - v_start)) * 1000);

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Function wrapper: job utama yang dipanggil pg_cron
--    Resolve dulu → lalu ensure
-- ---------------------------------------------------------------------------
create or replace function mr_scheduler_tick()
returns void language plpgsql security definer as $$
declare
  v_resolve jsonb;
  v_ensure  jsonb;
begin
  v_resolve := mr_resolve_expired_battles();
  v_ensure  := mr_ensure_minimum_battles();

  -- Cleanup log lama (non-blocking)
  perform mr_cleanup_scheduler_log();
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Daftarkan pg_cron jobs
--    Pastikan pg_cron extension sudah aktif sebelum jalankan ini!
-- ---------------------------------------------------------------------------

-- Hapus job lama jika ada
select cron.unschedule(jobid)
from   cron.job
where  jobname in ('mr-battle-tick', 'mr-ensure-battles', 'mr-resolve-battles');

-- Job utama: setiap 1 menit
select cron.schedule(
  'mr-battle-tick',
  '* * * * *',
  $$ select mr_scheduler_tick(); $$
);

-- ---------------------------------------------------------------------------
-- 8. RLS policies untuk mr_battles (pastikan service role bisa insert)
-- ---------------------------------------------------------------------------
alter table mr_battles enable row level security;

-- Service role selalu bisa semua
drop policy if exists "service_role_full" on mr_battles;
create policy "service_role_full"
  on mr_battles for all
  to service_role
  using (true) with check (true);

-- Anon (frontend) hanya bisa SELECT battle yang live/ended/paid
drop policy if exists "anon_select_battles" on mr_battles;
create policy "anon_select_battles"
  on mr_battles for select
  to anon
  using (status in ('live', 'ended', 'paid'));

-- ---------------------------------------------------------------------------
-- 9. Index untuk performa query
-- ---------------------------------------------------------------------------
create index if not exists idx_mr_battles_status_end
  on mr_battles(status, end_time);

create index if not exists idx_mr_battles_mode_status
  on mr_battles(mode, status);

create index if not exists idx_mr_scheduler_log_ran
  on mr_scheduler_log(ran_at desc);

-- ---------------------------------------------------------------------------
-- 10. Verifikasi — jalankan ini untuk cek semua berhasil
-- ---------------------------------------------------------------------------
/*
-- Cek function ada:
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name like 'mr_%';

-- Test manual:
select mr_scheduler_tick();

-- Cek log:
select * from mr_scheduler_log order by ran_at desc limit 10;

-- Cek cron jobs terdaftar:
select jobid, jobname, schedule, command from cron.job where jobname like 'mr-%';

-- Cek battle aktif:
select id, token_a, token_b, status, end_time
from   mr_battles
where  status = 'live'
order  by end_time;
*/
