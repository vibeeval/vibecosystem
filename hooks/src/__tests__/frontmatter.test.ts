/**
 * Tests for frontmatter parsing logic.
 *
 * Imports the REAL parseFrontmatter implementation shared with the vibeco
 * CLI (tools/vibeco/lib/frontmatter.mjs) - not a copy.
 */
import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../../tools/vibeco/lib/frontmatter.mjs';

describe('parseFrontmatter', () => {
  it('reads CRLF metadata used by shipped agents and accepts a UTF-8 BOM', () => {
    const source = '\uFEFF---\r\nname: architect\r\ndescription: Windows line endings\r\n---\r\nBody';
    expect(parseFrontmatter(source)).toEqual({ name: 'architect', description: 'Windows line endings' });
  });

  it('requires a complete closing delimiter line', () => {
    expect(parseFrontmatter('---\nname: invalid\n---suffix\nBody')).toEqual({});
  });

  it('parses valid frontmatter with name and description', () => {
    const content = [
      '---',
      'name: my-skill',
      'description: A useful skill',
      '---',
      '',
      '# Content here',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      name: 'my-skill',
      description: 'A useful skill',
    });
  });

  it('returns empty object for empty content', () => {
    expect(parseFrontmatter('')).toEqual({});
  });

  it('returns empty object when no frontmatter delimiters', () => {
    const content = '# Just a heading\nSome text.\n';
    expect(parseFrontmatter(content)).toEqual({});
  });

  it('handles double-quoted values', () => {
    const content = [
      '---',
      'name: "quoted-name"',
      'description: "A description with spaces"',
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result.name).toBe('quoted-name');
    expect(result.description).toBe('A description with spaces');
  });

  it('handles single-quoted values', () => {
    const content = [
      '---',
      "name: 'single-quoted'",
      "type: 'feedback'",
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result.name).toBe('single-quoted');
    expect(result.type).toBe('feedback');
  });

  it('parses multiple fields correctly', () => {
    const content = [
      '---',
      'name: test-memory',
      'description: This is a test',
      'type: project',
      'priority: high',
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      name: 'test-memory',
      description: 'This is a test',
      type: 'project',
      priority: 'high',
    });
  });

  it('handles values with colons in them', () => {
    const content = [
      '---',
      'description: time is 10:30:00 today',
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    // The parser splits on first colon only
    expect(result.description).toBe('time is 10:30:00 today');
  });

  it('ignores lines without colons', () => {
    const content = [
      '---',
      'name: valid-entry',
      'this line has no colon',
      'type: user',
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      name: 'valid-entry',
      type: 'user',
    });
  });

  it('trims whitespace around keys and values', () => {
    const content = [
      '---',
      '  name  :   spaced-out  ',
      '  type  :   feedback  ',
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result.name).toBe('spaced-out');
    expect(result.type).toBe('feedback');
  });

  it('handles frontmatter followed by content', () => {
    const content = [
      '---',
      'name: doc',
      '---',
      '',
      'This is the body.',
      'It has multiple lines.',
      '',
      '## Section',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result).toEqual({ name: 'doc' });
  });

  it('returns empty object when only opening delimiter exists', () => {
    const content = '---\nname: incomplete\n';
    expect(parseFrontmatter(content)).toEqual({});
  });

  it('handles empty frontmatter block', () => {
    const content = '---\n\n---\nBody text';
    // The regex requires at least one char between delimiters
    // An empty line between --- matches as \n which is captured
    const result = parseFrontmatter(content);
    // Empty line has no colon, so no entries
    expect(result).toEqual({});
  });

  it('does not strip quotes from values that are only partially quoted', () => {
    const content = [
      '---',
      'name: "half-quoted',
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    // startsWith " but does not endsWith " -- no stripping
    expect(result.name).toBe('"half-quoted');
  });

  it('handles empty value after colon', () => {
    const content = [
      '---',
      'name: ',
      '---',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result.name).toBe('');
  });
});
