import { NextResponse } from 'next/server';
import { getSupabaseAdmin, assertAdminAuth } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    assertAdminAuth(request);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('user_program_memberships')
      .select(`
        id,
        user_id,
        program_id,
        created_at,
        programs:program_id(id, name, organization_id)
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
    }

    return NextResponse.json({ memberships: data || [] });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: String(err?.message || err) }, { status });
  }
}
