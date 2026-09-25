import { describe, expect, it } from 'vitest';
import { detectLang, en, es, fill } from './strings';

const leaves = (o: object, prefix = ''): [string, unknown][] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

describe('strings', () => {
  it('have the same keys and no empty text in both languages', () => {
    const esLeaves = leaves(es);
    const enLeaves = leaves(en);
    expect(enLeaves.map(([k]) => k)).toEqual(esLeaves.map(([k]) => k));
    for (const [, v] of [...esLeaves, ...enLeaves]) expect(String(v).trim()).not.toBe('');
  });

  it('use the same placeholders in both languages', () => {
    const holes = (s: unknown) => (String(s).match(/\{\w+\}/g) ?? []).sort().join();
    const enMap = new Map(leaves(en));
    for (const [k, v] of leaves(es)) expect(holes(enMap.get(k))).toBe(holes(v));
  });
});

describe('fill', () => {
  it('replaces placeholders and keeps unknown ones', () => {
    expect(fill('{a} de {b} {c}', { a: 1, b: 'x' })).toBe('1 de x {c}');
  });
});

describe('detectLang', () => {
  it('picks the first supported language', () => {
    expect(detectLang(['fr-FR', 'en-GB', 'es'])).toBe('en');
    expect(detectLang(['es-ES'])).toBe('es');
    expect(detectLang(['de'])).toBe('es');
  });
});
