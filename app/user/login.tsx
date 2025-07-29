// app/user/login.tsx
import { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebase/FirebaseConfig';
import { router } from 'expo-router';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('./(tabs)/Home');
    } catch (err: any) {
      alert('Login failed: ' + err.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />

      <TouchableOpacity onPress={handleLogin}>
        <Text>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/user/signup')}>
        <Text>No account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}
