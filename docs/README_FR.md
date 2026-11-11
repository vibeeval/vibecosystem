[English · canonical documentation](../README.md)

# vibecosystem — Français

**Un environnement ciblé pour Claude Code et un worker limité pour Codex.**

Le profil `core`, utilisé par défaut, installe une sélection de composants pour explorer, développer, relire et vérifier. La mémoire, l’apprentissage et l’orchestration se choisissent séparément ; installer le catalogue complet ne lance pas automatiquement un essaim d’agents.

Cette page est une introduction. Les instructions techniques à jour, les dépendances et les limites figurent dans le README anglais.

![Runtime profiles](../assets/runtime-overview.svg)

## Démarrage rapide

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
```

Le profil par défaut est `core` ; changez de profil avec :

```bash
vibeco profile quality
vibeco profile core
vibeco profile memory
vibeco profile full
```

`vibeco effective-config` affiche le profil actif et le nombre de hooks enregistrés.

La version 3.5.0 est le paquet npm actuellement publié. Les limites de contexte sont exprimées en caractères, pas en consommation totale du modèle. Aucun taux fixe d’économie de tokens n’est garanti.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
