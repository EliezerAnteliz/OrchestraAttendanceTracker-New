const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

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
  
  // Obtener el rango de celdas
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  // Extraer las cabeceras (primera fila)
  const headers = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({r: 0, c: C});
    const cell = worksheet[cellAddress];
    headers.push(cell ? cell.v : undefined);
  }
  
  // Mostrar las cabeceras
  console.log('Cabeceras del archivo:');
  headers.forEach((header, index) => {
    if (header) {
      console.log(`${index + 1}. ${header}`);
    }
  });
  
  // Extraer la primera fila de datos para ejemplo
  const firstRow = {};
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const headerAddress = XLSX.utils.encode_cell({r: 0, c: C});
    const dataAddress = XLSX.utils.encode_cell({r: 1, c: C});
    const headerCell = worksheet[headerAddress];
    const dataCell = worksheet[dataAddress];
    
    if (headerCell && dataCell) {
      firstRow[headerCell.v] = dataCell.v;
    }
  }
  
  console.log('\nPrimera fila de datos (ejemplo):');
  console.log(JSON.stringify(firstRow, null, 2));
  
  // Guardar los resultados en un archivo JSON
  fs.writeFileSync(
    path.join(__dirname, '../excel-headers.json'),
    JSON.stringify({ headers, firstRow }, null, 2)
  );
  
  console.log('\nCabeceras y ejemplo guardados en excel-headers.json');
  
} catch (error) {
  console.error('Error al analizar el archivo Excel:', error);
}
