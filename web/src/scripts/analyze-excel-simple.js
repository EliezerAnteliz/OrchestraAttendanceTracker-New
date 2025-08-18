const XLSX = require('xlsx');
const path = require('path');

// Ruta al archivo Excel
const excelFilePath = path.join(__dirname, '../../ASCEND @Stafford Visual & Performing Arts Elementary (Responses).xlsx');

try {
  // Leer el archivo Excel
  const workbook = XLSX.readFile(excelFilePath);
  
  // Obtener el nombre de la primera hoja
  const sheetName = workbook.SheetNames[0];
  console.log(`Nombre de la hoja: ${sheetName}`);
  
  // Obtener la hoja de trabajo
  const worksheet = workbook.Sheets[sheetName];
  
  // Convertir la hoja a JSON
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Mostrar las cabeceras (primera fila)
  if (data.length > 0) {
    console.log('Cabeceras del archivo:');
    data[0].forEach((header, index) => {
      console.log(`${index + 1}. ${header}`);
    });
    
    // Mostrar la primera fila de datos
    if (data.length > 1) {
      console.log('\nPrimera fila de datos:');
      data[1].forEach((value, index) => {
        const header = data[0][index] || `Columna ${index + 1}`;
        console.log(`${header}: ${value}`);
      });
    }
  } else {
    console.log('El archivo Excel no contiene datos.');
  }
  
} catch (error) {
  console.error('Error al analizar el archivo Excel:', error);
}
