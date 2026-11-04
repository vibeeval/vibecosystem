[English · canonical documentation](../README.md)

# vibecosystem — Português

**Um ambiente focado para Claude Code e um worker limitado para Codex.**

O perfil padrão `core` instala componentes selecionados para investigar, implementar, revisar e verificar. Memória, aprendizado e orquestração são escolhidos separadamente; instalar todo o catálogo não inicia automaticamente um enxame de agentes.

Esta página é uma introdução. As instruções técnicas atuais, dependências e limitações estão no README em inglês.

![Runtime profiles](../assets/runtime-overview.svg)

## Início rápido

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

A versão 3.5.0 está em preparação nesta árvore de código; isso não significa uma publicação no npm ou GitHub. Os limites de contexto contam caracteres e não limitam o consumo total do modelo. Não há promessa de uma porcentagem fixa de economia de tokens.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
