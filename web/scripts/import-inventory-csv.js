/**
 * SCRIPT DE IMPORTACIÓN DE INVENTARIO DESDE CSV
 * Versión JavaScript (sin TypeScript)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración del proyecto de prueba
const INVENTORY_CONFIG = {
  url: 'https://rrajmmykivbzzobljqmm.supabase.co',
  serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyYWptbXlraXZienpvYmxqcW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY4MTk5OCwiZXhwIjoyMTAwMjU3OTk4fQ.Gj72kPIxvfapXMV4WJp6Agi38TUMJZ8m7oAJI5BLK-4'
};

const supabase = createClient(INVENTORY_CONFIG.url, INVENTORY_CONFIG.serviceRoleKey);

// Mapeo de condiciones a códigos de estado
const CONDITION_TO_STATUS = {
  'IN USE': 'assigned',
  'IN CORE': 'available',
  'In Repair': 'repair',
  'RETIRED': 'retired'
};

// Mapeo de STATUS a source
const STATUS_TO_SOURCE = {
  'Purchased': '01',
  'Borrowed': '03'
};

function parseInventoryCode(code) {
  if (!code || code.length !== 16) return null;
  
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

function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',');
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    
    rows.push(row);
  }
  
  return rows;
}

async function getCatalogId(table, code) {
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

async function getProgramByName(name) {
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

async function getTestOrganization() {
  // Primero intentar por nombre
  let { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', 'TOSA Test Organization')
    .single();
  
  if (data) return data.id;
  
  // Si no funciona, obtener cualquier organización
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();
  
  if (orgs) {
    console.log(`   Usando organización con ID: ${orgs.id}`);
    return orgs.id;
  }
  
  // Si tampoco funciona, usar el ID que vimos en los programas
  const fallbackId = '8bade020-abcc-4ee9-a14a-fa311bb3f482';
  console.log(`   Usando organización fallback: ${fallbackId}`);
  return fallbackId;
}

async function importAsset(row, programId, organizationId) {
  console.log(`\n📦 Procesando: ${row.DESCRIPTION} - ${row.BRAND} ${row.SIZE}`);
  
  let parsedCode = null;
  let catalogIds = {};
  
  if (row.INVENTORY_NUM && row.INVENTORY_NUM.length === 16) {
    parsedCode = parseInventoryCode(row.INVENTORY_NUM);
    
    if (parsedCode) {
      console.log(`   Código encontrado: ${row.INVENTORY_NUM}`);
      
      catalogIds.location_id = await getCatalogId('asset_locations', parsedCode.location);
      catalogIds.source_id = await getCatalogId('asset_sources', parsedCode.source);
      catalogIds.group_id = await getCatalogId('asset_groups', parsedCode.group);
      catalogIds.class_id = await getCatalogId('asset_classes', parsedCode.class);
    }
  } else {
    console.log(`   ⚠️  Sin código de inventario`);
  }
  
  // Valores por defecto
  if (!catalogIds.location_id) {
    catalogIds.location_id = await getCatalogId('asset_locations', '20');
  }
  
  if (!catalogIds.source_id) {
    const sourceCode = STATUS_TO_SOURCE[row.STATUS] || '01';
    catalogIds.source_id = await getCatalogId('asset_sources', sourceCode);
  }
  
  if (!catalogIds.group_id) {
    catalogIds.group_id = await getCatalogId('asset_groups', '08');
  }
  
  if (!catalogIds.class_id) {
    catalogIds.class_id = await getCatalogId('asset_classes', '01');
  }
  
  const statusCode = CONDITION_TO_STATUS[row.CONDITION] || 'available';
  
  const assetData = {
    organization_id: organizationId,
    full_code: parsedCode ? row.INVENTORY_NUM : null,
    location_id: catalogIds.location_id,
    source_id: catalogIds.source_id,
    group_id: catalogIds.group_id,
    class_id: catalogIds.class_id,
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
    assigned_to_text: row.ASSIGNED_TO || null,
    notes: row.OBSERVATIONS || null,
    is_active: true
  };
  
  const { data, error } = await supabase
    .from('assets')
    .insert(assetData)
    .select()
    .single();
  
  if (error) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
  
  console.log(`   ✅ Importado exitosamente (ID: ${data.id})`);
}

async function main() {
  console.log('========================================');
  console.log('IMPORTACIÓN DE INVENTARIO DESDE CSV');
  console.log('========================================');
  console.log(`URL: ${INVENTORY_CONFIG.url}`);
  console.log('========================================\n');
  
  try {
    const organizationId = await getTestOrganization();
    console.log(`✅ Organización encontrada: ${organizationId}\n`);
    
    // Importar Japhet
    console.log('📂 Importando datos de JAPHET...');
    const japhetPath = 'D:\\Proyectos Aplicaciones\\Attendance\\Inventory Data\\japhet_2025_2026.csv';
    const japhetRows = readCSV(japhetPath);
    const japhetProgramId = await getProgramByName('Japhet');
    
    console.log(`   Programa Japhet ID: ${japhetProgramId}`);
    console.log(`   Total de filas: ${japhetRows.length}`);
    
    for (const row of japhetRows) {
      await importAsset(row, japhetProgramId, organizationId);
    }
    
    console.log(`\n✅ Japhet completado: ${japhetRows.length} activos\n`);
    
    // Importar Stafford
    console.log('📂 Importando datos de STAFFORD...');
    const staffordPath = 'D:\\Proyectos Aplicaciones\\Attendance\\Inventory Data\\stafford_2025_2026.csv';
    const staffordRows = readCSV(staffordPath);
    const staffordProgramId = await getProgramByName('Stafford');
    
    console.log(`   Programa Stafford ID: ${staffordProgramId}`);
    console.log(`   Total de filas: ${staffordRows.length}`);
    
    for (const row of staffordRows) {
      await importAsset(row, staffordProgramId, organizationId);
    }
    
    console.log(`\n✅ Stafford completado: ${staffordRows.length} activos\n`);
    
    console.log('========================================');
    console.log('✅ IMPORTACIÓN COMPLETADA EXITOSAMENTE');
    console.log('========================================');
    console.log(`Total: ${japhetRows.length + staffordRows.length} activos`);
    
  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error);
    process.exit(1);
  }
}

main();
