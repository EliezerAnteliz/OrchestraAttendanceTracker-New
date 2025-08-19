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
    <div className="min-h-screen bg-[#f6f7fb]">
      <div className="container mx-auto px-4 py-8">
        {/* Header with back button */}
        <div className="flex items-center mb-8">
          <Link 
            href="/dashboard/students" 
            className="mr-4 p-3 rounded-lg hover:bg-[#e6e9ef] transition-all duration-200 bg-white shadow-sm border border-[#d0d4e4]"
          >
            <MdArrowBack size={20} className="text-[#323338]" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-[#323338]">
              {t('new_student')}
            </h1>
            <p className="text-[#676879] mt-1">{t('complete_student_info')}</p>
          </div>
        </div>
      
        {/* Error message */}
        {error && (
          <div className="max-w-5xl mx-auto mb-6">
            <div className="p-4 bg-[#ffebee] border-l-4 border-[#e74c3c] text-[#c62828] rounded-lg shadow-sm">
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}
        
        {/* Student form */}
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-[#d0d4e4] overflow-hidden mb-8">
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Personal Information */}
              <div>
                <h2 className="text-lg font-semibold mb-6 flex items-center text-[#323338]">
                  <MdPerson className="mr-2 text-[#0086c0]" /> {t('personal_information')}
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[#323338] mb-2">
                      {t('first_name')} <span className="text-[#e74c3c]">*</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={student.first_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-[#d0d4e4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0086c0] focus:border-[#0086c0] transition-all duration-200 bg-white hover:border-[#a1a6b8]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#323338] mb-2">
                      {t('last_name')} <span className="text-[#e74c3c]">*</span>
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={student.last_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-[#d0d4e4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0086c0] focus:border-[#0086c0] transition-all duration-200 bg-white hover:border-[#a1a6b8]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#323338] mb-2">{t('grade')}</label>
                    <input
                      type="text"
                      name="grade"
                      value={student.grade}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-[#d0d4e4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0086c0] focus:border-[#0086c0] transition-all duration-200 bg-white hover:border-[#a1a6b8]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#323338] mb-2">{t('status')}</label>
                    <div className="flex items-center p-3 bg-[#f6f7fb] rounded-md border border-[#d0d4e4] hover:bg-white transition-all duration-200">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={student.is_active}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-[#0086c0] focus:ring-[#0086c0] border-[#d0d4e4] rounded"
                      />
                      <span className="ml-3 text-[#323338] font-medium">{t('active')}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Orchestra Information */}
              <div>
                <h2 className="text-lg font-semibold mb-6 flex items-center text-[#323338]">
                  <MdMusicNote className="mr-2 text-[#0086c0]" /> {t('orchestra_info')}
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[#323338] mb-2">{t('instrument')}</label>
                    <input
                      type="text"
                      name="instrument"
                      value={student.instrument}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-[#d0d4e4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0086c0] focus:border-[#0086c0] transition-all duration-200 bg-white hover:border-[#a1a6b8]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#323338] mb-2">{t('instrument_size')}</label>
                    <input
                      type="text"
                      name="instrument_size"
                      value={student.instrument_size}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-[#d0d4e4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0086c0] focus:border-[#0086c0] transition-all duration-200 bg-white hover:border-[#a1a6b8]"
                      placeholder={t('instrument_size_placeholder')}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#323338] mb-2">{t('position')}</label>
                    <input
                      type="text"
                      name="position"
                      value={student.position}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-[#d0d4e4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0086c0] focus:border-[#0086c0] transition-all duration-200 bg-white hover:border-[#a1a6b8]"
                      placeholder={t('position_placeholder')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
          {/* Form actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-[#d0d4e4]">
            <Link
              href="/dashboard/students"
              className="px-6 py-2.5 border border-[#d0d4e4] text-[#323338] rounded-md hover:bg-[#f6f7fb] hover:border-[#a1a6b8] transition-all duration-200 flex items-center justify-center font-medium bg-white"
            >
              <MdCancel className="mr-2" size={16} /> {t('cancel')}
            </Link>
            <button
              type="submit"
              disabled={loading || !student.first_name || !student.last_name}
              className={`px-8 py-2.5 bg-[#0086c0] text-white rounded-md hover:bg-[#006ba1] transition-all duration-200 flex items-center justify-center font-medium ${
                (loading || !student.first_name || !student.last_name) ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <MdSave className="mr-2" size={16} /> {loading ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
