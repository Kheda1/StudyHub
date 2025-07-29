import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/firebase/FirebaseConfig';
import { collection, doc, setDoc } from 'firebase/firestore';
import { router } from 'expo-router';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [level, setLevel] = useState('highschool');
  const [interests, setInterests] = useState('');
  const [subjects, setSubjects] = useState('');
  const [methods, setMethods] = useState('');
  const [times, setTimes] = useState('');

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { label: 'High School', value: 'highschool' },
    { label: 'College', value: 'college' },
  ]);

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        email,
        phone,
        level,
        interests,
        subjects,
        methods,
        times,
      });

      router.replace('./(tabs)/Home');
    } catch (err: any) {
      alert('Signup failed: ' + err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone Number"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Academic Level</Text>
        <View style={{ zIndex: 1000, marginBottom: 20 }}>
          <DropDownPicker
            open={open}
            value={level}
            items={items}
            setOpen={setOpen}
            setValue={setLevel}
            setItems={setItems}
            listMode="SCROLLVIEW"
            placeholder="Select level"
          />
        </View>

        <Text style={styles.label}>Academic Interests</Text>
        <TextInput
          style={styles.input}
          value={interests}
          onChangeText={setInterests}
          placeholder="e.g. Science, Tech..."
        />

        <Text style={styles.label}>Subjects</Text>
        <TextInput
          style={styles.input}
          value={subjects}
          onChangeText={setSubjects}
          placeholder="e.g. Math, Biology..."
        />

        <Text style={styles.label}>Preferred Study Methods</Text>
        <TextInput
          style={styles.input}
          value={methods}
          onChangeText={setMethods}
          placeholder="e.g. Group study, flashcards..."
        />

        <Text style={styles.label}>Study Times</Text>
        <TextInput
          style={styles.input}
          value={times}
          onChangeText={setTimes}
          placeholder="e.g. Evenings, weekends..."
        />

        <TouchableOpacity style={styles.signupButton} onPress={handleSignUp}>
          <Text style={styles.signupText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/user/login')}>
          <Text style={styles.loginLink}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  signupButton: {
    backgroundColor: '#1E88E5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  signupText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loginLink: {
    color: '#1E88E5',
    textAlign: 'center',
  },
});
