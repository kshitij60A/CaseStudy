/**
 * Utility functions for pricing calculations on the backend.
 * Ensures that quotation totals and line amounts are strictly calculated/validated by backend.
 */

/**
 * Calculates line amount for an individual quotation item.
 * Base Amount = Quantity * Unit Price
 * After Discount = Base Amount * (1 - Discount / 100)
 * Line Amount = After Discount * (1 + GST / 100)
 */
function calculateLineAmount(quantity, unitPrice, discountPercent = 0, gstPercent = 18) {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const disc = Number(discountPercent) || 0;
  const gst = Number(gstPercent) || 0;

  const baseAmount = qty * price;
  const amountAfterDiscount = baseAmount * (1 - disc / 100);
  const lineAmount = amountAfterDiscount * (1 + gst / 100);

  return Math.round(lineAmount * 100) / 100;
}

/**
 * Calculates full quotation pricing structure including subtotal, GST total, and Grand Total.
 */
function calculateQuotationTotals(items, headerDiscountPercent = 0, defaultGstPercent = 18) {
  let computedSubtotal = 0;
  let computedGrandTotal = 0;

  const processedItems = items.map((item) => {
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const itemDiscount = item.discountPercent !== undefined ? Number(item.discountPercent) : Number(headerDiscountPercent);
    const itemGst = item.gstPercent !== undefined ? Number(item.gstPercent) : Number(defaultGstPercent);

    const lineAmount = calculateLineAmount(qty, unitPrice, itemDiscount, itemGst);
    const baseAmount = qty * unitPrice;

    computedSubtotal += baseAmount;
    computedGrandTotal += lineAmount;

    return {
      ...item,
      quantity: qty,
      unitPrice,
      discountPercent: itemDiscount,
      gstPercent: itemGst,
      lineAmount,
    };
  });

  return {
    subtotal: Math.round(computedSubtotal * 100) / 100,
    totalAmount: Math.round(computedGrandTotal * 100) / 100,
    items: processedItems,
  };
}

module.exports = {
  calculateLineAmount,
  calculateQuotationTotals,
};
