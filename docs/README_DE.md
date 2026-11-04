[English · canonical documentation](../README.md)

# vibecosystem — Deutsch

**Eine fokussierte Laufzeit für Claude Code und ein begrenzter Worker für Codex.**

Das Standardprofil `core` installiert ausgewählte Komponenten für Analyse, Implementierung, Review und Prüfung. Speicher, Lernen und Orchestrierung werden separat ausgewählt. Die Installation des gesamten Katalogs startet keinen Agentenschwarm.

Diese Seite ist eine Einführung. Aktuelle technische Anleitungen, Abhängigkeiten und Einschränkungen stehen im englischen README.

![Runtime profiles](../assets/runtime-overview.svg)

## Schnellstart

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

Version 3.5.0 wird in diesem Quellbaum vorbereitet; eine Veröffentlichung auf npm oder GitHub ist damit nicht zugesagt. Kontextgrenzen zählen Zeichen und begrenzen nicht den gesamten Modellverbrauch. Es gibt kein Versprechen eines festen Token-Sparprozentsatzes.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
