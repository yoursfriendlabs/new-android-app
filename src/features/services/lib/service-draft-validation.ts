import type { DraftServiceLine } from '@/src/types/forms';
import { atMost, nonNegativeNumber, positiveNumber, requiredText } from '@/src/shared/lib/validation';

export function serviceDraftLineErrors(line: DraftServiceLine) {
  return {
    product: line.itemType === 'part' && !line.product?.id ? 'Pick the product from stock.' : '',
    description: line.itemType === 'labor' ? requiredText(line.description, 'Say what was done on this line.') : '',
    quantity: positiveNumber(line.quantity, 'Enter a quantity greater than zero.'),
    unitPrice: nonNegativeNumber(line.unitPrice, 'A rate cannot be negative.'),
    taxRate: nonNegativeNumber(line.taxRate, 'A tax rate cannot be negative.') ||
      atMost(line.taxRate, 100, 'A tax rate cannot be over 100%.'),
    unitType: line.unitType === 'secondary' && !(Number(line.product?.secondaryConversionRate) > 0)
      ? 'This product has no conversion rate for its second unit.' : '',
  };
}
