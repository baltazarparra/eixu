import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

const { themeVars } = await loadModule('lib/blocks/theme.ts');
const { contrastRatio, readableHighlight } = await loadModule(
  'lib/blocks/contrast.ts',
);

await test('destaque tem contraste AA em todos os tons sem trocar o fundo do botão', () => {
  for (const highlight of [
    '#ffffff',
    '#000000',
    '#777777',
    '#ffff00',
    '#c45c26',
    '#1f6feb',
  ]) {
    for (const paper of ['#ffffff', '#14161a']) {
      const vars = themeVars({
        highlight,
        paper,
        ink: paper === '#ffffff' ? '#14161a' : '#ffffff',
        accent: '#112233',
        accentAlt: '#445566',
        surface: '#aabbcc',
      });
      for (const [tone, background] of Object.entries({
        paper: '--brand-paper',
        soft: '--surface',
        services: '--services-surface',
        ink: '--brand-ink',
        accent: '--accent',
        'accent-2': '--accent-2',
      }))
        assert.ok(
          contrastRatio(vars[`--highlight-text-${tone}`], vars[background]) >=
            4.5,
          `${highlight}/${paper}/${tone}`,
        );
      assert.ok(
        contrastRatio(vars['--highlight'], vars['--highlight-ink']) >= 4.5,
      );
      if (highlight === '#ffffff') assert.equal(vars['--highlight'], highlight);
    }
  }
  assert.equal(readableHighlight('#112233', '#ffffff'), '#112233');
});

await test('cliente sem highlight usa a primária e também ganha texto legível', () => {
  const vars = themeVars({ accent: '#ffffff', paper: '#ffffff' });
  assert.equal(vars['--highlight'], vars['--accent']);
  assert.ok(contrastRatio(vars['--highlight-text'], vars['--paper']) >= 4.5);
});
