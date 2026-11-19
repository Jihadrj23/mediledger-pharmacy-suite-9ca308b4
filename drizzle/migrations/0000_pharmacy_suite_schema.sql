
create type public.app_role as enum ('admin', 'cashier');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  is_active boolean not null default true,
  max_discount_percent numeric(5,2) not null default 5 check (max_discount_percent between 0 and 100),
  can_collect_due boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
                 where ur.user_id = _user_id and ur.role = _role and p.is_active)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and is_active)
$$;

create or replace function public.setup_required()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.setup_required() to anon, authenticated;

create policy "Own profile or admin reads" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admin updates profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Own role or admin reads" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _role public.app_role;
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    _role := 'admin';
  elsif coalesce(new.raw_app_meta_data->>'created_by_admin', '') = 'true' then
    _role := coalesce(nullif(new.raw_app_meta_data->>'staff_role', ''), 'cashier')::public.app_role;
  else
    raise exception 'Public sign-up is disabled. Ask the pharmacy owner to create your account.';
  end if;
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email);
  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.pharmacy_settings (
  id int primary key default 1 check (id = 1),
  pharmacy_name text not null default 'My Pharmacy',
  logo_url text,
  address text default '',
  phone text default '',
  trade_info text default '',
  receipt_footer text default 'Thank you. Get well soon!',
  currency text not null default 'BDT',
  language text not null default 'en' check (language in ('en','bn')),
  vat_enabled boolean not null default false,
  vat_percent numeric(5,2) not null default 0,
  invoice_prefix text not null default 'INV-',
  max_cashier_discount_percent numeric(5,2) not null default 10,
  low_stock_threshold int not null default 20,
  expiry_alert_days int not null default 90,
  updated_at timestamptz not null default now()
);
grant select, update on public.pharmacy_settings to authenticated;
grant all on public.pharmacy_settings to service_role;
alter table public.pharmacy_settings enable row level security;
create policy "Staff read settings" on public.pharmacy_settings for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admin update settings" on public.pharmacy_settings for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.pharmacy_settings (pharmacy_name, address, phone) values ('Shastho Pharmacy', 'House 12, Road 5, Dhanmondi, Dhaka', '+880 1711-000000');

create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
create table public.manufacturers (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
create table public.dosage_forms (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
grant select, insert, update, delete on public.categories, public.manufacturers, public.dosage_forms to authenticated;
grant all on public.categories, public.manufacturers, public.dosage_forms to service_role;
alter table public.categories enable row level security;
alter table public.manufacturers enable row level security;
alter table public.dosage_forms enable row level security;
create policy "Staff read" on public.categories for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admin write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "Staff read" on public.manufacturers for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admin write" on public.manufacturers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "Staff read" on public.dosage_forms for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admin write" on public.dosage_forms for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  generic_name text not null default '',
  manufacturer_id uuid references public.manufacturers(id),
  category_id uuid references public.categories(id),
  dosage_form_id uuid references public.dosage_forms(id),
  strength text not null default '',
  barcode text unique,
  pack_size text default '',
  strips_per_box int not null default 1 check (strips_per_box >= 1),
  pieces_per_strip int not null default 1 check (pieces_per_strip >= 1),
  base_unit text not null default 'piece',
  is_divisible boolean not null default true,
  mrp numeric(12,2) not null default 0 check (mrp >= 0),
  price_box numeric(12,2) not null default 0 check (price_box >= 0),
  price_strip numeric(12,2) not null default 0 check (price_strip >= 0),
  price_piece numeric(12,2) not null default 0 check (price_piece >= 0),
  reorder_level int not null default 20 check (reorder_level >= 0),
  status text not null default 'active' check (status in ('active','inactive')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index medicines_dup_idx on public.medicines (lower(brand_name), lower(strength), coalesce(dosage_form_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(manufacturer_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index medicines_brand_idx on public.medicines (lower(brand_name));
create index medicines_generic_idx on public.medicines (lower(generic_name));
grant select, insert, update on public.medicines to authenticated;
grant all on public.medicines to service_role;
alter table public.medicines enable row level security;
create policy "Staff read medicines" on public.medicines for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admin insert medicines" on public.medicines for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "Admin update medicines" on public.medicines for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, address text,
  opening_balance numeric(14,2) not null default 0,
  current_payable numeric(14,2) not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "Admin manage suppliers" on public.suppliers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, address text,
  opening_balance numeric(14,2) not null default 0,
  current_due numeric(14,2) not null default 0,
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index customers_phone_idx on public.customers (phone) where phone is not null and phone <> '';
grant select, insert, update on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "Staff read customers" on public.customers for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff register customers" on public.customers for insert to authenticated
  with check (public.is_staff(auth.uid()) and (public.has_role(auth.uid(),'admin') or (current_due = 0 and opening_balance = 0)));
create policy "Admin update customers" on public.customers for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.medicine_batches (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id),
  supplier_id uuid references public.suppliers(id),
  batch_number text not null,
  purchase_price numeric(12,4) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12,4) not null default 0,
  mrp numeric(12,4) not null default 0,
  original_qty int not null check (original_qty >= 0),
  remaining_qty int not null check (remaining_qty >= 0),
  mfg_date date,
  expiry_date date not null,
  purchase_ref text,
  is_damaged boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (medicine_id, batch_number)
);
create index batches_med_exp_idx on public.medicine_batches (medicine_id, expiry_date);
grant select, insert, update on public.medicine_batches to authenticated;
grant all on public.medicine_batches to service_role;
alter table public.medicine_batches enable row level security;
create policy "Admin manage batches" on public.medicine_batches for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id),
  batch_id uuid references public.medicine_batches(id),
  direction text not null check (direction in ('in','out')),
  qty_base int not null check (qty_base > 0),
  reason text not null,
  reference text,
  note text,
  created_by uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index stock_mov_med_idx on public.stock_movements (medicine_id, created_at desc);
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "Admin read movements" on public.stock_movements for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_logs (created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "Admin read audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.log_activity(_action text, _entity text default null, _entity_id text default null, _details jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not allowed'; end if;
  insert into public.audit_logs (user_id, action, entity, entity_id, details) values (auth.uid(), _action, _entity, _entity_id, coalesce(_details,'{}'));
end $$;
revoke execute on function public.log_activity(text,text,text,jsonb) from anon, public;
grant execute on function public.log_activity(text,text,text,jsonb) to authenticated;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, to_jsonb(new)->>'id', jsonb_build_object('new', to_jsonb(new)));
  return new;
end $$;
create trigger audit_medicines after insert or update on public.medicines for each row execute function public.audit_row_change();
create trigger audit_settings after update on public.pharmacy_settings for each row execute function public.audit_row_change();
create trigger audit_profiles after update on public.profiles for each row execute function public.audit_row_change();

create or replace function public.get_stock_overview()
returns table (medicine_id uuid, total_qty bigint, sellable_qty bigint, nearest_expiry date, expired_qty bigint)
language sql stable security definer set search_path = public as $$
  select m.id,
    coalesce(sum(b.remaining_qty),0)::bigint,
    coalesce(sum(b.remaining_qty) filter (where b.expiry_date > (now() at time zone 'Asia/Dhaka')::date and not b.is_damaged),0)::bigint,
    min(b.expiry_date) filter (where b.remaining_qty > 0 and b.expiry_date > (now() at time zone 'Asia/Dhaka')::date),
    coalesce(sum(b.remaining_qty) filter (where b.expiry_date <= (now() at time zone 'Asia/Dhaka')::date),0)::bigint
  from public.medicines m left join public.medicine_batches b on b.medicine_id = m.id
  where public.is_staff(auth.uid())
  group by m.id
$$;
revoke execute on function public.get_stock_overview() from anon, public;
grant execute on function public.get_stock_overview() to authenticated;

create or replace function public.admin_inventory_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _today date := (now() at time zone 'Asia/Dhaka')::date; r jsonb;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admin only'; end if;
  with s as (select * from public.get_stock_overview())
  select jsonb_build_object(
    'purchase_value', (select coalesce(sum(remaining_qty * purchase_price),0) from medicine_batches where expiry_date > _today and not is_damaged),
    'mrp_value', (select coalesce(sum(remaining_qty * mrp),0) from medicine_batches where expiry_date > _today and not is_damaged),
    'customer_due', (select coalesce(sum(current_due),0) from customers),
    'supplier_payable', (select coalesce(sum(current_payable),0) from suppliers),
    'medicine_count', (select count(*) from medicines where status='active'),
    'out_of_stock', (select count(*) from s join medicines m on m.id=s.medicine_id where m.status='active' and s.sellable_qty = 0),
    'low_stock', (select count(*) from s join medicines m on m.id=s.medicine_id where m.status='active' and s.sellable_qty > 0 and s.sellable_qty <= m.reorder_level),
    'exp_30', (select count(*) from medicine_batches where remaining_qty>0 and expiry_date > _today and expiry_date <= _today + 30),
    'exp_60', (select count(*) from medicine_batches where remaining_qty>0 and expiry_date > _today + 30 and expiry_date <= _today + 60),
    'exp_90', (select count(*) from medicine_batches where remaining_qty>0 and expiry_date > _today + 60 and expiry_date <= _today + 90),
    'expired', (select count(*) from medicine_batches where remaining_qty>0 and expiry_date <= _today)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_inventory_summary() from anon, public;
grant execute on function public.admin_inventory_summary() to authenticated;

create or replace function public.clear_demo_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admin only'; end if;
  delete from stock_movements where is_demo;
  delete from medicine_batches where is_demo;
  delete from medicines where is_demo and not exists (select 1 from medicine_batches b where b.medicine_id = medicines.id) and not exists (select 1 from stock_movements s where s.medicine_id = medicines.id);
  delete from customers where is_demo;
  delete from suppliers where is_demo and not exists (select 1 from medicine_batches b where b.supplier_id = suppliers.id);
  insert into audit_logs (user_id, action, entity) values (auth.uid(), 'clear_demo_data', 'system');
end $$;
revoke execute on function public.clear_demo_data() from anon, public;
grant execute on function public.clear_demo_data() to authenticated;

insert into public.categories (name) values ('Analgesic'),('Antibiotic'),('Antacid / GI'),('Antihistamine'),('Antidiabetic'),('Cardiovascular'),('Vitamin & Supplement'),('Respiratory'),('Dermatology'),('Ophthalmic'),('Other');
insert into public.manufacturers (name) values ('Square Pharmaceuticals'),('Beximco Pharma'),('Incepta Pharmaceuticals'),('ACI Limited'),('Renata Limited'),('Eskayef (SK+F)'),('Opsonin Pharma'),('Healthcare Pharmaceuticals'),('Drug International'),('Aristopharma'),('Acme'),('Radiant'),('Sanofi'),('SMC'),('Jayson'),('GSK');
insert into public.dosage_forms (name) values ('Tablet'),('Capsule'),('Syrup'),('Suspension'),('Injection'),('Drops'),('Cream'),('Ointment'),('Gel'),('Inhaler'),('Spray'),('Other');

with src(brand, generic, mfr, cat, form, strength, spb, pps, pp, reorder, barcode) as (values
 ('Napa','Paracetamol','Beximco Pharma','Analgesic','Tablet','500 mg',10,10,1.20,200,'8941100500011'),
 ('Napa Extra','Paracetamol + Caffeine','Beximco Pharma','Analgesic','Tablet','500/65 mg',10,10,2.50,150,'8941100500028'),
 ('Ace','Paracetamol','Square Pharmaceuticals','Analgesic','Tablet','500 mg',10,10,1.20,200,'8941100500035'),
 ('Ace Plus','Paracetamol + Caffeine','Square Pharmaceuticals','Analgesic','Tablet','500/65 mg',10,10,2.50,150,'8941100500042'),
 ('Fast','Paracetamol','Acme','Analgesic','Tablet','500 mg',10,10,1.00,100,'8941100500059'),
 ('Tufnil','Tolfenamic Acid','Eskayef (SK+F)','Analgesic','Tablet','200 mg',5,10,10.00,50,'8941100500066'),
 ('Rolac','Ketorolac','Renata Limited','Analgesic','Tablet','10 mg',5,10,12.00,50,'8941100500073'),
 ('Naprosyn','Naproxen','Radiant','Analgesic','Tablet','500 mg',5,10,9.00,50,'8941100500080'),
 ('Seclo','Omeprazole','Square Pharmaceuticals','Antacid / GI','Capsule','20 mg',6,10,6.00,150,'8941100500097'),
 ('Losectil','Omeprazole','Eskayef (SK+F)','Antacid / GI','Capsule','20 mg',6,10,5.50,100,'8941100500103'),
 ('Sergel','Esomeprazole','Healthcare Pharmaceuticals','Antacid / GI','Capsule','20 mg',6,10,7.00,100,'8941100500110'),
 ('Nexum','Esomeprazole','Square Pharmaceuticals','Antacid / GI','Tablet','20 mg',6,10,7.00,100,'8941100500127'),
 ('Pantonix','Pantoprazole','Incepta Pharmaceuticals','Antacid / GI','Tablet','20 mg',6,10,5.00,100,'8941100500134'),
 ('Antacid Plus','Aluminium + Magnesium','Opsonin Pharma','Antacid / GI','Suspension','200 ml',1,1,85.00,10,'8941100500141'),
 ('Flagyl','Metronidazole','Sanofi','Antacid / GI','Tablet','400 mg',10,10,1.80,100,'8941100500158'),
 ('Motigut','Domperidone','Incepta Pharmaceuticals','Antacid / GI','Tablet','10 mg',10,10,3.00,80,'8941100500165'),
 ('Emistat','Ondansetron','Incepta Pharmaceuticals','Antacid / GI','Tablet','8 mg',5,10,10.00,40,'8941100500172'),
 ('Orsaline-N','Oral Rehydration Salt','SMC','Antacid / GI','Other','Sachet',20,1,6.00,100,'8941100500189'),
 ('Azithrocin','Azithromycin','Beximco Pharma','Antibiotic','Tablet','500 mg',2,6,35.00,30,'8941100500196'),
 ('Zimax','Azithromycin','Square Pharmaceuticals','Antibiotic','Tablet','500 mg',2,6,40.00,30,'8941100500202'),
 ('Ciprocin','Ciprofloxacin','Square Pharmaceuticals','Antibiotic','Tablet','500 mg',5,10,15.00,50,'8941100500219'),
 ('Fimoxyl','Amoxicillin','Healthcare Pharmaceuticals','Antibiotic','Capsule','500 mg',5,10,8.00,50,'8941100500226'),
 ('Moxacil','Amoxicillin','Square Pharmaceuticals','Antibiotic','Capsule','500 mg',5,10,8.50,50,'8941100500233'),
 ('Cef-3','Cefixime','Square Pharmaceuticals','Antibiotic','Capsule','200 mg',2,6,35.00,30,'8941100500240'),
 ('Sefur','Cefuroxime','Incepta Pharmaceuticals','Antibiotic','Tablet','500 mg',2,7,50.00,30,'8941100500257'),
 ('Ceftron','Ceftriaxone','Square Pharmaceuticals','Antibiotic','Injection','1 g',1,1,200.00,10,'8941100500264'),
 ('Fexo','Fexofenadine','Square Pharmaceuticals','Antihistamine','Tablet','120 mg',5,10,8.00,80,'8941100500271'),
 ('Alatrol','Cetirizine','Square Pharmaceuticals','Antihistamine','Tablet','10 mg',10,10,3.00,100,'8941100500288'),
 ('Deslor','Desloratadine','Eskayef (SK+F)','Antihistamine','Tablet','5 mg',5,10,5.00,60,'8941100500295'),
 ('Histacin','Chlorpheniramine','Jayson','Antihistamine','Tablet','4 mg',10,10,0.50,100,'8941100500301'),
 ('Monas','Montelukast','ACI Limited','Respiratory','Tablet','10 mg',3,10,16.00,60,'8941100500318'),
 ('Montene','Montelukast','Square Pharmaceuticals','Respiratory','Tablet','10 mg',3,10,16.00,60,'8941100500325'),
 ('Azmasol','Salbutamol','Beximco Pharma','Respiratory','Inhaler','100 mcg',1,1,250.00,10,'8941100500332'),
 ('Tusca','Dextromethorphan','Square Pharmaceuticals','Respiratory','Syrup','100 ml',1,1,70.00,15,'8941100500349'),
 ('Brodil','Salbutamol','ACI Limited','Respiratory','Syrup','100 ml',1,1,40.00,15,'8941100500356'),
 ('Comet','Metformin','Square Pharmaceuticals','Antidiabetic','Tablet','500 mg',10,10,4.00,150,'8941100500363'),
 ('Secrin','Glimepiride','Healthcare Pharmaceuticals','Antidiabetic','Tablet','2 mg',5,10,10.00,60,'8941100500370'),
 ('Linita','Linagliptin','Incepta Pharmaceuticals','Antidiabetic','Tablet','5 mg',3,10,35.00,40,'8941100500387'),
 ('Insulet R','Human Insulin','Incepta Pharmaceuticals','Antidiabetic','Injection','100 IU/ml',1,1,450.00,5,'8941100500394'),
 ('Osartil','Losartan','Incepta Pharmaceuticals','Cardiovascular','Tablet','50 mg',3,10,8.00,80,'8941100500400'),
 ('Amdocal','Amlodipine','Beximco Pharma','Cardiovascular','Tablet','5 mg',3,10,5.00,80,'8941100500417'),
 ('Bisocor','Bisoprolol','Incepta Pharmaceuticals','Cardiovascular','Tablet','5 mg',3,10,7.00,60,'8941100500424'),
 ('Ecosprin','Aspirin','ACI Limited','Cardiovascular','Tablet','75 mg',10,10,0.80,100,'8941100500431'),
 ('Rosuva','Rosuvastatin','Square Pharmaceuticals','Cardiovascular','Tablet','10 mg',3,10,20.00,60,'8941100500448'),
 ('Ceevit','Vitamin C','Square Pharmaceuticals','Vitamin & Supplement','Tablet','250 mg',10,10,1.50,100,'8941100500455'),
 ('Calbo-D','Calcium + Vitamin D3','Square Pharmaceuticals','Vitamin & Supplement','Tablet','500 mg',3,10,10.00,80,'8941100500462'),
 ('Neuro-B','Vitamin B1, B6, B12','Square Pharmaceuticals','Vitamin & Supplement','Tablet','Combination',5,10,9.00,60,'8941100500479'),
 ('Zinc B','Zinc Sulphate','Drug International','Vitamin & Supplement','Syrup','100 ml',1,1,45.00,15,'8941100500486'),
 ('Ferocal','Iron + Folic Acid','Opsonin Pharma','Vitamin & Supplement','Capsule','Combination',3,10,4.00,60,'8941100500493'),
 ('Betnovate','Betamethasone','GSK','Dermatology','Cream','0.1%',1,1,90.00,10,'8941100500509'),
 ('Fungidal','Clotrimazole','ACI Limited','Dermatology','Cream','1%',1,1,60.00,10,'8941100500516'),
 ('Bactroban','Mupirocin','GSK','Dermatology','Ointment','2%',1,1,220.00,8,'8941100500523'),
 ('Diclofen Gel','Diclofenac','Aristopharma','Analgesic','Gel','1%',1,1,80.00,10,'8941100500530'),
 ('Optimox','Moxifloxacin','Aristopharma','Ophthalmic','Drops','0.5%',1,1,150.00,8,'8941100500547'),
 ('Nasomist','Fluticasone','Square Pharmaceuticals','Respiratory','Spray','50 mcg',1,1,350.00,5,'8941100500554'),
 ('Tears Naturale','Hypromellose','Aristopharma','Ophthalmic','Drops','0.3%',1,1,120.00,8,'8941100500561')
)
insert into public.medicines (brand_name, generic_name, manufacturer_id, category_id, dosage_form_id, strength, barcode, pack_size,
  strips_per_box, pieces_per_strip, is_divisible, price_piece, price_strip, price_box, mrp, reorder_level, is_demo)
select s.brand, s.generic,
  (select id from public.manufacturers where name = s.mfr),
  (select id from public.categories where name = s.cat),
  (select id from public.dosage_forms where name = s.form),
  s.strength, s.barcode,
  case when s.spb*s.pps = 1 then '1 unit' else s.spb || ' x ' || s.pps end,
  s.spb, s.pps, (s.spb*s.pps > 1),
  s.pp, s.pp*s.pps, s.pp*s.pps*s.spb, s.pp*s.pps*s.spb, s.reorder, true
from src s;

with m as (select id, price_piece, strips_per_box*pieces_per_strip as box_qty, reorder_level, (row_number() over (order by brand_name))::int as n from public.medicines where is_demo)
insert into public.medicine_batches (medicine_id, batch_number, purchase_price, selling_price, mrp, original_qty, remaining_qty, mfg_date, expiry_date, purchase_ref, is_demo)
select id, 'B' || lpad(n::text,3,'0') || '-A', round(price_piece*0.78,4), price_piece, price_piece,
  box_qty*10,
  case when n % 11 = 0 then 0 when n % 6 = 0 then greatest(reorder_level/2,1) else box_qty*(4 + n % 5) end,
  current_date - 300,
  case when n % 13 = 0 then current_date - 10
       when n % 7 = 0 then current_date + 20
       when n % 5 = 0 then current_date + 50
       when n % 4 = 0 then current_date + 80
       else current_date + 200 + n*3 end,
  'OPENING', true from m
union all
select id, 'B' || lpad(n::text,3,'0') || '-B', round(price_piece*0.82,4), price_piece, price_piece,
  box_qty*5,
  case when n % 11 = 0 or n % 6 = 0 then 0 else box_qty*(2 + n % 3) end,
  current_date - 60, current_date + 500 + n*2, 'OPENING', true from m;

insert into public.stock_movements (medicine_id, batch_id, direction, qty_base, reason, reference, note, is_demo)
select medicine_id, id, 'in', original_qty, 'opening_stock', 'OPENING', 'Demo opening stock', true from public.medicine_batches where is_demo;
insert into public.stock_movements (medicine_id, batch_id, direction, qty_base, reason, reference, note, is_demo)
select medicine_id, id, 'out', original_qty - remaining_qty, 'sale', 'DEMO', 'Demo historical sales', true from public.medicine_batches where is_demo and original_qty > remaining_qty;

insert into public.suppliers (name, phone, address, opening_balance, current_payable, is_demo) values
 ('Square Distribution Point','01711-111111','Tejgaon, Dhaka',0,18500,true),
 ('Beximco Depot Dhanmondi','01711-222222','Dhanmondi, Dhaka',0,12250,true),
 ('Incepta Sales Center','01711-333333','Savar, Dhaka',5000,9800,true),
 ('ACI Pharma Agent','01711-444444','Mirpur, Dhaka',0,0,true),
 ('Renata Depot','01711-555555','Mohammadpur, Dhaka',0,4300,true);
insert into public.customers (name, phone, address, opening_balance, current_due, is_demo) values
 ('Abdul Karim','01811-100001','Dhanmondi 15',0,850,true),
 ('Rahima Begum','01811-100002','Jigatola',0,1240,true),
 ('Md. Hasan Ali','01811-100003','Kalabagan',500,500,true),
 ('Shahana Akter','01811-100004','Lalmatia',0,0,true),
 ('Jamal Uddin','01811-100005','Shankar',0,2310,true),
 ('Nasrin Sultana','01811-100006','Rayer Bazar',0,0,true);
