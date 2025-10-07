"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Lang = "es" | "en";

type Translations = Record<string, Record<Lang, string>>;

const translations: Translations = {
  // Global
  lang_es: { es: "ES", en: "ES" },
  lang_en: { es: "EN", en: "EN" },
  switch_to_en: { es: "Cambiar a Inglés", en: "Switch to English" },
  switch_to_es: { es: "Cambiar a Español", en: "Switch to Spanish" },

  // Landing
  app_title: { es: "Ascend Attendance Tracker", en: "Ascend Attendance Tracker" },
  login: { es: "Iniciar Sesión", en: "Log In" },
  access_dashboard: { es: "Acceder al Dashboard", en: "Go to Dashboard" },
  features: { es: "Características", en: "Features" },
  feature_attendance: { es: "Registro de asistencia", en: "Attendance tracking" },
  feature_profiles: { es: "Perfiles de estudiantes", en: "Student profiles" },
  feature_reports: { es: "Reportes detallados", en: "Detailed reports" },
  feature_access_any: { es: "Acceso desde cualquier dispositivo", en: "Access from any device" },
  landing_headline: { es: "Gestión de Asistencia para el Programa Ascend", en: "Attendance Management for Ascend Program" },
  landing_desc: {
    es: "Una plataforma colaborativa en línea para registrar la asistencia de los estudiantes, elaborar informes claros y asegurar registros precisos y actualizados del Programa Ascend.",
    en: "A collaborative online platform to record student attendance, create clear reports and ensure accurate and updated records for the Ascend Program.",
  },
  start_free: { es: "Comenzar Gratis", en: "Start Free" },
  benefits_title: { es: "Beneficios del Ascend Attendance Tracker", en: "Benefits of Ascend Attendance Tracker" },
  benefits_desc: { es: "Una plataforma colaborativa diseñada para facilitar el registro de asistencia y generar informes precisos para el Programa Ascend", en: "A collaborative platform designed to facilitate attendance recording and generate accurate reports for the Ascend Program" },
  easy_to_use: { es: "Fácil de Usar", en: "Easy to Use" },
  easy_to_use_desc: { es: "Interfaz intuitiva que cualquier instructor puede dominar en minutos", en: "Intuitive interface that any instructor can master in minutes" },
  smart_reports: { es: "Reportes Inteligentes", en: "Smart Reports" },
  smart_reports_desc: { es: "Visualiza tendencias y patrones de asistencia con gráficos claros", en: "Visualize attendance trends and patterns with clear charts" },
  for_musicians: { es: "Para el Programa Ascend", en: "For Ascend Program" },
  for_musicians_desc: { es: "Diseñado específicamente para el Programa Ascend y sus instructores, facilitando la gestión educativa", en: "Specifically designed for the Ascend Program and its instructors, facilitating educational management" },
  student_management: { es: "Gestión de Estudiantes", en: "Student Management" },
  student_management_desc: { es: "Administra perfiles y datos de estudiantes", en: "Manage student profiles and data" },
  attendance_recording: { es: "Registro de Asistencia", en: "Attendance Recording" },
  attendance_recording_desc: { es: "Control diario rápido y eficiente", en: "Quick and efficient daily tracking" },
  detailed_reports: { es: "Reportes Detallados", en: "Detailed Reports" },
  detailed_reports_desc: { es: "Análisis y estadísticas completas", en: "Complete analysis and statistics" },
  access_247: { es: "Acceso 24/7", en: "24/7 Access" },
  access_247_desc: { es: "Disponible desde cualquier dispositivo", en: "Available from any device" },
  back_to_home: { es: "Volver al inicio", en: "Back to home" },
  access_account_continue: { es: "Accede a tu cuenta para continuar", en: "Access your account to continue" },
  view_details: { es: "Ver Detalles", en: "View Details" },
  footer_copyright: { es: " Eliezer Anteliz", en: " Eliezer Anteliz" },

  // Auth
  email: { es: "Correo Electrónico", en: "Email" },
  password: { es: "Contraseña", en: "Password" },
  sign_in: { es: "Iniciar Sesión", en: "Log In" },
  signing_in: { es: "Iniciando sesión...", en: "Signing in..." },
  dont_have_account: { es: "¿No tienes una cuenta?", en: "Don't have an account?" },
  sign_up_here: { es: "Regístrate aquí", en: "Sign up here" },
  create_account: { es: "Crear Cuenta", en: "Create Account" },
  creating_account: { es: "Creando cuenta...", en: "Creating account..." },
  password_min: { es: "Mínimo 6 caracteres", en: "Minimum 6 characters" },
  already_have_account: { es: "¿Ya tienes una cuenta?", en: "Already have an account?" },
  sign_in_here: { es: "Inicia sesión aquí", en: "Sign in here" },
  
  // Signup form translations
  email_placeholder: { es: "tu@email.com", en: "your@email.com" },
  organization: { es: "Organización", en: "Organization" },
  select_organization: { es: "Selecciona tu organización...", en: "Select your organization..." },
  loading_organizations: { es: "Cargando organizaciones disponibles...", en: "Loading available organizations..." },
  sede: { es: "Sede", en: "Site" },
  select_sede: { es: "Selecciona una sede...", en: "Select a site..." },
  select_organization_first: { es: "Selecciona una organización primero", en: "Select an organization first" },
  loading_sedes: { es: "Cargando sedes disponibles...", en: "Loading available sites..." },
  user_level: { es: "Nivel de Usuario", en: "User Level" },
  viewer: { es: "Viewer", en: "Viewer" },
  staff: { es: "Staff", en: "Staff" },
  confirm_password: { es: "Confirmar Contraseña", en: "Confirm Password" },
  minimum_6_characters: { es: "Mínimo 6 caracteres", en: "Minimum 6 characters" },
  passwords_match: { es: "Las contraseñas coinciden", en: "Passwords match" },
  passwords_dont_match: { es: "Las contraseñas no coinciden", en: "Passwords don't match" },
  join_musical_community: { es: "Únete a la comunidad musical", en: "Join the musical community" },
  account_created_successfully: { es: "¡Cuenta creada exitosamente!", en: "Account created successfully!" },
  redirecting_to_login: { es: "Serás redirigido a la página de inicio de sesión en unos momentos.", en: "You will be redirected to the login page in a few moments." },
  redirecting: { es: "Redirigiendo...", en: "Redirecting..." },
  please_select_organization: { es: "Por favor selecciona una organización", en: "Please select an organization" },
  please_select_sede: { es: "Por favor selecciona una sede", en: "Please select a site" },
  error_loading_organizations_signup: { es: "Error al cargar las organizaciones disponibles", en: "Error loading available organizations" },
  error_loading_sedes: { es: "Error al cargar las sedes disponibles", en: "Error loading available sites" },
  error_creating_account: { es: "Error al crear la cuenta", en: "Error creating account" },

  // Dashboard layout
  brand_title: { es: "Ascend", en: "Ascend" },
  brand_subtitle: { es: "Attendance Tracker", en: "Attendance Tracker" },
  menu_dashboard: { es: "Dashboard", en: "Dashboard" },
  menu_students: { es: "Estudiantes", en: "Students" },
  menu_attendance: { es: "Asistencia", en: "Attendance" },
  menu_reports: { es: "Reportes", en: "Reports" },
  sign_out: { es: "Cerrar sesión", en: "Sign out" },
  mobile_header: { es: "Ascend Attendance", en: "Ascend Attendance" },

  // Dashboard page
  loading_data: { es: "Cargando datos...", en: "Loading data..." },
  error_loading_dashboard: {
    es: "No se pudieron cargar los datos. Por favor, intenta de nuevo más tarde.",
    en: "Could not load data. Please try again later.",
  },
  welcome_dashboard: { es: "Bienvenido al Dashboard", en: "Welcome to the Dashboard" },
  dashboard_summary: { es: "Resumen de la actividad del programa Ascend", en: "Summary of Ascend program activity" },
  total_students: { es: "Total Estudiantes", en: "Total Students" },
  active_students: { es: "Estudiantes Activos", en: "Active Students" },
  attendance_today: { es: "Asistencia Hoy", en: "Attendance Today" },
  attendance_rate: { es: "Tasa de Asistencia", en: "Attendance Rate" },
  quick_access: { es: "Acceso Rápido", en: "Quick Access" },
  student_details_tab: { es: "Detalles del Estudiante", en: "Student Details" },
  quick_register_attendance: { es: "Registrar Asistencia", en: "Record Attendance" },
  quick_register_attendance_desc: {
    es: "Marca la asistencia de los estudiantes para hoy",
    en: "Mark today's student attendance",
  },
  quick_student_list: { es: "Lista de Estudiantes", en: "Student List" },
  quick_student_list_desc: {
    es: "Ver y gestionar la información de los estudiantes",
    en: "View and manage student information",
  },

  // Student details page
  edit: { es: "Editar", en: "Edit" },
  delete: { es: "Eliminar", en: "Delete" },
  save: { es: "Guardar", en: "Save" },
  cancel: { es: "Cancelar", en: "Cancel" },
  edit_student: { es: "Editar Estudiante", en: "Edit Student" },
  confirm_delete_title: { es: "Confirmar eliminación", en: "Confirm deletion" },
  confirm_delete_message: {
    es: "¿Estás seguro de que deseas eliminar a {first} {last}? Esta acción no se puede deshacer.",
    en: "Are you sure you want to delete {first} {last}? This action cannot be undone.",
  },
  back_to_students: { es: "Volver a la lista de estudiantes", en: "Back to student list" },
  loading_student_data: { es: "Cargando datos del estudiante...", en: "Loading student data..." },
  student_not_found: { es: "Estudiante no encontrado", en: "Student not found" },
  error_loading_student: { es: "Error al cargar datos del estudiante", en: "Error loading student data" },
  error_updating_student: { es: "Error al actualizar estudiante", en: "Error updating student" },

  personal_info: { es: "Información Personal", en: "Personal Information" },
  full_name: { es: "Nombre completo", en: "Full name" },
  first_name: { es: "Nombre", en: "First name" },
  last_name: { es: "Apellido", en: "Last name" },
  grade: { es: "Grado", en: "Grade" },
  age: { es: "Edad", en: "Age" },
  years: { es: "años", en: "years" },
  status: { es: "Estado", en: "Status" },
  active: { es: "Activo", en: "Active" },
  inactive: { es: "Inactivo", en: "Inactive" },
  not_specified: { es: "No especificado", en: "Not specified" },

  orchestra_info: { es: "Información de Orquesta", en: "Orchestra Information" },
  instrument: { es: "Instrumento", en: "Instrument" },
  instrument_size: { es: "Tamaño del Instrumento", en: "Instrument Size" },
  position: { es: "Posición", en: "Position" },
  orchestra_position: { es: "Posición", en: "Position" },

  parents_info: { es: "Información de Padres", en: "Parents Information" },
  manage_contacts: { es: "Administrar contactos", en: "Manage contacts" },
  phone_not_registered: { es: "Teléfono no registrado", en: "Phone not registered" },
  email_not_registered: { es: "Email no registrado", en: "Email not registered" },
  no_contacts_registered: { es: "No hay contactos registrados para este estudiante.", en: "There are no contacts registered for this student." },
  add_contact: { es: "Añadir contacto", en: "Add contact" },
  quick_generate_reports: { es: "Generar Reportes", en: "Generate Reports" },
  quick_generate_reports_desc: {
    es: "Crea reportes de asistencia y participación",
    en: "Create attendance and participation reports",
  },

  // Students page
  students_title: { es: "Estudiantes", en: "Students" },
  bulk_upload: { es: "Carga Masiva", en: "Bulk Upload" },
  new_student: { es: "Nuevo Estudiante", en: "New Student" },
  search_student_placeholder: { es: "Buscar estudiante...", en: "Search student..." },
  show_all: { es: "Mostrar todos", en: "Show all" },
  only_active: { es: "Solo activos", en: "Only active" },
  showing_n_of_total: { es: "Mostrando {n} de {total} estudiantes", en: "Showing {n} of {total} students" },
  actions: { es: "Acciones", en: "Actions" },
  view: { es: "Ver", en: "View" },
  not_assigned: { es: "No asignado", en: "Not assigned" },
  no_students_found: { es: "No se encontraron estudiantes con los filtros actuales.", en: "No students found with current filters." },
  loading_students: { es: "Cargando estudiantes...", en: "Loading students..." },
  error_loading_students: { es: "No se pudieron cargar los estudiantes. Por favor, intenta de nuevo más tarde.", en: "Could not load students. Please try again later." },
  bulk_upload_title: { es: "Carga Masiva de Estudiantes", en: "Bulk Upload of Students" },
  close: { es: "Cerrar", en: "Close" },

  // Reports page
  loading: { es: "Cargando...", en: "Loading..." },
  no_data: { es: "No hay datos disponibles", en: "No data available" },
  couldnt_load_students_try_again: { es: "No se pudieron cargar los estudiantes. Por favor, intente nuevamente.", en: "Could not load students. Please try again." },
  report_of: { es: "Reporte de {name}", en: "Report of {name}" },
  group_report: { es: "Reporte Grupal", en: "Group Report" },
  report_type: { es: "Tipo de Reporte", en: "Report Type" },
  individual: { es: "Individual", en: "Individual" },
  group: { es: "Grupal", en: "Group" },
  period: { es: "Período", en: "Period" },
  monthly: { es: "Mensual", en: "Monthly" },
  weekly: { es: "Semanal", en: "Weekly" },
  student: { es: "Estudiante", en: "Student" },
  all: { es: "Todos", en: "All" },
  instrument_label: { es: "Instrumento", en: "Instrument" },
  statistics: { es: "Estadísticas", en: "Statistics" },
  total_attendances: { es: "Total Asistencias", en: "Total Attendances" },
  total_excused_absences: { es: "Total Faltas Justificadas", en: "Total Excused Absences" },
  total_unexcused_absences: { es: "Total Faltas Injustificadas", en: "Total Unexcused Absences" },
  attendance_percentage_label: { es: "Porcentaje Asistencia", en: "Attendance Percentage" },
  excused_percentage_label: { es: "Porcentaje Faltas Justificadas", en: "Excused Absence Percentage" },
  unexcused_percentage_label: { es: "Porcentaje Faltas Injustificadas", en: "Unexcused Absence Percentage" },
  weekly_trend_title: { es: "Tendencia Semanal (3 previas + actual)", en: "Weekly Trend (3 previous + current)" },
  trend_direction: { es: "Dirección de Tendencia", en: "Trend Direction" },
  trend_up: { es: "Alcista", en: "Upward" },
  trend_down: { es: "Bajista", en: "Downward" },
  trend_flat: { es: "Neutra", en: "Flat" },

  // Reports UI controls
  select_student_title: { es: "Seleccionar Estudiante", en: "Select Student" },
  select: { es: "Seleccionar", en: "Select" },
  selected_student: { es: "Estudiante Seleccionado", en: "Selected Student" },
  report_type_title: { es: "Tipo de Reporte", en: "Report Type" },
  annual: { es: "Anual", en: "Annual" },
  generate_report: { es: "Generar Reporte", en: "Generate Report" },
  download_csv: { es: "Descargar CSV", en: "Download CSV" },
  chart: { es: "Gráfico", en: "Chart" },
  attendance_distribution: { es: "Distribución de Asistencia", en: "Attendance Distribution" },
  bars: { es: "Barras", en: "Bars" },
  pie: { es: "Torta", en: "Pie" },
  month: { es: "Mes", en: "Month" },
  week: { es: "Semana", en: "Week" },
  change: { es: "Cambiar", en: "Change" },
  // monthly, weekly, group, individual already defined above
  group_report_title: { es: "Reporte Grupal", en: "Group Report" },
  report_for_name: { es: "Reporte de {name}", en: "Report for {name}" },
  no_data_available: { es: "No hay datos disponibles", en: "No data available" },
  generating: { es: "Generando...", en: "Generating..." },
  export_csv: { es: "Exportar CSV", en: "Export CSV" },
  total_records: { es: "Total Registros", en: "Total Records" },
  showing_data_of: { es: "Mostrando datos de {label}", en: "Showing data for {label}" },
  monthly_breakdown_title: { es: "Desglose mensual (Septiembre - Mayo)", en: "Monthly breakdown (September - May)" },
  attendance_label: { es: "Asistencias", en: "Attendances" },
  excused_absences_short: { es: "F. Justificadas", en: "Excused" },
  unexcused_absences_short: { es: "F. Injustificadas", en: "Unexcused" },
  academic_year: { es: "Año académico", en: "Academic year" },
  
  // Unexcused absences report
  unexcused_absences_current_week: { es: "Faltas Injustificadas (Semana Actual)", en: "Unexcused Absences (Current Week)" },
  loading_unexcused: { es: "Cargando...", en: "Loading..." },
  no_unexcused_status_found: { es: "No se encontró el estado de \"Falta Injustificada\" en la base de datos", en: "\"Unexcused Absence\" status not found in database" },
  no_students_with_unexcused: { es: "No hay estudiantes con 2 o más faltas injustificadas en la semana actual", en: "No students with 2 or more unexcused absences this week" },
  unexcused_absences_title: { es: "Faltas Injustificadas - Semana Actual", en: "Unexcused Absences - Current Week" },
  no_students_unexcused_this_week: { es: "No hay estudiantes con faltas injustificadas esta semana", en: "No students with unexcused absences this week" },
  total_students_with_unexcused: { es: "Total de estudiantes con faltas injustificadas:", en: "Total students with unexcused absences:" },
  student_info: { es: "Información del estudiante", en: "Student information" },
  parent_contact_label: { es: "Contacto del Padre/Madre", en: "Parent/Guardian Contact" },
  unexcused_count: { es: "Faltas injustificadas:", en: "Unexcused absences:" },
  no_contact_info: { es: "No hay información de contacto registrada", en: "No contact information registered" },
  close_button: { es: "Cerrar", en: "Close" },
  error_fetching_unexcused: { es: "Error al obtener las faltas injustificadas", en: "Error fetching unexcused absences" },
  
  // Admin page (users)
  admin_users_page_title: { es: "Admin · Usuarios", en: "Admin · Users" },
  admin_users_page_desc: {
    es: "Gestiona acceso por sede (programa). Solo admins de organización pueden ver esta página.",
    en: "Manage access per site (program). Only organization admins can view this page.",
  },
  program_label: { es: "Sede", en: "Site" },
  loading_programs: { es: "Cargando sedes…", en: "Loading sites…" },
  grant_update_access: { es: "Conceder / Actualizar acceso", en: "Grant / Update access" },
  role: { es: "Rol", en: "Role" },
  admin_label: { es: "Admin", en: "Admin" },
  staff_label: { es: "Staff", en: "Staff" },
  viewer_label: { es: "Viewer", en: "Viewer" },
  save_access: { es: "Guardar acceso", en: "Save access" },
  processing: { es: "Procesando…", en: "Processing…" },
  members_title: { es: "Miembros de la sede", en: "Site members" },
  refresh: { es: "Refrescar", en: "Refresh" },
  select_a_program: { es: "Selecciona una sede.", en: "Select a site." },
  no_members: { es: "Sin miembros.", en: "No members." },
  since: { es: "Desde", en: "Since" },
  revoke: { es: "Revocar", en: "Revoke" },
  admin_email_placeholder: { es: "usuario@dominio.com", en: "user@domain.com" },
  
  // Attendance page
  attendance_title: { es: "Asistencia", en: "Attendance" },
  enable_attendance_mode: { es: "Activar Modo Asistencia", en: "Enable Attendance Mode" },
  disable_attendance_mode: { es: "Desactivar Modo Asistencia", en: "Disable Attendance Mode" },
  search_name_or_instrument: { es: "Buscar por nombre o instrumento...", en: "Search by name or instrument..." },
  all_instruments: { es: "Todos los instrumentos", en: "All instruments" },
  select_all: { es: "Seleccionar Todos", en: "Select All" },
  deselect_all: { es: "Deseleccionar Todos", en: "Deselect All" },
  mark_present: { es: "Marcar Presente", en: "Mark Present" },
  mark_excused_absence: { es: "Marcar Falta Justificada", en: "Mark Excused Absence" },
  mark_unexcused_absence: { es: "Marcar Falta Injustificada", en: "Mark Unexcused Absence" },
  not_recorded: { es: "No registrado", en: "Not recorded" },
  prev_month: { es: "Mes anterior", en: "Previous month" },
  next_month: { es: "Mes siguiente", en: "Next month" },
  attendance: { es: "Asistencia", en: "Attendance" },
  no_students_selected: { es: "No hay estudiantes seleccionados. Por favor, selecciona al menos un estudiante.", en: "No students selected. Please select at least one student." },
  error_marking_attendance: { es: "Error al marcar asistencia", en: "Error marking attendance" },

  // Program switcher (sidebar/header)
  select_site_label: { es: "Selecciona la sede", en: "Select site" },
  no_sites_assigned: { es: "No tienes sedes asignadas.", en: "You have no sites assigned." },
  refresh_sites: { es: "Refrescar sedes", en: "Refresh sites" },

  // New student form
  personal_information: { es: "Información Personal", en: "Personal Information" },
  required_fields_error: { es: "Nombre y apellido son campos obligatorios", en: "First name and last name are required fields" },
  error_creating_student: { es: "Error al crear estudiante", en: "Error creating student" },
  instrument_size_placeholder: { es: "1/2, 3/4, 4/4", en: "1/2, 3/4, 4/4" },
  position_placeholder: { es: "Primera fila, Segunda fila", en: "First row, Second row" },
  first_name_placeholder: { es: "Juan", en: "John" },
  last_name_placeholder: { es: "Pérez", en: "Smith" },
  grade_placeholder: { es: "5to grado", en: "5th grade" },
  instrument_placeholder: { es: "Violín", en: "Violin" },
  saving: { es: "Guardando...", en: "Saving..." },
  complete_student_info: { es: "Complete la información del estudiante", en: "Complete the student information" },

  // Bulk upload (students)
  bulk_upload_desc: {
    es: "Sube un archivo Excel con los datos de los estudiantes. El sistema registrará nuevos estudiantes y actualizará los existentes basándose en el nombre y apellido.",
    en: "Upload an Excel file with student data. The system will create new students and update existing ones based on first and last name."
  },
  bulk_upload_required_fields: { es: "Campos requeridos: first_name, last_name", en: "Required fields: first_name, last_name" },
  bulk_upload_optional_fields: {
    es: "Campos opcionales: current_grade, age, instrument, instrument_size, orchestra_position, active, parent_first_name, parent_last_name, parent_phone_number, parent_email, parent_preferred_contact_method",
    en: "Optional fields: current_grade, age, instrument, instrument_size, orchestra_position, active, parent_first_name, parent_last_name, parent_phone_number, parent_email, parent_preferred_contact_method"
  },
  select_file: { es: "Seleccionar archivo", en: "Select file" },
  no_file_selected: { es: "Ningún archivo seleccionado", en: "No file selected" },
  processing_records: { es: "Procesando: {{processed}} de {{total}} registros", en: "Processing: {{processed}} of {{total}} records" },
  results: { es: "Resultados", en: "Results" },
  new_students: { es: "Estudiantes nuevos", en: "New students" },
  updated_students: { es: "Estudiantes actualizados", en: "Updated students" },
  errors: { es: "Errores", en: "Errors" },
  download_excel_template: { es: "Descargar plantilla Excel", en: "Download Excel template" },
  
  // Additional bulk upload translations
  bulk_upload_subtitle: { es: "Sube un archivo Excel con la información de los estudiantes", en: "Upload an Excel file with student information" },
  usage_instructions: { es: "Instrucciones de uso", en: "Usage Instructions" },
  required_fields: { es: "Campos obligatorios", en: "Required fields" },
  optional_fields: { es: "Campos opcionales", en: "Optional fields" },
  parent_data: { es: "Datos de padres", en: "Parent data" },
  bulk_upload_parent_fields: { es: "parent_first_name, parent_last_name, parent_phone_number, parent_email", en: "parent_first_name, parent_last_name, parent_phone_number, parent_email" },
  drag_excel_file_here: { es: "Arrastra tu archivo Excel aquí", en: "Drag your Excel file here" },
  drop_file_here: { es: "Suelta el archivo aquí", en: "Drop the file here" },
  or_click_to_select: { es: "o haz clic para seleccionar", en: "or click to select" },
  supported_formats: { es: "Formatos soportados", en: "Supported formats" },
  file_selected: { es: "Archivo seleccionado", en: "File selected" },
  processing_file: { es: "Procesando archivo", en: "Processing file" },
  process_completed_successfully: { es: "Proceso completado exitosamente", en: "Process completed successfully" },
  process_completed_with_warnings: { es: "Proceso completado con advertencias", en: "Process completed with warnings" },
  errors_found: { es: "Errores encontrados", en: "Errors found" },
  need_template: { es: "¿Necesitas una plantilla?", en: "Need a template?" },
  download_template_description: { es: "Descarga nuestra plantilla de Excel con el formato correcto", en: "Download our Excel template with the correct format" },
  
  // Clear attendance translations
  clear_attendance: { es: "Limpiar Asistencia", en: "Clear Attendance" },
  clear_attendance_short: { es: "Limpiar", en: "Clear" },
  clear_attendance_confirm: { es: "¿Estás seguro de que quieres limpiar toda la asistencia del {{date}}? Esta acción no se puede deshacer.", en: "Are you sure you want to clear all attendance for {{date}}? This action cannot be undone." },
  attendance_cleared_success: { es: "Asistencia limpiada exitosamente para {{date}}", en: "Attendance cleared successfully for {{date}}" },
  clear_attendance_error: { es: "Error al limpiar la asistencia: {{error}}", en: "Error clearing attendance: {{error}}" },
  
  // Button translations
  bulk_upload_short: { es: "Carga Masiva", en: "Bulk Upload" },
  new_student_short: { es: "Nuevo Estudiante", en: "New Student" },
  
  // Role switching translations
  viewing_as: { es: "Viendo como", en: "Viewing as" },
  switch_view_as: { es: "Cambiar vista como", en: "Switch view as" },
  your_role: { es: "tu rol", en: "your role" },
  viewing: { es: "viendo", en: "viewing" },
  reset_to_actual_role: { es: "Volver a mi rol", en: "Reset to my role" },
  
  // Parent contact translations
  parent_contact_info: { es: "Información de Contacto del Padre/Madre", en: "Parent Contact Information" },
  parent_name: { es: "Nombre del Padre/Madre", en: "Parent Name" },
  parent_phone: { es: "Teléfono del Padre/Madre", en: "Parent Phone" },
  parent_email: { es: "Correo del Padre/Madre", en: "Parent Email" },
  parent_name_placeholder: { es: "María González", en: "Maria Gonzalez" },
  parent_phone_placeholder: { es: "+1 234 567 8900", en: "+1 234 567 8900" },
  parent_email_placeholder: { es: "maria@email.com", en: "maria@email.com" },
  
  // User edit modal translations
  edit_user: { es: "Editar Usuario", en: "Edit User" },
  update_user_info_permissions: { es: "Actualiza información y permisos", en: "Update information and permissions" },
  personal_info_section: { es: "Información Personal", en: "Personal Information" },
  full_name_label: { es: "Nombre Completo", en: "Full Name" },
  full_name_placeholder: { es: "Nombre completo del usuario", en: "User's full name" },
  email_address_label: { es: "Correo Electrónico", en: "Email Address" },
  email_placeholder_user: { es: "usuario@dominio.com", en: "user@domain.com" },
  permissions_access_section: { es: "Permisos y Acceso", en: "Permissions and Access" },
  user_role_label: { es: "Rol del Usuario", en: "User Role" },
  administrator: { es: "Administrador", en: "Administrator" },
  staff_member: { es: "Personal", en: "Staff" },
  viewer_role: { es: "Visualizador", en: "Viewer" },
  assigned_sites_programs: { es: "Sedes/Programas Asignados", en: "Assigned Sites/Programs" },
  sites_selection_help: { es: "💡 Selecciona las sedes donde el usuario puede trabajar. Los profesores pueden estar asignados a múltiples sedes.", en: "💡 Select the sites where the user can work. Teachers can be assigned to multiple sites." },
  orchestra_site: { es: "Sede de la orquesta", en: "Orchestra site" },
  save_changes: { es: "Guardar Cambios", en: "Save Changes" },
  saving_changes: { es: "Guardando...", en: "Saving..." },
  
  // Admin Users Page translations
  admin_users_title: { es: "Gestión de Usuarios", en: "User Management" },
  admin_users_subtitle: { es: "Administra usuarios y sus roles en los programas", en: "Manage users and their roles in programs" },
  add_new_user: { es: "Agregar Nuevo Usuario", en: "Add New User" },
  registered_users: { es: "Usuarios Registrados", en: "Registered Users" },
  manage_all_users: { es: "Gestiona todos los usuarios de la organización", en: "Manage all users in the organization" },
  users_count: { es: "usuarios", en: "users" },
  no_programs_available: { es: "No hay programas disponibles", en: "No programs available" },
  contact_admin_programs: { es: "Contacta al administrador para configurar los programas.", en: "Contact the administrator to configure programs." },
  
  // Create User Modal translations
  create_new_user: { es: "Crear Nuevo Usuario", en: "Create New User" },
  grant_system_access: { es: "Conceder acceso al sistema", en: "Grant system access" },
  user_information: { es: "Información del Usuario", en: "User Information" },
  user_full_name: { es: "Nombre Completo", en: "Full Name" },
  user_full_name_placeholder: { es: "Nombre completo del usuario", en: "User's full name" },
  user_email_address: { es: "Correo Electrónico", en: "Email Address" },
  user_email_placeholder: { es: "usuario@dominio.com", en: "user@domain.com" },
  organization_assignment: { es: "Asignación de Organización", en: "Organization Assignment" },
  select_organization_label: { es: "Seleccionar Organización", en: "Select Organization" },
  select_organization_placeholder: { es: "Selecciona una organización...", en: "Select an organization..." },
  loading_organizations_text: { es: "Cargando organizaciones...", en: "Loading organizations..." },
  program_access: { es: "Acceso a Programas", en: "Program Access" },
  select_programs_label: { es: "Seleccionar Programas", en: "Select Programs" },
  select_programs_help: { es: "Selecciona los programas donde el usuario puede trabajar", en: "Select the programs where the user can work" },
  no_programs_organization: { es: "No hay programas disponibles para esta organización", en: "No programs available for this organization" },
  user_role_assignment: { es: "Asignación de Rol", en: "Role Assignment" },
  select_user_role: { es: "Seleccionar Rol", en: "Select Role" },
  admin_role_desc: { es: "Acceso completo al sistema", en: "Full system access" },
  staff_role_desc: { es: "Acceso a funciones de personal", en: "Staff functions access" },
  viewer_role_desc: { es: "Solo lectura", en: "Read-only access" },
  create_user_button: { es: "Crear Usuario", en: "Create User" },
  creating_user: { es: "Creando usuario...", en: "Creating user..." },
  
  // User management table translations
  name_column: { es: "Nombre", en: "Name" },
  email_column: { es: "Email", en: "Email" },
  organization_column: { es: "Organización", en: "Organization" },
  program_site_column: { es: "Programa / Sede", en: "Program / Site" },
  role_column: { es: "Rol", en: "Role" },
  status_column: { es: "Estado", en: "Status" },
  registration_date_column: { es: "Fecha de Registro", en: "Registration Date" },
  actions_column: { es: "Acciones", en: "Actions" },
  no_program: { es: "Sin programas", en: "No programs" },
  admin_role: { es: "Admin", en: "Admin" },
  staff_role: { es: "Staff", en: "Staff" },
  viewer_role_short: { es: "Viewer", en: "Viewer" },
  active_status: { es: "Activo", en: "Active" },
  inactive_status: { es: "Inactivo", en: "Inactive" },
  edit_tooltip: { es: "Editar usuario", en: "Edit user" },
  toggle_status_tooltip: { es: "Cambiar estado", en: "Toggle status" },
  activate_user: { es: "Activar usuario", en: "Activate user" },
  deactivate_user: { es: "Desactivar usuario", en: "Deactivate user" },
  delete_tooltip: { es: "Eliminar usuario", en: "Delete user" },
  
  // Delete confirmation modal translations
  confirm_deletion: { es: "Confirmar Eliminación", en: "Confirm Deletion" },
  delete_user_warning: { es: "¿Estás seguro de que deseas eliminar este usuario?", en: "Are you sure you want to delete this user?" },
  delete_user_confirmation: { es: "¿Estás seguro de que deseas eliminar completamente al usuario <strong>{email}</strong>? Esta acción no se puede deshacer y eliminará todos los datos asociados.", en: "Are you sure you want to completely delete the user <strong>{email}</strong>? This action cannot be undone and will delete all associated data." },
  delete_user_description: { es: "Esta acción eliminará permanentemente al usuario y todos sus datos asociados. No se puede deshacer.", en: "This action will permanently delete the user and all associated data. This cannot be undone." },
  delete_user_button: { es: "Eliminar Usuario", en: "Delete User" },
  deleting: { es: "Eliminando...", en: "Deleting..." },
  
  // Success and error messages
  user_created_success: { es: "Usuario creado exitosamente", en: "User created successfully" },
  user_updated_success: { es: "Usuario actualizado exitosamente", en: "User updated successfully" },
  user_deleted_success: { es: "Usuario eliminado exitosamente", en: "User deleted successfully" },
  user_status_updated: { es: "Estado del usuario actualizado", en: "User status updated" },
  error_creating_user: { es: "Error al crear el usuario", en: "Error creating user" },
  error_updating_user: { es: "Error al actualizar el usuario", en: "Error updating user" },
  error_deleting_user: { es: "Error al eliminar el usuario", en: "Error deleting user" },
  error_loading_users: { es: "Error al cargar los usuarios", en: "Error loading users" },
  error_loading_organizations: { es: "Error al cargar las organizaciones", en: "Error loading organizations" },
  user_exists_error: { es: "Ya existe un usuario con este correo electrónico", en: "A user with this email already exists" },
  
  // Form validation messages
  field_required: { es: "Este campo es obligatorio", en: "This field is required" },
  invalid_email: { es: "Correo electrónico inválido", en: "Invalid email address" },
  select_organization_required: { es: "Selecciona una organización", en: "Select an organization" },
  select_program_required: { es: "Selecciona al menos un programa", en: "Select at least one program" },
  select_role_required: { es: "Selecciona un rol", en: "Select a role" },
  
  // User status validation messages  
  user_account_inactive: { es: "Tu cuenta está inactiva. Contacta al administrador para reactivarla.", en: "Your account is inactive. Contact the administrator to reactivate it." },
  user_profile_not_found: { es: "No se encontró el perfil de usuario. Contacta al administrador.", en: "User profile not found. Contact the administrator." },
};

interface I18nContextValue {
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
  toggleLanguage: () => void;
  setLanguage: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("lang") as Lang | null) : null;
    if (saved === "es" || saved === "en") setLang(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("lang", lang);
  }, [lang]);

  const t = useMemo(
    () =>
      (key: string, vars?: Record<string, string | number>) => {
        const pack = translations[key];
        let value = (pack ? pack[lang] : key) || key;
        if (vars) {
          Object.entries(vars).forEach(([k, v]) => {
            value = value.replace(new RegExp(`{${k}}`, "g"), String(v));
          });
        }
        return value;
      },
    [lang]
  );

  const toggleLanguage = () => setLang((prev) => (prev === "es" ? "en" : "es"));

  const value = useMemo(
    () => ({ lang, t, toggleLanguage, setLanguage: setLang }),
    [lang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
