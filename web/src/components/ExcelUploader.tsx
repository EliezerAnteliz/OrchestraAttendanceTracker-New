import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { FiDownload, FiUpload, FiAlertCircle, FiCheckCircle, FiFile, FiX, FiUsers } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';

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
  const { activeProgram } = useProgram();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ total: 0, processed: 0 });
  const [results, setResults] = useState({ added: 0, updated: 0, errors: 0 });
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [tableStructure, setTableStructure] = useState<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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
        
        // Añadir student_id, program_id y organization_id a los datos del estudiante
        const studentDataWithId = {
          ...studentData,
          student_id: row.student_id ? row.student_id.trim() : generatedStudentId,
          program_id: activeProgram?.id, // Usar el programa activo actual
          organization_id: activeProgram?.organization_id // Usar la organización del programa activo
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
        program_id: activeProgram?.id, // Usar el programa activo actual
        organization_id: activeProgram?.organization_id // Usar la organización del programa activo
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
    <div className="bg-white">
      <div className="p-6">
        {/* Instructions */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-1 bg-blue-100 rounded-full mt-0.5">
              <FiAlertCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-2">{t('usage_instructions')}</h4>
              <div className="text-sm text-blue-800 space-y-1">
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
              ? 'border-blue-400 bg-blue-50' 
              : file 
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {!file ? (
            <div className="space-y-4">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                isDragOver ? 'bg-blue-100' : 'bg-gray-200'
              }`}>
                <FiUpload className={`w-8 h-8 ${
                  isDragOver ? 'text-blue-600' : 'text-gray-500'
                }`} />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900 mb-1">
                  {isDragOver ? t('drop_file_here') : t('drag_excel_file_here')}
                </p>
                <p className="text-sm text-gray-600 mb-4">{t('or_click_to_select')}</p>
                <label htmlFor="excel-file-input" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors font-medium">
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
              <p className="text-xs text-gray-500">{t('supported_formats')}: .xlsx, .xls</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <FiFile className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900 mb-1">{t('file_selected')}</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">{file.name}</span>
                  <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
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
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <FiUpload className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">{t('processing_file')}...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-900">
                {t('processing_records', { processed: progress.processed, total: progress.total })}
              </p>
              <span className="text-sm text-blue-700 font-medium">
                {progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {(results.added > 0 || results.updated > 0 || results.errors > 0) && !isUploading && (
          <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
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
              <h3 className="text-lg font-semibold text-gray-900">
                {results.errors > 0 ? t('process_completed_with_warnings') : t('process_completed_successfully')}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('new_students')}</p>
                    <p className="text-2xl font-bold text-green-600">{results.added}</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FiUsers className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('updated_students')}</p>
                    <p className="text-2xl font-bold text-blue-600">{results.updated}</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FiCheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('errors')}</p>
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
            <div className="max-h-48 overflow-y-auto bg-white border border-red-200 rounded-md">
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
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 mb-1">{t('need_template')}</h4>
              <p className="text-sm text-gray-600">{t('download_template_description')}</p>
            </div>
            <a 
              href="/student_template_updated.xlsx" 
              download 
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              <FiDownload className="w-4 h-4" />
              {t('download_excel_template')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
