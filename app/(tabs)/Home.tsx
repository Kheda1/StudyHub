import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { auth } from '@/firebase/FirebaseConfig';

export default function HomeScreen() {
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      console.log("User signed out");
      router.replace('/');
    } catch (error) {
      console.log('Sign out error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>
      <TouchableOpacity onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#1E88E5',
    fontWeight: 'bold',
  },
});
