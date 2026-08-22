import { GET as rootCallbackGET } from '@/app/auth/callback/route';

export async function GET(request) {
  return rootCallbackGET(request);
}
