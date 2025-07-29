// app/user/welcome.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function WelcomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Welcome to StudyHub!</Text>

      <TouchableOpacity onPress={() => router.push('/user/signup')}>
        <Text>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/user/login')}>
        <Text>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}
