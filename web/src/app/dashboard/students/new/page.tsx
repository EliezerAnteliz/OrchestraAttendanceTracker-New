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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with back button */}
        <div className="flex items-center mb-8">
          <Link 
            href="/dashboard/students" 
            className="mr-4 p-3 rounded-full hover:bg-white/80 shadow-md transition-all duration-200 bg-white/60"
          >
            <MdArrowBack size={24} className="text-gray-700" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t('new_student')}
            </h1>
            <p className="text-gray-600 mt-1">{t('complete_student_info')}</p>
          </div>
        </div>
      
        {/* Error message */}
        {error && (
          <div className="max-w-5xl mx-auto mb-6">
            <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg shadow-sm">
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}
        
        {/* Student form */}
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden mb-8">
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Personal Information */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                  <MdPerson className="mr-2 text-[#0073ea]" /> {t('personal_information')}
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('first_name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={student.first_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('last_name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={student.last_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('grade')}</label>
                    <input
                      type="text"
                      name="grade"
                      value={student.grade}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">{t('status')}</label>
                    <div className="flex items-center p-3 bg-gray-50 rounded-xl border-2 border-gray-200 hover:bg-white transition-all duration-200">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={student.is_active}
                        onChange={handleInputChange}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-gray-700 font-medium">{t('active')}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Orchestra Information */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                  <MdMusicNote className="mr-2 text-[#0073ea]" /> {t('orchestra_info')}
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('instrument')}</label>
                    <input
                      type="text"
                      name="instrument"
                      value={student.instrument}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('instrument_size')}</label>
                    <input
                      type="text"
                      name="instrument_size"
                      value={student.instrument_size}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                      placeholder={t('instrument_size_placeholder')}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('position')}</label>
                    <input
                      type="text"
                      name="position"
                      value={student.position}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                      placeholder={t('position_placeholder')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
          {/* Form actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-200">
            <Link
              href="/dashboard/students"
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center justify-center font-medium shadow-sm"
            >
              <MdCancel className="mr-2" size={20} /> {t('cancel')}
            </Link>
            <button
              type="submit"
              disabled={loading || !student.first_name || !student.last_name}
              className={`px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center font-medium shadow-lg ${
                (loading || !student.first_name || !student.last_name) ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              <MdSave className="mr-2" size={20} /> {loading ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
