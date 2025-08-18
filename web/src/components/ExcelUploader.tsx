import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { FiDownload, FiUpload, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface Student {
  student_id?: string; // Hacemos student_id opcional para que no se envíe en inserciones nuevas
  first_name: string;
  last_name: string;
  instrument?: string;
  current_grade?: string;
  age?: number;
  orchestra_position?: string;
  is_active?: boolean;
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

export default function ExcelUploader({ onComplete }: ExcelUploaderProps) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ total: 0, processed: 0 });
  const [results, setResults] = useState({ added: 0, updated: 0, errors: 0 });
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [tableStructure, setTableStructure] = useState<any>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

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

      setProgress({ total: jsonData.length, processed: 0 });
      
      // Procesar cada fila
      for (const row of jsonData) {
        try {
          await processStudentRow(row);
          setProgress(prev => ({ ...prev, processed: prev.processed + 1 }));
        } catch (error: any) {
          console.error('Error processing row:', error);
          setErrorMessages(prev => [...prev, `Error en fila ${jsonData.indexOf(row) + 2}: ${error.message}`]);
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

  const processStudentRow = async (row: any) => {
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
        is_active: row.active !== undefined ? Boolean(row.active) : true
      };
      
      // Log para depuración del tamaño del instrumento
      if (row.instrument_size) {
        console.log('Valor original de instrument_size:', row.instrument_size);
        console.log('Tipo de dato de instrument_size:', typeof row.instrument_size);
        console.log('Valor procesado de instrument_size:', String(row.instrument_size).trim());
      }

      console.log('Datos preparados para procesamiento:', studentData);

      // Verificar si el estudiante ya existe (por nombre y apellido)
      const { data: existingStudents, error: searchError } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('first_name', studentData.first_name)
        .eq('last_name', studentData.last_name);

      if (searchError) {
        throw new Error(`Error al buscar estudiante: ${searchError.message}`);
      }

      let studentId: string;

      // Si el estudiante existe, actualizarlo
      if (existingStudents && existingStudents.length > 0) {
        studentId = existingStudents[0].id;
        console.log('Estudiante encontrado, actualizando ID:', studentId);
        
        const { error: updateError } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', studentId);

        if (updateError) {
          throw new Error(`Error al actualizar estudiante: ${updateError.message}`);
        }

        setResults(prev => ({ ...prev, updated: prev.updated + 1 }));
      } 
      // Si no existe, crear nuevo estudiante
      else {
        console.log('Estudiante no encontrado, insertando nuevo');
        
        // Generar un student_id único basado en el nombre y apellido
        const generatedStudentId = `S${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        
        // Añadir student_id, organization_id y program_id a los datos del estudiante
        const studentDataWithId = {
          ...studentData,
          student_id: row.student_id ? row.student_id.trim() : generatedStudentId,
          organization_id: 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4', // ID fijo de la organización
          program_id: '9d7dc91c-7bbe-49cd-bc64-755467bf91da' // ID fijo del programa
        };
        
        console.log('Intentando insertar estudiante con datos:', JSON.stringify(studentDataWithId));
        
        try {
          const { data: newStudent, error: insertError } = await supabase
            .from('students')
            .insert([studentDataWithId])
            .select('id, student_id')
            .single();

          if (insertError) {
            console.error('Error detallado al insertar:', insertError);
            console.error('Código:', insertError.code);
            console.error('Mensaje:', insertError.message);
            console.error('Detalles:', insertError.details);
            console.error('Pista:', insertError.hint);
            throw new Error(`Error al insertar estudiante: ${insertError.code} - ${insertError.message} - ${insertError.details || 'Sin detalles'} - ${insertError.hint || 'Sin pista'}`);
          }
          
          if (!newStudent) {
            console.error('No se recibió respuesta de datos al insertar');
            throw new Error('No se recibió respuesta de datos al insertar estudiante');
          }
          
          studentId = newStudent.id;
          console.log('Estudiante insertado con ID:', studentId);
          setResults(prev => ({ ...prev, added: prev.added + 1 }));
        } catch (error) {
          console.error('Error en la inserción:', error);
          if (error instanceof Error) {
            throw error;
          } else {
            throw new Error(`Error desconocido al insertar estudiante: ${JSON.stringify(error)}`);
          }
        }
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

  const processParentData = async (row: any, studentId: string) => {
    try {
      // Preparar datos del padre/madre
      const parentData = {
        full_name: `${row.parent_first_name.trim()} ${row.parent_last_name.trim()}`,
        phone_number: row.parent_phone_number ? row.parent_phone_number.toString().trim() : null,
        email: row.parent_email ? row.parent_email.trim() : null,
        preferred_contact_method: row.parent_preferred_contact_method ? row.parent_preferred_contact_method.trim() : 'phone',
        organization_id: 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4' // ID fijo de la organización
      };
      
      console.log('Procesando datos de padre/madre:', parentData);

      // Verificar si el padre/madre ya existe
      const { data: existingParents, error: searchError } = await supabase
        .from('parents')
        .select('id')
        .eq('full_name', parentData.full_name);

      if (searchError) {
        throw new Error(`Error al buscar padre/madre: ${searchError.message}`);
      }

      let parentId: string;

      // Si el padre/madre existe, actualizarlo
      if (existingParents && existingParents.length > 0) {
        parentId = existingParents[0].id;
        console.log('Padre/madre encontrado, actualizando ID:', parentId);
        
        const { error: updateError } = await supabase
          .from('parents')
          .update(parentData)
          .eq('id', parentId);
          
        if (updateError) {
          throw new Error(`Error al actualizar padre/madre: ${updateError.message}`);
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
          is_primary_contact: true // Asumimos que es contacto primario por defecto
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
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">

      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-4">
        <p className="text-gray-700 mb-2">{t('bulk_upload_desc')}</p>
        <p className="text-sm text-gray-600">{t('bulk_upload_required_fields')}</p>
        <p className="text-sm text-gray-600 mb-4">{t('bulk_upload_optional_fields')}</p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="excel-file-input" className="inline-flex items-center gap-2 px-3 py-2 bg-[#e5f2ff] text-[#0073ea] rounded-md cursor-pointer hover:bg-[#d7eaff] w-fit">
            <FiUpload /> {t('select_file')}
          </label>
          <input
            id="excel-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          <span className="text-sm text-gray-700 truncate">
            {file ? file.name : t('no_file_selected')}
          </span>
          {isUploading && <FiUpload className="animate-pulse text-[#0073ea]" />}
        </div>
      </div>

      {isUploading && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-1">
            {t('processing_records', { processed: progress.processed, total: progress.total })}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      )}

      {(results.added > 0 || results.updated > 0 || results.errors > 0) && !isUploading && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            {results.errors > 0 ? (
              <FiAlertCircle className="text-yellow-500" />
            ) : (
              <FiCheckCircle className="text-green-500" />
            )}
            {t('results')}:
          </h3>
          <ul className="text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="font-medium">{t('new_students')}:</span> 
              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{results.added}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-medium">{t('updated_students')}:</span> 
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{results.updated}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-medium">{t('errors')}:</span> 
              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{results.errors}</span>
            </li>
          </ul>
        </div>
      )}

      {errorMessages.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium text-red-700 mb-2">{t('errors')}:</h3>
          <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded-md">
            <ul className="text-sm text-red-800">
              {errorMessages.map((msg, index) => (
                <li key={index} className="mb-1">{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-6">
        <a 
          href="/student_template_updated.xlsx" 
          download 
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2"
        >
          <FiDownload /> {t('download_excel_template')}
        </a>
      </div>
    </div>
  );
}
