/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */



const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';
const accent = '#46cb81';
const accentlight = '#46cb8129';
const coolGray = '#C4C4C4'
//6D6D6D
//C4C4C4
export const Colors = {
  light: {
    text: '#141414',
    textlight: '#616161',
    background: '#F9F9F9',
    backgroundLight: '#F0EFEF',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    accent,
    accentlight,
    coolGray
  },
  dark: {
    text: '#ECEDEE',
    textlight: '#9b9c9f',
    background: '#0c0c0c',
    backgroundLight: '#222425',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    accent,
    accentlight,
    coolGray
  },
};

