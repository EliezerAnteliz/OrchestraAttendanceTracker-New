import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Borra la cuenta de Supabase Auth de un usuario (paso final de "eliminar
// usuario completamente" en Admin/Usuarios).
//
// Por qué existe esta ruta: el borrado de la cuenta de Auth requiere la
// service role key de Supabase, que solo puede vivir en el servidor — nunca
// en un componente "use client" (el navegador jamás tiene acceso real a esa
// key, aunque el código la referencie). Antes admin/users/page.tsx llamaba
// getSupabaseAdmin() directo desde el navegador: fallaba en silencio (quedó
// atrapado por un catch que trata "falta la key" como algo esperado), así
// que el perfil y las membresías se borraban pero la cuenta de Auth seguía
// viva para siempre en Supabase.
//
// Autorización: en vez de un token estático (como el patrón usado en
// /api/admin/memberships/*, pensado para llamadas servidor-a-servidor), acá
// se verifica la sesión real de quien llama y se confirma que sea Admin de
// al menos un programa visible — el mismo criterio (misma función RPC) que
// ya usa el sidebar para decidir si mostrar el link "Admin/Usuarios".
//
// La app usa el cliente plano de @supabase/supabase-js (lib/supabase.ts),
// que guarda la sesión en localStorage, NO en cookies — por eso esta ruta
// NO puede usar createRouteHandlerClient({ cookies }) (ese patrón es para
// apps que sincronizan la sesión a cookies vía auth-helpers/middleware, y
// aquí nunca hay cookies que leer, así que siempre daba "Unauthorized: no
// session" incluso con sesión real activa). En vez de eso, el navegador
// manda el access_token de su sesión actual en el header Authorization, y
// aquí lo validamos contra Supabase directamente.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const targetUserId = body?.user_id as string | undefined;
    if (!targetUserId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: no session' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user: caller }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !caller) {
      return NextResponse.json({ error: 'Unauthorized: no session' }, { status: 401 });
    }

    const { data: visiblePrograms, error: rpcError } = await supabase.rpc('list_admin_visible_programs');
    if (rpcError) {
      return NextResponse.json({ error: `No se pudo verificar el rol: ${rpcError.message}` }, { status: 500 });
    }
    if (!Array.isArray(visiblePrograms) || visiblePrograms.length === 0) {
      return NextResponse.json({ error: 'Unauthorized: se requiere rol de Admin' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
