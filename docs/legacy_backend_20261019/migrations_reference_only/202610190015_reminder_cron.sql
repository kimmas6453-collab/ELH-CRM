-- pg_cron already enabled for the Callio sync. Runs at 08:00 Vietnam (01:00 UTC).
select cron.schedule('crm-daily-reminders','0 1 * * *','select private.daily_reminders()');
