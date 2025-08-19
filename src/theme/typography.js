import { Platform } from 'react-native';

// Factor de escala para diferentes tamaños de texto
const SCALE_FACTOR = 1.125; // Escala perfecta cuarta (1.125)

// Tamaños base
const BASE_SIZE = 16;
const calculateSize = (step) => Math.round(BASE_SIZE * Math.pow(SCALE_FACTOR, step));

// Familia de fuentes por plataforma
const FONTS = {
    regular: Platform.select({
        ios: 'Inter-Regular',
        android: 'Inter-Regular',
        default: 'Inter-Regular',
    }),
    medium: Platform.select({
        ios: 'Inter-Medium',
        android: 'Inter-Medium',
        default: 'Inter-Medium',
    }),
    semibold: Platform.select({
        ios: 'Inter-SemiBold',
        android: 'Inter-SemiBold',
        default: 'Inter-SemiBold',
    }),
    bold: Platform.select({
        ios: 'Inter-Bold',
        android: 'Inter-Bold',
        default: 'Inter-Bold',
    }),
};

// Tamaños de texto calculados
export const SIZES = {
    xs: calculateSize(-2),    // 12.44px
    sm: calculateSize(-1),    // 14px
    base: BASE_SIZE,          // 16px
    md: calculateSize(1),     // 18px
    lg: calculateSize(2),     // 20.25px
    xl: calculateSize(3),     // 22.78px
    '2xl': calculateSize(4),  // 25.63px
    '3xl': calculateSize(5),  // 28.83px
    '4xl': calculateSize(6),  // 32.44px
};

// Altura de línea para cada tamaño
const LINE_HEIGHT_MULTIPLIER = 1.5;
export const LINE_HEIGHTS = Object.entries(SIZES).reduce((acc, [key, size]) => ({
    ...acc,
    [key]: Math.round(size * LINE_HEIGHT_MULTIPLIER),
}), {});

// Estilos de texto predefinidos
export const TYPOGRAPHY = {
    // Encabezados
    h1: {
        fontFamily: FONTS.bold,
        fontSize: SIZES['4xl'],
        lineHeight: LINE_HEIGHTS['4xl'],
        letterSpacing: -0.5,
    },
    h2: {
        fontFamily: FONTS.bold,
        fontSize: SIZES['3xl'],
        lineHeight: LINE_HEIGHTS['3xl'],
        letterSpacing: -0.5,
    },
    h3: {
        fontFamily: FONTS.semibold,
        fontSize: SIZES['2xl'],
        lineHeight: LINE_HEIGHTS['2xl'],
        letterSpacing: -0.25,
    },
    h4: {
        fontFamily: FONTS.semibold,
        fontSize: SIZES.xl,
        lineHeight: LINE_HEIGHTS.xl,
        letterSpacing: -0.25,
    },
    h5: {
        fontFamily: FONTS.medium,
        fontSize: SIZES.lg,
        lineHeight: LINE_HEIGHTS.lg,
        letterSpacing: 0,
    },

    // Cuerpo de texto
    body1: {
        fontFamily: FONTS.regular,
        fontSize: SIZES.base,
        lineHeight: LINE_HEIGHTS.base,
        letterSpacing: 0.15,
    },
    body2: {
        fontFamily: FONTS.regular,
        fontSize: SIZES.sm,
        lineHeight: LINE_HEIGHTS.sm,
        letterSpacing: 0.15,
    },

    // Texto destacado
    subtitle1: {
        fontFamily: FONTS.medium,
        fontSize: SIZES.base,
        lineHeight: LINE_HEIGHTS.base,
        letterSpacing: 0.1,
    },
    subtitle2: {
        fontFamily: FONTS.medium,
        fontSize: SIZES.sm,
        lineHeight: LINE_HEIGHTS.sm,
        letterSpacing: 0.1,
    },

    // Texto pequeño y etiquetas
    caption: {
        fontFamily: FONTS.regular,
        fontSize: SIZES.xs,
        lineHeight: LINE_HEIGHTS.xs,
        letterSpacing: 0.2,
    },
    overline: {
        fontFamily: FONTS.medium,
        fontSize: SIZES.xs,
        lineHeight: LINE_HEIGHTS.xs,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    // Botones y elementos interactivos
    button: {
        fontFamily: FONTS.medium,
        fontSize: SIZES.sm,
        lineHeight: LINE_HEIGHTS.sm,
        letterSpacing: 0.25,
        textTransform: 'uppercase',
    },
    chip: {
        fontFamily: FONTS.medium,
        fontSize: SIZES.sm,
        lineHeight: LINE_HEIGHTS.sm,
        letterSpacing: 0.1,
    },

    // Variantes de peso
    regular: {
        fontFamily: FONTS.regular,
    },
    medium: {
        fontFamily: FONTS.medium,
    },
    semibold: {
        fontFamily: FONTS.semibold,
    },
    bold: {
        fontFamily: FONTS.bold,
    },
};

export default {
    FONTS,
    SIZES,
    LINE_HEIGHTS,
    TYPOGRAPHY,
}; 