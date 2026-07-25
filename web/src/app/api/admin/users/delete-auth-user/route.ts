import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
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
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const targetUserId = body?.user_id as string | undefined;
    if (!targetUserId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) {
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
