/** Converts a canonical EUR aggregate into the user's reporting currency. */
export function toReportingAmount(baseAmount: number, reportingExchangeRate: number) {
  return baseAmount * reportingExchangeRate;
}
