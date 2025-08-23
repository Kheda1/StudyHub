import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  View, 
  TextInput, 
  ScrollView, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { wp, hp } from '@/constants/common';
import { router } from 'expo-router';
import { auth } from '@/firebase/FirebaseConfig';
import { updateProfile } from 'firebase/auth';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import { supabase } from '@/services/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import 'react-native-url-polyfill/auto';

const DEFAULT_PROFILE_IMAGE = 'https://www.gravatar.com/avatar/default?s=200&d=mp';
const AVATAR_BUCKET = 'user-profiles';
const db = getFirestore();

type SupabaseError = {
  message: string;
  status?: number;
};

export default function ProfileScreen() {
  const [user, setUser] = useState(auth.currentUser);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_PROFILE_IMAGE);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.email || '');
      setAvatarUrl(user.photoURL || DEFAULT_PROFILE_IMAGE);
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      console.log("User signed out");
      router.replace('/');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign out';
      Alert.alert('Error', errorMessage);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select image';
      Alert.alert('Error', errorMessage);
    }
  };

  const uploadImageToSupabase = async (uri: string): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.uid}-${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = (error as SupabaseError).message || 'Failed to upload image';
      throw new Error(errorMessage);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let newAvatarUrl = avatarUrl;
      
      if (avatarUrl.startsWith('file://')) {
        newAvatarUrl = await uploadImageToSupabase(avatarUrl);
      }

      await updateProfile(user, {
        displayName,
        photoURL: newAvatarUrl
      });

      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        photoURL: newAvatarUrl,
        updatedAt: new Date()
      });

      setUser({ ...user, displayName, photoURL: newAvatarUrl });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            onPress={isEditing ? pickImage : undefined}
            disabled={!isEditing}
          >
            <Image
              source={{ uri: avatarUrl }}
              style={styles.profileImage}
              placeholder={DEFAULT_PROFILE_IMAGE}
              transition={300}
              contentFit="cover"
            />
            {isEditing && (
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={wp(4.5)} color="white" />
              </View>
            )}
          </TouchableOpacity>

          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              maxLength={30}
            />
          ) : (
            <ThemedText style={styles.name}>{displayName || 'Anonymous'}</ThemedText>
          )}
        </View>

        <View style={styles.buttonContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={styles.buttonText}>Save Changes</ThemedText>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditing(false)}
                disabled={loading}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <ThemedText style={styles.buttonText}>Edit Profile</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.signOutButton]}
                onPress={handleSignOut}
              >
                <ThemedText style={styles.buttonText}>Sign Out</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingVertical: hp(3),
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: hp(4),
  },
  profileImage: {
    width: wp(40),
    height: wp(40),
    borderRadius: wp(20),
    borderWidth: 2,
    borderColor: '#eee',
  },
  editBadge: {
    position: 'absolute',
    right: wp(-1),
    bottom: hp(-1),
    backgroundColor: '#1E88E5',
    borderRadius: wp(3),
    padding: wp(2),
  },
  name: {
    fontSize: wp(6),
    fontWeight: 'bold',
    marginTop: hp(2),
    textAlign: 'center',
  },
  nameInput: {
    fontSize: wp(5.5),
    fontWeight: '600',
    marginTop: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#1E88E5',
    padding: wp(1.5),
    textAlign: 'center',
    width: wp(70),
    color: '#333',
  },
  buttonContainer: {
    width: '100%',
    marginTop: hp(2),
  },
  button: {
    paddingVertical: hp(1.8),
    borderRadius: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.5),
    flexDirection: 'row',
  },
  editButton: {
    backgroundColor: '#1E88E5',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  signOutButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: wp(4.2),
    marginLeft: wp(2),
  },
});