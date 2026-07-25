import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Crea (o localiza) la cuenta de Supabase Auth de un usuario nuevo, vía el
// flujo de invitación por correo (Admin/Usuarios → "Agregar usuario").
//
// Antes esto se hacía con supabase.auth.signUp({ email, password: '123456' })
// directo desde el navegador: TODA cuenta nueva quedaba con la misma
// contraseña fija y conocida ("123456 password temporal"), visible en el
// código y mostrada en pantalla — cualquiera que supiera o adivinara el
// correo de alguien del equipo podía entrar a su cuenta antes de que esa
// persona iniciara sesión por primera vez. Ahora se usa
// auth.admin.inviteUserByEmail(), que crea la cuenta sin contraseña y le
// manda un correo con un link para que la propia persona elija su
// contraseña — nadie más la conoce en ningún momento.
//
// Requiere que el envío de correos esté configurado en el proyecto de
// Supabase (SMTP propio o el servicio de correo por defecto); si no lo
// está, la invitación se crea pero el correo no llega — hay que revisarlo
// en Authentication → Email Templates / Settings en el panel de Supabase.
//
// Autorización: mismo criterio que /api/admin/users/delete-auth-user
// (sesión real + list_admin_visible_programs), no un token estático.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email as string | undefined;
    const full_name = body?.full_name as string | undefined;
    const organization_id = body?.organization_id as string | undefined;
    const role = body?.role as string | undefined;
    const program_id = body?.program_id as string | undefined;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
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

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { organization_id, program_id, role, full_name: full_name || email.split('@')[0] },
    });

    if (inviteError) {
      // Ya existe una cuenta de Auth con este correo (invitación previa,
      // o se registró antes) — reutilizamos su id en vez de fallar.
      const alreadyExists = /already.*registered|already.*exists/i.test(inviteError.message || '');
      if (alreadyExists) {
        const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          return NextResponse.json({ error: listError.message }, { status: 500 });
        }
        const existing = existingUsers?.users?.find((u) => u.email === email);
        if (existing) {
          return NextResponse.json({ user_id: existing.id, is_new_user: false });
        }
      }
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    if (!inviteData?.user) {
      return NextResponse.json({ error: 'La invitación no devolvió un usuario' }, { status: 500 });
    }

    return NextResponse.json({ user_id: inviteData.user.id, is_new_user: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
