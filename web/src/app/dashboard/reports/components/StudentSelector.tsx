import React from 'react';
import { MdPerson, MdSearch, MdCheck } from 'react-icons/md';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  instrument?: string;
  student_id?: string;
}

interface StudentSelectorProps {
  selectedStudent: Student | null;
  setStudentModalVisible: (visible: boolean) => void;
  reportType: 'individual' | 'group';
}

interface StudentModalProps {
  visible: boolean;
  onClose: () => void;
  students: Student[];
  selectedStudent: Student | null;
  onSelectStudent: (student: Student) => void;
}

export const StudentSelector: React.FC<StudentSelectorProps> = ({
  selectedStudent,
  setStudentModalVisible,
  reportType
}) => {
  if (reportType !== 'individual') return null;

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4 mb-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Estudiante</h2>
      <button
        onClick={() => setStudentModalVisible(true)}
        className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-sm hover:bg-gray-50"
      >
        <div className="flex items-center">
          <MdPerson size={20} className="text-gray-500 mr-2" />
          <span className="text-sm">
            {selectedStudent 
              ? `${selectedStudent.first_name} ${selectedStudent.last_name}` 
              : 'Seleccionar estudiante'}
          </span>
        </div>
        <MdSearch size={20} className="text-gray-500" />
      </button>
    </div>
  );
};

export const StudentModal: React.FC<StudentModalProps> = ({
  visible,
  onClose,
  students,
  selectedStudent,
  onSelectStudent
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || 
           (student.instrument && student.instrument.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-sm border border-gray-300 overflow-hidden">
        <div className="p-4 border-b border-gray-300">
          <h2 className="text-lg font-medium text-gray-800">Seleccionar Estudiante</h2>
        </div>
        
        <div className="p-4 border-b border-gray-300">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre o instrumento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent"
            />
            <MdSearch size={20} className="absolute left-3 top-2.5 text-gray-500" />
          </div>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {filteredStudents.length > 0 ? (
            filteredStudents.map(student => (
              <button
                key={student.id}
                className={`w-full flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 text-left
                  ${selectedStudent?.id === student.id ? 'bg-[#0073ea10]' : ''}`}
                onClick={() => onSelectStudent(student)}
              >
                <div className="flex items-center">
                  <MdPerson size={20} className="text-gray-500 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {student.first_name} {student.last_name}
                    </p>
                    {student.instrument && (
                      <p className="text-xs text-gray-500">{student.instrument}</p>
                    )}
                  </div>
                </div>
                {selectedStudent?.id === student.id && (
                  <MdCheck size={20} className="text-[#0073ea]" />
                )}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              No se encontraron estudiantes
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-sm hover:bg-gray-200 mr-2"
          >
            Cancelar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0073ea] text-white rounded-sm hover:bg-[#0060c0]"
            disabled={!selectedStudent}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentSelector;
