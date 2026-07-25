-- ========================================
-- ENLACE ACTIVOS <-> ESTUDIANTES — STAFFORD, LOTE 1 (24 confirmados)
-- ========================================
-- Los 26 seriales del Excel ya existían como activos en Stafford, sin
-- assigned_to_text ni assigned_student_id previos (lienzo limpio). De
-- esos 26, 24 cruzan con un estudiante activo de Stafford.
-- Quedan fuera "Penelope Herrera" (serial 8362) y "Angela Mercedes
-- Villarreal" (serial NYOSA 12023) — ningún estudiante activo con esos
-- nombres en Stafford, pendiente de confirmar con Eliezer.
-- ========================================

-- A. Coincidencia exacta (mayúsculas/acentos/espacios sin importar) (18)
UPDATE assets SET assigned_student_id = '328be26f-8909-4097-ba2e-e4a861890e63' WHERE id = 'd3db2ae2-a10a-423c-9886-5123399603ff'; -- Zeriyah Goss
UPDATE assets SET assigned_student_id = '833739d6-33e9-4fa1-93c4-ccb681f307d9' WHERE id = 'f7e0c4ed-aa68-4dfb-b98c-8daf7c24985d'; -- Elianna Mendoza
UPDATE assets SET assigned_student_id = '2fcf566b-938c-41c9-98e6-8b1d1993dfe9' WHERE id = 'efe9aa18-0d73-4310-9a04-5afd42fc915a'; -- Adrian Gutierrez Villanueva
UPDATE assets SET assigned_student_id = 'fa70a5d0-7953-4bd1-a5a1-2e20024a1059' WHERE id = 'f7a10ad4-3f4f-43c5-b53b-96823bf8d179'; -- Bella Montes
UPDATE assets SET assigned_student_id = '18b40926-91f2-4ec9-adcb-6eeefafd55b2' WHERE id = '23af1a24-29e1-4a96-869a-029e6f9ea204'; -- Gaviana Perez
UPDATE assets SET assigned_student_id = 'd5724bfe-8f2d-4d1c-8db0-a9bc1fa04a05' WHERE id = 'f6fc4579-c925-4d7e-a4c1-1dc78120f578'; -- Inila Arvind
UPDATE assets SET assigned_student_id = 'ab1362c8-f425-4f4e-906a-e65d46c3feab' WHERE id = '3c2671de-a99c-4ba4-a1a3-521c390bbb05'; -- Shandon Shipman
UPDATE assets SET assigned_student_id = 'bc61f054-2192-4abb-9377-7c2e9ba03324' WHERE id = '78c89741-3794-42b3-a9cf-35d3d590fa38'; -- Miranda Carcamo
UPDATE assets SET assigned_student_id = 'e88c88b9-d0c7-4dda-9def-09e1b756af47' WHERE id = 'b1f0f0d4-710e-4f36-9973-7ba38a82d69c'; -- Tania Ramirez
UPDATE assets SET assigned_student_id = 'bd6202ee-ef7d-4ce2-be5e-f3b884b29332' WHERE id = '0b402012-23b4-40c5-9455-470fcaa7af7c'; -- Jesus Delgado
UPDATE assets SET assigned_student_id = 'b829f61b-b68a-4892-8246-2be5ab47ef2f' WHERE id = '32e2a467-e4f6-4ed3-b30f-027e44574b41'; -- Faustino Juarez
UPDATE assets SET assigned_student_id = '909b8786-ca50-4e13-9c8d-1ca27a92bc6f' WHERE id = '322d15ef-8f50-4e58-9202-6862e00fccad'; -- Nadhi Arvind
UPDATE assets SET assigned_student_id = 'dcab964e-80b8-43fd-b62e-3b891b8f1376' WHERE id = '42d7f856-3cf8-4780-8b44-0352dd9aea2f'; -- Luna Flores
UPDATE assets SET assigned_student_id = 'c84ca515-aca6-4e06-bbce-04265d82553e' WHERE id = 'e2e082b2-a02a-4326-a7a4-07e102420a65'; -- Claudia Villabona
UPDATE assets SET assigned_student_id = '721084e4-df15-4ed0-8b4b-46038ed86a05' WHERE id = 'a9eb3326-f85a-4f2b-9b6a-c37786c0eeee'; -- Audrey Moreno
UPDATE assets SET assigned_student_id = 'dd3d7f38-dce6-4d3e-88f2-8987a2c76d7a' WHERE id = '4f1f47e7-f878-4e91-8483-3d61eb2e656a'; -- Sara Sandoval
UPDATE assets SET assigned_student_id = '051a7551-91b3-48d0-91eb-e0ea599c2d94' WHERE id = 'e84564bd-9fb6-48e6-b153-721519792b95'; -- Coraline Garfinkel
UPDATE assets SET assigned_student_id = '702af7a9-6c42-48b4-af61-d162d8045f50' WHERE id = '0a7e1f8c-972e-4668-a092-706449591b23'; -- Sol Flores

-- B. Coinciden pero al estudiante en el sistema le falta un apellido
--    compuesto o nombre intermedio que sí trae el Excel — único candidato
--    posible en cada caso, sin ambigüedad (6)
UPDATE assets SET assigned_student_id = 'e8143ec5-4bfa-4e15-8603-3fbe88aada4c' WHERE id = '95855349-7511-4869-ab94-873c7d384925'; -- Excel: "Bryan Felix-Lopez" = sistema: "Bryan Lopez"
UPDATE assets SET assigned_student_id = '64b8c549-c496-449b-b62e-dc77bfbf4131' WHERE id = 'f1d23f44-c22f-40b4-8f61-66eebcab7e65'; -- Excel: "Jayden Felix-lopez" = sistema: "Jayden Lopez"
UPDATE assets SET assigned_student_id = '23a4038b-7278-4e0d-a4f1-b6fa396e5a5a' WHERE id = 'd91b3feb-adb4-40d5-a1b5-7c4e1645975d'; -- Excel: "Isaac Hernandez Ibarra" = sistema: "Issac Hernandez Ibarra" (typo)
UPDATE assets SET assigned_student_id = '21da6609-0134-4579-8861-af920c1ab967' WHERE id = 'aa5018a1-5c43-4083-bd6e-784bd5fa9819'; -- Excel: "Ian Rivera-Ramirez" = sistema: "Ian Ramirez"
UPDATE assets SET assigned_student_id = '74a7df28-3efe-4007-9163-8ad6c7c142b7' WHERE id = 'ca3be368-aadd-4695-a302-526fff000add'; -- Excel: "Ellie Annette Lugo" = sistema: "Ellie Lugo"
UPDATE assets SET assigned_student_id = '03a8a52b-dd1b-4023-9cdf-4957fbccd834' WHERE id = 'c0498434-dca1-4262-8f28-066dc2deaf2e'; -- Excel: "Isabella Ramirez Luna" = sistema: "Isabella Luna"

-- Verificación: debe devolver 24
select count(*) as enlazados_stafford_lote1 from assets
where current_program_id = 'cd87e160-6166-4b86-8df7-a1bcb800d5c7' and assigned_student_id is not null;
