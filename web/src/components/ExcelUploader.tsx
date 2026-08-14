import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { FiDownload, FiUpload, FiAlertCircle, FiCheckCircle, FiFile, FiX, FiUsers } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';

// Datos médicos/de retiro autorizado del formulario "Ascend Enrollment" (13/08) —
// se suben a mano vía esta misma plantilla, sin sincronización en vivo con el
// formulario de Google. Se guardan tal cual vienen (texto libre), sin
// interpretar ni normalizar el contenido.
interface AuthorizedPickupPerson {
  first_name: string;
  last_name: string;
  phone: string;
}

interface Student {
  student_id?: string; // Hacemos student_id opcional para que no se envíe en inserciones nuevas
  first_name: string;
  last_name: string;
  instrument?: string;
  current_grade?: string;
  age?: number;
  orchestra_position?: string;
  is_active?: boolean;
  dietary_restrictions?: string;
  dietary_restrictions_details?: string;
  requires_special_care?: string;
  special_care_details?: string;
  takes_medication?: string;
  medication_details?: string;
  has_allergies_or_illness?: string;
  allergies_illness_details?: string;
  authorized_pickup?: AuthorizedPickupPerson[];
}

interface Parent {
  id?: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  email?: string;
  preferred_contact_method?: string;
  full_name?: string;
}

interface StudentParent {
  student_id: string;
  parent_id: string;
  relationship_type?: string;
}

interface ExcelUploaderProps {
  onComplete: (results: { added: number; updated: number; errors: number }) => void;
}

interface DuplicateCandidate {
  existingStudent: any;
  excelRow: any;
  similarity: number;
}

interface ConfirmationDialog {
  isOpen: boolean;
  candidate: DuplicateCandidate | null;
  onConfirm: (action: 'update' | 'create') => void;
  onCancel: () => void;
}

export default function ExcelUploader({ onComplete }: ExcelUploaderProps) {
  const { t } = useI18n();
  const { activeProgram } = useProgram();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ total: 0, processed: 0 });
  const [results, setResults] = useState({ added: 0, updated: 0, errors: 0 });
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [tableStructure, setTableStructure] = useState<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialog>({
    isOpen: false,
    candidate: null,
    onConfirm: () => {},
    onCancel: () => {}
  });
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // Obtener la estructura de la tabla students al cargar el componente
  useEffect(() => {
    const fetchTableStructure = async () => {
      try {
        // Obtener un registro para ver la estructura
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .limit(1);
          
        if (error) {
          console.error('Error al obtener estructura de tabla:', error);
          return;
        }
        
        if (data && data.length > 0) {
          console.log('Estructura de la tabla students:', Object.keys(data[0]));
          console.log('Tipos de datos:', JSON.stringify(data[0]));
          setTableStructure(data[0]);
          
          // Mostrar si student_id y id son diferentes
          if ('id' in data[0] && 'student_id' in data[0]) {
            console.log('Campo id:', data[0].id);
            console.log('Campo student_id:', data[0].student_id);
            console.log('Son iguales:', data[0].id === data[0].student_id);
          } else {
            console.log('Campos disponibles:', Object.keys(data[0]).join(', '));
          }
        }
        
        // Consultar la estructura de la tabla directamente
        const { data: tableInfo, error: tableError } = await supabase
          .from('students')
          .select('*')
          .limit(5);
          
        if (tableInfo && tableInfo.length > 0) {
          console.log('Muestra de 5 registros:');
          tableInfo.forEach((row, index) => {
            console.log(`Registro ${index + 1}:`, JSON.stringify(row));
          });
        }
      } catch (error) {
        console.error('Error al obtener estructura:', error);
      }
    };
    
    fetchTableStructure();
  }, []);

  const processFile = async (f: File) => {
    setFile(f);
    setIsUploading(true);
    setProgress({ total: 0, processed: 0 });
    setResults({ added: 0, updated: 0, errors: 0 });
    setErrorMessages([]);

    try {
      // Leer el archivo Excel
      const data = await f.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      console.log('\n🚀 INICIANDO PROCESAMIENTO DE', jsonData.length, 'FILAS');
      console.log('Datos del Excel:', jsonData);

      setProgress({ total: jsonData.length, processed: 0 });
      
      // Procesar cada fila
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        console.log(`\n📋 PROCESANDO FILA ${i + 1}/${jsonData.length}:`, row);
        
        try {
          await processStudentRow(row);
          setProgress(prev => ({ ...prev, processed: prev.processed + 1 }));
          console.log(`✅ Fila ${i + 1} procesada exitosamente`);
        } catch (error: any) {
          console.error(`❌ Error en fila ${i + 1}:`, error);
          setErrorMessages(prev => [...prev, `Error en fila ${i + 2}: ${error.message}`]);
          setResults(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      }

      onComplete(results);
    } catch (error: any) {
      console.error('Error processing Excel file:', error);
      setErrorMessages(prev => [...prev, `Error al procesar el archivo: ${error.message}`]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await processFile(f);
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const excelFile = files.find(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    );
    
    if (excelFile) {
      await processFile(excelFile);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeFile = () => {
    setFile(null);
    setResults({ added: 0, updated: 0, errors: 0 });
    setErrorMessages([]);
  };

  // Función para normalizar texto removiendo acentos y tildes
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD') // Descomponer caracteres con acentos
      .replace(/[\u0300-\u036f]/g, '') // Remover marcas diacríticas (acentos, tildes)
      .replace(/\s+/g, ' '); // Normalizar espacios
  };

  // Arma el array authorized_pickup a partir de las 6 columnas planas del
  // Excel (authorized_pickup_1_first_name, _last_name, _phone, y lo mismo
  // para _2) — la plantilla solo trae 2 personas (así viene el formulario de
  // origen), pero se guarda como jsonb para no atarse a ese número. Se
  // saltea a la persona #N si no trajo ni nombre ni apellido en el Excel.
  const buildAuthorizedPickup = (row: any): AuthorizedPickupPerson[] => {
    const people: AuthorizedPickupPerson[] = [];
    for (const n of [1, 2]) {
      const first = row[`authorized_pickup_${n}_first_name`];
      const last = row[`authorized_pickup_${n}_last_name`];
      const phone = row[`authorized_pickup_${n}_phone`];
      if ((first && String(first).trim()) || (last && String(last).trim())) {
        people.push({
          first_name: first ? String(first).trim() : '',
          last_name: last ? String(last).trim() : '',
          phone: phone ? String(phone).trim() : '',
        });
      }
    }
    return people;
  };

  // true si el Excel trajo AL MENOS UNA de las 6 columnas de retiro
  // autorizado con algo — se usa para decidir si esta fila debe pisar el
  // authorized_pickup ya guardado (si la fila no trae nada de esto, se deja
  // el valor existente tal cual, igual que el resto de campos opcionales).
  const hasAuthorizedPickupData = (row: any): boolean => {
    return [1, 2].some((n) =>
      [`authorized_pickup_${n}_first_name`, `authorized_pickup_${n}_last_name`, `authorized_pickup_${n}_phone`].some(
        (key) => row[key] && String(row[key]).trim()
      )
    );
  };

  // Función para normalizar y dividir nombres
  const parseFullName = (fullName: string) => {
    const normalized = normalizeText(fullName);
    const parts = normalized.split(' ').filter(part => part.length > 0);
    
    return {
      original: normalized,
      parts: parts,
      firstNames: parts.slice(0, -1), // Todos excepto el último (asumiendo que el último es apellido)
      lastNames: parts.slice(-1), // Solo el último
      // Si hay más de 2 partes, asumir formato: nombre1 nombre2 apellido1 apellido2
      firstName: parts[0] || '',
      lastName: parts[parts.length - 1] || '',
      fullFirstNames: parts.length > 2 ? parts.slice(0, Math.ceil(parts.length / 2)) : [parts[0] || ''],
      fullLastNames: parts.length > 2 ? parts.slice(Math.ceil(parts.length / 2)) : [parts[parts.length - 1] || '']
    };
  };

  // Función mejorada para calcular similitud entre nombres
  const calculateNameSimilarity = (name1: string, name2: string): number => {
    const parsed1 = parseFullName(name1);
    const parsed2 = parseFullName(name2);
    
    console.log('Calculando similitud entre:');
    console.log('- Nombre 1:', name1, '→', parsed1.parts);
    console.log('- Nombre 2:', name2, '→', parsed2.parts);
    
    // Coincidencia exacta
    if (parsed1.original === parsed2.original) return 1.0;
    
    // Contar coincidencias exactas de componentes
    let exactMatches = 0;
    const matchedParts = [];
    
    for (const part1 of parsed1.parts) {
      if (parsed2.parts.includes(part1) && part1.length > 1) {
        exactMatches++;
        matchedParts.push(part1);
      }
    }
    
    console.log('- Componentes que coinciden:', matchedParts);
    console.log('- Total de coincidencias:', exactMatches);
    
    // Si no hay al menos 2 componentes que coinciden, no es candidato
    if (exactMatches < 2) {
      console.log('❌ Menos de 2 componentes coinciden');
      return 0.0;
    }
    
    // Verificar patrones específicos de coincidencia
    const firstNameMatch = parsed1.firstName === parsed2.firstName && parsed1.firstName.length > 1;
    const lastNameMatch = parsed1.lastName === parsed2.lastName && parsed1.lastName.length > 1;
    
    console.log('- Primer nombre coincide:', firstNameMatch, `(${parsed1.firstName} vs ${parsed2.firstName})`);
    console.log('- Último apellido coincide:', lastNameMatch, `(${parsed1.lastName} vs ${parsed2.lastName})`);
    
    // Caso 1: Coincidencia de primer nombre + algún apellido
    if (firstNameMatch && matchedParts.some(part => part !== parsed1.firstName)) {
      console.log('✅ Patrón detectado: Primer nombre + apellido coinciden');
      
      // Verificar si uno es subconjunto del otro
      const isSubset1 = parsed1.parts.every(part => parsed2.parts.includes(part));
      const isSubset2 = parsed2.parts.every(part => parsed1.parts.includes(part));
      
      if (isSubset1 || isSubset2) {
        // Caso como "Jesus Delgado" vs "Jesus Anthony Delgado" - alta similitud
        console.log('🔥 Subconjunto detectado - alta similitud');
        return 0.9;
      } else {
        // Caso como "Ian Ramirez" vs "Ian Daniel Rivera-Ramirez" - similitud media para confirmación
        console.log('⚠️ Coincidencia parcial - requiere confirmación');
        return 0.75;
      }
    }
    
    // Caso 2: Solo coincidencias de apellidos sin primer nombre
    if (!firstNameMatch && exactMatches >= 2) {
      console.log('⚪ Solo apellidos coinciden');
      return 0.6;
    }
    
    // Otros casos
    const totalComponents = Math.max(parsed1.parts.length, parsed2.parts.length);
    const componentSimilarity = exactMatches / totalComponents;
    
    console.log('- Similitud por componentes:', componentSimilarity);
    
    return componentSimilarity >= 0.5 ? componentSimilarity : 0.0;
  };

  // Función para buscar candidatos similares con mejor precisión
  const findSimilarStudents = async (firstName: string, lastName: string) => {
    console.log('=== INICIANDO BÚSQUEDA DE SIMILARES ===');
    console.log('Buscando para:', firstName, lastName);
    
    const { data: allStudents, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, instrument, current_grade, age')
      .eq('program_id', activeProgram?.id);

    if (error || !allStudents) {
      console.log('Error o sin estudiantes:', error);
      return [];
    }

    console.log('Total de estudiantes en BD:', allStudents.length);

    const candidates: DuplicateCandidate[] = [];
    const inputFullName = `${firstName} ${lastName}`;
    const inputParsed = parseFullName(inputFullName);

    console.log('Input parseado:', inputParsed);

    for (const student of allStudents) {
      const existingFullName = `${student.first_name} ${student.last_name}`;
      const existingParsed = parseFullName(existingFullName);
      
      console.log(`\n--- Comparando ---`);
      console.log('Input:', inputFullName, '→', inputParsed.parts);
      console.log('BD:', existingFullName, '→', existingParsed.parts);
      
      const similarity = calculateNameSimilarity(inputFullName, existingFullName);
      
      console.log('Similitud calculada:', similarity);
      
      // Considerar como candidato si hay similitud > 0.6 pero < 1.0 (no exacta)
      if (similarity >= 0.6 && similarity < 1.0) {
        console.log('✅ CANDIDATO VÁLIDO:', existingFullName, 'Similitud:', similarity);
        candidates.push({
          existingStudent: student,
          excelRow: { first_name: firstName, last_name: lastName },
          similarity
        });
      } else if (similarity > 0) {
        console.log('⚪ Similitud insuficiente:', existingFullName, 'Similitud:', similarity);
      } else {
        console.log('⚫ Sin similitud:', existingFullName);
      }
    }

    console.log('\n=== RESUMEN ===');
    console.log('Total de candidatos encontrados:', candidates.length);
    candidates.forEach((c, i) => {
      console.log(`${i + 1}. ${c.existingStudent.first_name} ${c.existingStudent.last_name} (${Math.round(c.similarity * 100)}%)`);
    });
    
    // Ordenar por similitud descendente y tomar solo los mejores
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5); // Máximo 5 candidatos para mostrar más opciones
  };

  const processStudentRow = async (row: any, skipConfirmation = false) => {
    console.log('\n🔍 PROCESANDO ESTUDIANTE:', row.first_name, row.last_name);
    
    // Validar datos mínimos requeridos
    if (!row.first_name || !row.last_name) {
      throw new Error('Nombre y apellido son obligatorios');
    }

    try {
      // Preparar datos del estudiante - solo los campos necesarios
      const studentData = {
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        // Campos opcionales con valores por defecto o null
        instrument: row.instrument ? row.instrument.trim() : null,
        instrument_size: row.instrument_size ? String(row.instrument_size).trim() : null,
        current_grade: row.current_grade ? row.current_grade.toString().trim() : null,
        age: row.age ? parseInt(row.age.toString()) : null,
        orchestra_position: row.orchestra_position ? row.orchestra_position.trim() : null,
        is_active: row.active !== undefined ? Boolean(row.active) : true,
        // Alergias/condiciones médicas (form Ascend Enrollment, cols AE-AL) —
        // texto libre, tal cual viene del Excel.
        dietary_restrictions: row.dietary_restrictions ? String(row.dietary_restrictions).trim() : null,
        dietary_restrictions_details: row.dietary_restrictions_details ? String(row.dietary_restrictions_details).trim() : null,
        requires_special_care: row.requires_special_care ? String(row.requires_special_care).trim() : null,
        special_care_details: row.special_care_details ? String(row.special_care_details).trim() : null,
        takes_medication: row.takes_medication ? String(row.takes_medication).trim() : null,
        medication_details: row.medication_details ? String(row.medication_details).trim() : null,
        has_allergies_or_illness: row.has_allergies_or_illness ? String(row.has_allergies_or_illness).trim() : null,
        allergies_illness_details: row.allergies_illness_details ? String(row.allergies_illness_details).trim() : null,
        // Personas autorizadas para retirar (cols BX-CC) — jsonb, [] si el
        // Excel no trajo ninguna de las 6 columnas para esta fila.
        authorized_pickup: buildAuthorizedPickup(row)
      };

      console.log('Datos preparados para procesamiento:', studentData);

      // Verificar si el estudiante ya existe (coincidencia con normalización)
      console.log('Buscando coincidencias para:', studentData.first_name, studentData.last_name);
      
      // Obtener todos los estudiantes del programa para comparar con normalización
      const { data: allStudents, error: searchError } = await supabase
        .from('students')
        .select('id, first_name, last_name, instrument, current_grade')
        .eq('program_id', activeProgram?.id);

      if (searchError) {
        throw new Error(`Error al buscar estudiante: ${searchError.message}`);
      }

      // Buscar coincidencia exacta usando normalización
      const normalizedInputFirst = normalizeText(studentData.first_name);
      const normalizedInputLast = normalizeText(studentData.last_name);
      
      const exactMatches = allStudents?.filter(s => {
        const normalizedExistingFirst = normalizeText(s.first_name);
        const normalizedExistingLast = normalizeText(s.last_name);
        return normalizedExistingFirst === normalizedInputFirst && 
               normalizedExistingLast === normalizedInputLast;
      }) || [];

      console.log('Coincidencias exactas encontradas:', exactMatches?.length || 0, exactMatches);

      let studentId: string;

      // Si hay coincidencia exacta, actualizar
      if (exactMatches && exactMatches.length > 0) {
        studentId = exactMatches[0].id;
        console.log('Estudiante encontrado, actualizando ID:', studentId);
        
        // Obtener datos actuales del estudiante
        const { data: currentStudent, error: fetchError } = await supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .single();

        if (fetchError) {
          throw new Error(`Error al obtener datos actuales del estudiante: ${fetchError.message}`);
        }

        // Crear objeto de actualización solo con campos que no están vacíos en el Excel
        const updateData: any = {};
        
        // Solo actualizar campos que tienen valores en el Excel
        if (studentData.first_name && studentData.first_name.trim()) {
          updateData.first_name = studentData.first_name;
        }
        if (studentData.last_name && studentData.last_name.trim()) {
          updateData.last_name = studentData.last_name;
        }
        if (studentData.instrument && studentData.instrument.trim()) {
          updateData.instrument = studentData.instrument;
        }
        if (studentData.instrument_size && studentData.instrument_size.trim()) {
          updateData.instrument_size = studentData.instrument_size;
        }
        if (studentData.current_grade && studentData.current_grade.trim()) {
          updateData.current_grade = studentData.current_grade;
        }
        if (studentData.age !== null && studentData.age !== undefined) {
          updateData.age = studentData.age;
        }
        if (studentData.orchestra_position && studentData.orchestra_position.trim()) {
          updateData.orchestra_position = studentData.orchestra_position;
        }
        if (studentData.is_active !== undefined) {
          updateData.is_active = studentData.is_active;
        }
        if (studentData.dietary_restrictions) updateData.dietary_restrictions = studentData.dietary_restrictions;
        if (studentData.dietary_restrictions_details) updateData.dietary_restrictions_details = studentData.dietary_restrictions_details;
        if (studentData.requires_special_care) updateData.requires_special_care = studentData.requires_special_care;
        if (studentData.special_care_details) updateData.special_care_details = studentData.special_care_details;
        if (studentData.takes_medication) updateData.takes_medication = studentData.takes_medication;
        if (studentData.medication_details) updateData.medication_details = studentData.medication_details;
        if (studentData.has_allergies_or_illness) updateData.has_allergies_or_illness = studentData.has_allergies_or_illness;
        if (studentData.allergies_illness_details) updateData.allergies_illness_details = studentData.allergies_illness_details;
        // authorized_pickup: solo pisa lo existente si el Excel trajo algo
        // en esta fila — si no, se deja el valor ya guardado tal cual.
        if (hasAuthorizedPickupData(row)) updateData.authorized_pickup = studentData.authorized_pickup;

        // Solo actualizar si hay campos para actualizar
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('students')
            .update(updateData)
            .eq('id', studentId);

          if (updateError) {
            throw new Error(`Error al actualizar estudiante: ${updateError.message}`);
          }
        }

        setResults(prev => ({ ...prev, updated: prev.updated + 1 }));
      } 
      // Si no hay coincidencia exacta, buscar candidatos similares
      else {
        console.log('No hay coincidencias exactas, buscando similares...');
        
        if (!skipConfirmation) {
          const similarCandidates = await findSimilarStudents(studentData.first_name, studentData.last_name);
          
          if (similarCandidates.length > 0) {
            console.log('Candidatos similares encontrados:', similarCandidates.length);
            // Mostrar diálogo de confirmación para el primer candidato más similar
            const bestCandidate = similarCandidates[0];
            
            return new Promise((resolve, reject) => {
              setConfirmationDialog({
                isOpen: true,
                candidate: {
                  ...bestCandidate,
                  excelRow: row
                },
                onConfirm: async (action: 'update' | 'create') => {
                  setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
                  try {
                    if (action === 'update') {
                      // Actualizar el estudiante existente
                      const result = await updateExistingStudent(bestCandidate.existingStudent.id, studentData, row);
                      resolve(result);
                    } else {
                      // Crear nuevo estudiante
                      const result = await createNewStudent(studentData, row);
                      resolve(result);
                    }
                  } catch (error) {
                    reject(error);
                  }
                },
                onCancel: () => {
                  setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
                  reject(new Error('Operación cancelada por el usuario'));
                }
              });
            });
          } else {
            console.log('No se encontraron candidatos similares');
          }
        }
        
        // Si no hay candidatos similares o se saltó la confirmación, crear nuevo estudiante
        console.log('Creando nuevo estudiante...');
        studentId = await createNewStudent(studentData, row);
      }

      // Procesar datos de padres si existen
      if (row.parent_first_name && row.parent_last_name) {
        await processParentData(row, studentId);
      }
    } catch (error: any) {
      console.error('Error procesando estudiante:', error);
      throw error;
    }
  };

  // Función auxiliar para actualizar estudiante existente
  const updateExistingStudent = async (studentId: string, studentData: any, row: any) => {
    console.log('Actualizando estudiante existente ID:', studentId);
    
    // Obtener datos actuales del estudiante
    const { data: currentStudent, error: fetchError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (fetchError) {
      throw new Error(`Error al obtener datos actuales del estudiante: ${fetchError.message}`);
    }

    // Crear objeto de actualización solo con campos que no están vacíos en el Excel
    const updateData: any = {};
    
    // Solo actualizar campos que tienen valores en el Excel
    if (studentData.first_name && studentData.first_name.trim()) {
      updateData.first_name = studentData.first_name;
    }
    if (studentData.last_name && studentData.last_name.trim()) {
      updateData.last_name = studentData.last_name;
    }
    if (studentData.instrument && studentData.instrument.trim()) {
      updateData.instrument = studentData.instrument;
    }
    if (studentData.instrument_size && studentData.instrument_size.trim()) {
      updateData.instrument_size = studentData.instrument_size;
    }
    if (studentData.current_grade && studentData.current_grade.trim()) {
      updateData.current_grade = studentData.current_grade;
    }
    if (studentData.age !== null && studentData.age !== undefined) {
      updateData.age = studentData.age;
    }
    if (studentData.orchestra_position && studentData.orchestra_position.trim()) {
      updateData.orchestra_position = studentData.orchestra_position;
    }
    if (studentData.is_active !== undefined) {
      updateData.is_active = studentData.is_active;
    }

    // Solo actualizar si hay campos para actualizar
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', studentId);

      if (updateError) {
        throw new Error(`Error al actualizar estudiante: ${updateError.message}`);
      }
    }

    setResults(prev => ({ ...prev, updated: prev.updated + 1 }));
    
    // Procesar datos de padres si existen
    if (row.parent_first_name && row.parent_last_name) {
      await processParentData(row, studentId);
    }
    
    return studentId;
  };

  // Función para generar un student_id único
  const generateUniqueStudentId = async (): Promise<string> => {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      // Generar ID con timestamp y random para mayor unicidad
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const candidateId = `S${timestamp}${random}`;
      
      // Verificar si ya existe
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('student_id', candidateId)
        .eq('organization_id', activeProgram?.organization_id);
      
      if (!existing || existing.length === 0) {
        console.log(`✅ student_id único generado: ${candidateId}`);
        return candidateId;
      }
      
      attempts++;
      console.log(`⚠️ Intento ${attempts}: ${candidateId} ya existe, reintentando...`);
    }
    
    // Si después de 10 intentos no se genera uno único, usar UUID
    const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    return `S${uuid}`;
  };

  // Función auxiliar para crear nuevo estudiante
  const createNewStudent = async (studentData: any, row: any) => {
    let studentIdToUse: string;
    
    // Si viene student_id en el Excel, verificar que no exista
    if (row.student_id && row.student_id.trim()) {
      const providedStudentId = row.student_id.trim();
      
      // Verificar si ya existe este student_id en la organización
      const { data: existingWithId } = await supabase
        .from('students')
        .select('id, student_id')
        .eq('student_id', providedStudentId)
        .eq('organization_id', activeProgram?.organization_id);
      
      if (existingWithId && existingWithId.length > 0) {
        console.log(`⚠️ student_id ${providedStudentId} ya existe, generando uno nuevo`);
        studentIdToUse = await generateUniqueStudentId();
      } else {
        studentIdToUse = providedStudentId;
      }
    } else {
      // Generar un student_id único
      studentIdToUse = await generateUniqueStudentId();
    }
    
    // Añadir student_id, program_id y organization_id a los datos del estudiante
    const studentDataWithId = {
      ...studentData,
      student_id: studentIdToUse,
      program_id: activeProgram?.id,
      organization_id: activeProgram?.organization_id
    };
    
    console.log('Intentando insertar estudiante con datos:', JSON.stringify(studentDataWithId));
    
    const { data: newStudent, error: insertError } = await supabase
      .from('students')
      .insert([studentDataWithId])
      .select('id, student_id')
      .single();

    if (insertError) {
      console.error('Error detallado al insertar:', insertError);
      throw new Error(`Error al insertar estudiante: ${insertError.code} - ${insertError.message}`);
    }
    
    if (!newStudent) {
      throw new Error('No se recibió respuesta de datos al insertar estudiante');
    }
    
    const studentId = newStudent.id;
    console.log('Estudiante insertado con ID:', studentId);
    setResults(prev => ({ ...prev, added: prev.added + 1 }));
    
    // Procesar datos de padres si existen
    if (row.parent_first_name && row.parent_last_name) {
      await processParentData(row, studentId);
    }
    
    return studentId;
  };

  const processParentData = async (row: any, studentId: string) => {
    try {
      // Preparar datos del padre/madre
      const parentData = {
        full_name: `${row.parent_first_name.trim()} ${row.parent_last_name.trim()}`,
        phone_number: row.parent_phone_number ? row.parent_phone_number.toString().trim() : null,
        email: row.parent_email ? row.parent_email.trim().toLowerCase() : null,
        preferred_contact_method: row.parent_preferred_contact_method ? row.parent_preferred_contact_method.trim() : 'phone',
        program_id: activeProgram?.id, // Usar el programa activo actual
        organization_id: activeProgram?.organization_id // Usar la organización del programa activo
      };
      
      console.log('Procesando datos de padre/madre:', parentData);

      // Buscar padre/madre existente por múltiples criterios
      const { data: allParents, error: searchError } = await supabase
        .from('parents')
        .select('id, full_name, email, phone_number')
        .eq('program_id', activeProgram?.id);

      if (searchError) {
        throw new Error(`Error al buscar padre/madre: ${searchError.message}`);
      }

      let parentId: string;
      let existingParent = null;

      // Buscar coincidencia por email (más confiable)
      if (parentData.email && allParents) {
        existingParent = allParents.find(p => 
          p.email && p.email.toLowerCase() === parentData.email?.toLowerCase()
        );
        if (existingParent) {
          console.log('Padre/madre encontrado por email:', existingParent.email);
        }
      }

      // Si no se encontró por email, buscar por teléfono
      if (!existingParent && parentData.phone_number && allParents) {
        const cleanPhone = parentData.phone_number.replace(/\D/g, ''); // Remover caracteres no numéricos
        existingParent = allParents.find(p => {
          if (!p.phone_number) return false;
          const cleanExistingPhone = p.phone_number.replace(/\D/g, '');
          return cleanExistingPhone === cleanPhone;
        });
        if (existingParent) {
          console.log('Padre/madre encontrado por teléfono:', existingParent.phone_number);
        }
      }

      // Si no se encontró por email ni teléfono, buscar por nombre normalizado
      if (!existingParent && allParents) {
        const normalizedInputName = normalizeText(parentData.full_name);
        existingParent = allParents.find(p => {
          const normalizedExistingName = normalizeText(p.full_name);
          return normalizedExistingName === normalizedInputName;
        });
        if (existingParent) {
          console.log('Padre/madre encontrado por nombre normalizado:', existingParent.full_name);
        }
      }

      // Si el padre/madre existe, actualizarlo solo con campos no vacíos
      if (existingParent) {
        parentId = existingParent.id;
        console.log('Padre/madre encontrado, actualizando ID:', parentId);
        
        // Obtener datos actuales del padre/madre
        const { data: currentParent, error: fetchError } = await supabase
          .from('parents')
          .select('*')
          .eq('id', parentId)
          .single();

        if (fetchError) {
          throw new Error(`Error al obtener datos actuales del padre/madre: ${fetchError.message}`);
        }

        // Crear objeto de actualización solo con campos que no están vacíos en el Excel
        const updateParentData: any = {};
        
        // Solo actualizar campos que tienen valores en el Excel
        if (parentData.full_name && parentData.full_name.trim()) {
          updateParentData.full_name = parentData.full_name;
        }
        if (parentData.phone_number && parentData.phone_number.trim()) {
          updateParentData.phone_number = parentData.phone_number;
        }
        if (parentData.email && parentData.email.trim()) {
          updateParentData.email = parentData.email;
        }
        if (parentData.preferred_contact_method && parentData.preferred_contact_method.trim()) {
          updateParentData.preferred_contact_method = parentData.preferred_contact_method;
        }

        // Solo actualizar si hay campos para actualizar
        if (Object.keys(updateParentData).length > 0) {
          const { error: updateError } = await supabase
            .from('parents')
            .update(updateParentData)
            .eq('id', parentId);
            
          if (updateError) {
            throw new Error(`Error al actualizar padre/madre: ${updateError.message}`);
          }
        }
      } 
      // Si no existe, crear nuevo padre/madre
      else {
        console.log('Padre/madre no encontrado, insertando nuevo');
        
        const { data: newParent, error: insertError } = await supabase
          .from('parents')
          .insert([parentData])
          .select('id')
          .single();

        if (insertError || !newParent) {
          throw new Error(`Error al insertar padre/madre: ${insertError?.message || 'No se pudo obtener el ID'}`);
        }

        parentId = newParent.id;
        console.log('Padre/madre insertado con ID:', parentId);
      }

      // Verificar si ya existe la relación estudiante-padre
      console.log('Verificando relación estudiante-padre con IDs:', { studentId, parentId });
      
      const { data: existingRelation, error: relationSearchError } = await supabase
        .from('student_parents')
        .select('*')
        .eq('student_id', studentId)
        .eq('parent_id', parentId);

      if (relationSearchError) {
        throw new Error(`Error al buscar relación estudiante-padre: ${relationSearchError.message}`);
      }

      // Si no existe la relación, crearla
      if (!existingRelation || existingRelation.length === 0) {
        console.log('Creando nueva relación estudiante-padre');
        
        const relationData = {
          student_id: studentId,
          parent_id: parentId,
          relationship: row.relationship_type || 'parent',
          is_primary_contact: true, // Asumimos que es contacto primario por defecto
          program_id: activeProgram?.id
        };

        const { error: relationError } = await supabase
          .from('student_parents')
          .insert([relationData]);

        if (relationError) {
          throw new Error(`Error al crear relación estudiante-padre: ${relationError.message}`);
        }
        
        console.log('Relación estudiante-padre creada exitosamente');
      } else {
        console.log('La relación estudiante-padre ya existe');
      }
    } catch (error: any) {
      console.error('Error procesando datos de padre/madre:', error);
      throw error;
    }
  };

  return (
    <div className="bg-[#FAF7F2]">
      <div className="p-6">
        {/* Instructions */}
        <div className="mb-6 bg-[#F4F0E8] border border-[#E3DDD1] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-1 bg-[#EFE9DD] rounded-full mt-0.5">
              <FiAlertCircle className="w-4 h-4 text-[#C2492B]" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-[#1B1917] mb-2">{t('usage_instructions')}</h4>
              <div className="text-sm text-[#56504A] space-y-1">
                <p><strong>{t('required_fields')}:</strong> {t('bulk_upload_required_fields')}</p>
                <p><strong>{t('optional_fields')}:</strong> {t('bulk_upload_optional_fields')}</p>
                <p><strong>{t('parent_data')}:</strong> {t('bulk_upload_parent_fields')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload Area */}
        <div 
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
            isDragOver 
              ? 'border-[#C2492B] bg-[#F4F0E8]' 
              : file 
                ? 'border-green-300 bg-green-50'
                : 'border-[#DED7C9] bg-[#FAF7F2] hover:border-[#C2492B] hover:bg-[#F4F0E8]'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {!file ? (
            <div className="space-y-4">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                isDragOver ? 'bg-[#EFE9DD]' : 'bg-[#EAE3D6]'
              }`}>
                <FiUpload className={`w-8 h-8 ${
                  isDragOver ? 'text-[#C2492B]' : 'text-[#8A8177]'
                }`} />
              </div>
              <div>
                <p className="text-lg font-medium text-[#1B1917] mb-1">
                  {isDragOver ? t('drop_file_here') : t('drag_excel_file_here')}
                </p>
                <p className="text-sm text-[#6E675E] mb-4">{t('or_click_to_select')}</p>
                <label htmlFor="excel-file-input" className="inline-flex items-center gap-2 px-6 py-3 bg-[#C2492B] text-white rounded-lg cursor-pointer hover:bg-[#A83A20] transition-colors font-medium">
                  <FiFile className="w-4 h-4" />
                  {t('select_file')}
                </label>
                <input
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-[#8A8177]">{t('supported_formats')}: .xlsx, .xls</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <FiFile className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-[#1B1917] mb-1">{t('file_selected')}</p>
                <div className="flex items-center justify-center gap-2 text-sm text-[#6E675E]">
                  <span className="font-medium">{file.name}</span>
                  <span className="text-[#A29889]">({(file.size / 1024).toFixed(1)} KB)</span>
                  {!isUploading && (
                    <button
                      onClick={removeFile}
                      className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {isUploading && (
                <div className="flex items-center justify-center gap-2 text-[#C2492B]">
                  <FiUpload className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">{t('processing_file')}...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className="mt-6 p-4 bg-[#F4F0E8] border border-[#E3DDD1] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[#1B1917]">
                {t('processing_records', { processed: progress.processed, total: progress.total })}
              </p>
              <span className="text-sm text-[#A83A20] font-medium">
                {progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-[#EAE3D6] rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#C2492B] to-[#A83A20] h-3 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {(results.added > 0 || results.updated > 0 || results.errors > 0) && !isUploading && (
          <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-[#F4F0E8] border border-green-200 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              {results.errors > 0 ? (
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <FiAlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
              ) : (
                <div className="p-2 bg-green-100 rounded-lg">
                  <FiCheckCircle className="w-5 h-5 text-green-600" />
                </div>
              )}
              <h3 className="text-lg font-semibold text-[#1B1917]">
                {results.errors > 0 ? t('process_completed_with_warnings') : t('process_completed_successfully')}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#FFFDFA] p-4 rounded-lg border border-green-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#6E675E]">{t('new_students')}</p>
                    <p className="text-2xl font-bold text-green-600">{results.added}</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FiUsers className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-[#FFFDFA] p-4 rounded-lg border border-[#E3DDD1] shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#6E675E]">{t('updated_students')}</p>
                    <p className="text-2xl font-bold text-[#C2492B]">{results.updated}</p>
                  </div>
                  <div className="p-2 bg-[#EFE9DD] rounded-lg">
                    <FiCheckCircle className="w-5 h-5 text-[#C2492B]" />
                  </div>
                </div>
              </div>
              <div className="bg-[#FFFDFA] p-4 rounded-lg border border-red-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#6E675E]">{t('errors')}</p>
                    <p className="text-2xl font-bold text-red-600">{results.errors}</p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-lg">
                    <FiAlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {errorMessages.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 bg-red-100 rounded-full">
                <FiAlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <h3 className="font-medium text-red-900">{t('errors_found')} ({errorMessages.length})</h3>
            </div>
            <div className="max-h-48 overflow-y-auto bg-[#FFFDFA] border border-red-200 rounded-md">
              <div className="p-3 space-y-2">
                {errorMessages.map((msg, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-red-800">{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Download Template */}
        <div className="mt-6 pt-6 border-t border-[#E3DDD1]">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-[#1B1917] mb-1">{t('need_template')}</h4>
              <p className="text-sm text-[#6E675E]">{t('download_template_description')}</p>
            </div>
            <a
              href="/student_template_updated.xlsx"
              download
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors font-medium"
            >
              <FiDownload className="w-4 h-4" />
              {t('download_excel_template')}
            </a>
          </div>
        </div>
      </div>

      {/* Diálogo de Confirmación de Duplicados */}
      {confirmationDialog.isOpen && confirmationDialog.candidate && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF7F2] rounded-xl shadow-2xl max-w-md w-full mx-4 border border-[#E3DDD1]">
            <div className="p-6">
              {/* Icono de advertencia */}
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full mb-4">
                <FiAlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              
              {/* Título */}
              <h3 className="text-lg font-semibold text-[#1B1917] text-center mb-4">
                Posible Estudiante Duplicado Detectado
              </h3>
              
              {/* Contenido */}
              <div className="space-y-4">
                <p className="text-sm text-[#6E675E] text-center">
                  Encontramos un estudiante similar en la base de datos:
                </p>
                
                {/* Comparación detallada */}
                <div className="bg-[#FAF7F2] rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <span className="text-xs font-medium text-[#8A8177] uppercase tracking-wide">Base de Datos</span>
                      <div className="mt-1 p-2 bg-[#EFE9DD] rounded text-sm font-semibold text-[#1B1917]">
                        {confirmationDialog.candidate.existingStudent.first_name} {confirmationDialog.candidate.existingStudent.last_name}
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium text-[#8A8177] uppercase tracking-wide">Excel</span>
                      <div className="mt-1 p-2 bg-green-100 rounded text-sm font-semibold text-green-900">
                        {confirmationDialog.candidate.excelRow.first_name} {confirmationDialog.candidate.excelRow.last_name}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center py-2 border-t border-[#E3DDD1]">
                    <span className="text-xs font-medium text-[#56504A]">Similitud Calculada:</span>
                    <div className={`inline-block ml-2 px-2 py-1 rounded-full text-xs font-bold ${
                      confirmationDialog.candidate.similarity >= 0.9 ? 'bg-red-100 text-red-800' :
                      confirmationDialog.candidate.similarity >= 0.8 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-[#EFE9DD] text-[#56504A]'
                    }`}>
                      {Math.round(confirmationDialog.candidate.similarity * 100)}%
                    </div>
                  </div>
                  
                  {/* Información adicional del estudiante existente */}
                  {confirmationDialog.candidate.existingStudent.instrument && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#56504A]">Instrumento:</span>
                      <span className="text-sm text-[#1B1917]">
                        {confirmationDialog.candidate.existingStudent.instrument}
                      </span>
                    </div>
                  )}
                  
                  {confirmationDialog.candidate.existingStudent.current_grade && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#56504A]">Grado:</span>
                      <span className="text-sm text-[#1B1917]">
                        {confirmationDialog.candidate.existingStudent.current_grade}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 text-center font-medium">
                    ⚠️ ¿Es la misma persona?
                  </p>
                  <p className="text-xs text-yellow-700 text-center mt-1">
                    Revisa cuidadosamente los nombres antes de decidir
                  </p>
                </div>
              </div>
              
              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => confirmationDialog.onConfirm('update')}
                  className="flex-1 px-4 py-3 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] focus:outline-none focus:ring-2 focus:ring-[#C2492B] focus:ring-offset-2 font-medium transition-colors"
                >
                  Actualizar Existente
                </button>
                <button
                  onClick={() => confirmationDialog.onConfirm('create')}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium transition-colors"
                >
                  Crear Nuevo
                </button>
                <button
                  onClick={confirmationDialog.onCancel}
                  className="flex-1 px-4 py-3 bg-[#DED7C9] text-[#56504A] rounded-lg hover:bg-[#C9BFAE] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:ring-offset-2 font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
