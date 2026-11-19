/** Badge color for a stock quantity: in stock vs. none on hand. */
export function stockColor(quantity: number): 'green' | 'red' {
  return quantity > 0 ? 'green' : 'red';
}
