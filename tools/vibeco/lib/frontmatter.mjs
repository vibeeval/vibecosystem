/**
 * Shared frontmatter parsing for vibeco CLI and hook tests.
 * Single source of truth - vibeco.mjs imports this, hooks/src/__tests__
 * test this exact implementation (not a copy).
 */

/**
 * Parses YAML-style frontmatter from a markdown string.
 * Expects content delimited by --- markers at the start.
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseFrontmatter(content) {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      fm[key] = val;
    }
  }
  return fm;
}
