// Debug script to check Supabase table structure
import { supabase } from '@/lib/supabase';

export async function debugSupabaseTables() {
  console.log('Starting Supabase table structure debug...');
  
  try {
    // Check students table
    console.log('Checking students table...');
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .limit(1);
    
    if (studentsError) {
      console.error('Error fetching students:', studentsError);
    } else {
      console.log('Students table structure:', studentsData && studentsData[0] ? Object.keys(studentsData[0]) : 'No data');
      console.log('Sample student:', studentsData && studentsData[0] ? studentsData[0] : 'No data');
    }
    
    // Check attendance table
    console.log('Checking attendance table...');
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);
    
    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
    } else {
      console.log('Attendance table structure:', attendanceData && attendanceData[0] ? Object.keys(attendanceData[0]) : 'No data');
      console.log('Sample attendance record:', attendanceData && attendanceData[0] ? attendanceData[0] : 'No data');
    }
    
    // Check attendance_status table
    console.log('Checking attendance_status table...');
    const { data: statusData, error: statusError } = await supabase
      .from('attendance_status')
      .select('*');
    
    if (statusError) {
      console.error('Error fetching attendance status:', statusError);
    } else {
      console.log('Attendance status records:', statusData);
    }
    
    return {
      students: studentsData && studentsData[0] ? Object.keys(studentsData[0]) : [],
      attendance: attendanceData && attendanceData[0] ? Object.keys(attendanceData[0]) : [],
      attendanceStatus: statusData
    };
  } catch (error) {
    console.error('Debug error:', error);
    return { error: error.message };
  }
}

export default debugSupabaseTables;
