# Welcome mail delivery

The welcome worker uses the existing private community verification table. No schema change or Gmail inbox permission is needed. A job is keyed by the account, not a browser session. A restart picks up queued and retry jobs. Each job has at most three attempts. A transport failure during Gmail send, an ambiguous provider response, or a stale sending record is never retried automatically. Previously deployed `claimed` records are also not replayed automatically because delivery is unknown.

Operator check (read-only, run using the existing restricted community database connection):

```sql
select id as job, identifier as state, value as detail, "updatedAt"
from mirpanel_community.verification
where identifier in ('mirpanel-welcome/failed','mirpanel-welcome/uncertain','mirpanel-welcome/sending')
   or (id like 'mirpanel-welcome:%' and value = 'claimed')
order by "updatedAt" desc
limit 100;
```

Investigate the provider's sent folder before considering manual recovery. An `accepted` state is a successful Gmail API response, not proof of inbox delivery. Do not export the verification table or enable Gmail inbox access for this worker.
