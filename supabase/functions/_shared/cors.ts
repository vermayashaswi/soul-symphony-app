
export const cors = (req: Request, res: Response): Response => {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
