/**
 * SCRIPT DE IMPORTACIÓN DE INVENTARIO DESDE CSV
 * 
 * ⚠️ IMPORTANTE: Este script importa datos REALES de instrumentos
 * Solo ejecutar en proyecto de prueba: rrajmmykivbzzobljqmm
 * 
 * Archivos de entrada:
 * - D:\Proyectos Aplicaciones\Attendance\Inventory Data\japhet_2025_2026.csv
 * - D:\Proyectos Aplicaciones\Attendance\Inventory Data\stafford_2025_2026.csv
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { INVENTORY_SUPABASE_CONFIG } from '../supabase.inventory.config';

// Configurar cliente de Supabase para ambiente de prueba
const supabase = createClient(
  INVENTORY_SUPABASE_CONFIG.url,
  INVENTORY_SUPABASE_CONFIG.anonKey
);

interface CSVRow {
  SITE: string;
  DESCRIPTION: string;
  BRAND: string;
  SIZE: string;
  SERIAL: string;
  MODEL: string;
  INVENTORY_NUM: string;
  OWNER: string;
  STATUS: string;
  CONDITION: string;
  ASSIGNED_TO: string;
  OBSERVATIONS: string;
  ESTIMATED_COST: string;
}

interface ParsedInventoryCode {
  location: string;      // 2 dígitos
  workArea: string;      // 2 dígitos
  source: string;        // 2 dígitos
  group: string;         // 2 dígitos
  class: string;         // 2 dígitos
  characteristic: string; // 2 dígitos
  sequence: string;      // 4 dígitos
}

// Mapeo de condiciones a códigos de estado
const CONDITION_TO_STATUS: Record<string, string> = {
  'IN USE': 'assigned',
  'IN CORE': 'available',
  'In Repair': 'repair',
  'RETIRED': 'retired'
};

// Mapeo de STATUS (Purchased/Borrowed) a source_id
const STATUS_TO_SOURCE: Record<string, string> = {
  'Purchased': '01', // Comprado
  'Borrowed': '03'   // Alquilado (prestado es similar)
};

/**
 * Parsea un código de inventario de 16 dígitos
 * Formato: 2+2+2+2+2+2+4 = 16 dígitos
 */
function parseInventoryCode(code: string): ParsedInventoryCode | null {
  if (!code || code.length !== 16) {
    return null;
  }

  return {
    location: code.substring(0, 2),
    workArea: code.substring(2, 4),
    source: code.substring(4, 6),
    group: code.substring(6, 8),
    class: code.substring(8, 10),
    characteristic: code.substring(10, 12),
    sequence: code.substring(12, 16)
  };
}

/**
 * Lee y parsea un archivo CSV
 */
function readCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }

  // Primera línea son los headers
  const headers = lines[0].split(',');
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    
    rows.push(row as CSVRow);
  }

  return rows;
}

/**
 * Busca el ID de un catálogo por su código
 */
async function getCatalogId(table: string, code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('code', code)
    .single();

  if (error || !data) {
    console.warn(`⚠️  No se encontró ${table} con código: ${code}`);
    return null;
  }

  return data.id;
}

/**
 * Busca un programa por nombre (case insensitive)
 */
async function getProgramByName(name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single();

  if (error || !data) {
    console.warn(`⚠️  No se encontró programa con nombre: ${name}`);
    return null;
  }

  return data.id;
}

/**
 * Busca un estudiante por nombre
 */
async function getStudentByName(name: string, programId: string): Promise<string | null> {
  if (!name || name.trim() === '') {
    return null;
  }

  const nameParts = name.trim().split(' ');
  if (nameParts.length === 0) {
    return null;
  }

  // Intentar búsqueda por nombre completo
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('program_id', programId)
    .or(`first_name.ilike.%${nameParts[0]}%,last_name.ilike.%${nameParts[nameParts.length - 1]}%`)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Obtiene la organización de prueba
 */
async function getTestOrganization(): Promise<string> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', 'test-org-001')
    .single();

  if (error || !data) {
    throw new Error('No se encontró la organización de prueba. Ejecuta primero 000_seed_test_data.sql');
  }

  return data.id;
}

/**
 * Importa una fila del CSV a la tabla assets
 */
async function importAsset(row: CSVRow, programId: string, organizationId: string): Promise<void> {
  console.log(`\n📦 Procesando: ${row.DESCRIPTION} - ${row.BRAND} ${row.SIZE}`);

  // Parsear código de inventario si existe
  let parsedCode: ParsedInventoryCode | null = null;
  let catalogIds: any = {};

  if (row.INVENTORY_NUM && row.INVENTORY_NUM.length === 16) {
    parsedCode = parseInventoryCode(row.INVENTORY_NUM);
    
    if (parsedCode) {
      console.log(`   Código encontrado: ${row.INVENTORY_NUM}`);
      
      // Buscar IDs en catálogos
      catalogIds.location_id = await getCatalogId('asset_locations', parsedCode.location);
      catalogIds.work_area_id = await getCatalogId('asset_work_areas', parsedCode.workArea);
      catalogIds.source_id = await getCatalogId('asset_sources', parsedCode.source);
      catalogIds.group_id = await getCatalogId('asset_groups', parsedCode.group);
      catalogIds.class_id = await getCatalogId('asset_classes', parsedCode.class);
      catalogIds.characteristic_id = await getCatalogId('asset_characteristics', parsedCode.characteristic);
    }
  } else {
    console.log(`   ⚠️  Sin código de inventario - se importará sin full_code`);
  }

  // Si no hay código o faltan catálogos, usar valores por defecto
  if (!catalogIds.location_id) {
    // Usar ubicación de Gerencia Ascend Oeste por defecto
    catalogIds.location_id = await getCatalogId('asset_locations', '20');
  }
  
  if (!catalogIds.source_id) {
    // Mapear STATUS a source
    const sourceCode = STATUS_TO_SOURCE[row.STATUS] || '01';
    catalogIds.source_id = await getCatalogId('asset_sources', sourceCode);
  }
  
  if (!catalogIds.group_id) {
    // Instrumentos musicales por defecto
    catalogIds.group_id = await getCatalogId('asset_groups', '08');
  }
  
  if (!catalogIds.class_id) {
    // Tangible por defecto
    catalogIds.class_id = await getCatalogId('asset_classes', '01');
  }

  // Mapear CONDITION a status_code
  const statusCode = CONDITION_TO_STATUS[row.CONDITION] || 'available';

  // Buscar estudiante asignado
  let assignedStudentId: string | null = null;
  let assignedToText: string | null = null;

  if (row.ASSIGNED_TO && row.ASSIGNED_TO.trim() !== '') {
    assignedStudentId = await getStudentByName(row.ASSIGNED_TO, programId);
    
    if (!assignedStudentId) {
      // No es un estudiante, guardar como texto
      assignedToText = row.ASSIGNED_TO;
      console.log(`   Asignado a (texto): ${assignedToText}`);
    } else {
      console.log(`   Asignado a estudiante: ${row.ASSIGNED_TO}`);
    }
  }

  // Preparar datos para inserción
  const assetData: any = {
    organization_id: organizationId,
    full_code: parsedCode ? row.INVENTORY_NUM : null,
    location_id: catalogIds.location_id,
    work_area_id: catalogIds.work_area_id || null,
    source_id: catalogIds.source_id,
    group_id: catalogIds.group_id,
    class_id: catalogIds.class_id,
    characteristic_id: catalogIds.characteristic_id || null,
    sequence_number: parsedCode ? parseInt(parsedCode.sequence) : Math.floor(Math.random() * 9999),
    description: row.DESCRIPTION,
    brand: row.BRAND || null,
    size: row.SIZE || null,
    serial_number: row.SERIAL || null,
    model: row.MODEL || null,
    owner: row.OWNER || null,
    estimated_cost: row.ESTIMATED_COST ? parseFloat(row.ESTIMATED_COST) : null,
    status_code: statusCode,
    current_program_id: programId,
    assigned_student_id: assignedStudentId,
    assigned_to_text: assignedToText,
    notes: row.OBSERVATIONS || null,
    is_active: true
  };

  // Insertar en la base de datos
  const { data, error } = await supabase
    .from('assets')
    .insert(assetData)
    .select()
    .single();

  if (error) {
    console.error(`   ❌ Error al insertar: ${error.message}`);
    throw error;
  }

  console.log(`   ✅ Importado exitosamente (ID: ${data.id})`);
}

/**
 * Función principal
 */
async function main() {
  console.log('========================================');
  console.log('IMPORTACIÓN DE INVENTARIO DESDE CSV');
  console.log('========================================');
  console.log(`Proyecto: ${INVENTORY_SUPABASE_CONFIG.description}`);
  console.log(`URL: ${INVENTORY_SUPABASE_CONFIG.url}`);
  console.log('========================================\n');

  try {
    // Obtener organización de prueba
    const organizationId = await getTestOrganization();
    console.log(`✅ Organización de prueba encontrada: ${organizationId}\n`);

    // Importar Japhet
    console.log('📂 Importando datos de JAPHET...');
    const japhetPath = 'D:\\Proyectos Aplicaciones\\Attendance\\Inventory Data\\japhet_2025_2026.csv';
    const japhetRows = readCSV(japhetPath);
    const japhetProgramId = await getProgramByName('Japhet');
    
    if (!japhetProgramId) {
      throw new Error('No se encontró el programa Japhet Test');
    }

    console.log(`   Programa Japhet ID: ${japhetProgramId}`);
    console.log(`   Total de filas: ${japhetRows.length}`);

    for (const row of japhetRows) {
      await importAsset(row, japhetProgramId, organizationId);
    }

    console.log(`\n✅ Japhet completado: ${japhetRows.length} activos importados\n`);

    // Importar Stafford
    console.log('📂 Importando datos de STAFFORD...');
    const staffordPath = 'D:\\Proyectos Aplicaciones\\Attendance\\Inventory Data\\stafford_2025_2026.csv';
    const staffordRows = readCSV(staffordPath);
    const staffordProgramId = await getProgramByName('Stafford');
    
    if (!staffordProgramId) {
      throw new Error('No se encontró el programa Stafford Test');
    }

    console.log(`   Programa Stafford ID: ${staffordProgramId}`);
    console.log(`   Total de filas: ${staffordRows.length}`);

    for (const row of staffordRows) {
      await importAsset(row, staffordProgramId, organizationId);
    }

    console.log(`\n✅ Stafford completado: ${staffordRows.length} activos importados\n`);

    console.log('========================================');
    console.log('✅ IMPORTACIÓN COMPLETADA EXITOSAMENTE');
    console.log('========================================');
    console.log(`Total de activos importados: ${japhetRows.length + staffordRows.length}`);

  } catch (error) {
    console.error('\n❌ ERROR EN LA IMPORTACIÓN:');
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar
main();
