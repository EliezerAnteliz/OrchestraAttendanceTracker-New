-- ========================================
-- MIGRACIÓN 002: CARGAR CATÁLOGOS DE INVENTARIO
-- ========================================
-- Proyecto: TOSA Inventario - Test
-- Fecha: 2026-07-21
-- Descripción: Carga los datos de catálogos (locations, sources, groups, etc.)
-- ⚠️ IMPORTANTE: Ejecutar SOLO en proyecto de prueba rrajmmykivbzzobljqmm
-- ========================================

-- 1. ASSET LOCATIONS
INSERT INTO asset_locations (code, name, category) VALUES
('01','Sede administrativa actual oficina','administrativa'),
('02','Sede Norte u otro Estado','administrativa'),
('20','Gerencia Ascend Oeste','ascend_gerencia'),
('21','Gerencia Ascend Norte','ascend_gerencia'),
('22','Gerencia Ascend Este','ascend_gerencia'),
('23','Gerencia Ascend Sur','ascend_gerencia'),
('50','Agrupaciones','agrupacion')
ON CONFLICT (code) DO NOTHING;

-- 2. ASSET WORK AREAS
INSERT INTO asset_work_areas (location_id, code, name) VALUES
((SELECT id FROM asset_locations WHERE code='01'),'00','Sede administrativa actual oficina'),
((SELECT id FROM asset_locations WHERE code='01'),'01','Presidencia'),
((SELECT id FROM asset_locations WHERE code='01'),'02','Junta Directiva'),
((SELECT id FROM asset_locations WHERE code='01'),'03','Dpto Dani'),
((SELECT id FROM asset_locations WHERE code='01'),'04','Dpto Kara'),
((SELECT id FROM asset_locations WHERE code='01'),'05','Dpto Mariana'),
((SELECT id FROM asset_locations WHERE code='02'),'00','Sede Norte u otro Estado'),
((SELECT id FROM asset_locations WHERE code='02'),'01','Logística'),
((SELECT id FROM asset_locations WHERE code='02'),'02','Inventario'),
((SELECT id FROM asset_locations WHERE code='20'),'00','Gerencia Ascend Oeste'),
((SELECT id FROM asset_locations WHERE code='20'),'01','Ascend Stafford'),
((SELECT id FROM asset_locations WHERE code='20'),'02','Ascend Japhet'),
((SELECT id FROM asset_locations WHERE code='20'),'03','Ascend Edgewood'),
((SELECT id FROM asset_locations WHERE code='20'),'04','Ascend área cercana'),
((SELECT id FROM asset_locations WHERE code='21'),'00','Gerencia Ascend Norte'),
((SELECT id FROM asset_locations WHERE code='22'),'00','Gerencia Ascend Este'),
((SELECT id FROM asset_locations WHERE code='23'),'00','Gerencia Ascend Sur'),
((SELECT id FROM asset_locations WHERE code='50'),'00','Agrupaciones'),
((SELECT id FROM asset_locations WHERE code='50'),'01','Orquesta TOSA'),
((SELECT id FROM asset_locations WHERE code='50'),'02','Orquesta de Cámara TOSA'),
((SELECT id FROM asset_locations WHERE code='50'),'03','Cuarteto'),
((SELECT id FROM asset_locations WHERE code='50'),'04','Quinteto')
ON CONFLICT (location_id, code) DO NOTHING;

-- Vincular áreas de Stafford y Japhet a los programs reales (si existen)
-- Nota: En ambiente de prueba, estos programs se crearán después
UPDATE asset_work_areas 
SET program_id = (SELECT id FROM programs WHERE name ILIKE '%stafford%' LIMIT 1)
WHERE code='01' AND location_id = (SELECT id FROM asset_locations WHERE code='20')
AND EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%stafford%');

UPDATE asset_work_areas 
SET program_id = (SELECT id FROM programs WHERE name ILIKE '%japhet%' LIMIT 1)
WHERE code='02' AND location_id = (SELECT id FROM asset_locations WHERE code='20')
AND EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%japhet%');

-- 3. ASSET SOURCES
INSERT INTO asset_sources (code, name) VALUES
('01','Comprado'),
('02','Donado'),
('03','Alquilado')
ON CONFLICT (code) DO NOTHING;

-- 4. ASSET GROUPS
INSERT INTO asset_groups (code, name) VALUES
('01','Terrenos y bienes naturales'),
('02','Construcciones'),
('03','Instalaciones técnicas'),
('04','Maquinarias'),
('05','Mobiliario'),
('06','Equipos para procesos informáticos'),
('07','Elementos de transporte'),
('08','Instrumentos musicales')
ON CONFLICT (code) DO NOTHING;

-- 5. ASSET CLASSES
INSERT INTO asset_classes (code, name) VALUES
('01','Tangible'),
('02','Intangible'),
('03','Inversiones en compañía')
ON CONFLICT (code) DO NOTHING;

-- 6. ASSET CHARACTERISTICS
INSERT INTO asset_characteristics (code, description) VALUES
('01','Se compran para el suministro de bienes o servicios, para el proceso de producción, para usarlos en la organización o para alquilarlos a terceros'),
('02','Son recursos o inversiones a largo plazo de una empresa'),
('03','No se consumen totalmente ni se venden dentro del año contable'),
('04','Tienen una forma física tangible'),
('05','Se deprecian para fines contables a lo largo de su vida útil'),
('06','Cuando llegan al término de su vida útil, generalmente se eliminan vendiéndolos por un valor de rescate'),
('07','Aparecen en los registros financieros a su valor neto en libros, que es su costo original menos la depreciación acumulada y cualquier cargo por deterioro')
ON CONFLICT (code) DO NOTHING;

-- 7. ASSET STATUS
INSERT INTO asset_status (code, description) VALUES
('available','Disponible / en bodega'),
('assigned','Asignado a estudiante'),
('repair','En reparación'),
('retired','Dado de baja'),
('on_loan','Prestado a taller externo')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- FIN DE MIGRACIÓN 002
-- ========================================
