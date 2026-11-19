-- 1. Open sign-up: owner first, invited staff as invited, everyone else becomes an inactive cashier awaiting approval
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _role public.app_role; _active boolean := true; _invite public.staff_invites%rowtype;
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    _role := 'admin';
  else
    select * into _invite from public.staff_invites where email = lower(new.email);
    if found then
      _role := _invite.role;
      delete from public.staff_invites where email = _invite.email;
    else
      _role := 'cashier';
      _active := false;
    end if;
  end if;
  insert into public.profiles (id, full_name, email, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email, _active);
  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end $$;

create or replace function public.unit_factor(_unit text, _spb int, _pps int)
returns int language sql immutable set search_path = public as $$
  select case _unit when 'box' then _spb * _pps when 'strip' then _pps when 'piece' then 1 end
$$;
grant execute on function public.unit_factor(text,int,int) to authenticated;

create sequence public.invoice_seq start 1001;

-- 2. Sales
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  customer_id uuid references public.customers(id),
  cashier_id uuid,
  cashier_name text not null default '',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  due numeric(14,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash','bkash','nagad','card')),
  cost_total numeric(14,2) not null default 0,
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index sales_created_idx on public.sales (created_at desc);
create index sales_cashier_idx on public.sales (cashier_id, created_at desc);
create index sales_customer_idx on public.sales (customer_id);
grant select (id, invoice_no, customer_id, cashier_id, cashier_name, subtotal, discount, vat, total, paid, due, payment_method, note, is_demo, created_at) on public.sales to authenticated;
grant all on public.sales to service_role;
alter table public.sales enable row level security;
create policy "Own or admin reads sales" on public.sales for select to authenticated
  using (public.has_role(auth.uid(),'admin') or (cashier_id = auth.uid() and public.is_staff(auth.uid())));

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  unit text not null check (unit in ('box','strip','piece')),
  qty int not null check (qty > 0),
  qty_base int not null check (qty_base > 0),
  unit_price numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  cost_amount numeric(14,4) not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_med_idx on public.sale_items (medicine_id);
grant select (id, sale_id, medicine_id, unit, qty, qty_base, unit_price, discount, line_total, is_demo, created_at) on public.sale_items to authenticated;
grant all on public.sale_items to service_role;
alter table public.sale_items enable row level security;
create policy "Read items of visible sales" on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and (public.has_role(auth.uid(),'admin') or (s.cashier_id = auth.uid() and public.is_staff(auth.uid())))));

-- 3. Customer due ledger
create table public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  kind text not null check (kind in ('opening','sale_due','payment','adjustment')),
  amount numeric(14,2) not null,
  sale_id uuid references public.sales(id),
  method text,
  note text,
  created_by uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index customer_ledger_cust_idx on public.customer_ledger (customer_id, created_at desc);
grant select on public.customer_ledger to authenticated;
grant all on public.customer_ledger to service_role;
alter table public.customer_ledger enable row level security;
create policy "Staff read ledger" on public.customer_ledger for select to authenticated using (public.is_staff(auth.uid()));

-- 4. Expenses (admin only)
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default ((now() at time zone 'Asia/Dhaka')::date),
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  created_by uuid default auth.uid(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (expense_date desc);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "Admin manage expenses" on public.expenses for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger audit_expenses after insert or update on public.expenses for each row execute function public.audit_row_change();

-- 5. Stock In (staff + admin): only ever adds quantity
create or replace function public.stock_in(_medicine_id uuid, _batch_number text, _expiry_date date, _unit text, _qty int, _purchase_price numeric, _mrp numeric, _mfg_date date default null, _note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _m public.medicines%rowtype; _f int; _base int; _b public.medicine_batches%rowtype;
  _bn text := upper(trim(coalesce(_batch_number,''))); _today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not allowed'; end if;
  select * into _m from public.medicines where id = _medicine_id;
  if not found then raise exception 'Medicine not found'; end if;
  if _qty is null or _qty <= 0 then raise exception 'Quantity must be more than zero'; end if;
  if _bn = '' then raise exception 'Enter the batch number'; end if;
  if _expiry_date is null or _expiry_date <= _today then raise exception 'Expiry date must be in the future'; end if;
  if _purchase_price is null or _purchase_price < 0 or _mrp is null or _mrp < 0 then raise exception 'Enter purchase price and MRP'; end if;
  _f := public.unit_factor(_unit, _m.strips_per_box, _m.pieces_per_strip);
  if _f is null then raise exception 'Choose box, strip or piece'; end if;
  _base := _qty * _f;
  select * into _b from public.medicine_batches where medicine_id = _medicine_id and upper(batch_number) = _bn for update;
  if found then
    if _b.expiry_date <> _expiry_date then
      raise exception 'Batch % is already recorded with expiry %. Check the batch number or expiry date.', _bn, to_char(_b.expiry_date, 'DD-MM-YYYY');
    end if;
    update public.medicine_batches set original_qty = original_qty + _base, remaining_qty = remaining_qty + _base where id = _b.id;
  else
    insert into public.medicine_batches (medicine_id, batch_number, purchase_price, selling_price, mrp, original_qty, remaining_qty, mfg_date, expiry_date, purchase_ref)
    values (_medicine_id, _bn, round(_purchase_price / _f, 4), _m.price_piece, round(_mrp / _f, 4), _base, _base, _mfg_date, _expiry_date, 'STOCK-IN')
    returning * into _b;
  end if;
  insert into public.stock_movements (medicine_id, batch_id, direction, qty_base, reason, reference, note, created_by)
  values (_medicine_id, _b.id, 'in', _base, 'stock_in', _bn, nullif(trim(coalesce(_note,'')),''), auth.uid());
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'stock_in', 'medicine_batches', _b.id::text, jsonb_build_object('medicine', _m.brand_name, 'batch', _bn, 'unit', _unit, 'qty', _qty, 'qty_base', _base));
  return _b.id;
end $$;
revoke execute on function public.stock_in(uuid,text,date,text,int,numeric,numeric,date,text) from anon, public;
grant execute on function public.stock_in(uuid,text,date,text,int,numeric,numeric,date,text) to authenticated;

-- 6. Create sale (staff + admin), FEFO batch allocation, due to customer ledger
create or replace function public.create_sale(_items jsonb, _customer_id uuid default null, _bill_discount numeric default 0, _paid numeric default 0, _payment_method text default 'cash', _note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid(); _is_admin boolean; _max_disc numeric; _cashier text; _s public.pharmacy_settings%rowtype;
  _today date := (now() at time zone 'Asia/Dhaka')::date;
  _it jsonb; _m public.medicines%rowtype; _f int; _qty int; _price numeric; _gross numeric; _ldisc numeric;
  _subtotal numeric := 0; _line_disc numeric := 0; _disc numeric; _vat numeric := 0; _total numeric; _paid_amt numeric; _due numeric;
  _sale_id uuid := gen_random_uuid(); _inv text; _cost numeric := 0; _need int; _take int; _b record; _lines jsonb := '[]'::jsonb; _line jsonb; _line_cost numeric;
begin
  if not public.is_staff(_uid) then raise exception 'Not allowed'; end if;
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then raise exception 'Add at least one medicine'; end if;
  if coalesce(_payment_method,'') not in ('cash','bkash','nagad','card') then raise exception 'Choose a payment method'; end if;
  _is_admin := public.has_role(_uid, 'admin');
  select max_discount_percent, full_name into _max_disc, _cashier from public.profiles where id = _uid;
  select * into _s from public.pharmacy_settings where id = 1;

  for _it in select value from jsonb_array_elements(_items) loop
    select * into _m from public.medicines where id = (_it->>'medicine_id')::uuid and status = 'active';
    if not found then raise exception 'Medicine not available'; end if;
    _qty := (_it->>'qty')::int;
    if _qty is null or _qty <= 0 then raise exception 'Quantity for % must be more than zero', _m.brand_name; end if;
    if not _m.is_divisible and _it->>'unit' <> 'box' then raise exception '% is sold as a whole unit only', _m.brand_name; end if;
    _f := public.unit_factor(_it->>'unit', _m.strips_per_box, _m.pieces_per_strip);
    if _f is null then raise exception 'Choose box, strip or piece for %', _m.brand_name; end if;
    _price := case _it->>'unit' when 'box' then _m.price_box when 'strip' then _m.price_strip else _m.price_piece end;
    _gross := round(_price * _qty, 2);
    _ldisc := round(_gross * least(greatest(coalesce((_it->>'discount_percent')::numeric, 0), 0), 100) / 100, 2);
    _subtotal := _subtotal + _gross;
    _line_disc := _line_disc + _ldisc;
    _lines := _lines || jsonb_build_array(jsonb_build_object('medicine_id', _m.id, 'name', _m.brand_name, 'unit', _it->>'unit', 'qty', _qty, 'base', _qty * _f, 'price', _price, 'gross', _gross, 'disc', _ldisc));
  end loop;

  _disc := _line_disc + round(greatest(coalesce(_bill_discount, 0), 0), 2);
  if _disc > _subtotal then raise exception 'Discount cannot be more than the bill'; end if;
  if not _is_admin and _disc > round(_subtotal * coalesce(_max_disc, 0) / 100, 2) then
    raise exception 'Discount is above your limit (% percent of the bill)', coalesce(_max_disc, 0);
  end if;
  if _s.vat_enabled then _vat := round((_subtotal - _disc) * _s.vat_percent / 100, 2); end if;
  _total := _subtotal - _disc + _vat;
  _paid_amt := least(greatest(round(coalesce(_paid, 0), 2), 0), _total);
  _due := _total - _paid_amt;
  if _due > 0 and _customer_id is null then raise exception 'Select a customer to record the unpaid amount as due'; end if;
  if _customer_id is not null and not exists (select 1 from public.customers where id = _customer_id) then raise exception 'Customer not found'; end if;

  _inv := coalesce(nullif(_s.invoice_prefix, ''), 'INV-') || nextval('public.invoice_seq');
  insert into public.sales (id, invoice_no, customer_id, cashier_id, cashier_name, subtotal, discount, vat, total, paid, due, payment_method, note)
  values (_sale_id, _inv, _customer_id, _uid, coalesce(_cashier, ''), _subtotal, _disc, _vat, _total, _paid_amt, _due, _payment_method, nullif(trim(coalesce(_note, '')), ''));

  for _line in select value from jsonb_array_elements(_lines) loop
    _need := (_line->>'base')::int;
    _line_cost := 0;
    for _b in
      select id, remaining_qty, purchase_price from public.medicine_batches
      where medicine_id = (_line->>'medicine_id')::uuid and remaining_qty > 0 and not is_damaged and expiry_date > _today
      order by expiry_date, created_at for update
    loop
      exit when _need <= 0;
      _take := least(_need, _b.remaining_qty);
      update public.medicine_batches set remaining_qty = remaining_qty - _take where id = _b.id;
      insert into public.stock_movements (medicine_id, batch_id, direction, qty_base, reason, reference, created_by)
      values ((_line->>'medicine_id')::uuid, _b.id, 'out', _take, 'sale', _inv, _uid);
      _line_cost := _line_cost + _take * _b.purchase_price;
      _need := _need - _take;
    end loop;
    if _need > 0 then raise exception 'Not enough stock for %', _line->>'name'; end if;
    insert into public.sale_items (sale_id, medicine_id, unit, qty, qty_base, unit_price, discount, line_total, cost_amount)
    values (_sale_id, (_line->>'medicine_id')::uuid, _line->>'unit', (_line->>'qty')::int, (_line->>'base')::int, (_line->>'price')::numeric,
            (_line->>'disc')::numeric, (_line->>'gross')::numeric - (_line->>'disc')::numeric, _line_cost);
    _cost := _cost + _line_cost;
  end loop;

  update public.sales set cost_total = round(_cost, 2) where id = _sale_id;
  if _due > 0 then
    insert into public.customer_ledger (customer_id, kind, amount, sale_id, note, created_by)
    values (_customer_id, 'sale_due', _due, _sale_id, 'Due on ' || _inv, _uid);
    update public.customers set current_due = current_due + _due where id = _customer_id;
  end if;
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (_uid, 'sale_created', 'sales', _sale_id::text, jsonb_build_object('invoice', _inv, 'total', _total, 'due', _due));
  return jsonb_build_object('id', _sale_id, 'invoice_no', _inv, 'total', _total, 'due', _due);
end $$;
revoke execute on function public.create_sale(jsonb,uuid,numeric,numeric,text,text) from anon, public;
grant execute on function public.create_sale(jsonb,uuid,numeric,numeric,text,text) to authenticated;

-- 7. Due collection (admin, or cashier allowed to collect dues)
create or replace function public.collect_due(_customer_id uuid, _amount numeric, _method text default 'cash', _note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare _cur numeric; _uid uuid := auth.uid();
begin
  if not (public.has_role(_uid, 'admin') or exists (select 1 from public.profiles where id = _uid and is_active and can_collect_due)) then
    raise exception 'You are not allowed to collect dues. Ask the owner to allow it.';
  end if;
  if coalesce(_method, '') not in ('cash','bkash','nagad','card') then raise exception 'Choose a payment method'; end if;
  select current_due into _cur from public.customers where id = _customer_id for update;
  if not found then raise exception 'Customer not found'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if round(_amount, 2) > _cur then raise exception 'Amount is more than the current due (%)', _cur; end if;
  insert into public.customer_ledger (customer_id, kind, amount, method, note, created_by)
  values (_customer_id, 'payment', -round(_amount, 2), _method, nullif(trim(coalesce(_note, '')), ''), _uid);
  update public.customers set current_due = current_due - round(_amount, 2) where id = _customer_id;
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (_uid, 'due_collected', 'customers', _customer_id::text, jsonb_build_object('amount', round(_amount, 2), 'method', _method));
  return _cur - round(_amount, 2);
end $$;
revoke execute on function public.collect_due(uuid,numeric,text,text) from anon, public;
grant execute on function public.collect_due(uuid,numeric,text,text) to authenticated;

-- 8. Admin-only stock adjustment (the only way to cut stock outside a sale)
create or replace function public.admin_adjust_stock(_batch_id uuid, _delta int, _reason text, _note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare _b public.medicine_batches%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only the owner/admin can adjust stock'; end if;
  if _delta is null or _delta = 0 then raise exception 'Enter a quantity to add or remove'; end if;
  if coalesce(_reason, '') not in ('damaged','expired','count_correction','return_to_supplier','found_extra','other') then raise exception 'Choose a reason'; end if;
  select * into _b from public.medicine_batches where id = _batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if _b.remaining_qty + _delta < 0 then raise exception 'Cannot remove more than the % pieces in this batch', _b.remaining_qty; end if;
  update public.medicine_batches
     set remaining_qty = remaining_qty + _delta,
         original_qty = original_qty + greatest(_delta, 0)
   where id = _batch_id;
  insert into public.stock_movements (medicine_id, batch_id, direction, qty_base, reason, reference, note, created_by)
  values (_b.medicine_id, _b.id, case when _delta > 0 then 'in' else 'out' end, abs(_delta), 'adjust_' || _reason, _b.batch_number, nullif(trim(coalesce(_note, '')), ''), auth.uid());
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'stock_adjusted', 'medicine_batches', _b.id::text, jsonb_build_object('delta', _delta, 'reason', _reason, 'note', _note));
  return _b.remaining_qty + _delta;
end $$;
revoke execute on function public.admin_adjust_stock(uuid,int,text,text) from anon, public;
grant execute on function public.admin_adjust_stock(uuid,int,text,text) to authenticated;

-- 9. Admin finance summary
create or replace function public.admin_finance_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _today date := (now() at time zone 'Asia/Dhaka')::date; _week date; _month date; _start date; r jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin only'; end if;
  _week := _today - 6;
  _month := date_trunc('month', _today::timestamp)::date;
  _start := least(_month, _today - 29);
  with s as (
    select (created_at at time zone 'Asia/Dhaka')::date as d, total, vat, cost_total, paid, due, payment_method
    from public.sales where created_at >= (_start::timestamp at time zone 'Asia/Dhaka')
  ), e as (
    select expense_date as d, amount from public.expenses where expense_date >= _start
  ), l as (
    select (created_at at time zone 'Asia/Dhaka')::date as d, amount from public.customer_ledger
    where kind = 'payment' and created_at >= (_start::timestamp at time zone 'Asia/Dhaka')
  )
  select jsonb_build_object(
    'today_sales', (select coalesce(sum(total), 0) from s where d = _today),
    'today_count', (select count(*) from s where d = _today),
    'today_profit', (select coalesce(sum(total - vat - cost_total), 0) from s where d = _today),
    'today_expenses', (select coalesce(sum(amount), 0) from e where d = _today),
    'week_sales', (select coalesce(sum(total), 0) from s where d >= _week),
    'week_count', (select count(*) from s where d >= _week),
    'week_profit', (select coalesce(sum(total - vat - cost_total), 0) from s where d >= _week),
    'week_expenses', (select coalesce(sum(amount), 0) from e where d >= _week),
    'month_sales', (select coalesce(sum(total), 0) from s where d >= _month),
    'month_count', (select count(*) from s where d >= _month),
    'month_profit', (select coalesce(sum(total - vat - cost_total), 0) from s where d >= _month),
    'month_expenses', (select coalesce(sum(amount), 0) from e where d >= _month),
    'month_due_given', (select coalesce(sum(due), 0) from s where d >= _month),
    'month_collected', (select coalesce(-sum(amount), 0) from l where d >= _month),
    'today_collected', (select coalesce(-sum(amount), 0) from l where d = _today),
    'today_cash', (select coalesce(sum(paid), 0) from s where d = _today and payment_method = 'cash'),
    'customer_due', (select coalesce(sum(current_due), 0) from public.customers),
    'due_customers', (select count(*) from public.customers where current_due > 0),
    'supplier_payable', (select coalesce(sum(current_payable), 0) from public.suppliers),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('date', g.day, 'sales', coalesce(x.sales, 0), 'profit', coalesce(x.profit, 0)) order by g.day), '[]'::jsonb)
               from (select (_today - i) as day from generate_series(0, 29) i) g
               left join (select d, sum(total) sales, sum(total - vat - cost_total) profit from s group by d) x on x.d = g.day),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount)), '[]'::jsonb) from (
                   select payment_method as method, sum(paid) as amount from s where d >= _month group by 1
                   union all select 'due', sum(due) from s where d >= _month having sum(due) > 0) p),
    'top_medicines', (select coalesce(jsonb_agg(to_jsonb(t) order by t.revenue desc), '[]'::jsonb) from (
                   select m.brand_name || ' ' || m.strength as name, sum(si.line_total) as revenue, sum(si.line_total - si.cost_amount) as profit
                   from public.sale_items si join public.sales sa on sa.id = si.sale_id join public.medicines m on m.id = si.medicine_id
                   where sa.created_at >= (_month::timestamp at time zone 'Asia/Dhaka')
                   group by 1 order by 2 desc limit 8) t)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_finance_summary() from anon, public;
grant execute on function public.admin_finance_summary() to authenticated;

-- 10. Admin sales list with profit
create or replace function public.admin_sales_list(_from date, _to date)
returns table (id uuid, invoice_no text, created_at timestamptz, customer_id uuid, customer_name text, cashier_name text, subtotal numeric, discount numeric, vat numeric, total numeric, paid numeric, due numeric, payment_method text, cost_total numeric, profit numeric, is_demo boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.invoice_no, s.created_at, s.customer_id, c.name, s.cashier_name, s.subtotal, s.discount, s.vat, s.total, s.paid, s.due, s.payment_method,
         s.cost_total, s.total - s.vat - s.cost_total, s.is_demo
  from public.sales s left join public.customers c on c.id = s.customer_id
  where public.has_role(auth.uid(), 'admin')
    and (s.created_at at time zone 'Asia/Dhaka')::date between _from and _to
  order by s.created_at desc
  limit 3000
$$;
revoke execute on function public.admin_sales_list(date,date) from anon, public;
grant execute on function public.admin_sales_list(date,date) to authenticated;

-- 11. Clear demo data now also removes demo sales, dues and expenses
create or replace function public.clear_demo_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admin only'; end if;
  delete from customer_ledger where is_demo;
  delete from sale_items where sale_id in (select id from sales where is_demo);
  delete from sales where is_demo;
  delete from expenses where is_demo;
  delete from stock_movements where is_demo;
  delete from medicine_batches b where b.is_demo and not exists (select 1 from stock_movements s where s.batch_id = b.id);
  delete from medicines m where m.is_demo
    and not exists (select 1 from medicine_batches b where b.medicine_id = m.id)
    and not exists (select 1 from stock_movements s where s.medicine_id = m.id)
    and not exists (select 1 from sale_items si where si.medicine_id = m.id);
  delete from customers c where c.is_demo
    and not exists (select 1 from sales s where s.customer_id = c.id)
    and not exists (select 1 from customer_ledger l where l.customer_id = c.id);
  delete from suppliers where is_demo and not exists (select 1 from medicine_batches b where b.supplier_id = suppliers.id);
  insert into audit_logs (user_id, action, entity) values (auth.uid(), 'clear_demo_data', 'system');
end $$;
revoke execute on function public.clear_demo_data() from anon, public;
grant execute on function public.clear_demo_data() to authenticated;

-- 12. Sample sales, dues and expenses (demo rows, removable from Settings)
do $$
declare
  d int; k int; n int; _cnt int := 0; _sid uuid; _inv text; _ts timestamptz; _m record; _unit text; _qty int; _f int; _price numeric; _lc numeric;
  _sub numeric; _cost numeric; _disc numeric; _total numeric; _paid numeric; _due numeric; _cust uuid; _method text;
  _today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  insert into public.customer_ledger (customer_id, kind, amount, note, is_demo, created_at)
  select id, 'opening', current_due, 'Opening due', true, now() - interval '40 days' from public.customers where is_demo and current_due > 0;

  for d in reverse 29..0 loop
    n := 8 + (d % 5);
    for k in 1..n loop
      _cnt := _cnt + 1;
      _sid := gen_random_uuid();
      _ts := ((_today - d)::timestamp + interval '9 hours' + (k * interval '70 minutes') + (random() * interval '30 minutes')) at time zone 'Asia/Dhaka';
      if _ts > now() then _ts := now() - (k * interval '6 minutes'); end if;
      _inv := 'INV-' || nextval('public.invoice_seq');
      _method := (array['cash','cash','cash','bkash','nagad','card'])[1 + (_cnt % 6)];
      _cust := null;
      if _cnt % 6 = 0 then
        select id into _cust from public.customers where is_demo order by name offset (_cnt % 6 + (_cnt / 6) % 6) % 6 limit 1;
      end if;
      insert into public.sales (id, invoice_no, customer_id, cashier_name, payment_method, is_demo, created_at)
      values (_sid, _inv, _cust, 'Demo cashier', _method, true, _ts);
      _sub := 0; _cost := 0;
      for _m in select * from public.medicines where is_demo and status = 'active' order by random() limit (1 + (_cnt % 3)) loop
        if _m.is_divisible then
          _unit := case when _cnt % 9 = 0 then 'box' when _cnt % 4 = 0 then 'piece' else 'strip' end;
          _qty := case when _unit = 'piece' then 4 + (_cnt % 6) else 1 + (_cnt % 2) end;
        else
          _unit := 'box'; _qty := 1;
        end if;
        _f := public.unit_factor(_unit, _m.strips_per_box, _m.pieces_per_strip);
        _price := case _unit when 'box' then _m.price_box when 'strip' then _m.price_strip else _m.price_piece end;
        _lc := round(_qty * _f * _m.price_piece * 0.8, 2);
        insert into public.sale_items (sale_id, medicine_id, unit, qty, qty_base, unit_price, discount, line_total, cost_amount, is_demo, created_at)
        values (_sid, _m.id, _unit, _qty, _qty * _f, _price, 0, _price * _qty, _lc, true, _ts);
        _sub := _sub + _price * _qty; _cost := _cost + _lc;
      end loop;
      _disc := case when _cnt % 7 = 0 then round(_sub * 0.05, 0) else 0 end;
      _total := _sub - _disc;
      _paid := case when _cust is not null then round(_total * 0.4, 0) else _total end;
      _due := _total - _paid;
      update public.sales set subtotal = _sub, discount = _disc, total = _total, paid = _paid, due = _due, cost_total = _cost where id = _sid;
      if _due > 0 then
        insert into public.customer_ledger (customer_id, kind, amount, sale_id, note, is_demo, created_at)
        values (_cust, 'sale_due', _due, _sid, 'Due on ' || _inv, true, _ts);
        update public.customers set current_due = current_due + _due where id = _cust;
      end if;
    end loop;
  end loop;

  insert into public.customer_ledger (customer_id, kind, amount, method, note, is_demo, created_at)
  select id, 'payment', -300, 'cash', 'Part payment', true, now() - interval '2 days'
  from public.customers where is_demo and current_due > 300 and name in ('Abdul Karim', 'Jamal Uddin');
  update public.customers set current_due = current_due - 300 where is_demo and current_due > 300 and name in ('Abdul Karim', 'Jamal Uddin');

  insert into public.expenses (expense_date, category, amount, note, is_demo) values
    (date_trunc('month', _today::timestamp)::date, 'Shop rent', 6000, 'Monthly rent', true),
    (greatest(date_trunc('month', _today::timestamp)::date, _today - 3), 'Electricity bill', 1850, 'DESCO prepaid', true),
    (greatest(date_trunc('month', _today::timestamp)::date, _today - 2), 'Internet', 800, 'Monthly package', true),
    (_today, 'Tea & snacks', 120, 'Counter', true),
    (greatest(date_trunc('month', _today::timestamp)::date, _today - 1), 'Delivery / transport', 250, 'Rickshaw van for stock', true),
    (_today - 35, 'Shop rent', 6000, 'Monthly rent', true);
end $$;