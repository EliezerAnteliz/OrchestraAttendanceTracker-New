-- ========================================
-- ENLACE ACTIVOS <-> ESTUDIANTES — LOTE 1 (39 confirmados)
-- ========================================
-- Requiere haber corrido antes 005_link_assets_to_students.sql
-- (agrega la columna assets.assigned_student_id).
--
-- Generado cruzando los resultados de la Consulta 1 de
-- revision_enlace_activos.sql contra el roster de estudiantes activos.
-- Los "falsos positivos" que salían por compartir apellido (ej. varios
-- "Rodriguez", "Jimenez", "Herrera", "Lopez", "Rocha") ya se filtraron.
-- ========================================

-- A. Coincidencia exacta de nombre completo (28)
UPDATE assets SET assigned_student_id = '4acd7753-50bc-446e-923a-9cf94423635c' WHERE id = 'be2dd5a6-0261-4a3d-9b5a-1d35f38fccd0'; -- Abigail Herrera
UPDATE assets SET assigned_student_id = 'd074d1b6-4719-4710-b620-d9af64a1e0f4' WHERE id = '84af83c9-8751-43ef-a115-c93e8449c334'; -- Adan Aguilera
UPDATE assets SET assigned_student_id = 'f31abf74-7961-45fd-bc96-ac202d0847ae' WHERE id = '594deda4-42b8-4301-84d0-f4e0fbcc3c0c'; -- Adriane Rocha
UPDATE assets SET assigned_student_id = '9586264b-357c-4b88-9b92-b3da6b891090' WHERE id = '6a68baf0-4660-470a-a47d-de2727f598db'; -- Alicia Lopez
UPDATE assets SET assigned_student_id = '276e8520-21ca-4f30-9c59-5d400a6dfa36' WHERE id = 'f62145f9-f346-46d4-8d9f-8ca0edccfd74'; -- Amalia Rocha
UPDATE assets SET assigned_student_id = 'ee62b097-2c9e-41b7-b950-57d5228dc900' WHERE id = '50caa241-153a-4156-96a5-e78409abe66c'; -- Ashleen Perez
UPDATE assets SET assigned_student_id = 'e6ad7709-1f45-42b9-a62f-098399a749f2' WHERE id = 'a8fde72b-cdc9-4adf-aae2-b94d5d3a2fe0'; -- Brian Lopez
UPDATE assets SET assigned_student_id = '8eeb9d76-60f3-4812-9260-224756268086' WHERE id = 'e0aa47a9-9efe-403e-8094-4c9749261431'; -- Bryson Delong
UPDATE assets SET assigned_student_id = '7facf743-10d2-44c5-8220-1e276fb4860a' WHERE id = 'f70b5653-be8e-48e8-8077-b7613264fcd6'; -- Cali Ramos
UPDATE assets SET assigned_student_id = '4ced5d81-4542-43ef-aa01-6ada774db4e6' WHERE id = '44eeaeb1-b3fa-4a00-a7f1-af081bc523f2'; -- Charlie Sanchez
UPDATE assets SET assigned_student_id = '44ba5056-c4db-400f-a002-6721cb65e517' WHERE id = '68fe9bf0-7ef2-46ed-ac50-714515502ee6'; -- David Mairena
UPDATE assets SET assigned_student_id = '8eceaae9-c414-4920-bdf7-3bb6c82c2c31' WHERE id = '39005780-7868-4f64-80db-ab4761641ec1'; -- Desireblu Rodriguez
UPDATE assets SET assigned_student_id = 'b94d3330-3403-41ff-baa2-55887e70112c' WHERE id = 'e488a3db-b0cd-4ac3-82bb-191c3747dad7'; -- Edgar Moreno
UPDATE assets SET assigned_student_id = '240fe422-77b7-4669-914f-0ce402869d68' WHERE id = '97475015-dd51-4528-a3b1-ddc3c64b061d'; -- Emily Bass
UPDATE assets SET assigned_student_id = '2fc59aa4-910e-4f38-8901-5521593eff82' WHERE id = '202812bb-5791-42f2-9e0e-1ad38071bfc1'; -- Gabriella Jimenez
UPDATE assets SET assigned_student_id = '1281cdb4-2a41-4758-94e4-253cdd2bfd2b' WHERE id = '731fa526-1da5-4dbc-9e58-cd3fa936319a'; -- Hope Rodriguez
UPDATE assets SET assigned_student_id = 'a25efbe0-2c7f-4277-aa72-889ad139678f' WHERE id = 'f2da8f6d-ae26-4807-b15e-b6eedc3078cf'; -- Isabella Macias
UPDATE assets SET assigned_student_id = 'e0cc95e3-5b23-4c46-9ff4-3f4bfaa8acf7' WHERE id = '634caaa4-6be1-429c-9f32-4f55e3efa7e7'; -- Jayden Gonzalez
UPDATE assets SET assigned_student_id = 'a763731c-0815-4dcc-a5c7-09b8c5125616' WHERE id = '615710f2-b13b-4632-9ce7-7a785c00de19'; -- John Herrera
UPDATE assets SET assigned_student_id = 'c7c65691-28e5-424d-87a5-71505005de5e' WHERE id = '1b46983e-887f-42ed-b7cb-9874196d669e'; -- Judaveen Gutierrez
UPDATE assets SET assigned_student_id = 'f6fce8eb-bf10-4ef6-8b46-9a02a2065af4' WHERE id = 'b9f9def7-edec-42f5-8f86-85c2e2449534'; -- Love Rodriguez
UPDATE assets SET assigned_student_id = '39d8fe86-a55d-43dc-8a26-bb823cb6e1c3' WHERE id = '2d5946c4-52b5-4b41-8ef8-ead53d1da39a'; -- Lucretia Badrak
UPDATE assets SET assigned_student_id = 'f8f2a8e7-3e4c-4de0-a583-1ece41b727c2' WHERE id = '45169be0-ae2c-4d40-891a-c0ef2a09dc68'; -- Matthias Cerna
UPDATE assets SET assigned_student_id = '793a46bc-7397-4674-a27b-354a96bf6ed7' WHERE id = '1e6b793f-2474-4570-8c38-1bceb81a4474'; -- Nayetzi Romero
UPDATE assets SET assigned_student_id = '72b068ae-e7fa-4e48-a5bc-5b71c5059009' WHERE id = 'a1c32e30-b458-4330-a36a-39d6fe3fb417'; -- Oliviah Casanova
UPDATE assets SET assigned_student_id = '1f344ee0-68cb-4771-a6e6-e0e24bf077a8' WHERE id = '649a0aef-5940-487b-a775-82aab228d4c3'; -- Peter Olguin
UPDATE assets SET assigned_student_id = 'ed663577-020a-4707-822a-6fc9a44375f0' WHERE id = '2c3d0a03-d94c-4063-bee0-1fa28cd41d23'; -- Rayna Faz
UPDATE assets SET assigned_student_id = '3b6b9296-be74-4d1a-9846-16973313680e' WHERE id = 'c52f6a63-b250-4098-8825-65269f0d6d40'; -- Rose Fox

-- B. Coincide completo, pero el nombre en el sistema tiene mayúsculas o
--    un espacio de más (misma confianza que el grupo A) (8)
UPDATE assets SET assigned_student_id = '72193528-3047-4648-bafa-4de6335df94e' WHERE id = '3ba6bb3b-6243-4e59-ad43-3062e5b0d957'; -- Amarissa de Hoyos
UPDATE assets SET assigned_student_id = '32eabb63-70fd-42fd-b2c8-cbd5472eabc1' WHERE id = 'f16c8048-84e3-430e-9e89-5f704470a985'; -- Dominikk Herrera
UPDATE assets SET assigned_student_id = '14548646-8d6a-4b54-87f3-bebe40fe21f5' WHERE id = '3b30bc6c-c085-4094-9a0c-a3b8959fa589'; -- Geovanni Jimenez
UPDATE assets SET assigned_student_id = 'f7085632-7225-4165-bea2-0885bad4e2f3' WHERE id = 'c65912bd-4dda-44d0-bfc3-e7c5ab57a3d1'; -- Jose Gil (nota: el registro del estudiante tiene el nombre completo en el campo "first_name" — revisar aparte)
UPDATE assets SET assigned_student_id = '0f7538fd-102f-4ba3-a7b8-3b661e095ab5' WHERE id = '7e258cfb-3db0-4627-afc0-09eb2c8c4344'; -- liliana ayala
UPDATE assets SET assigned_student_id = '63379bcd-8b53-4098-9d73-1ea91fab29da' WHERE id = '9727b2e6-276d-4fca-91c3-822ee1523ab3'; -- Maggie Flores
UPDATE assets SET assigned_student_id = 'c0a92ff1-903c-44fc-a28c-ee913f69d73f' WHERE id = '16c45644-6cd6-4e1e-a3c1-8d77469c4de9'; -- Natalia Jimenez
UPDATE assets SET assigned_student_id = '73e2a13f-e1bb-4ab8-9924-74e319692302' WHERE id = '7b56fc27-86a8-4a02-9feb-3c1a18674f02'; -- Ximena Morales

-- C. Revisados a mano — coinciden por typo, único candidato posible (3)
--    Confírmalos antes de correrlos si quieres verificarlos tú mismo.
UPDATE assets SET assigned_student_id = '32b1c1f6-e990-4afa-b549-12d550b32de4' WHERE id = 'a0c723d5-ce33-4359-bcaf-8ec6c4d46999'; -- "Liliana Neavez" (activo) = "Lilliana Neavez" (sistema)
UPDATE assets SET assigned_student_id = '63000f99-722a-43f0-90e9-65901077ecb8' WHERE id = '518893ad-c965-417c-b877-0e0ed654e304'; -- "Lilyanna Lucio" (activo) = "Lilyana Lucio" (sistema)
UPDATE assets SET assigned_student_id = '7118bcaf-259a-4ad8-8451-c15c85bafff1' WHERE id = 'a6a02cb6-e027-49bd-9759-243ac7c39ebc'; -- "Maddilyn Ridenour" (activo) = "Maddilynn Ridenour" (sistema)

-- Verificación: debe devolver 39
select count(*) as enlazados from assets where assigned_student_id is not null;
