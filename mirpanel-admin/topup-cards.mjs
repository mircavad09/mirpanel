// The callers read availability after taking the same lock used by card selection
// and card administration. Availability displayed before selection is advisory.
export const topupCardLock='select pg_advisory_xact_lock(714025001)';
export async function availableTopupCards(db){
 const {rows}=await db.query(`
   with day as (select public.payment_baku_date() as d)
   select m.id,m.provider_name,m.display_name,m.holder_name,m.last4,m.method_type,m.encrypted_number
   from public.payment_methods m cross join day
   where m.active and not m.manual_disabled and not m.archived and m.deleted_at is null
     and nullif(m.encrypted_number,'') is not null and m.last4 ~ '^[0-9]{4}$'
     and (m.limit_mode='unlimited' or
       coalesce((select c.confirmed_count from public.payment_method_daily_counters c
         where c.method_id=m.id and c.counter_date=day.d),0)
       + (select count(*) from public.payment_reservations r where r.method_id=m.id and r.usage_day=day.d
         and (r.status='reviewing' or (r.status='reserved' and r.expires_at>clock_timestamp())))
       + (select count(*) from mirpanel_community.wallet_topups t where t.method_id=m.id
         and t.created_at >= day.d::timestamp at time zone 'Asia/Baku'
         and t.created_at < (day.d+1)::timestamp at time zone 'Asia/Baku'
         and (t.status in ('reviewing','approved') or
           (t.status='draft' and t.reserved_until>clock_timestamp()))) < m.daily_limit)
   order by m.sort_order,m.created_at,m.id`);
 return rows;
}

export const topupUnavailable=()=>Object.assign(Error('Hazırda limiti boş olan aktiv ödəniş kartı yoxdur. Bir qədər sonra kartları yenidən yoxlayın.'),{status:409,code:'TOPUP_CARD_UNAVAILABLE'});
export const topupExpired=()=>Object.assign(Error('Kart rezervinin vaxtı bitib. Yeni köçürmə üçün kartı yenidən seçin. Artıq köçürmüsünüzsə, dəstəyə yazın.'),{status:409,code:'TOPUP_CARD_EXPIRED'});
