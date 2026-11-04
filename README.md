# FROSTMETA — автообновляемая мета Dota 2

1. Создайте репозиторий на GitHub и загрузите все файлы из этой папки.
2. Получите бесплатный токен: https://stratz.com/api (вход через Steam).
3. Repo → Settings → Secrets and variables → Actions → New secret: имя `STRATZ_TOKEN`, значение — токен.
4. Repo → Settings → Pages → Deploy from branch → `main` / root. Сайт появится по ссылке GitHub Pages.
5. Repo → Actions → «Update meta» → Run workflow (первый запуск вручную). Дальше обновление идёт каждый день в 04:00 UTC.

Если запуск упал с «STRATZ error» — скрипт не менялся с момента написания и не тестировался на живом API.
Откройте https://stratz.com/api (GraphQL Explorer), проверьте имена полей `winWeek` / `bracketIds` / `positionIds`
и поправьте запрос в `scripts/update.py` (функция запроса — одна строка), либо пришлите мне текст ошибки.
