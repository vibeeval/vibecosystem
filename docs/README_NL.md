[English · canonical documentation](../README.md)

# vibecosystem — Nederlands

**Een gerichte runtime voor Claude Code en een begrensde worker voor Codex.**

Het standaardprofiel `core` installeert geselecteerde onderdelen voor onderzoek, implementatie, review en verificatie. Geheugen, leren en orkestratie kies je apart; het installeren van de volledige catalogus start niet automatisch een zwerm agents.

Dit is een introductie. Actuele technische instructies, afhankelijkheden en beperkingen staan in de Engelse README.

![Runtime profiles](../assets/runtime-overview.svg)

## Snel starten

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

Versie 3.5.0 wordt in deze broncode voorbereid; dit betekent niet dat deze op npm of GitHub is gepubliceerd. Contextlimieten tellen tekens en begrenzen niet het totale modelverbruik. Er wordt geen vast percentage tokenbesparing beloofd.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
