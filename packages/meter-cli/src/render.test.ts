import { describe, expect, it } from 'vitest';
import { parseToolResult, renderToolResult } from './render.ts';

const io = { color: false };

describe('render', () => {
  it('parses text-only results and keeps the Next hint', () => {
    const parsed = parseToolResult({
      content: [
        { type: 'text', text: '{"a":1,"b":{"c":"x"}}\n\nNext: do the thing.' }
      ]
    });
    expect(parsed.data).toEqual({ a: 1, b: { c: 'x' } });
    expect(parsed.nextSteps).toBe('do the thing.');
    expect(renderToolResult(parsed, io)).toBe(
      'a    1\nb.c  x\nNext: do the thing.'
    );
  });

  it('renders item pages as tables with a footer', () => {
    const page = {
      items: [
        { id: 'a', amount_minor: 100, paid: true },
        { id: 'b', amount_minor: null, paid: false }
      ],
      next_cursor: 'n1',
      total_count: 2
    };
    const rendered = renderToolResult(
      parseToolResult({ content: [], structuredContent: page }),
      io
    );
    expect(rendered.split('\n')[0]).toBe('id  amount_minor  paid');
    expect(rendered).toMatch(/^a   100 {11}yes$/m);
    expect(rendered).toMatch(/^b   — {13}no$/m);
    expect(rendered).toMatch(
      /2 items · total_count: 2 · more: pass --cursor n1/
    );
  });
});
