import { useFonts } from 'expo-font';

export const FONTS = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
};

export const loadFonts = () => {
  // Usamos fuentes del sistema como fallback
  const [fontsLoaded] = useFonts({
    [FONTS.regular]: 'System',
    [FONTS.medium]: 'System',
    [FONTS.semibold]: 'System',
    [FONTS.bold]: 'System',
  });
  
  return fontsLoaded;
};

export default {
  loadFonts,
  FONTS,
}; 