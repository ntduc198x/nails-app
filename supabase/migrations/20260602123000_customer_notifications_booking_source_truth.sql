begin;

alter table public.customer_notifications
  add column if not exists related_booking_request_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_notifications_related_booking_request_id_fkey'
  ) then
    alter table public.customer_notifications
      add constraint customer_notifications_related_booking_request_id_fkey
      foreign key (related_booking_request_id)
      references public.booking_requests(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_customer_notifications_related_booking_request
  on public.customer_notifications (related_booking_request_id);

update public.customer_notifications cn
set related_booking_request_id = br.id
from public.booking_requests br
where cn.kind = 'BOOKING'
  and cn.related_booking_request_id is null
  and cn.related_appointment_id is not null
  and br.appointment_id = cn.related_appointment_id
  and br.customer_id = cn.customer_id
  and br.org_id = cn.org_id;

delete from public.customer_notifications cn
where cn.kind = 'BOOKING'
  and cn.related_booking_request_id is null
  and cn.related_appointment_id is null;

create or replace function public.notify_customer_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_customer_user_id uuid;
  v_title text;
  v_body text;
  v_effective_start timestamptz;
  v_status text := coalesce(new.status, 'NEW');
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.customer_id is null then
    return new;
  end if;

  if coalesce(old.status, '') = coalesce(new.status, '')
     and coalesce(old.appointment_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(new.appointment_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  select ca.user_id
  into v_customer_user_id
  from public.customer_accounts ca
  where ca.customer_id = new.customer_id
    and ca.org_id = new.org_id
  order by ca.created_at asc
  limit 1;

  if v_customer_user_id is null then
    return new;
  end if;

  v_effective_start := coalesce(new.requested_start_at, old.requested_start_at);

  if v_status = 'CONFIRMED' then
    v_title := 'Lịch hẹn đã được xác nhận';
    v_body := 'Tiệm đã xác nhận lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'dịch vụ của bạn') || ' vào ' || to_char(v_effective_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') || '.';
  elsif v_status = 'NEEDS_RESCHEDULE' then
    v_title := 'Lịch hẹn cần đổi giờ';
    v_body := 'Tiệm cần điều chỉnh lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'dịch vụ của bạn') || '. Bạn vui lòng liên hệ trực tiếp với tiệm để được hỗ trợ nhanh nhất.';
  elsif v_status = 'CANCELLED' then
    v_title := 'Lịch hẹn đã bị hủy';
    v_body := 'Lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'dịch vụ của bạn') || ' đã bị hủy. Nếu cần hỗ trợ, bạn vui lòng liên hệ trực tiếp với tiệm.';
  elsif v_status = 'CONVERTED' or (new.appointment_id is not null and old.appointment_id is distinct from new.appointment_id) then
    v_title := 'Lịch hẹn đã được ghi nhận';
    v_body := 'Yêu cầu đặt lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'của bạn') || ' đã được chuyển thành lịch hẹn chính thức.';
  elsif v_status = 'EXPIRED_UNCONFIRMED' then
    v_title := 'Lịch hẹn không được xác nhận';
    v_body := 'Lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'dịch vụ của bạn') || ' đã hết hiệu lực vì tiệm chưa xác nhận kịp trước giờ hẹn.';
  else
    return new;
  end if;

  insert into public.customer_notifications (
    user_id,
    customer_id,
    org_id,
    title,
    body,
    kind,
    related_appointment_id,
    related_booking_request_id,
    is_read,
    sent_at
  )
  values (
    v_customer_user_id,
    new.customer_id,
    new.org_id,
    v_title,
    v_body,
    'BOOKING',
    new.appointment_id,
    new.id,
    false,
    now()
  );

  return new;
end;
$$;

commit;
