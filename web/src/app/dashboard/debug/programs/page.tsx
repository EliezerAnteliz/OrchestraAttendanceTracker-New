"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function DebugProgramsPage() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<any[] | null>(null);
  const [programs, setPrograms] = useState<any[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState<{ url: string; usingDefaults: boolean } | null>(null);

  useEffect(() => {
    // Reuse the same info logged in supabase.ts
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL as string) || 'https://lbanldhbmuabmybtlkbs.supabase.co';
    const usingDefaults = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    setEnvInfo({ url, usingDefaults });
  }, []);

  useEffect(() => {
    const run = async () => {
      const errs: string[] = [];
      try {
        if (!user?.id) {
          errs.push('No user in AuthContext. Please log in again.');
          setErrors(errs);
          return;
        }
        // 1) memberships
        const { data: mData, error: mErr } = await supabase
          .from('user_program_memberships')
          .select('program_id, role, created_at')
          .eq('user_id', user.id);
        if (mErr) errs.push(`Memberships error: ${mErr.message}`);
        setMemberships(mData || []);

        const ids = (mData || []).map((m: any) => m.program_id).filter(Boolean);
        // 2) programs by ids
        if (ids.length) {
          const { data: pData, error: pErr } = await supabase
            .from('programs')
            .select('id, name, organization_id')
            .in('id', ids);
          if (pErr) errs.push(`Programs error: ${pErr.message}`);
          setPrograms(pData || []);
        } else {
          setPrograms([]);
        }
      } catch (e: any) {
        errs.push(`Unexpected error: ${e?.message || String(e)}`);
      } finally {
        setErrors(errs);
      }
    };
    run();
  }, [user?.id]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-[#0073ea]">Debug: Programs & Memberships</h1>

      <section className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-medium mb-2">Environment</h2>
        <p><strong>Supabase URL:</strong> {envInfo?.url}</p>
        <p>
          <strong>Using defaults:</strong> {envInfo?.usingDefaults ? 'Yes (configure .env.local and restart dev server)' : 'No'}
        </p>
      </section>

      <section className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-medium mb-2">Auth</h2>
        <p><strong>User ID:</strong> {user?.id || '—'}</p>
        <p><strong>Email:</strong> {user?.email || '—'}</p>
      </section>

      <section className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-medium mb-2">Memberships (user_program_memberships)</h2>
        {memberships === null ? (
          <p>Cargando…</p>
        ) : memberships.length ? (
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">{JSON.stringify(memberships, null, 2)}</pre>
        ) : (
          <p>No memberships found for this user.</p>
        )}
      </section>

      <section className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-medium mb-2">Programs</h2>
        {programs === null ? (
          <p>Cargando…</p>
        ) : programs.length ? (
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">{JSON.stringify(programs, null, 2)}</pre>
        ) : (
          <p>No programs fetched.</p>
        )}
      </section>

      {errors.length ? (
        <section className="bg-red-50 border border-red-200 text-red-700 rounded p-4">
          <h2 className="text-lg font-medium mb-2">Errors</h2>
          <ul className="list-disc ml-6 text-sm">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
