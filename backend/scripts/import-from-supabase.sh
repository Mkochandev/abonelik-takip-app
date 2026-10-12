#!/usr/bin/env bash
#
# Supabase verisini kendi Postgres'imize aktarır (sunucuda çalışır).
#
#   scripts/import-from-supabase.sh eriste_dev
#   scripts/import-from-supabase.sh eriste --yes      # canlı veritabanı
#
# Girdi dosyaları (ortam değişkeniyle değiştirilebilir):
#   DUMP_FILE  (varsayılan ~/goc/public.dump)    pg_dump custom format, public şeması
#   USERS_CSV  (varsayılan ~/goc/auth_users.csv) id,email,encrypted_password,email_confirmed_at,created_at
#
# Bağlantı: psql'in standart ortam değişkenleri (PGHOST, PGPORT, PGUSER,
# PGPASSWORD ya da ~/.pgpass). Varsayılan PGHOST=localhost, PGUSER=eriste_app.
#
# Önce `npm run migrate` ile şema kurulmuş olmalı. Script tekrar
# çalıştırılabilir: hedef tabloları boşaltıp yeniden doldurur. Her şey tek
# transaction'da; bir hata olursa hiçbir şey değişmez.
#
# Nasıl çalışır: dump'taki veri (pg_restore --data-only) geçici bir
# legacy_import şemasına, kolonları text olan ara tablolara yüklenir. Oradan
# gerçek tablolara, ortak kolonlar hedef tipe dönüştürülerek FK sırasıyla
# eklenir. Yeni şemada karşılığı olmayan tablo ve kolonlar atlanır ve
# raporlanır. Kullanıcılar CSV'den (auth.users) gelir; plan alanları dump'taki
# public.users satırından alınır.

set -euo pipefail

usage() {
  echo "Kullanım: $0 <veritabanı> [--yes]" >&2
  echo "  <veritabanı>: eriste_dev ya da eriste (canlı için --yes zorunlu)" >&2
  exit 2
}

TARGET_DB=""
CONFIRMED=0

for arg in "$@"; do
  case "$arg" in
    --yes) CONFIRMED=1 ;;
    -h|--help) usage ;;
    -*) echo "Bilinmeyen seçenek: $arg" >&2; usage ;;
    *)
      [[ -z "$TARGET_DB" ]] || usage
      TARGET_DB="$arg"
      ;;
  esac
done

[[ -n "$TARGET_DB" ]] || usage

if [[ "$TARGET_DB" == "eriste" && "$CONFIRMED" -ne 1 ]]; then
  echo "HATA: '$TARGET_DB' canlı veritabanı. Tablolar boşaltılıp yeniden doldurulacak." >&2
  echo "Eminsen --yes ile çalıştır." >&2
  exit 1
fi

DUMP_FILE="${DUMP_FILE:-$HOME/goc/public.dump}"
USERS_CSV="${USERS_CSV:-$HOME/goc/auth_users.csv}"
export PGHOST="${PGHOST:-localhost}"
export PGUSER="${PGUSER:-eriste_app}"
export PGDATABASE="$TARGET_DB"

for file in "$DUMP_FILE" "$USERS_CSV"; do
  if [[ ! -r "$file" ]]; then
    echo "HATA: dosya okunamıyor: $file" >&2
    exit 1
  fi
done

for tool in psql pg_restore perl; do
  command -v "$tool" >/dev/null || { echo "HATA: $tool bulunamadı" >&2; exit 1; }
done

PSQL=(psql -X -q -v ON_ERROR_STOP=1)

baseline=$("${PSQL[@]}" -At -c \
  "select count(*) from schema_migrations where name = '0001_baseline.sql'" 2>/dev/null || true)
if [[ "$baseline" != "1" ]]; then
  echo "HATA: '$TARGET_DB' üzerinde baseline migration yok. Önce: npm run migrate" >&2
  exit 1
fi

# CSV başlık satırı varsa atlanır.
CSV_HEADER=false
if head -n 1 "$USERS_CSV" | grep -qi '^"\{0,1\}id"\{0,1\},'; then
  CSV_HEADER=true
fi

WORK_DIR=$(mktemp -d)
chmod 700 "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT
SQL_FILE="$WORK_DIR/import.sql"

# 1) Dump verisi → legacy_import şemasındaki ara tablolar. Her COPY'den önce
#    aynı kolonlarla (hepsi text) ara tablo oluşturulur. setval satırları
#    atılır (sequence'ler en sonda hedef tablodaki en büyük id'ye göre
#    ayarlanır). COPY veri blokları olduğu gibi geçer.
{
  cat <<'SQL'
set client_min_messages = warning;
drop schema if exists legacy_import cascade;
create schema legacy_import;
SQL

  pg_restore --data-only --no-owner --no-privileges --schema=public -f - "$DUMP_FILE" |
    perl -ne '
      s/\r\n\z/\n/;
      if ($in_copy) { $in_copy = 0 if $_ eq "\\.\n"; print; next; }
      if (/^COPY public\.(\S+) \((.*)\) FROM stdin;$/) {
        my ($table, $columns) = ($1, $2);
        my $defs = join(", ", map { "$_ text" } split(/, /, $columns));
        print "CREATE TABLE legacy_import.$table ($defs);\n";
        print "COPY legacy_import.$table ($columns) FROM stdin;\n";
        $in_copy = 1;
        next;
      }
      next if /^SELECT pg_catalog\.setval/;
      # Çıktıya boş bir sonuç tablosu basmasın.
      s/^SELECT pg_catalog\.set_config\(.search_path., .., false\);$/SET search_path = \x27\x27;/;
      print;
    '

  # pg_restore çıktısı search_path'i boşaltır ve uyarı seviyesini yükseltir.
  cat <<SQL
set search_path = public;
set client_min_messages = notice;

-- 2) auth.users dökümü (CSV) -------------------------------------------------
create table legacy_import.auth_users (
  id text, email text, encrypted_password text, email_confirmed_at text, created_at text
);
\\copy legacy_import.auth_users from '$USERS_CSV' with (format csv, header $CSV_HEADER)
SQL

  cat <<'SQL'

do $$
begin
  if to_regclass('legacy_import.users') is null then
    raise exception 'Dump''ta public.users verisi yok';
  end if;
end $$;

-- 3) Hedef tabloları boşalt ----------------------------------------------------
-- Uygulamanın yönettiği katalog kayıtlarının (erişte Premium) logosu
-- migration'larla belirlenir (ör. 0002_eriste_logo); Supabase'deki eski
-- değer bunu ezmesin diye önce saklanır, aktarımdan sonra geri yazılır.
create temp table keep_managed_logos on commit drop as
  select managed_by, billing_cycle, logo_url
  from subscriptions_catalog where managed_by is not null;

-- users ve subscriptions_catalog'a bağlı her şey CASCADE ile boşalır
-- (oturum ve şifre sıfırlama token'ları dahil).
set client_min_messages = warning;
truncate users, subscriptions_catalog restart identity cascade;
set client_min_messages = notice;

-- 4) Kullanıcılar ------------------------------------------------------------
do $$
declare
  n bigint;
  list text;
begin
  select count(*), string_agg(id, ', ') into n, list
  from legacy_import.auth_users where coalesce(email, '') = '';
  if n > 0 then
    raise notice 'ATLANDI: e-postası olmayan % auth kullanıcısı: %', n, list;
  end if;

  select count(*), string_agg(u.id, ', ') into n, list
  from legacy_import.users u
  where not exists (select 1 from legacy_import.auth_users a where a.id = u.id);
  if n > 0 then
    raise notice 'UYARI: public.users''ta olup CSV''de olmayan % kullanıcı (verileri atlanacak): %', n, list;
  end if;
end $$;

insert into users
  (id, email, password_hash, email_verified_at, created_at, plan, premium_expires_at,
   eriste_dismissed)
select a.id::uuid,
       lower(trim(a.email)),
       coalesce(a.encrypted_password, ''),
       nullif(a.email_confirmed_at, '')::timestamptz,
       coalesce(nullif(a.created_at, '')::timestamptz, now()),
       coalesce(u.plan, 'free'),
       nullif(u.premium_expires_at, '')::timestamptz,
       coalesce(u.eriste_dismissed::boolean, false)
from legacy_import.auth_users a
left join legacy_import.users u on u.id = a.id
where coalesce(a.email, '') <> '';

do $$
declare
  n bigint;
  list text;
begin
  select count(*), string_agg(email, ', ') into n, list
  from users where password_hash !~ '^\$2[aby]\$';
  if n > 0 then
    raise notice 'UYARI: bcrypt şifresi olmayan % kullanıcı (şifre sıfırlamayla girebilir): %', n, list;
  end if;
end $$;

-- 5) Diğer tablolar (FK sırasıyla) ------------------------------------------
do $$
declare
  load_order text[] := array[
    'subscriptions_catalog', 'price_history', 'user_subscriptions', 'user_settings',
    'kivirik_answers', 'kivirik_dismissals', 'price_reports', 'transactions'
  ];
  t text;
  target regclass;
  insert_columns text;
  select_columns text;
  skipped_columns text;
  user_filter text;
  staged bigint;
  inserted bigint;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'legacy_import'
      and table_name not in ('users', 'auth_users')
      and table_name <> all (load_order)
    order by 1
  loop
    raise notice 'ATLANDI: % tablosunun yeni şemada karşılığı yok', t;
  end loop;

  foreach t in array load_order loop
    if to_regclass(format('legacy_import.%I', t)) is null then
      raise notice '%: dump''ta veri yok', t;
      continue;
    end if;

    target := format('public.%I', t)::regclass;

    -- Ortak kolonlar, hedef tipe dönüştürülerek.
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum),
           string_agg(format('s.%I::%s', a.attname, format_type(a.atttypid, a.atttypmod)), ', '
                      order by a.attnum)
      into insert_columns, select_columns
    from pg_attribute a
    where a.attrelid = target and a.attnum > 0 and not a.attisdropped
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'legacy_import' and c.table_name = t and c.column_name = a.attname
      );

    select string_agg(c.column_name, ', ' order by c.ordinal_position) into skipped_columns
    from information_schema.columns c
    where c.table_schema = 'legacy_import' and c.table_name = t
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid = target and a.attname = c.column_name and a.attnum > 0
          and not a.attisdropped
      );

    if skipped_columns is not null then
      raise notice '%: yeni şemada olmayan kolonlar atlandı: %', t, skipped_columns;
    end if;

    -- Kullanıcısı aktarılmamış satırlar FK'yi bozmasın.
    user_filter := '';
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'legacy_import' and table_name = t and column_name = 'user_id'
    ) then
      user_filter := 'where s.user_id::uuid in (select id from public.users)';
    end if;

    execute format('insert into public.%I (%s) select %s from legacy_import.%I s %s',
                   t, insert_columns, select_columns, t, user_filter);
    get diagnostics inserted = row_count;

    execute format('select count(*) from legacy_import.%I', t) into staged;
    if inserted <> staged then
      raise notice '%: % satırdan % aktarıldı (kullanıcısı olmayan satırlar atlandı)',
        t, staged, inserted;
    end if;
  end loop;
end $$;

do $$
declare
  n bigint;
begin
  update subscriptions_catalog sc
  set logo_url = k.logo_url
  from keep_managed_logos k
  where sc.managed_by = k.managed_by and sc.billing_cycle = k.billing_cycle
    and sc.logo_url is distinct from k.logo_url;
  get diagnostics n = row_count;
  if n > 0 then
    raise notice 'subscriptions_catalog: % yönetilen kaydın logo_url''i migration değeriyle korundu', n;
  end if;
end $$;

-- 6) Sequence'ler -------------------------------------------------------------
do $$
declare
  r record;
  max_id bigint;
begin
  for r in
    select c.relname as table_name, a.attname as column_name,
           pg_get_serial_sequence(format('public.%I', c.relname), a.attname) as seq
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and pg_get_serial_sequence(format('public.%I', c.relname), a.attname) is not null
  loop
    execute format('select max(%I) from public.%I', r.column_name, r.table_name) into max_id;
    perform setval(r.seq, coalesce(max_id, 0) + 1, false);
    raise notice 'sequence %: sonraki değer %', r.seq, coalesce(max_id, 0) + 1;
  end loop;
end $$;

-- 7) Satır sayıları -----------------------------------------------------------
-- supabase: dump'taki satır sayısı (users için CSV'deki auth kullanıcısı).
create temp table import_counts (tablo text, supabase bigint, yeni bigint) on commit drop;

do $$
declare
  t text;
  staged bigint;
  loaded bigint;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name <> 'schema_migrations'
    order by 1
  loop
    staged := null;
    if t = 'users' then
      select count(*) into staged from legacy_import.auth_users;
    elsif to_regclass(format('legacy_import.%I', t)) is not null then
      execute format('select count(*) from legacy_import.%I', t) into staged;
    end if;
    execute format('select count(*) from public.%I', t) into loaded;
    insert into import_counts values (t, staged, loaded);
  end loop;
end $$;

\echo
\echo 'Satır sayıları (supabase: dump / CSV, yeni: aktarılan):'
select tablo, supabase, yeni,
       case when supabase is distinct from yeni and supabase is not null then '<-- fark' else '' end as durum
from import_counts order by tablo;

set client_min_messages = warning;
drop schema legacy_import cascade;
SQL
} > "$SQL_FILE"

echo "Hedef: $TARGET_DB ($PGUSER@$PGHOST)"
echo "Dump:  $DUMP_FILE"
echo "CSV:   $USERS_CSV (başlık: $CSV_HEADER)"
echo

"${PSQL[@]}" --single-transaction -f "$SQL_FILE"

echo
echo "Aktarım tamamlandı."
