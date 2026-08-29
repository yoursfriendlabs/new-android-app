# Features

Each folder is a product area. Routes in `app/` import from here.

| Folder | Contains |
| --- | --- |
| `home` | Personal dashboard charts |
| `auth` | Login/register UI and auth helpers |
| `money` | Personal money, expense form, money entry |
| `parties` | Contact/party forms, payments, device contacts |
| `inventory` | Product form, detail, restock |
| `pos` | Product cards, cart/totals hooks |
| `notes` | Personal inbox, composer, reminders, task queries |
| `habits` | Coins, streaks, interval reminders |
| `staff` | Access-control helpers (directory/salary screens still in `app/`, extract as they grow) |
| `cafe` | Cafe order helpers |

Inside a feature, keep this shape:

```
src/features/<name>/
  components/     UI
  lib/            Pure helpers
  hooks/          Queries and local orchestration
```
