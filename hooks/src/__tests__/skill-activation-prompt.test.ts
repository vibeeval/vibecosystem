import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildSync } from 'esbuild';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

describe('skill-activation-prompt project script opt-in', () => {
  let bundles: string;
  let fixture: string;
  let home: string;
  let project: string;
  let marker: string;
  let uvMarker: string;
  let bin: string;

  beforeAll(() => {
    bundles = mkdtempSync(join(tmpdir(), 'skill-activation-bundles-'));
    buildSync({
      entryPoints: [fileURLToPath(new URL('../skill-activation-prompt.ts', import.meta.url))],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outdir: bundles,
      outExtension: { '.js': '.mjs' },
      logLevel: 'silent',
    });
  });

  afterAll(() => rmSync(bundles, { recursive: true, force: true }));

  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'skill-activation-fixture-'));
    home = join(fixture, 'home');
    project = join(fixture, 'project');
    bin = join(fixture, 'bin');
    marker = join(fixture, 'pattern-inference-ran');
    uvMarker = join(fixture, 'uv-invoked');
    mkdirSync(home);
    mkdirSync(project);
    mkdirSync(bin);
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude', 'vibecosystem-runtime.json'), JSON.stringify({
      activeProfile: 'full',
    }));

    mkdirSync(join(project, '.claude', 'skills'), { recursive: true });
    writeFileSync(join(project, '.claude', 'skills', 'skill-rules.json'), JSON.stringify({
      version: '1',
      skills: {
        'fixture-skill': {
          type: 'domain',
          enforcement: 'suggest',
          priority: 'high',
          promptTriggers: { keywords: ['agentica-fixture-skill'] },
          description: 'Isolated fixture skill',
        },
      },
    }));

    mkdirSync(join(project, 'scripts', 'agentica_patterns'), { recursive: true });
    writeFileSync(join(project, 'scripts', 'agentica_patterns', 'pattern_inference.py'), [
      'from pathlib import Path',
      `Path(${JSON.stringify(marker)}).write_text('ran', encoding='utf-8')`,
      '',
      'class Result:',
      '    def to_dict(self):',
      '        return {',
      "            'pattern': 'swarm',",
      "            'confidence': 0.91,",
      "            'signals': ['fixture'],",
      "            'needs_clarification': False,",
      "            'clarification_probe': None,",
      "            'ambiguity_type': None,",
      "            'alternatives': [],",
      "            'work_breakdown': 'split the work',",
      '        }',
      '',
      'def infer_pattern(prompt):',
      '    return Result()',
      '',
      'def generate_work_breakdown(result):',
      "    return 'detailed swarm breakdown'",
      '',
    ].join('\n'));

    writeFileSync(join(bin, 'uv'), [
      '#!/bin/sh',
      `/bin/touch ${JSON.stringify(uvMarker)}`,
      'if [ "$1" = "run" ] && [ "$2" = "python" ] && [ "$3" = "-c" ]; then',
      '  exec /usr/bin/python3 -c "$4"',
      'fi',
      'exit 0',
      '',
    ].join('\n'));
    chmodSync(join(bin, 'uv'), 0o755);
  });

  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  function writeSkillRules(root: string, skills: Record<string, unknown>) {
    mkdirSync(join(root, '.claude', 'skills'), { recursive: true });
    writeFileSync(join(root, '.claude', 'skills', 'skill-rules.json'), JSON.stringify({
      version: '1',
      skills,
    }));
  }

  function runHook(env: Record<string, string> = {}, prompt = 'Please activate agentica-fixture-skill for this request') {
    const result = spawnSync(process.execPath, [join(bundles, 'skill-activation-prompt.mjs')], {
      input: JSON.stringify({
        session_id: 'isolated-skill-activation',
        cwd: project,
        permission_mode: 'default',
        prompt,
      }),
      cwd: project,
      env: {
        HOME: home,
        PATH: bin,
        CLAUDE_PROJECT_DIR: project,
        ...env,
      },
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    return result;
  }

  it('skips project-local pattern_inference.py without VIBECO_ALLOW_PROJECT_SCRIPTS=1', () => {
    const result = runHook();
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(uvMarker)).toBe(false);
    expect(result.stdout).toContain('SKILL ACTIVATION CHECK');
    expect(result.stdout).toContain('fixture-skill');
    expect(result.stdout).not.toContain('AGENTICA PATTERN INFERENCE');
  });

  it('runs project-local pattern_inference.py when VIBECO_ALLOW_PROJECT_SCRIPTS=1', () => {
    const result = runHook({ VIBECO_ALLOW_PROJECT_SCRIPTS: '1' });
    expect(existsSync(uvMarker)).toBe(true);
    expect(existsSync(marker)).toBe(true);
    expect(result.stdout).toContain('SKILL ACTIVATION CHECK');
    expect(result.stdout).toContain('fixture-skill');
    expect(result.stdout).toContain('AGENTICA PATTERN INFERENCE');
    expect(result.stdout).toContain('detailed swarm breakdown');
  });

  it('keeps the global skill-rules.json entry when a project rule uses the same name', () => {
    writeSkillRules(home, {
      'shared-skill': {
        type: 'guardrail',
        enforcement: 'suggest',
        priority: 'high',
        promptTriggers: { keywords: ['global-shared-kw'] },
        description: 'GLOBAL_RULE_CONTENT',
      },
    });
    writeSkillRules(project, {
      'shared-skill': {
        type: 'domain',
        enforcement: 'block',
        priority: 'low',
        promptTriggers: { keywords: ['project-override-kw'] },
        description: 'PROJECT_OVERRIDE_CONTENT',
      },
    });

    const globalHit = runHook({}, 'Please use global-shared-kw in this request');
    expect(globalHit.stdout).toContain('SKILL ACTIVATION CHECK');
    expect(globalHit.stdout).toContain('shared-skill');
    expect(globalHit.stdout).not.toContain('BLOCKING');
    expect(globalHit.stdout).not.toContain('PROJECT_OVERRIDE_CONTENT');

    const projectHit = runHook({}, 'Please use project-override-kw in this request');
    expect(projectHit.stdout).not.toContain('shared-skill');
    expect(projectHit.stdout).not.toContain('BLOCKING');
    expect(projectHit.stdout).not.toContain('PROJECT_OVERRIDE_CONTENT');
  });

  it('loads a project-only skill-rules.json entry that does not exist globally', () => {
    writeSkillRules(project, {
      'project-only-skill': {
        type: 'domain',
        enforcement: 'suggest',
        priority: 'high',
        promptTriggers: { keywords: ['project-only-kw'] },
        description: 'PROJECT_ONLY_CONTENT',
      },
    });

    const result = runHook({}, 'Please use project-only-kw in this request');
    expect(result.stdout).toContain('SKILL ACTIVATION CHECK');
    expect(result.stdout).toContain('project-only-skill');
    expect(result.stdout).not.toContain('fixture-skill');
  });

  it('keeps disjoint project and global skill-rules.json entries when names do not conflict', () => {
    writeSkillRules(home, {
      'global-union-skill': {
        type: 'domain',
        enforcement: 'suggest',
        priority: 'high',
        promptTriggers: { keywords: ['global-union-kw'] },
        description: 'GLOBAL_UNION_CONTENT',
      },
    });
    writeSkillRules(project, {
      'project-union-skill': {
        type: 'domain',
        enforcement: 'suggest',
        priority: 'high',
        promptTriggers: { keywords: ['project-union-kw'] },
        description: 'PROJECT_UNION_CONTENT',
      },
    });

    const result = runHook({}, 'Please use global-union-kw and project-union-kw in this request');
    expect(result.stdout).toContain('SKILL ACTIVATION CHECK');
    expect(result.stdout).toContain('global-union-skill');
    expect(result.stdout).toContain('project-union-skill');
  });
});
