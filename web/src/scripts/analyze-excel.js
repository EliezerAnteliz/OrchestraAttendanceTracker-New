const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Ruta al archivo Excel
const excelFilePath = path.join(__dirname, '../../ASCEND @Stafford Visual & Performing Arts Elementary (Responses).xlsx');

// Función para analizar el archivo Excel
function analyzeExcelFile() {
  try {
    // Leer el archivo Excel
    const workbook = XLSX.readFile(excelFilePath);
    
    // Obtener el nombre de la primera hoja
    const sheetName = workbook.SheetNames[0];
    
    // Obtener la hoja de trabajo
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir la hoja a JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
      console.log('El archivo Excel no contiene datos.');
      return;
    }
    
    // Obtener las columnas del primer registro
    const columns = Object.keys(data[0]);
    
    console.log('=== ANÁLISIS DEL ARCHIVO EXCEL ===');
    console.log(`Nombre de la hoja: ${sheetName}`);
    console.log(`Total de registros: ${data.length}`);
    console.log('\n=== COLUMNAS ENCONTRADAS ===');
    columns.forEach((column, index) => {
      console.log(`${index + 1}. ${column}`);
    });
    
    // Analizar los tipos de datos en cada columna
    console.log('\n=== ANÁLISIS DE TIPOS DE DATOS ===');
    const columnTypes = {};
    
    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== undefined && val !== null);
      
      // Determinar el tipo de datos predominante
      const types = {
        string: 0,
        number: 0,
        date: 0,
        boolean: 0,
        empty: 0
      };
      
      values.forEach(value => {
        if (value === undefined || value === null || value === '') {
          types.empty++;
        } else if (typeof value === 'number') {
          types.number++;
        } else if (typeof value === 'boolean') {
          types.boolean++;
        } else if (typeof value === 'string') {
          // Intentar detectar si es una fecha
          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{4}-\d{1,2}-\d{1,2}$/;
          if (datePattern.test(value)) {
            types.date++;
          } else {
            types.string++;
          }
        }
      });
      
      // Determinar el tipo predominante
      let predominantType = 'string';
      let maxCount = types.string;
      
      Object.keys(types).forEach(type => {
        if (types[type] > maxCount) {
          predominantType = type;
          maxCount = types[type];
        }
      });
      
      // Calcular el porcentaje de valores no vacíos
      const totalValues = data.length;
      const nonEmptyValues = totalValues - types.empty;
      const fillRate = Math.round((nonEmptyValues / totalValues) * 100);
      
      columnTypes[column] = {
        type: predominantType,
        fillRate: `${fillRate}%`,
        empty: types.empty,
        total: totalValues
      };
      
      console.log(`Columna: ${column}`);
      console.log(`  - Tipo predominante: ${predominantType}`);
      console.log(`  - Tasa de llenado: ${fillRate}%`);
      console.log(`  - Valores vacíos: ${types.empty} de ${totalValues}`);
      console.log('---');
    });
    
    // Mostrar una muestra de los datos
    console.log('\n=== MUESTRA DE DATOS (PRIMER REGISTRO) ===');
    console.log(JSON.stringify(data[0], null, 2));
    
    // Guardar el análisis en un archivo JSON para referencia
    const analysisResult = {
      sheetName,
      recordCount: data.length,
      columns,
      columnTypes,
      sampleData: data[0]
    };
    
    fs.writeFileSync(
      path.join(__dirname, '../excel-analysis-result.json'),
      JSON.stringify(analysisResult, null, 2)
    );
    
    console.log('\nAnálisis completado y guardado en excel-analysis-result.json');
    
  } catch (error) {
    console.error('Error al analizar el archivo Excel:', error);
  }
}

// Ejecutar el análisis
analyzeExcelFile();
