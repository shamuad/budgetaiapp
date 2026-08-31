import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  amountCursorAfterMask,
  amountInputPlaceholder,
  formatAmountForInput,
  formatCurrency,
  localeNumberParts,
  maskAmountInput,
  resolveNumberLocale,
  resolveNumberLocaleFromDevice,
} from './money';

describe('resolveNumberLocale', () => {
  it('maps language codes to a single number locale each', () => {
    assert.equal(resolveNumberLocale('en'), 'en-US');
    assert.equal(resolveNumberLocale('nl'), 'nl-NL');
    assert.equal(resolveNumberLocale('tr'), 'tr-TR');
    assert.equal(resolveNumberLocale('es'), 'es-ES');
  });

  it('maps Amsterdam / NL to nl-NL so currency and grouping agree', () => {
    assert.equal(resolveNumberLocale('en-NL'), 'nl-NL');
    assert.equal(resolveNumberLocale('en-nl'), 'nl-NL');
    assert.equal(resolveNumberLocale('nl-NL'), 'nl-NL');
  });

  it('falls back to en-US', () => {
    assert.equal(resolveNumberLocale(undefined), 'en-US');
    assert.equal(resolveNumberLocale('xx'), 'en-US');
  });
});

describe('resolveNumberLocaleFromDevice', () => {
  it('lets Region Netherlands win over English (US) language', () => {
    assert.equal(
      resolveNumberLocaleFromDevice({ languageTag: 'en-US', languageCode: 'en', regionCode: 'NL' }),
      'nl-NL',
    );
  });
});

describe('localeNumberParts', () => {
  it('uses a comma group and a dot decimal for en-US', () => {
    assert.deepEqual(localeNumberParts('en-US'), {
      locale: 'en-US',
      group: ',',
      decimal: '.',
    });
  });

  it('uses a dot group and a comma decimal for nl-NL', () => {
    assert.deepEqual(localeNumberParts('nl-NL'), {
      locale: 'nl-NL',
      group: '.',
      decimal: ',',
    });
  });
});

describe('formatCurrency', () => {
  it('formats with grouping and two decimals', () => {
    assert.match(formatCurrency(6873.51, 'EUR', 'en-US'), /6,873\.51/);
    assert.match(formatCurrency(6873.51, 'EUR', 'nl-NL'), /6\.873,51/);
  });

  it('honours device separators even when the locale tag is en-US', () => {
    assert.match(
      formatCurrency(6234.55, 'EUR', 'en-US', { locale: 'en-US', group: '.', decimal: ',' }),
      /6\.234,55/,
    );
  });
});

describe('formatAmountForInput', () => {
  it('groups thousands and strips trailing zeros', () => {
    assert.equal(formatAmountForInput(1200, 'en-US'), '1,200');
    assert.equal(formatAmountForInput(1200.5, 'en-US'), '1,200.5');
    assert.equal(formatAmountForInput(1200, 'nl-NL'), '1.200');
    assert.equal(formatAmountForInput(1200.5, 'nl-NL'), '1.200,5');
  });
});

describe('maskAmountInput', () => {
  it('groups as each digit is typed in en-US', () => {
    assert.equal(maskAmountInput('1', 'en-US'), '1');
    assert.equal(maskAmountInput('12', 'en-US'), '12');
    assert.equal(maskAmountInput('120', 'en-US'), '120');
    assert.equal(maskAmountInput('1200', 'en-US'), '1,200');
    assert.equal(maskAmountInput('12000', 'en-US'), '12,000');
  });

  it('keeps a trailing decimal and two fraction digits', () => {
    assert.equal(maskAmountInput('1200.', 'en-US'), '1,200.');
    assert.equal(maskAmountInput('1200.5', 'en-US'), '1,200.5');
    assert.equal(maskAmountInput('1200.50', 'en-US'), '1,200.50');
    assert.equal(maskAmountInput('1200.501', 'en-US'), '1,200.50');
    assert.equal(maskAmountInput('1,200.', 'en-US'), '1,200.');
  });

  it('accepts a comma from a Dutch pad as the en-US decimal', () => {
    assert.equal(maskAmountInput('1200,', 'en-US'), '1,200.');
    assert.equal(maskAmountInput('1200,5', 'en-US'), '1,200.5');
  });

  it('does not treat a thousands comma as a decimal', () => {
    assert.equal(maskAmountInput('1,200', 'en-US'), '1,200');
  });

  it('groups and uses a comma decimal in nl-NL', () => {
    assert.equal(maskAmountInput('1200', 'nl-NL'), '1.200');
    assert.equal(maskAmountInput('1200,', 'nl-NL'), '1.200,');
    assert.equal(maskAmountInput('1200,50', 'nl-NL'), '1.200,50');
    assert.equal(maskAmountInput('1.200', 'nl-NL'), '1.200');
  });

  it('accepts a dot from a US pad as the nl-NL decimal', () => {
    assert.equal(maskAmountInput('1200.5', 'nl-NL'), '1.200,5');
  });

  it('rejects a second decimal marker', () => {
    assert.equal(maskAmountInput('1,200.50.', 'en-US'), '1,200.50');
    assert.equal(maskAmountInput('1.200,50,', 'nl-NL'), '1.200,50');
  });

  it('returns an empty string for a blank field', () => {
    assert.equal(maskAmountInput('', 'en-US'), '');
    assert.equal(maskAmountInput('abc', 'en-US'), '');
  });
});

describe('amountInputPlaceholder', () => {
  it('matches the locale decimal', () => {
    assert.equal(amountInputPlaceholder('en-US'), '0.00');
    assert.equal(amountInputPlaceholder('nl-NL'), '0,00');
  });
});

describe('amountCursorAfterMask', () => {
  it('stays after the last digit when grouping appears', () => {
    assert.equal(amountCursorAfterMask('120', '1200', '1,200', 3), 5);
  });

  it('moves past a just-typed decimal', () => {
    assert.equal(amountCursorAfterMask('1,200', '1,200.', '1,200.', 6), 6);
  });
});
