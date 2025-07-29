import { Text, type TextProps, StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'italic' | 'tiny';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor('text');

  return (
    <Text
      style={[
        { color: color },
        type === 'tiny' ? styles.tiny : undefined,
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'italic' ? styles.italic : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Regular',
    paddingTop: 3
  },
  italic: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 22,
    fontFamily: 'Italic',
    paddingTop: 3

  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Medium',
  },
  title: {
    fontSize: 32,

    fontFamily: 'Bold',
  },
  subtitle: {
    fontSize: 20,
    fontFamily: 'SemiBold', paddingTop: 3
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
    fontFamily: 'Light', paddingTop: 3
  },
  tiny: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Regular',
    paddingTop: 3
  },
});
