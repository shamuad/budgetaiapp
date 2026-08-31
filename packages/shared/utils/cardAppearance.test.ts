import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getAccountCardColor,
  gradientMatchesPreset,
  parseCustomColor,
  PREMIUM_CARD_GRADIENTS,
  resolveAccountCardAppearance,
  serializeFlatColor,
  serializeGradient,
} from './cardAppearance';

describe('parseCustomColor', () => {
  it('parses flat hex with or without hash', () => {
    assert.deepEqual(parseCustomColor('#4338CA'), { kind: 'flat', color: '#4338CA' });
    assert.deepEqual(parseCustomColor('4338ca'), { kind: 'flat', color: '#4338CA' });
  });

  it('parses JSON gradient payloads', () => {
    const json = '{"gradient":["#2D3748","#718096","#CBD5E0"],"angle":145}';
    assert.deepEqual(parseCustomColor(json), {
      kind: 'gradient',
      colors: ['#2D3748', '#718096', '#CBD5E0'],
      angle: 145,
    });
  });

  it('returns null for empty or invalid values', () => {
    assert.equal(parseCustomColor(null), null);
    assert.equal(parseCustomColor(''), null);
    assert.equal(parseCustomColor('not-json'), null);
    assert.equal(parseCustomColor('{"gradient":[]}'), null);
  });
});

describe('serialize helpers', () => {
  it('round-trips flat colors', () => {
    const serialized = serializeFlatColor('#AABBCC');
    assert.equal(serialized, '#AABBCC');
    assert.deepEqual(parseCustomColor(serialized), { kind: 'flat', color: '#AABBCC' });
  });

  it('round-trips gradient presets', () => {
    const preset = PREMIUM_CARD_GRADIENTS[0];
    const serialized = serializeGradient(preset);
    assert.ok(serialized);
    const parsed = parseCustomColor(serialized);
    assert.ok(parsed && parsed.kind === 'gradient');
    assert.ok(gradientMatchesPreset(parsed, preset));
  });
});

describe('resolveAccountCardAppearance', () => {
  it('prefers custom gradient over brand color', () => {
    const json = serializeGradient(PREMIUM_CARD_GRADIENTS[1])!;
    const appearance = resolveAccountCardAppearance({
      name: 'Garanti',
      type: 'card',
      custom_color: json,
    });

    assert.equal(appearance.kind, 'gradient');
  });

  it('falls back to type color when custom is invalid', () => {
    const appearance = resolveAccountCardAppearance({
      name: 'Unknown Bank',
      type: 'cash',
      custom_color: '{bad',
    });

    assert.deepEqual(appearance, { kind: 'flat', color: '#047857' });
  });
});

describe('getAccountCardColor', () => {
  it('returns the first gradient stop for logo tint', () => {
    const json = serializeGradient(PREMIUM_CARD_GRADIENTS[2])!;
    assert.equal(
      getAccountCardColor({ name: 'Card', type: 'card', custom_color: json }),
      '#0A0A0A',
    );
  });
});
