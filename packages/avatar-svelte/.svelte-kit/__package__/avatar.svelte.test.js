import { toSvg } from '@awflow/avatar/adapter';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { Avatar } from './index';
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const canon = (el) => {
    const attrs = Array.from(el.attributes)
        .map((a) => `${a.name}=${a.value}`)
        .sort()
        .join(' ');
    const kids = Array.from(el.children).map(canon).join('');
    return `<${el.tagName} ${attrs}>${kids}</${el.tagName}>`;
};
const tree = (svg) => canon(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement);
const CASES = [
    { name: 'Ada Lovelace', opts: { expression: 'happy' } },
    {
        name: 'Linh',
        opts: { expression: 'sad', frame: 'bone' },
    },
    {
        name: 'Doan Labs',
        opts: {
            expression: 'surprised',
            eyewear: 'glasses',
            headwear: 'sprout',
            neckwear: 'tie',
            size: 300,
        },
    },
    { name: '東京', opts: { expression: 'curious', square: false } },
];
describe('SSR parity with toSvg', () => {
    for (const { name, opts } of CASES) {
        test(`${name} ${JSON.stringify(opts)}`, () => {
            const out = render(Avatar, { props: { name, ...opts } });
            const svelte = tree(strip(out.body));
            const svg = tree(toSvg(name, opts));
            expect(svelte).toBe(svg);
        });
    }
    test('render is stable across calls', () => {
        const a = render(Avatar, { props: { name: 'Ada', expression: 'happy' } });
        const b = render(Avatar, { props: { name: 'Ada', expression: 'happy' } });
        expect(a.body).toBe(b.body);
    });
    test('carries the accessible name and known geometry', () => {
        const out = render(Avatar, {
            props: { name: 'Linh', neckwear: 'tie', size: 300 },
        });
        expect(out.body).toContain('aria-label="Linh"');
        expect(out.body).toContain('M-4 15L-13 63');
    });
});
