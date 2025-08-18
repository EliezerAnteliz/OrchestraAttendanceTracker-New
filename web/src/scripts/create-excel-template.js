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
    'parent_preferred_contact_method'
  ];

  // Crear un libro de trabajo
  const workbook = XLSX.utils.book_new();
  
  // Crear una hoja de trabajo
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  
  // Añadir la hoja al libro
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  
  // Escribir el archivo
  const outputPath = path.join(__dirname, '../../public/student_template_updated.xlsx');
  XLSX.writeFile(workbook, outputPath);
  
  console.log(`Plantilla Excel creada en: ${outputPath}`);
}

// Ejecutar la función
createExcelTemplate();
