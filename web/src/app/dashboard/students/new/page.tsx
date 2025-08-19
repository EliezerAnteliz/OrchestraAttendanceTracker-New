'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { MdArrowBack, MdSave, MdCancel, MdPerson, MdMusicNote } from 'react-icons/md';
import { theme } from '@/styles/theme';
import { useI18n } from '@/contexts/I18nContext';

interface NewStudent {
  first_name: string;
  last_name: string;
  grade: string;
  instrument: string;
  instrument_size: string;
  position: string;
  is_active: boolean;
}

export default function NewStudent() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<NewStudent>({
    first_name: '',
    last_name: '',
    grade: '',
    instrument: '',
    instrument_size: '',
    position: '',
    is_active: true
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setStudent({
      ...student,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      // Validate required fields
      if (!student.first_name || !student.last_name) {
        throw new Error(t('required_fields_error'));
      }
      
      // Insert new student
      const { data, error: insertError } = await supabase
        .from('students')
        .insert({
          first_name: student.first_name,
          last_name: student.last_name,
          grade: student.grade || null,
          instrument: student.instrument || null,
          instrument_size: student.instrument_size || null,
          position: student.position || null,
          is_active: student.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      // Redirect to the student detail page
      router.push(`/dashboard/students/${data.id}`);
    } catch (err) {
      console.error('Error creating student:', err);
      setError(err instanceof Error ? err.message : t('error_creating_student'));
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header with back button */}
      <div className="flex items-center mb-6">
        <Link 
          href="/dashboard/students" 
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <MdArrowBack size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">{t('new_student')}</h1>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {/* Student form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                  <MdPerson className="mr-2 text-[#0073ea]" /> {t('personal_information')}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('first_name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={student.first_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('last_name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={student.last_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('grade')}</label>
                    <input
                      type="text"
                      name="grade"
                      value={student.grade}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={student.is_active}
                        onChange={handleInputChange}
                        className="h-5 w-5 text-[#0073ea] focus:ring-[#0073ea] border-gray-300 rounded"
                      />
                      <span className="ml-2 text-gray-700">{t('active')}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Orchestra Information */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                  <MdMusicNote className="mr-2 text-[#0073ea]" /> {t('orchestra_info')}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('instrument')}</label>
                    <input
                      type="text"
                      name="instrument"
                      value={student.instrument}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('instrument_size')}</label>
                    <input
                      type="text"
                      name="instrument_size"
                      value={student.instrument_size}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                      placeholder={t('instrument_size_placeholder')}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('position')}</label>
                    <input
                      type="text"
                      name="position"
                      value={student.position}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                      placeholder={t('position_placeholder')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Form actions */}
        <div className="flex justify-end space-x-3">
          <Link
            href="/dashboard/students"
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center"
          >
            <MdCancel className="mr-1" /> {t('cancel')}
          </Link>
          <button
            type="submit"
            disabled={loading || !student.first_name || !student.last_name}
            className={`px-4 py-2 bg-[#0073ea] text-white rounded-md hover:bg-[#0060c0] transition-colors flex items-center ${
              (loading || !student.first_name || !student.last_name) ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            <MdSave className="mr-1" /> {loading ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
