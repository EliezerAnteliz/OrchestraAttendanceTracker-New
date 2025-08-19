-- Configuración de la base de datos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de organizaciones
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    website TEXT,
    address TEXT,
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_email CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Tabla de programas
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de estados de asistencia
CREATE TABLE attendance_status (
    code VARCHAR(2) PRIMARY KEY,
    description VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de padres
CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    preferred_contact_method VARCHAR(20) NOT NULL DEFAULT 'phone',
    organization_id UUID NOT NULL REFERENCES organizations(id),
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_parent_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_contact_method CHECK (preferred_contact_method IN ('phone', 'email', 'both'))
);

-- Tabla de estudiantes
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(10) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    age INTEGER CHECK (age > 0 AND age < 100),
    current_grade VARCHAR(20),
    instrument VARCHAR(50) DEFAULT 'Not Assigned',
    instrument_size VARCHAR(20) DEFAULT 'N/A',
    orchestra_position VARCHAR(50) DEFAULT 'Section',
    is_active BOOLEAN NOT NULL DEFAULT true,
    withdrawal_date DATE,
    profile_photo TEXT,
    notes TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    program_id UUID NOT NULL REFERENCES programs(id),
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_id_per_org UNIQUE (student_id, organization_id)
);

-- Tabla de relaciones estudiante-padre
CREATE TABLE student_parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    parent_id UUID NOT NULL REFERENCES parents(id),
    relationship VARCHAR(50) DEFAULT 'Parent',
    is_primary_contact BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_parent UNIQUE (student_id, parent_id)
);

-- Tabla de asistencia
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    date DATE NOT NULL,
    status_code VARCHAR(2) NOT NULL REFERENCES attendance_status(code),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_attendance_record UNIQUE (student_id, date)
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_students_organization ON students(organization_id);
CREATE INDEX idx_students_program ON students(program_id);
CREATE INDEX idx_student_parents_student ON student_parents(student_id);
CREATE INDEX idx_student_parents_parent ON student_parents(parent_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);

-- Índices adicionales para optimizar consultas de reportes
CREATE INDEX idx_attendance_status_code ON attendance(status_code);
CREATE INDEX idx_attendance_date_status ON attendance(date, status_code);
CREATE INDEX idx_students_instrument ON students(instrument);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);

-- Vistas materializadas para reportes frecuentes
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_attendance_stats AS
SELECT 
    student_id,
    date_trunc('month', date) as month,
    status_code,
    COUNT(*) as count
FROM attendance
GROUP BY student_id, date_trunc('month', date), status_code;

CREATE INDEX idx_monthly_stats_student ON monthly_attendance_stats(student_id);
CREATE INDEX idx_monthly_stats_month ON monthly_attendance_stats(month);

-- Función para refrescar estadísticas
CREATE OR REPLACE FUNCTION refresh_attendance_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW monthly_attendance_stats;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
    BEFORE UPDATE ON programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parents_updated_at
    BEFORE UPDATE ON parents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
