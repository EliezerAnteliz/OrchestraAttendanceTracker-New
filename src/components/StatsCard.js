import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { useAppTheme, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';

export const StatsCard = ({ title, value, trend, color }) => {
  const { theme } = useAppTheme();
  
  const trendColor = trend > 0 ? theme.colors.attendance.present : 
                    trend < 0 ? theme.colors.attendance.unexcused :
                    theme.colors.onSurfaceVariant;

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.onSurfaceVariant }]}>
          {title}
        </Text>
        <Text style={[styles.value, { color: color || theme.colors.primary }]}>
          {value}
        </Text>
        {trend != null && (
          <Text style={[styles.trend, { color: trendColor }]}>
            {trend > 0 ? '+' : ''}{trend}%
          </Text>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: SPACING.sm,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
    marginHorizontal: SPACING.sm,
    ...SHADOWS.small,
  },
  container: {
    alignItems: 'flex-start',
  },
  title: {
    ...TYPOGRAPHY.body2,
    marginBottom: SPACING.xs,
  },
  value: {
    ...TYPOGRAPHY.h1,
    marginBottom: SPACING.xs,
  },
  trend: {
    ...TYPOGRAPHY.body2,
  },
});

export default StatsCard;