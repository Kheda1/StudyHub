import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/FirebaseConfig';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        
        router.replace('/(tabs)/Home');
      } else {
        
        router.replace('/user/welcome');
      }
    });

    return unsubscribe; 
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
