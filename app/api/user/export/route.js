import { GET as privacyExportGET } from '@/app/api/privacy/export/route';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return privacyExportGET(request);
}
