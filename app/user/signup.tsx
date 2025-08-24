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
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@/firebase/FirebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { router } from 'expo-router';
import { academicLevels } from '@/constants/academicLevels';
import { AcademicLevel } from '@/types/types';
import { wp } from '@/constants/common';
import { ThemedText } from '@/components/ThemedText';


export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel | null>(null);
  const [subjects, setSubjects] = useState('');
  const [methods, setMethods] = useState('');
  const [preferences, setPreferences] = useState('');
  const [open, setOpen] = useState(false);

  const handleSignUp = async () => {

    if (!displayName || !academicLevel) {
      alert("Please fill all required fields");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        displayName,
        phone,
        academicLevel: academicLevel,
        subjects: subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : [],
        methods: methods ? methods.split(',').map(m => m.trim()).filter(Boolean) : [],
        preferences: preferences ? preferences.split(',').map(p => p.trim()).filter(Boolean) : [],
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateProfile(userCredential.user, {
        displayName,
      });

      alert('Signup successful!');
      console.log("User signed In");
      router.replace('/(tabs)/Home');
    } catch (err: any) {
      alert('Signup failed: ' + err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: wp(8) }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        
        <ThemedText style={styles.label}>Full Name</ThemedText>
        <TextInput 
          style={styles.input} 
          value={displayName} 
          onChangeText={setDisplayName} 
          placeholder="Enter your full name" 
          autoCapitalize="words"
        />

        <ThemedText style={styles.label}>Email</ThemedText>
        <TextInput 
          style={styles.input} 
          value={email} 
          onChangeText={setEmail} 
          placeholder="Email" 
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <ThemedText style={styles.label}>Password</ThemedText>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />

        <ThemedText style={styles.label}>Phone (optional)</ThemedText>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone Number"
          keyboardType="phone-pad"
        />

        <ThemedText style={styles.label}>Academic Level</ThemedText>
        <View style={{ zIndex: 1000, marginBottom: 20 }}>
          <DropDownPicker
            open={open}
            value={academicLevel}
            items={academicLevels}
            setOpen={setOpen}
            setValue={setAcademicLevel}
            setItems={() => {}} 
            placeholder="Select level"
            listMode="SCROLLVIEW"
            dropDownDirection="BOTTOM"
            style={{ borderColor: '#CCC' }}
            textStyle={{ fontSize: 14 }}
          />
        </View>

        <ThemedText style={styles.label}>Subjects/Modules</ThemedText>
        <TextInput
          style={styles.input}
          value={subjects}
          onChangeText={setSubjects}
          placeholder="e.g. Math, Biology, Comm Skills..."
        />

        <ThemedText style={styles.label}>Preferred Study Methods</ThemedText>
        <TextInput
          style={styles.input}
          value={methods}
          onChangeText={setMethods}
          placeholder="e.g. Group study, Goal Setting, Study Buddy..."
        />

        <ThemedText style={styles.label}>Study Times</ThemedText>
        <TextInput
          style={styles.input}
          value={preferences}
          onChangeText={setPreferences}
          placeholder="e.g. Evenings, weekends..."
        />

        <TouchableOpacity style={styles.signupButton} onPress={handleSignUp}>
          <ThemedText style={styles.signupText}>Sign Up</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/user/login')}>
          <ThemedText style={styles.loginLink}>Already have an account? Log in</ThemedText>
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