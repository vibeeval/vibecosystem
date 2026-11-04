[English · canonical documentation](../README.md)

# vibecosystem — 한국어

**Claude Code를 위한 간결한 런타임과 Codex를 위한 범위가 제한된 worker.**

기본 `core` 프로필은 조사, 구현, 검토, 검증에 필요한 구성 요소를 선택해 설치합니다. 메모리, 학습, 다중 에이전트 조정은 별도로 선택합니다. 전체 카탈로그를 설치해도 에이전트 군집이 자동으로 시작되지는 않습니다.

이 페이지는 개요입니다. 최신 기술 안내, 의존성과 제한 사항은 영어 README를 확인하세요.

![Runtime profiles](../assets/runtime-overview.svg)

## 빠른 시작

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

3.5.0은 이 소스 트리에서 준비 중이며 npm 또는 GitHub에 게시되었다는 의미가 아닙니다. 컨텍스트 제한은 문자 수 기준이며 모델의 전체 토큰 사용량을 제한하지 않습니다. 고정된 토큰 절감률을 약속하지 않습니다.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
