// FrigoGest 2026 - Light Modern Theme
// Tema claro e moderno para todo o aplicativo

export const lightTheme = {
    // Backgrounds
    bg: {
        primary: 'bg-gray-50',           // Fundo principal - cinza muito claro
        secondary: 'bg-white',           // Fundo secundário - branco
        card: 'bg-white',                // Cards
        hover: 'hover:bg-gray-100',      // Hover state
        active: 'bg-blue-50',            // Estado ativo
        input: 'bg-gray-50',             // Inputs
        sidebar: 'bg-gradient-to-br from-blue-600 to-indigo-700', // Sidebar com gradiente
    },

    // Text Colors
    text: {
        primary: 'text-gray-900',        // Texto principal - preto suave
        secondary: 'text-gray-600',      // Texto secundário
        muted: 'text-gray-400',          // Texto discreto
        white: 'text-white',             // Texto branco (para sidebar)
        link: 'text-blue-600',           // Links
        linkHover: 'hover:text-blue-700',
    },

    // Borders
    border: {
        default: 'border-gray-200',      // Borda padrão
        light: 'border-gray-100',        // Borda clara
        focus: 'focus:border-blue-500',  // Borda em foco
        hover: 'hover:border-gray-300',  // Borda hover
    },

    // Shadows
    shadow: {
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl',
        card: 'shadow-md hover:shadow-lg',
    },

    // Buttons
    button: {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
        success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        warning: 'bg-amber-600 hover:bg-amber-700 text-white',
        ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
    },

    // Status Colors
    status: {
        success: {
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
            border: 'border-emerald-200',
            icon: 'text-emerald-600',
        },
        warning: {
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            border: 'border-amber-200',
            icon: 'text-amber-600',
        },
        error: {
            bg: 'bg-red-50',
            text: 'text-red-700',
            border: 'border-red-200',
            icon: 'text-red-600',
        },
        info: {
            bg: 'bg-blue-50',
            text: 'text-blue-700',
            border: 'border-blue-200',
            icon: 'text-blue-600',
        },
    },

    // Special Elements
    badge: {
        blue: 'bg-blue-100 text-blue-700 border-blue-200',
        green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        red: 'bg-red-100 text-red-700 border-red-200',
        yellow: 'bg-amber-100 text-amber-700 border-amber-200',
        gray: 'bg-gray-100 text-gray-700 border-gray-200',
    },

    // Selection
    selection: 'selection:bg-blue-200',

    // Ring (focus)
    ring: 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
};

// Helper function to get theme classes
export const getThemeClass = (path: string) => {
    const keys = path.split('.');
    let value: any = lightTheme;

    for (const key of keys) {
        value = value[key];
        if (!value) return '';
    }

    return value;
};

export default lightTheme;
