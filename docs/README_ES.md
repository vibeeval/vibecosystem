[English · canonical documentation](../README.md)

# vibecosystem — Español

**Un entorno enfocado para Claude Code y un worker acotado para Codex.**

El perfil predeterminado `core` instala componentes seleccionados para investigar, implementar, revisar y verificar. La memoria, el aprendizaje y la orquestación se eligen por separado; instalar el catálogo completo no inicia un enjambre de agentes.

Esta página es una introducción. La documentación técnica vigente, los requisitos y las limitaciones están en el README en inglés.

![Runtime profiles](../assets/runtime-overview.svg)

## Inicio rápido

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
```

El perfil predeterminado es `core`; cambia de perfil con:

```bash
vibeco profile quality
vibeco profile core
vibeco profile memory
vibeco profile full
```

`vibeco effective-config` muestra el perfil activo y el número de hooks registrados.

La versión 3.5.0 es el paquete npm publicado actualmente. Los límites de contexto se expresan en caracteres y no limitan el consumo total del modelo. No se promete un porcentaje fijo de ahorro de tokens.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
