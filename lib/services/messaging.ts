export type SaleNotificationPayload = {
  customerId: string;
  saleId: string;
  totalAmount: number;
};

export async function sendWhatsApp(payload: SaleNotificationPayload): Promise<void> {
  // Mock hook: replace with real WhatsApp provider integration.
  console.info('[Messaging] sendWhatsApp called', payload);
}
