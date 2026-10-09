import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  let input: { pin?: unknown };
  try {
    input = await request.json();
  } catch (error) {
    console.warn('PIN verification request body could not be parsed.', error);
    return jsonResponse({ error: 'Send a JSON body containing a 6-digit PIN code.' }, 400);
  }

  const pin = typeof input.pin === 'string' ? input.pin.trim() : '';
  if (!/^\d{6}$/.test(pin)) return jsonResponse({ error: 'Enter a valid 6-digit PIN code.' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase Edge Function is missing its required server environment.');
    return jsonResponse({ error: 'PIN verification is not configured.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip');
  if (!clientIp) {
    console.error('Request gateway did not provide an IP for PIN lookup rate limiting.');
    return jsonResponse({ error: 'PIN verification is temporarily unavailable.' }, 503);
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientIp));
  const ipHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const { data: withinLimit, error: rateLimitError } = await supabase.rpc('consume_kerala_pin_lookup', { ip_digest: ipHash });
  if (rateLimitError) {
    console.error('Could not apply Kerala PIN lookup rate limit.', rateLimitError);
    return jsonResponse({ error: 'PIN verification is temporarily unavailable.' }, 503);
  }
  if (!withinLimit) return jsonResponse({ error: 'Too many PIN lookups. Please wait 15 minutes and try again.' }, 429);

  const { data: cached, error: cacheError } = await supabase
    .from('kerala_pincodes')
    .select('districts, post_offices, verified_at')
    .eq('pin_code', pin)
    .maybeSingle();

  if (cacheError) {
    console.error('Could not read the verified Kerala PIN cache.', cacheError);
    return jsonResponse({ error: 'PIN verification is temporarily unavailable.' }, 503);
  }

  if (cached && Date.now() - new Date(cached.verified_at).getTime() < 30 * 24 * 60 * 60 * 1000) {
    const offices = Array.isArray(cached.post_offices) ? cached.post_offices : [];
    return jsonResponse({
      valid: true,
      pin,
      districts: cached.districts,
      localities: [...new Set([...cached.districts, ...offices.map((office: { name?: string }) => office.name).filter(Boolean)])],
    });
  }

  let response: Response;
  try {
    response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  } catch (error) {
    console.error('Third-party postal PIN lookup could not be reached.', error);
    return jsonResponse({ error: 'The postal lookup service could not be reached. Try again shortly.' }, 502);
  }

  if (!response.ok) return jsonResponse({ error: `Postal lookup returned HTTP ${response.status}. Try again shortly.` }, 502);

  let results: Array<{ Status?: string; PostOffice?: Array<Record<string, unknown>> }>;
  try {
    results = await response.json();
  } catch (error) {
    console.error('Third-party postal PIN lookup returned invalid JSON.', error);
    return jsonResponse({ error: 'The postal lookup returned an invalid response.' }, 502);
  }

  const offices = results?.[0]?.PostOffice;
  const keralaOffices = Array.isArray(offices)
    ? offices.filter((office) => typeof office.State === 'string' && office.State.trim().toLowerCase() === 'kerala')
    : [];

  if (keralaOffices.length === 0) {
    return jsonResponse({ valid: false, error: 'That PIN code was not found in Kerala. Please check the PIN and try again.' });
  }

  const districts = [...new Set(keralaOffices.map((office) => office.District).filter((district): district is string => typeof district === 'string' && district.trim().length > 0).map((district) => district.trim()))];
  const postOffices = keralaOffices.map((office) => ({
    name: typeof office.Name === 'string' ? office.Name.trim() : '',
    branch_type: typeof office.BranchType === 'string' ? office.BranchType : null,
    delivery_status: typeof office.DeliveryStatus === 'string' ? office.DeliveryStatus : null,
  })).filter((office) => office.name);

  const { error: saveError } = await supabase.from('kerala_pincodes').upsert({
    pin_code: pin,
    districts,
    post_offices: postOffices,
    source: 'api.postalpincode.in',
    verified_at: new Date().toISOString(),
  });

  if (saveError) {
    console.error('Could not cache verified Kerala PIN data.', saveError);
    return jsonResponse({ error: 'PIN was verified but could not be saved. Please try again.' }, 503);
  }

  return jsonResponse({
    valid: true,
    pin,
    districts,
    localities: [...new Set([...districts, ...postOffices.map((office) => office.name)])],
  });
});
