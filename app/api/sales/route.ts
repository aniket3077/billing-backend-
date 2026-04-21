import { PaymentType } from '@prisma/client';
import { NextResponse } from 'next/server';

import { createSale } from '@/lib/services/billing';
import { HttpError, toErrorMessage } from '@/lib/services/http-error';

type SalesRequestBody = {
  customerId: string;
  paymentType: PaymentType;
  items: Array<{
    productId: string;
    batchId: string;
    quantity: number;
  }>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SalesRequestBody;

    if (!body.customerId || !body.paymentType || !Array.isArray(body.items)) {
      throw new HttpError(400, 'Invalid request payload.');
    }

    if (![PaymentType.cash, PaymentType.khata].includes(body.paymentType)) {
      throw new HttpError(400, 'Invalid paymentType.');
    }

    const sale = await createSale({
      customerId: body.customerId,
      paymentType: body.paymentType,
      items: body.items,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Sale created successfully.',
        data: {
          id: sale.id,
          customerId: sale.customerId,
          totalAmount: sale.totalAmount.toNumber(),
          paymentType: sale.paymentType,
          createdAt: sale.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
