// Script para verificar la estructura de la base de datos
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseStructure() {
  try {
    console.log('Verificando estructura de la base de datos...');
    
    // Obtener un estudiante para ejemplo
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .limit(1);
    
    if (studentsError) {
      console.error('Error al obtener estudiantes:', studentsError);
    } else {
      console.log('Estructura de la tabla students:');
      if (students.length > 0) {
        console.log(Object.keys(students[0]));
        console.log('Ejemplo de ID de estudiante:', students[0].id);
      } else {
        console.log('No se encontraron estudiantes');
      }
    }
    
    // Obtener estructura de la tabla parents
    const { data: parents, error: parentsError } = await supabase
      .from('parents')
      .select('*')
      .limit(1);
    
    if (parentsError) {
      console.error('Error al obtener padres:', parentsError);
    } else {
      console.log('\nEstructura de la tabla parents:');
      if (parents.length > 0) {
        console.log(Object.keys(parents[0]));
        console.log('Ejemplo de padre:', parents[0]);
      } else {
        console.log('No se encontraron padres');
      }
    }
    
    // Obtener estructura de la tabla student_parents
    const { data: studentParents, error: studentParentsError } = await supabase
      .from('student_parents')
      .select('*')
      .limit(5);
    
    if (studentParentsError) {
      console.error('Error al obtener relaciones estudiante-padre:', studentParentsError);
    } else {
      console.log('\nEstructura de la tabla student_parents:');
      if (studentParents.length > 0) {
        console.log(Object.keys(studentParents[0]));
        console.log('Ejemplos de relaciones:');
        studentParents.forEach(sp => console.log(`- Estudiante ${sp.student_id} -> Padre ${sp.parent_id}`));
      } else {
        console.log('No se encontraron relaciones estudiante-padre');
      }
    }
    
    // Verificar relaciones específicas
    if (students.length > 0) {
      const studentId = students[0].id;
      console.log(`\nBuscando padres para el estudiante con ID: ${studentId}`);
      
      const { data: relations, error: relationsError } = await supabase
        .from('student_parents')
        .select('parent_id')
        .eq('student_id', studentId);
      
      if (relationsError) {
        console.error('Error al buscar relaciones:', relationsError);
      } else if (relations.length > 0) {
        console.log(`Se encontraron ${relations.length} padres asociados`);
        const parentIds = relations.map(r => r.parent_id);
        console.log('IDs de padres:', parentIds);
        
        const { data: parentDetails, error: parentDetailsError } = await supabase
          .from('parents')
          .select('*')
          .in('id', parentIds);
        
        if (parentDetailsError) {
          console.error('Error al obtener detalles de padres:', parentDetailsError);
        } else {
          console.log('Detalles de padres encontrados:');
          console.log(parentDetails);
        }
      } else {
        console.log('No se encontraron padres asociados a este estudiante');
      }
    }
  } catch (error) {
    console.error('Error general:', error);
  }
}

checkDatabaseStructure();
