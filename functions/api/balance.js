export async function onRequest(context) {
  const { request } = context;
  const auth = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  try {
    const r = await fetch('https://api.deepseek.com/user/balance', {
      headers: { 'Authorization': auth },
      cf: { cacheTtl: 0 }
    });
    const text = await r.text();
    // passthrough status and body, add CORS
    return new Response(text, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  });
}
