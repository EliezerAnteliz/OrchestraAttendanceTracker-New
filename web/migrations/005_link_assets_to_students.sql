-- ========================================
-- MIGRACIÓN 005: ENLAZAR ACTIVOS DE INVENTARIO A ESTUDIANTES REALES
-- ========================================
-- Fecha: 2026-07-24
-- Descripción: hoy "assigned_to_text" en assets es texto libre (alguien
-- escribe "Abigail Martinez" a mano) y no está conectado con la tabla
-- students. Esta migración agrega una columna opcional que sí es un
-- enlace real, para poder saber con certeza qué instrumento físico
-- tiene cada estudiante, y para que el "Asignado a" en Inventario pueda
-- ser un buscador de estudiantes reales en vez de texto libre.
--
-- No es destructiva: assigned_to_text se queda igual (sigue sirviendo
-- para asignaciones que NO son estudiantes, ej. "Terranova"), y la
-- columna nueva empieza vacía para todos los activos existentes — nada
-- se sobreescribe ni se borra con solo correr este archivo.
-- ========================================

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS assigned_student_id uuid REFERENCES students(id);

COMMENT ON COLUMN assets.assigned_student_id IS
  'Enlace real al estudiante que tiene este activo asignado (cuando aplica). assigned_to_text se mantiene para asignaciones a no-estudiantes o mientras se completa la vinculación.';

CREATE INDEX IF NOT EXISTS assets_assigned_student_idx
  ON assets(assigned_student_id)
  WHERE assigned_student_id IS NOT NULL;
