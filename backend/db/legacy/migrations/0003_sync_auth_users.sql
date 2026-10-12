-- auth.users içinde yeni bir kullanıcı oluşturulduğunda (Supabase Auth
-- üzerinden kayıt), bunu public.users tablosuna otomatik olarak
-- yansıtan trigger. Bu sayede public.users.id her zaman auth.users.id
-- ile eşleşir ve user_subscriptions/transactions gibi tablolardaki
-- foreign key'ler (users.id referansı) sorunsuz çalışır.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
