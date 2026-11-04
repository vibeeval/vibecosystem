[English · canonical documentation](../README.md)

# vibecosystem — Русский

**Компактная среда для Claude Code и worker с ограниченной областью задач для Codex.**

Профиль `core` по умолчанию устанавливает выбранные компоненты для исследования, реализации, ревью и проверки. Память, обучение и координация нескольких агентов подключаются отдельно; установка полного каталога не запускает рой агентов автоматически.

Это краткое введение. Актуальные технические инструкции, зависимости и ограничения находятся в английском README.

![Runtime profiles](../assets/runtime-overview.svg)

## Быстрый старт

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

Версия 3.5.0 готовится в этом дереве исходного кода; это не означает публикацию в npm или GitHub. Ограничения контекста заданы в символах и не ограничивают весь расход токенов модели. Фиксированный процент экономии токенов не обещается.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
