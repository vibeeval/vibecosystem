[English · canonical documentation](../README.md)

# vibecosystem — 中文

**为 Claude Code 提供精简运行环境，为 Codex 提供有明确边界的 worker。**

默认的 `core` 配置只安装用于调查、实现、审查和验证的部分组件。记忆、学习和多智能体编排需要单独选择；安装完整目录不会自动启动智能体集群。

本页为简要介绍。最新技术说明、依赖和限制以英文 README 为准。

![Runtime profiles](../assets/runtime-overview.svg)

## 快速开始

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

3.5.0 正在此源码树中准备，并不表示已经发布到 npm 或 GitHub。上下文限制以字符计算，不限制模型的总 token 使用量。项目不承诺固定比例的 token 节省。

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
