create or replace function update_bill_elo(
    p_bill_id integer,
    p_delta integer
)
returns integer
language sql
as $$
    update bills
    set bill_elo = coalesce(bill_elo, 1000) + p_delta
    where bill_id = p_bill_id
    returning bill_elo;
$$;