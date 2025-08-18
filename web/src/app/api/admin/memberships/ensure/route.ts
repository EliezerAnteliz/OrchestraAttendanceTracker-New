import { NextResponse } from 'next/server';
import { getSupabaseAdmin, assertAdminAuth } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    assertAdminAuth(request);

    const body = await request.json();
    const user_id = body?.user_id as string | undefined;
    const program_id = body?.program_id as string | undefined;

    if (!user_id || !program_id) {
      return NextResponse.json({ error: 'user_id and program_id are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check existing membership
    const { data: existing, error: checkError } = await supabase
      .from('user_program_memberships')
      .select('*')
      .eq('user_id', user_id)
      .eq('program_id', program_id)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json({ error: String(checkError.message || checkError) }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ ensured: true, existed: true, membership: existing });
    }

    // Insert if not exists
    const { data: inserted, error: insertError } = await supabase
      .from('user_program_memberships')
      .insert({ user_id, program_id })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: String(insertError.message || insertError) }, { status: 500 });
    }

    return NextResponse.json({ ensured: true, existed: false, membership: inserted });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: String(err?.message || err) }, { status });
  }
}
