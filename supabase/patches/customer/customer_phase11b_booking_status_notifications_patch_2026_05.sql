-- Phase 11b booking status notifications patch:
-- Push booking status changes into customer_notifications inbox.

begin;

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

  if coalesce(old.status, '') = coalesce(new.status, '') and coalesce(old.appointment_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(new.appointment_id, '00000000-0000-0000-0000-000000000000'::uuid) then
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
    false,
    now()
  );

  return new;
end;
$$;

drop trigger if exists trg_customer_booking_status_notifications on public.booking_requests;
create trigger trg_customer_booking_status_notifications
after update of status, appointment_id on public.booking_requests
for each row
execute function public.notify_customer_booking_status_change();

commit;
