-- Script para configurar el sistema de registro de usuarios mejorado
-- Ejecutar en el SQL Editor de Supabase

-- 1. Crear tabla user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'staff', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_id ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- 3. Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow profile creation during signup" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Política para administradores
CREATE POLICY "Admins can manage organization profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_program_memberships upm
            JOIN programs p ON p.id = upm.program_id
            WHERE upm.user_id = auth.uid()
            AND upm.role = 'admin'
            AND p.organization_id = user_profiles.organization_id
        )
    );

-- 6. Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profiles_updated_at();

-- 8. Función para obtener usuarios de una organización
CREATE OR REPLACE FUNCTION get_organization_users(org_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(20),
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Verificar que el usuario actual es admin
    IF NOT EXISTS (
        SELECT 1 FROM user_program_memberships upm
        JOIN programs p ON p.id = upm.program_id
        WHERE upm.user_id = auth.uid()
        AND upm.role = 'admin'
        AND p.organization_id = org_id
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    RETURN QUERY
    SELECT 
        up.id,
        up.user_id,
        up.email,
        up.full_name,
        up.role,
        up.is_active,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.organization_id = org_id
    ORDER BY up.created_at DESC;
END;
$$;

-- 9. Función para sincronizar con user_program_memberships
CREATE OR REPLACE FUNCTION sync_user_profile_with_memberships()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Crear membership en el primer programa activo de la organización
        INSERT INTO user_program_memberships (user_id, program_id, role, created_at)
        SELECT 
            NEW.user_id,
            p.id,
            NEW.role,
            NEW.created_at
        FROM programs p
        WHERE p.organization_id = NEW.organization_id
        AND p.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM user_program_memberships upm
            WHERE upm.user_id = NEW.user_id
            AND upm.program_id = p.id
        )
        ORDER BY p.created_at ASC
        LIMIT 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Trigger para sincronización
CREATE TRIGGER sync_user_profile_memberships
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_profile_with_memberships();
