-- ---------------------------------------------------------------
-- 008: Atomic Pro-pass grant
-- ---------------------------------------------------------------
-- Browser verification and the Razorpay webhook can arrive at the same time.
-- The grant is a single database transaction so an order can never add two
-- 30-day periods, and a crash cannot leave a captured payment without access.
--
-- The function is SECURITY DEFINER and only executable by service_role. It
-- must never be callable with the public anon key.

create unique index if not exists idx_payments_provider_order_unique
  on public.payments(provider_order_id);

create or replace function public.grant_pro_pass(
  p_user_id uuid,
  p_provider text,
  p_order_id text,
  p_payment_id text,
  p_amount_minor_units integer,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_now timestamptz := now();
  v_current_end timestamptz;
  v_period_end timestamptz;
begin
  -- Serialize all grants for one student so two different orders cannot both
  -- read the same starting period and fail to stack.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Insert the order if this is the first confirmation, otherwise lock and
  -- return the existing row. Unique(provider_order_id) makes this safe under
  -- concurrent webhook + browser verification.
  insert into public.payments (
    user_id,
    provider,
    provider_order_id,
    provider_payment_id,
    amount_minor_units,
    currency,
    status,
    idempotency_key
  )
  values (
    p_user_id,
    p_provider,
    p_order_id,
    p_payment_id,
    p_amount_minor_units,
    p_currency,
    'granted',
    'order_' || p_order_id
  )
  on conflict (provider_order_id) do update
    set provider_order_id = excluded.provider_order_id
  returning * into v_payment;

  if v_payment.user_id <> p_user_id then
    raise exception 'Payment order belongs to a different user';
  end if;

  if v_payment.status = 'granted' then
    if v_payment.provider_payment_id = p_payment_id then
      return jsonb_build_object(
        'granted', true,
        'alreadyProcessed', true
      );
    end if;
    raise exception 'Payment order was already captured by another payment';
  end if;

  -- Lock the subscription row before calculating the new end date. The
  -- previous grant may have completed a moment ago.
  select current_period_end
    into v_current_end
    from public.subscriptions
   where user_id = p_user_id
   for update;

  if v_current_end is not null and v_current_end > v_now then
    v_period_end := v_current_end + interval '30 days';
  else
    v_period_end := v_now + interval '30 days';
  end if;

  insert into public.subscriptions (
    user_id,
    provider,
    plan_code,
    status,
    current_period_start,
    current_period_end,
    updated_at
  )
  values (
    p_user_id,
    p_provider,
    'pro',
    'active',
    v_now,
    v_period_end,
    v_now
  )
  on conflict (user_id) do update
    set provider = excluded.provider,
        plan_code = 'pro',
        status = 'active',
        current_period_start = case
          when subscriptions.current_period_end is not null
            and subscriptions.current_period_end > v_now
          then subscriptions.current_period_start
          else v_now
        end,
        current_period_end = v_period_end,
        updated_at = v_now;

  update public.payments
     set provider_payment_id = p_payment_id,
         amount_minor_units = p_amount_minor_units,
         currency = p_currency,
         status = 'granted'
   where id = v_payment.id;

  return jsonb_build_object(
    'granted', true,
    'alreadyProcessed', false
  );
end;
$$;

revoke all on function public.grant_pro_pass(
  uuid, text, text, text, integer, text
) from public, anon, authenticated;

grant execute on function public.grant_pro_pass(
  uuid, text, text, text, integer, text
) to service_role;
