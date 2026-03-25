# Agent Assignment Matrix - Task Tipi → Agent Eslestirme

Hangi is hangi agent'a gider. Maestro ve /swarm bu tabloyu referans alir.

## Developer Assignment

| Task Kategorisi | Ana Agent | Yedek Agent | QA Agent |
|----------------|-----------|-------------|----------|
| React/Next.js UI | frontend-dev | designer | code-reviewer |
| API endpoint | backend-dev | kraken | code-reviewer + security-reviewer |
| Database schema/query | backend-dev | database-reviewer | code-reviewer |
| Auth/security | backend-dev + security-reviewer | security-analyst | security-reviewer |
| CI/CD, Docker | devops | backend-dev | verifier |
| AI/LLM entegrasyon | ai-engineer | backend-dev | code-reviewer |
| Buyuk feature (TDD) | kraken | backend-dev | tdd-guide + verifier |
| Kucuk fix/tweak | spark | frontend-dev | code-reviewer |
| Refactoring | phoenix + refactor-cleaner | kraken | code-reviewer |
| Test yazimi | tdd-guide | qa-engineer | arbiter |
| E2E test | e2e-runner | qa-engineer | verifier |
| Performans | profiler | backend-dev | verifier |
| Dokumantasyon | technical-writer | doc-updater | code-reviewer |
| Tech debt/cleanup | janitor | refactor-cleaner | code-reviewer |
| Dependency upgrade | migrator | devops | verifier |
| Release/deploy | shipper | devops | verifier |
| Scaffold/boilerplate | catalyst | frontend-dev | code-reviewer |
| Bug post-mortem | coroner | sleuth | code-reviewer |
| Test data/fixture | mocksmith | tdd-guide | arbiter |
| Bug reproduction | replay | sleuth | qa-engineer |
| GraphQL API | graphql-expert | backend-dev | code-reviewer |
| WebSocket/realtime | websocket-expert | backend-dev | code-reviewer |
| Redis/caching | redis-expert | backend-dev | code-reviewer |
| Elasticsearch/search | elasticsearch-expert | backend-dev | code-reviewer |
| Terraform/IaC | terraform-expert | devops | verifier |
| Kubernetes/K8s | kubernetes-expert | devops | verifier |
| AWS infra | aws-expert | devops | verifier |
| GCP infra | gcp-expert | devops | verifier |
| Azure infra | azure-expert | devops | verifier |
| MongoDB/NoSQL | mongodb-expert | database-reviewer | code-reviewer |
| OAuth/auth flow | oauth-expert | security-reviewer | security-reviewer |
| Vector DB/embeddings | vector-db-expert | ai-engineer | code-reviewer |
| Load/perf testing | load-tester | profiler | verifier |
| Contract testing | contract-testing-expert | tdd-guide | verifier |
| Feature flags | feature-flag-expert | backend-dev | code-reviewer |
| Canary deploy | canary-deploy-expert | devops | verifier |
| Incident response | sentinel | devops | verifier |
| Chaos engineering | chaos-engineer | devops | verifier |
| A11y testing | accessibility-auditor | frontend-dev | qa-engineer |
| i18n/l10n | i18n-expert + babel | frontend-dev | code-reviewer |
| SEO optimization | seo-specialist | frontend-dev | code-reviewer |
| Web performance | web-perf-expert | profiler | verifier |
| API gateway | api-gateway-expert + nexus | backend-dev | code-reviewer |
| Service mesh | service-mesh-expert | devops | verifier |
| Event sourcing | event-sourcing-expert | backend-dev | code-reviewer |
| CQRS pattern | cqrs-expert | architect | code-reviewer |
| DDD modeling | ddd-expert | architect | code-reviewer |
| Clean architecture | clean-arch-expert | architect | code-reviewer |
| Micro frontend | micro-frontend-expert | frontend-dev | code-reviewer |
| Compliance/audit | compliance-expert | security-reviewer | security-reviewer |
| API documentation | api-doc-generator | technical-writer | code-reviewer |
| Migration planning | migration-planner | migrator | verifier |
| Dependency tracking | dependency-tracker | migrator | verifier |
| Log analysis | log-analyzer | profiler | verifier |
| Config validation | config-validator | devops | verifier |
| Schema validation | schema-validator | database-reviewer | code-reviewer |
| Code generation | code-generator | catalyst | code-reviewer |
| Template/scaffold | template-engine | catalyst | code-reviewer |
| gRPC API | grpc-expert | backend-dev | code-reviewer |
| Kafka/messaging | kafka-expert | backend-dev | code-reviewer |
| Prometheus/monitoring | prometheus-expert | devops | verifier |
| Distributed tracing | tracing-expert | devops | verifier |
| Data pipeline | data-pipeline-expert | backend-dev | code-reviewer |
| API versioning | api-versioning-expert | backend-dev | code-reviewer |
| Swift/iOS | swift-expert | frontend-dev | code-reviewer |
| Kotlin/Android | kotlin-expert | frontend-dev | code-reviewer |
| Build hatasi | build-error-resolver | devops | verifier |
| Python code review | python-reviewer | code-reviewer | verifier |
| Go code review | go-reviewer | code-reviewer | verifier |
| Go build hatasi | go-build-resolver | devops | verifier |
| Plan review | plan-reviewer | architect | code-reviewer |
| External repo arastirma | pathfinder | scout | code-reviewer |
| ML/Data pipeline | neuron | ai-engineer | code-reviewer |
| Mobile cross-platform | spectre | frontend-dev | code-reviewer |
| DB optimization | vault | database-reviewer | code-reviewer |
| Browser otomasyon | browser-agent | e2e-runner | verifier |
| Web crawling/scraping | harvest | oracle | code-reviewer |
| Config security audit | security-reviewer | config-validator | verifier |
| Performance optimization loop | nitro + experiment-loop | profiler | verifier |

## Arastirma & Analiz Assignment

| Task Kategorisi | Ana Agent | Yedek |
|----------------|-----------|-------|
| Codebase kesfetme | scout | Explore agent |
| Dis arastirma (web/docs) | oracle | WebSearch |
| Derin web crawling | harvest | oracle |
| Rekabet analizi | harvest | growth |
| Dokumantasyon crawl | harvest | oracle |
| Bug investigation | sleuth | scout |
| Mimari karar | architect | planner |
| Sprint planlama | project-manager | planner |
| Requirements | business-analyst | project-manager |
| Data analizi | data-analyst | backend-dev |
| UX/UI tasarim | designer | frontend-dev |
| Marka/copy | copywriter | technical-writer |
| Growth stratejisi | growth | project-manager |
| Guvenlik audit | security-analyst | security-reviewer |
| Context recovery | compass | scribe |
| Session handoff | compass | scribe |
| Teknik karar | tech-lead | architect |
| Performans analizi | nitro | profiler |
| Agent performans | psyche | reputation-engine |
| Session analizi | session-replay-analyzer | data-analyst |
| Tech stack degerlendirme | tech-radar | architect |
| Dependency analizi | dependency-graph-analyzer | dependency-tracker |

## Review Assignment

| Olay | Reviewer(lar) |
|------|---------------|
| Kod yazildi | code-reviewer |
| Auth/data kodu | code-reviewer + security-reviewer |
| DB migration | code-reviewer + database-reviewer |
| API endpoint | code-reviewer + security-reviewer |
| Frontend component | code-reviewer (+ designer opsiyonel) |
| Infra degisiklik | code-reviewer + devops |

## Escalation Zinciri

Task 3 kez QA'den gecemezse:

| Basarisiz Agent | Escalation |
|-----------------|------------|
| spark | kraken'e devret (TDD ile) |
| kraken | parcala → spark'lara dagit |
| frontend-dev | designer + frontend-dev birlikte |
| backend-dev | architect ile mimari review → tekrar |
| devops | backend-dev ile birlikte |
| migrator | devops + architect birlikte |
| coroner | sleuth + manual review |
| replay | sleuth + coroner birlikte |
| ddd-expert | architect escalation |
| cqrs-expert | architect escalation |
| clean-arch-expert | architect escalation |
| event-sourcing-expert | architect escalation |
| azure-expert | devops + architect |
| gcp-expert | devops + architect |
| i18n-expert | babel + frontend-dev |
| seo-specialist | web-perf-expert + frontend-dev |
| api-gateway-expert | nexus + backend-dev |
| service-mesh-expert | devops + architect |
| micro-frontend-expert | frontend-dev + architect |
| compliance-expert | security-analyst + security-reviewer |
| browser-agent | e2e-runner + manual browser testing |
| harvest | oracle + WebFetch manual extraction |

## Severity → Response Mapping

| Severity | Response Time | Agent Sayisi | Ornek |
|----------|--------------|-------------|-------|
| P0 Critical | HEMEN | 3-5 agent paralel | Production down, data loss |
| P1 High | < 1 saat | 2-3 agent | Major feature broken |
| P2 Medium | < 4 saat | 1-2 agent | Minor feature broken |
| P3 Low | Sonraki sprint | 1 agent | Kozmetik, typo |

## Hizir-Only Agent'lar (Orchestration & Specialist)

| Agent | Gercek Rolü | Tetikleyici |
|-------|-------------|-------------|
| nexus | API Gateway & Platform Engineer | API gateway tasarimi, microservice orchestration |
| sentinel | SRE / On-Call Operator | Incident response, monitoring, alerting |
| spectre | Mobile Dev (cross-platform) | React Native, Flutter, mobile app |
| babel | Localization & i18n Operator | Cok dilli uygulama, locale, RTL |
| psyche | Agent performance psychology | Agent basarisizlik analizi |
| commander | Engineering Manager | Ekip yonetimi, sprint planlama |
| neuron | ML/Data Engineer | Data pipeline, model training, MLOps |
| vault | DBA / Database Operator | DB optimization, migration, backup |
| nitro | Performance Engineer | Profiling, optimization, bottleneck |
| reputation-engine | Agent trust scoring | Agent guvenilirlik |
| swarm-optimizer | Swarm efficiency tuning | /swarm sonrasi analiz |
| tech-lead | Tech Leader | Teknik vizyon, mimari karar |
| cost-tracker | Token/resource cost tracking | Maliyet analizi |
| tech-radar | Technology evaluation | Tech stack kararlar |
| session-replay-analyzer | Session efficiency analysis | Session optimizasyonu |
| dependency-graph-analyzer | Dependency graph analysis | Dependency audit |

## Swarm Phase → Agent Mapping

```
Phase 1 (Kesif):       scout + project-manager + architect + harvest (dis arastirma)
                        (+ tech-lead, tech-radar gerekirse)
Phase 2 (Gelistirme):  backend-dev + frontend-dev + designer + devops
                        (+ ai-engineer, kraken, browser-agent gerekirse)
                        Specialist havuzu (task'a gore): azure-expert, gcp-expert,
                        graphql-expert, websocket-expert, redis-expert, kafka-expert,
                        ddd-expert, cqrs-expert, event-sourcing-expert, i18n-expert,
                        seo-specialist, web-perf-expert, micro-frontend-expert,
                        nexus, spectre, babel, neuron, vault, nitro, harvest
Phase 3 (Review):      code-reviewer + security-reviewer + qa-engineer + data-analyst
                        (+ compliance-expert, accessibility-auditor gerekirse)
                        (+ browser-agent deploy dogrulama gerekirse)
Phase 4 (Duzeltme):    spark/kraken + tdd-guide + verifier
Phase 5 (Final):       self-learner + technical-writer + growth
                        (+ session-replay-analyzer, reputation-engine)
```
