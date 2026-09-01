export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { code, secret } = body;

    const mySecret = context.env.MIRPANEL_SECRET || "mirpanel_gizli_shifre";
    
    if (secret !== mySecret) {
      return new Response(JSON.stringify({ error: "İcazəsiz giriş" }), { status: 401 });
    }

    if (!code) {
      return new Response(JSON.stringify({ error: "Kod tapılmadı" }), { status: 400 });
    }

    const supabaseUrl = context.env.SUPABASE_URL;
    const supabaseKey = context.env.SUPABASE_SERVICE_ROLE_KEY;

    await fetch(`${supabaseUrl}/rest/v1/netflix_codes`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ household_code: code, status: 'new' }) 
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server xətası" }), { status: 500 });
  }
}
