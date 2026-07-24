/**
 * Compatibilidad hacia atrás: este hook antes tenía su propia lógica y
 * estado (cada componente que lo llamaba creaba su propia copia — ver nota
 * completa en `src/contexts/UserRoleContext.tsx` sobre el bug real que
 * causó, 24/07). Ahora es solo un alias del Context compartido, para que
 * los ~15 archivos que ya hacían `import { useUserRole } from
 * '@/hooks/useUserRole'` sigan funcionando exactamente igual sin tocarlos.
 */
export { useUserRoleContext as useUserRole, type UserRole } from '@/contexts/UserRoleContext';
