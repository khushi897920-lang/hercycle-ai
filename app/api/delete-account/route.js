import { POST as privacyDeletePOST } from '@/app/api/privacy/delete/route';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  return privacyDeletePOST(request);
}

export async function DELETE(request) {
  return privacyDeletePOST(request);
}
