alter table public.bills
  alter column bill_elo set data type float8 using bill_elo::float8;
