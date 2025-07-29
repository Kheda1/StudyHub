import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/FirebaseConfig';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, navigate to the main app (tabs)
        router.replace('/(tabs)/Home');
      } else {
        // No user is signed in, navigate to welcome screen
        router.replace('/user/welcome');
      }
    });

    return unsubscribe; // cleanup the listener
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
