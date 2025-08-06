import { Stack } from 'expo-router';

export default function CommunityLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false // This keeps headers consistent with your main tabs
      }} 
    />
  );
}