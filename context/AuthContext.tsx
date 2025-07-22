import { AddUser, create, readById, updatePost } from "@/firebase/dbActions";
import  { db, auth } from "@/firebase/FirebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, User, UserCredential } from "firebase/auth";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import React, { createContext, useContext, useState, ReactNode } from "react";
import { Appearance, Settings, ToastAndroid } from "react-native";
import { doc, setDoc, getFirestore } from "firebase/firestore";
//import { app } from "@/firebase/firebasesetup"; // adjust path if needed
//import { user } from "@/types/types";
//import { GoogleSignin } from "@react-native-google-signin/google-signin";

export type FirebaseUser = User & {
    [key: string]: any; // Additional custom fields
};

type GoogleSignInUser = {
    id: string;
    name: string | null;
    email: string;
    photo: string | null;
    familyName: string | null;
    givenName: string | null;
};

type GoogleSignInResponse = {
    idToken: string;
    user: GoogleSignInUser;
};

type SettingsType = {
    theme: 'device' | 'light' | 'dark'; // 'light', 'dark', or 'device'
    [key: string]: any;
};

type Credentials = {
    email: string;
    password: string;
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
    bio?: string;
    location?: string; 
};

type AuthContextType = {
    user: FirebaseUser | null;
    settings: SettingsType | null;
    isSignedIn: boolean;
    signUp: (credentials: Credentials) => Promise<void>;
    Login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; message?: string }>;
    setupUser: (userData: FirebaseUser | null) => Promise<void>;
    Logout: () => Promise<boolean>;
    updateAccount: (credentials: Partial<Credentials>) => Promise<{ success: boolean; error?: string }>;
    InitSettings: () => Promise<void>;
    signInWithGoogle: (googleResponse: GoogleSignInResponse) => Promise<{ success: boolean; user?: FirebaseUser; error?: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [settings, setSettings] = useState<SettingsType | null>(null);
    const [isSignedIn, setIsSignedIn] = useState(false);

    const InitSettings = async () => {
        try {
            const dataJson = await AsyncStorage.getItem('settings');
            if (dataJson) {
                const data = JSON.parse(dataJson) as SettingsType;
                if (data) {
                    setSettings(data);
                    if (data.theme) {
                        Appearance.setColorScheme(data.theme === 'device' ? null : data.theme);
                    }
                }
            }
        } catch (error) {
            console.error("Error initializing settings:", error);
        }
    };

    const setupUser = async (userData: FirebaseUser | null) => {
        if (userData) {
            const additional = await readById('users', userData.uid);
            setUser({ ...userData, ...additional });
            setIsSignedIn(true);
            await AsyncStorage.setItem('user', JSON.stringify({
                ...userData,
            }));
            return;
        } else {
            setUser(null);
            setIsSignedIn(false);
            await AsyncStorage.removeItem('user');
            return;
        }
    };

    const Login = async (credentials: { email: string; password: string }) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            const user = userCredential.user;

            setUser({ ...user });
            setIsSignedIn(true);
            await AsyncStorage.setItem("user", JSON.stringify({ ...user }));

            router.back();
            return { success: true };

        } catch (error: any) {
            const errorCode = error.message.match(/\(([^)]+)\)/)?.[1];
            console.log(error);
            console.log(errorCode);

            let errorMessage = "An unexpected error occurred. Please try again.";

            if (errorCode) {
                switch (errorCode) {
                    case "auth/network-request-failed":
                        errorMessage = "Network request failed";
                        break;
                    case "auth/invalid-email":
                        errorMessage = "Invalid email format.";
                        break;
                    case "auth/user-not-found":
                        errorMessage = "No account found with this email.";
                        break;
                    case "auth/wrong-password":
                        errorMessage = "Incorrect password. Please try again.";
                        break;
                    case "auth/user-disabled":
                        errorMessage = "This account has been disabled.";
                        break;
                    case "auth/too-many-requests":
                        errorMessage = "Too many failed attempts. Try again later.";
                        break;
                    case "auth/invalid-credential":
                        errorMessage = "Password and Email are not recognised";
                        break;
                    default:
                        errorMessage = "Login failed. Please try again.";
                }
            }

            return { success: false, message: errorMessage };
        }
    };

    const signUp = async (credentials: Credentials) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
            const user = userCredential.user;

            // Update the user's profile with the display name
            await updateProfile(user, { displayName: credentials.displayName });
            const newUser = await AddUser(user.uid, {
                phoneNumber: null,
                photoURL: null,
                displayName: credentials.displayName,
                uid: user.uid,
                email: user.email,
            });

            setUser({
                ...user,
                displayName: credentials.displayName || '',
            });
            setIsSignedIn(true);
            router.back();
            await AsyncStorage.setItem('user', JSON.stringify({
                ...user,
                displayName: credentials.displayName || ''
            }));
        } catch (error) {
            console.log('error logging in ', error);
        }
    };

    const Logout = async () => {
        try {
            await signOut(auth);
            await setupUser(null);
            ToastAndroid.show('logout successful', ToastAndroid.SHORT);
            return true; // Returns true if successful
        } catch (error) {
            ToastAndroid.show('logout unsuccessful', ToastAndroid.SHORT);
            console.error("Error during logout:", error);
            return false; // Returns false on failure
        }
    };

    const updateAccount = async (credentials: Partial<Credentials>) => {
        try {
            if (!isSignedIn || !user) {
                router.push('./user/login');
                return { success: false, error: "User not signed in" };
            }

            await updateProfile(auth.currentUser!, {
                displayName: credentials.displayName,
                photoURL: credentials.photoURL,
            });

            const updated = await AddUser(user.uid, {
                ...credentials,
            });

            router.back();
            return { success: true };
        } catch (error: any) {
            console.log("Update Error > ", error);
            return { success: false, error: error.message };
        }
    };

    const signInWithGoogle = async (googleResponse: GoogleSignInResponse) => {
        try {
            const { idToken, user: googleUser } = googleResponse;
            if (!idToken) throw new Error("No idToken found in Google response");
            const googleCredential = GoogleAuthProvider.credential(idToken);
            const userCredential = await signInWithCredential(auth, googleCredential);

            // Save user info to Firestore
            const { uid, email, displayName, photoURL } = userCredential.user;
            await setDoc(doc(db, "users", uid), {
                email: email ?? googleUser.email ?? "",
                displayName: displayName ?? googleUser.name ?? "",
                photoURL: photoURL ?? googleUser.photo ?? "",
                lastLogin: new Date()
            }, { merge: true });

            setUser(userCredential.user);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.log(error);
            return { success: false, error };
        }
    };

    return (
        <AuthContext.Provider value={{
            signUp,
            Login,
            isSignedIn,
            user,
            settings,
            setupUser,
            Logout,
            updateAccount,
            InitSettings,
            signInWithGoogle
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};