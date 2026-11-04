[English · canonical documentation](../README.md)

# vibecosystem — 日本語

**Claude Code 向けの軽量な実行環境と、Codex 向けの範囲を限定した worker。**

既定の `core` プロファイルは、調査・実装・レビュー・検証に必要なコンポーネントを選んでインストールします。メモリ、学習、複数エージェントの連携は個別に選択します。全カタログをインストールしても、エージェント群が自動起動するわけではありません。

このページは概要です。最新の技術手順、依存関係、制限は英語版 README を参照してください。

![Runtime profiles](../assets/runtime-overview.svg)

## クイックスタート

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

3.5.0 はこのソースツリーで準備中です。npm や GitHub での公開を意味しません。コンテキスト制限は文字数であり、モデル全体のトークン使用量の上限ではありません。一定割合のトークン削減は保証しません。

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
