const XLSX = require('xlsx');
const path = require('path');

// Crear una plantilla de Excel para la carga masiva de estudiantes
function createExcelTemplate() {
  // Definir las columnas que necesitamos para estudiantes y padres
  const headers = [
    // Datos del estudiante
    'student_id',  // Añadido campo student_id como primera columna
    'first_name',
    'last_name',
    'current_grade',
    'age',
    'instrument',
    'instrument_size',
    'orchestra_position',
    'active',
    // Datos del padre/madre/tutor
    'parent_first_name',
    'parent_last_name',
    'parent_phone_number',
    'parent_email',
    'parent_preferred_contact_method',
    // Alergias/condiciones médicas — form "Ascend Enrollment" (cols AE-AL),
    // carga manual (13/08). Ver ExcelUploader.tsx.
    'dietary_restrictions',
    'dietary_restrictions_details',
    'requires_special_care',
    'special_care_details',
    'takes_medication',
    'medication_details',
    'has_allergies_or_illness',
    'allergies_illness_details',
    // Personas autorizadas para retirar (cols BX-CC) — hasta 2 personas,
    // igual que trae el formulario de origen.
    'authorized_pickup_1_first_name',
    'authorized_pickup_1_last_name',
    'authorized_pickup_1_phone',
    'authorized_pickup_2_first_name',
    'authorized_pickup_2_last_name',
    'authorized_pickup_2_phone'
  ];

  // Crear un libro de trabajo
  const workbook = XLSX.utils.book_new();

  // Crear una hoja de trabajo
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);

  // Ancho de columna según el largo del encabezado (13/08, pedido de
  // Eliezer: que se lean los encabezados sin tener que agrandar cada
  // columna a mano). OJO: el paquete "xlsx" (SheetJS Community, no Pro)
  // NO soporta escribir estilos de celda (negrita, relleno) — eso se
  // aplica aparte con Python/openpyxl sobre este mismo archivo. Si se
  // vuelve a correr este script, el ancho de columna se conserva pero
  // la negrita del encabezado se pierde y hay que reaplicarla.
  worksheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));

  // Añadir la hoja al libro
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  
  // Escribir el archivo
  const outputPath = path.join(__dirname, '../../public/student_template_updated.xlsx');
  XLSX.writeFile(workbook, outputPath);
  
  console.log(`Plantilla Excel creada en: ${outputPath}`);
}

// Ejecutar la función
createExcelTemplate();
