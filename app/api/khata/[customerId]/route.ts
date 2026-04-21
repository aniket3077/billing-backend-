import { NextResponse } from 'next/server';

import { HttpError, toErrorMessage } from '@/lib/services/http-error';
import { getKhataSummary } from '@/lib/services/khata';

type Params = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { customerId } = await params;

    if (!customerId) {
      throw new HttpError(400, 'customerId is required.');
    }

    const summary = await getKhataSummary(customerId);

    return NextResponse.json({ success: true, data: summary }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ success: false, message: toErrorMessage(error) }, { status: 500 });
  }
}
