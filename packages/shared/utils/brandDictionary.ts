export type BrandEntry = {
  /** Display name for the matched institution. */
  name: string;
  /** Primary brand hex used as the card background. */
  color: string;
  /** Root domain passed to the favicon helper. */
  domain: string;
};

/**
 * Major retail banks mapped to brand colors and domains.
 * Keys are matched case-insensitively against account names (longest key wins).
 */
export const brandDictionary: Record<string, BrandEntry> = {
  'abn amro': { name: 'ABN AMRO', color: '#00A03C', domain: 'abnamro.nl' },
  'akbank': { name: 'Akbank', color: '#DC3020', domain: 'akbank.com' },
  'american express': { name: 'American Express', color: '#006FCF', domain: 'americanexpress.com' },
  'amex': { name: 'American Express', color: '#006FCF', domain: 'americanexpress.com' },
  'barclays': { name: 'Barclays', color: '#00AEEF', domain: 'barclays.com' },
  'bank of america': { name: 'Bank of America', color: '#E31837', domain: 'bankofamerica.com' },
  'bnp paribas': { name: 'BNP Paribas', color: '#00915A', domain: 'bnpparibas.com' },
  'bunq': { name: 'bunq', color: '#19A974', domain: 'bunq.com' },
  'capital one': { name: 'Capital One', color: '#004977', domain: 'capitalone.com' },
  'chase': { name: 'Chase', color: '#117ACA', domain: 'chase.com' },
  'citibank': { name: 'Citi', color: '#003B70', domain: 'citi.com' },
  'citi': { name: 'Citi', color: '#003B70', domain: 'citi.com' },
  'commerzbank': { name: 'Commerzbank', color: '#FFCC00', domain: 'commerzbank.de' },
  'credit agricole': { name: 'Crédit Agricole', color: '#009597', domain: 'credit-agricole.com' },
  'denizbank': { name: 'DenizBank', color: '#003DA5', domain: 'denizbank.com' },
  'deutsche bank': { name: 'Deutsche Bank', color: '#0018A8', domain: 'deutsche-bank.de' },
  'enpara': { name: 'Enpara.com', color: '#6E2C91', domain: 'enpara.com' },
  'finansbank': { name: 'QNB Finansbank', color: '#7B2D8E', domain: 'qnbfinansbank.com' },
  'garanti': { name: 'Garanti BBVA', color: '#00854A', domain: 'garantibbva.com.tr' },
  'halkbank': { name: 'Halkbank', color: '#0066B3', domain: 'halkbank.com.tr' },
  'hsbc': { name: 'HSBC', color: '#DB0011', domain: 'hsbc.com' },
  'ing': { name: 'ING', color: '#FF6200', domain: 'ing.com' },
  'isbank': { name: 'İş Bankası', color: '#003DA5', domain: 'isbank.com.tr' },
  'iş bank': { name: 'İş Bankası', color: '#003DA5', domain: 'isbank.com.tr' },
  'kuveyt turk': { name: 'Kuveyt Türk', color: '#006B54', domain: 'kuveytturk.com.tr' },
  'kuveytturk': { name: 'Kuveyt Türk', color: '#006B54', domain: 'kuveytturk.com.tr' },
  'lloyds': { name: 'Lloyds Bank', color: '#006A4D', domain: 'lloydsbank.com' },
  'monzo': { name: 'Monzo', color: '#14233C', domain: 'monzo.com' },
  'n26': { name: 'N26', color: '#36A18B', domain: 'n26.com' },
  'natwest': { name: 'NatWest', color: '#5A287D', domain: 'natwest.com' },
  'papara': { name: 'Papara', color: '#000000', domain: 'papara.com' },
  'paypal': { name: 'PayPal', color: '#003087', domain: 'paypal.com' },
  'qnb finansbank': { name: 'QNB Finansbank', color: '#7B2D8E', domain: 'qnbfinansbank.com' },
  'qnb': { name: 'QNB Finansbank', color: '#7B2D8E', domain: 'qnbfinansbank.com' },
  'rabobank': { name: 'Rabobank', color: '#FF6600', domain: 'rabobank.nl' },
  'revolut': { name: 'Revolut', color: '#191C1F', domain: 'revolut.com' },
  'santander': { name: 'Santander', color: '#EC0000', domain: 'santander.com' },
  'starling': { name: 'Starling Bank', color: '#6935D3', domain: 'starlingbank.com' },
  'teb': { name: 'TEB', color: '#006B3F', domain: 'teb.com.tr' },
  'td bank': { name: 'TD Bank', color: '#34A853', domain: 'td.com' },
  'vakifbank': { name: 'VakıfBank', color: '#FFB800', domain: 'vakifbank.com.tr' },
  'vakıfbank': { name: 'VakıfBank', color: '#FFB800', domain: 'vakifbank.com.tr' },
  'wells fargo': { name: 'Wells Fargo', color: '#D71E28', domain: 'wellsfargo.com' },
  'wise': { name: 'Wise', color: '#163300', domain: 'wise.com' },
  'yapı kredi': { name: 'Yapı Kredi', color: '#004990', domain: 'yapikredi.com.tr' },
  'yapikredi': { name: 'Yapı Kredi', color: '#004990', domain: 'yapikredi.com.tr' },
  'ziraat': { name: 'Ziraat Bankası', color: '#C8102E', domain: 'ziraatbank.com.tr' },
};

const sortedKeys = Object.keys(brandDictionary).sort((a, b) => b.length - a.length);

/** Finds a bank brand from a free-form account name such as "ING Credit Card". */
export function resolveBrand(accountName: string): BrandEntry | null {
  const normalized = accountName.toLowerCase();

  for (const key of sortedKeys) {
    if (normalized.includes(key)) {
      return brandDictionary[key];
    }
  }

  return null;
}
