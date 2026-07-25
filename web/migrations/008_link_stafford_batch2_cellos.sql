-- ========================================
-- ENLACE ACTIVOS <-> ESTUDIANTES — STAFFORD, LOTE 2 (5 confirmados)
-- ========================================
-- Violonchelos "Ascend" sin serial — se distinguen por el código de
-- inventario (full_code), confirmado contra la tabla de seguimiento de
-- Eliezer. "Dominic Villarreal" (código 2001010801040050) queda fuera:
-- estudiante retirado, no se enlaza. "Allison Hernandez" (T3320813,
-- préstamo EISD) y "Aidren Menchaca" (YOSA 12017, préstamo YOSA) tampoco
-- se incluyen aquí — son instrumentos que todavía no existen como activo
-- en el sistema; Eliezer los va a crear manualmente desde la app.
-- ========================================

UPDATE assets SET assigned_student_id = '138ce02e-6908-4e9c-98cf-b97d6107d7c3' WHERE id = '41cdff57-349f-4824-b2fa-39b795c3c316'; -- código ...041 -> Dominic Rodriguez
UPDATE assets SET assigned_student_id = '5c1fb55a-fd62-4ee5-b286-c611dabf03d9' WHERE id = 'e0268687-429a-40df-aa3d-d9802f628e17'; -- código ...042 -> Abigail Martinez
UPDATE assets SET assigned_student_id = '932ed953-35b8-4bea-b83b-01d13602bb8d' WHERE id = '668b3b34-ebc8-46e4-9790-74d8ce2ab821'; -- código ...045 -> Iziah Perez
UPDATE assets SET assigned_student_id = '3187cb41-a71c-4df8-9972-a20a0525db4b' WHERE id = 'a0aa9e76-368c-4d9a-8ef4-87da9ce8f8a6'; -- código ...048 -> Sophia Cortez
UPDATE assets SET assigned_student_id = '62df5032-7194-41fd-bfa0-5f8c203bc33d' WHERE id = '252d61f1-f3bc-4ec2-ba22-e6a51844fb34'; -- código ...051 -> Timothy Cortez

-- Verificación: debe devolver 29 (los 24 del lote 1 + estos 5)
select count(*) as enlazados_stafford_total from assets
where current_program_id = 'cd87e160-6166-4b86-8df7-a1bcb800d5c7' and assigned_student_id is not null;
