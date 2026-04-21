import { PaymentType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { HttpError } from '@/lib/services/http-error';
import { sendWhatsApp } from '@/lib/services/messaging';

export type SaleInputItem = {
  productId: string;
  batchId: string;
  quantity: number;
};

export type CreateSaleInput = {
  customerId: string;
  paymentType: PaymentType;
  items: SaleInputItem[];
};

const toCurrencyDecimal = (value: number) =>
  new Prisma.Decimal(value.toFixed(2));

export async function createSale(input: CreateSaleInput) {
  if (!input.items.length) {
    throw new HttpError(400, 'At least one sale item is required.');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true },
  });

  if (!customer) {
    throw new HttpError(404, 'Customer not found.');
  }

  const sale = await prisma.$transaction(async (tx) => {
    const preparedItems: Array<{
      productId: string;
      batchId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    let totalAmount = new Prisma.Decimal(0);

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new HttpError(400, `Invalid quantity for batch ${item.batchId}.`);
      }

      const batch = await tx.batch.findUnique({
        where: { id: item.batchId },
        include: {
          product: {
            select: {
              id: true,
              price: true,
            },
          },
        },
      });

      if (!batch || batch.productId !== item.productId) {
        throw new HttpError(404, `Batch ${item.batchId} does not exist for product ${item.productId}.`);
      }

      if (batch.expiryDate < new Date()) {
        throw new HttpError(400, `Batch ${batch.batchNumber} is expired and cannot be sold.`);
      }

      if (batch.quantity < item.quantity) {
        throw new HttpError(409, `Insufficient stock for batch ${batch.batchNumber}.`);
      }

      const lineTotal = batch.product.price.mul(item.quantity);
      totalAmount = totalAmount.add(lineTotal);

      preparedItems.push({
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity,
        unitPrice: batch.product.price,
        lineTotal,
      });
    }

    const createdSale = await tx.sale.create({
      data: {
        customerId: input.customerId,
        paymentType: input.paymentType,
        totalAmount: toCurrencyDecimal(totalAmount.toNumber()),
      },
    });

    await tx.saleItem.createMany({
      data: preparedItems.map((item) => ({
        saleId: createdSale.id,
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
    });

    for (const item of preparedItems) {
      const updateResult = await tx.batch.updateMany({
        where: {
          id: item.batchId,
          quantity: { gte: item.quantity },
        },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });

      if (updateResult.count !== 1) {
        throw new HttpError(409, `Stock changed during checkout for batch ${item.batchId}. Please retry.`);
      }
    }

    if (input.paymentType === PaymentType.khata) {
      await tx.khataTransaction.create({
        data: {
          customerId: input.customerId,
          type: 'credit',
          amount: toCurrencyDecimal(totalAmount.toNumber()),
          referenceId: createdSale.id,
        },
      });
    }

    return createdSale;
  });

  await sendWhatsApp({
    customerId: sale.customerId,
    saleId: sale.id,
    totalAmount: sale.totalAmount.toNumber(),
  });

  return sale;
}
