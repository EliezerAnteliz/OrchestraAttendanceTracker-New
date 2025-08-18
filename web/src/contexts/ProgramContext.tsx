"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export type Program = {
  id: string;
  name: string;
  organization_id?: string | null;
};

interface ProgramContextValue {
  programs: Program[];
  activeProgram: Program | null;
  setActiveProgramId: (id: string) => void;
  refreshPrograms: () => Promise<void>;
  loading: boolean;
}

const ProgramContext = createContext<ProgramContextValue | undefined>(undefined);

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      // Use user from AuthContext
      const userId = user?.id;
      const userEmail = user?.email as string | undefined;
      console.log('ProgramContext: session user ->', { userId, userEmail });
      if (!userId) {
        setPrograms([]);
        setActiveProgram(null);
        return;
      }

      // Step 1: memberships for current user
      const { data: memberships, error: memErr } = await supabase
        .from('user_program_memberships')
        .select('program_id, role, created_at')
        .eq('user_id', userId);
      if (memErr) {
        console.error('ProgramContext: memberships error ->', memErr);
      }
      const programIds = (memberships || []).map((m: any) => m.program_id).filter(Boolean);
      console.log('ProgramContext: membership programIds ->', programIds);

      let progs: Program[] = [];

      // Step 1.5: Prefer a unified RPC that already applies RLS/authorization logic server-side
      try {
        const { data: unified, error: unifiedErr } = await supabase.rpc('list_programs_for_current_user');
        if (unifiedErr) {
          console.warn('ProgramContext: list_programs_for_current_user error ->', unifiedErr);
        } else if (Array.isArray(unified) && unified.length > 0) {
          progs = unified.map((p: any) => ({ id: p.id, name: p.name, organization_id: p.organization_id }));
        }
      } catch (rpcErr) {
        console.warn('ProgramContext: RPC list_programs_for_current_user threw ->', rpcErr);
      }

      // Step 2: If user is org admin, prefer RPC that returns all programs in their orgs
      try {
        const { data: adminPrograms, error: adminErr } = await supabase.rpc('list_admin_visible_programs');
        if (adminErr) {
          console.warn('ProgramContext: list_admin_visible_programs error ->', adminErr);
        } else if (Array.isArray(adminPrograms) && adminPrograms.length > 0) {
          progs = adminPrograms.map((p: any) => ({ id: p.id, name: p.name, organization_id: p.organization_id }));
        }
      } catch (rpcErr) {
        console.warn('ProgramContext: RPC list_admin_visible_programs threw ->', rpcErr);
      }

      // Step 3: If not org admin (or RPC empty), fall back to membership IDs
      if (progs.length === 0 && programIds.length) {
        const { data: progsData, error: progsErr, status } = await supabase
          .from('programs')
          .select('id, name, organization_id')
          .in('id', programIds);
        if (progsErr) {
          console.error('ProgramContext: programs fetch error ->', progsErr, { status });
        } else {
          console.log('ProgramContext: programs fetch data ->', progsData);
        }
        progs = (progsData || []).map((p: any) => ({ id: p.id, name: p.name, organization_id: p.organization_id }));
      }

      console.log('ProgramContext: loaded programs ->', progs);

      setPrograms(progs);

      // Restore previous selection
      const savedId = typeof window !== "undefined" ? localStorage.getItem("activeProgramId") : null;
      const initial = progs.find((p) => p.id === savedId) || progs[0] || null;
      setActiveProgram(initial || null);
      if (initial && typeof window !== "undefined") {
        localStorage.setItem("activeProgramId", initial.id);
      }
    } catch (e) {
      console.error("Error loading programs", e);
      setPrograms([]);
      setActiveProgram(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const setActiveProgramId = useCallback((id: string) => {
    const found = programs.find((p) => p.id === id) || null;
    setActiveProgram(found);
    if (found && typeof window !== "undefined") {
      localStorage.setItem("activeProgramId", found.id);
    }
  }, [programs]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms, user?.id]);

  const value = useMemo<ProgramContextValue>(
    () => ({ programs, activeProgram, setActiveProgramId, refreshPrograms: loadPrograms, loading }),
    [programs, activeProgram, setActiveProgramId, loadPrograms, loading]
  );

  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function useProgram() {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error("useProgram must be used within ProgramProvider");
  return ctx;
}
