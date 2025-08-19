## Modo Oscuro

El sistema de temas ahora incluye soporte completo para modo oscuro. La implementación utiliza React Context para proporcionar el tema actual a todos los componentes de la aplicación.

### Cómo Funciona el Modo Oscuro

1. **Detección Automática**: Al iniciar la aplicación, se detecta automáticamente la preferencia del sistema (claro u oscuro).
2. **Persistencia**: La preferencia del usuario se guarda en AsyncStorage para mantenerla entre sesiones.
3. **Cambio Dinámico**: El usuario puede cambiar entre temas en cualquier momento usando el botón de alternancia de tema ubicado en la pantalla principal (Estudiantes).

### Uso del Modo Oscuro en Componentes

Para acceder al tema actual y sus funcionalidades en cualquier componente:

```javascript
import { useAppTheme } from '../theme';

const MiComponente = () => {
    const { theme, isDark, toggleTheme, setTheme } = useAppTheme();
    
    // Usar theme para acceder a colores, espaciado, etc.
    // isDark indica si el modo oscuro está activo
    // toggleTheme() alterna entre modo claro y oscuro
    // setTheme(true/false) establece un tema específico
    
    return (
        <View style={{ backgroundColor: theme.colors.background }}>
            {/* Contenido del componente */}
        </View>
    );
};
```

### Componente ThemeToggleButton

Se ha creado un componente reutilizable para alternar entre temas. Este componente solo se muestra en la pantalla principal (Estudiantes) para mantener una interfaz limpia y consistente:

```javascript
import ThemeToggleButton from '../components/ThemeToggleButton';

// En tu componente:
<ThemeToggleButton />
```

### Vista Previa del Tema

La aplicación incluye una pantalla de vista previa del tema que muestra todos los componentes con el tema actual. Esta pantalla está principalmente destinada a los desarrolladores para verificar la apariencia de los componentes con diferentes temas.

Para acceder a la vista previa del tema, navega manualmente a la ruta `/theme-preview`. Esta pantalla no está visible en la navegación principal de la aplicación ya que está destinada principalmente para uso durante el desarrollo. 