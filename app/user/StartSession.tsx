import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { db } from "@/firebase/FirebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { wp } from "@/constants/common";

export default function StartSession() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        if (!sessionId) return;
        const docRef = doc(db, "studySessions", sessionId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSession({ id: snap.id, ...snap.data() });
        } else {
          Alert.alert("Not Found", "This session does not exist.");
          router.back();
        }
      } catch (error) {
        console.error("Error loading session:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const formatDateTime = (date: any) => {
    const d = new Date(date.toDate());
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleStartSession = async () => {
    try {
      setStarting(true);
      const docRef = doc(db, "studySessions", sessionId!);
      await updateDoc(docRef, {
        status: "active",
        startedAt: serverTimestamp(),
      });
      Alert.alert("Session Started 🎉", "Good luck with your study!");
      console.log("Session started:", sessionId);
    //   router.push({
    //     pathname: "/user/ActiveSession",
    //     params: { sessionId },
    //   });
    } catch (error) {
      console.error("Error starting session:", error);
      Alert.alert("Error", "Could not start session. Try again.");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <ThemedText style={styles.loadingText}>Loading session...</ThemedText>
      </ThemedView>
    );
  }
    if (!session) {
    return (
        <ThemedView style={styles.centered}>
        <Ionicons name="alert-circle" size={wp(8)} color="red" />
        <ThemedText style={styles.loadingText}>
            Session not found or could not be loaded.
        </ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={styles.startButton}>
            <Text style={styles.startButtonText}>Go Back</Text>
        </TouchableOpacity>
        </ThemedView>
    );
    }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={wp(6)} color="#4CAF50" />
        </TouchableOpacity>
        <ThemedText style={styles.headerText}>Start Session</ThemedText>
      </View>

      {/* Session Card */}
      <View style={styles.card}>
        <ThemedText style={styles.sessionTitle}>
          {session.subjectEmoji || "📚"} {session.subject} {session.type}
        </ThemedText>
        <ThemedText style={styles.sessionTime}>
          {formatDateTime(session.scheduledDate)}
        </ThemedText>
        <ThemedText style={styles.sessionDescription}>
          {session.description || "No description provided."}
        </ThemedText>

        <ThemedText style={styles.participantsTitle}>Participants:</ThemedText>
        {session.participantNames?.map((name: string, idx: number) => (
          <Text key={idx} style={styles.participant}>
            • {name}
          </Text>
        ))}
      </View>

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startButton, starting && { opacity: 0.7 }]}
        onPress={handleStartSession}
        disabled={starting}
      >
        {starting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.startButtonText}>Start Session</Text>
        )}
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: wp(4),
    fontSize: wp(5),
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: wp(4),
  },
  headerText: {
    fontSize: wp(5),
    fontWeight: "bold",
    marginLeft: wp(3),
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: wp(3),
    padding: wp(5),
    marginBottom: wp(5),
    elevation: 2,
  },
  sessionTitle: {
    fontSize: wp(5),
    fontWeight: "bold",
    marginBottom: wp(2),
  },
  sessionTime: {
    fontSize: wp(4),
    color: "#1976D2",
    marginBottom: wp(3),
  },
  sessionDescription: {
    fontSize: wp(3.8),
    color: "#555",
    marginBottom: wp(3),
  },
  participantsTitle: {
    fontSize: wp(4),
    fontWeight: "600",
    marginBottom: wp(1),
  },
  participant: {
    fontSize: wp(3.6),
    color: "#444",
    marginLeft: wp(2),
  },
  startButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: wp(4),
    borderRadius: wp(3),
    alignItems: "center",
    width: wp(30),
  },
  startButtonText: {
    fontSize: wp(6),
    fontWeight: "bold",
    color: "#fff",
  },
});
