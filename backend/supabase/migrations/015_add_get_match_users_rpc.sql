create or replace function get_match_users(
    p_user_id uuid,
    p_take integer default 5
)
returns table (
    user_id uuid,
    bias real
)
language sql
as $$
    with target_user as (
        select
            coalesce(bias, 0.5)::real as target_bias,
            greatest(0.02::real, (0.20::real * (1 - coalesce(bias, 0.5)::real))) as range_diff
        from users
        where user_id = p_user_id
    )
    select u.user_id, u.bias
    from users u
    cross join target_user t
    where u.user_id <> p_user_id
      and u.bias is not null
      and abs(u.bias - t.target_bias) <= t.range_diff
    order by random()
    limit greatest(1, least(coalesce(p_take, 5), 50));
$$;
