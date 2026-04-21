import { NextResponse } from 'next/server';

import { HttpError, toErrorMessage } from '@/lib/services/http-error';
import { createKhataDebit } from '@/lib/services/khata';

type PaymentRequestBody = {
  customerId: string;
  amount: number;
  referenceId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PaymentRequestBody;

    if (!body.customerId || typeof body.amount !== 'number') {
      throw new HttpError(400, 'Invalid request payload.');
    }

    const transaction = await createKhataDebit(body);

    return NextResponse.json(
      {
        success: true,
        message: 'Khata payment recorded successfully.',
        data: {
          id: transaction.id,
          customerId: transaction.customerId,
          type: transaction.type,
          amount: transaction.amount.toNumber(),
          referenceId: transaction.referenceId,
          createdAt: transaction.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ success: false, message: toErrorMessage(error) }, { status: 500 });
  }
}
