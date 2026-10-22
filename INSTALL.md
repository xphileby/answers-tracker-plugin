# answers — установка из этого архива

Плагин `answers` для Claude Code: панель с индексом ответов текущей сессии;
клик по записи прокручивает транскрипт к этому сообщению. Команды внутри
сессии: `/answers`, `/answers all`, `/answers final`, `/answers clear`.

Архив устроен как маркетплейс из одного плагина:

```
answers-plugin/
  .claude-plugin/marketplace.json   ← маркетплейс «answers-plugin»
  answers/                          ← сам плагин (манифест, hooks/register.tsx)
  INSTALL.md, install.sh
```

## Установка из GitHub

В сессии Claude Code одной строкой (`y` на добавление маркетплейса, затем scope):

```
/plugin install answers --marketplace xphileby/answers-tracker-plugin
```

Из терминала: `claude plugin install answers --marketplace xphileby/answers-tracker-plugin`.

## Установка из папки

1. Распакуй архив, например в `~/claude-plugins/answers-plugin`.
   При установке Claude Code копирует плагин в свой кэш и дальше работает
   из него; папка нужна только для `/plugin marketplace update` и переустановки,
   поэтому лучше оставить её на месте.

2. В любой сессии Claude Code:

   ```
   /plugin marketplace add ~/claude-plugins/answers-plugin
   /plugin install answers@answers-plugin
   ```

   Или из терминала, без интерактива (то же самое делает `install.sh`):

   ```
   claude plugin marketplace add ~/claude-plugins/answers-plugin
   claude plugin install answers@answers-plugin --scope user
   ```

3. В уже открытой сессии выполни `/reload-plugins` или перезапусти её,
   затем `/answers`.

## Без установки, на одну сессию

```
claude --plugin-dir ~/claude-plugins/answers-plugin/answers
```

Плагин живёт только в этой сессии, в настройки ничего не пишется;
в следующий раз флаг нужно передать снова.

## Требования

- Claude Code не старше той версии, на которой плагин собран (2.1.308):
  плагин использует модули хуков (`hooks/hooks.json` → `modules`) и API
  панелей, которых нет в более ранних сборках.
- Сеть не нужна: ни зависимостей, ни скачиваний. Плагин не хранит секретов
  и не содержит путей конкретной машины.

## Удаление

```
/plugin uninstall answers@answers-plugin
/plugin marketplace remove answers-plugin
```
