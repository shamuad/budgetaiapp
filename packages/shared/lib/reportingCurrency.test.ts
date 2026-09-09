import assert from 'node:assert/strict';
import test from 'node:test';

import { toReportingAmount } from './reportingCurrency';

test('converts canonical aggregates with the persisted reporting rate', () => {
  assert.equal(toReportingAmount(100, 35.5), 3550);
  assert.equal(toReportingAmount(-12.5, 0.85), -10.625);
});

test('keeps EUR aggregates unchanged when the reporting rate is one', () => {
  assert.equal(toReportingAmount(9430.55, 1), 9430.55);
});
