import { KhataType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { HttpError } from '@/lib/services/http-error';

export type CreateKhataPaymentInput = {
  customerId: string;
  amount: number;
  referenceId?: string;
};

const toCurrencyDecimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

export async function createKhataDebit(input: CreateKhataPaymentInput) {
  if (input.amount <= 0) {
    throw new HttpError(400, 'Amount must be greater than 0.');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true },
  });

  if (!customer) {
    throw new HttpError(404, 'Customer not found.');
  }

  return prisma.khataTransaction.create({
    data: {
      customerId: input.customerId,
      type: KhataType.debit,
      amount: toCurrencyDecimal(input.amount),
      referenceId: input.referenceId,
    },
  });
}

export async function getKhataSummary(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });

  if (!customer) {
    throw new HttpError(404, 'Customer not found.');
  }

  const grouped = await prisma.khataTransaction.groupBy({
    by: ['type'],
    where: { customerId },
    _sum: {
      amount: true,
    },
  });

  const totalCredit = grouped.find((x) => x.type === KhataType.credit)?._sum.amount ?? new Prisma.Decimal(0);
  const totalDebit = grouped.find((x) => x.type === KhataType.debit)?._sum.amount ?? new Prisma.Decimal(0);

  return {
    customerId,
    totalCredit: totalCredit.toNumber(),
    totalDebit: totalDebit.toNumber(),
    balance: totalCredit.sub(totalDebit).toNumber(),
  };
}
