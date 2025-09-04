import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { router } from "expo-router";
import { db, auth } from "@/firebase/FirebaseConfig";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { wp, hp } from "@/constants/common";

export default function ViewFullSchedule() {
  const accent = useThemeColor("accent");
  const textColor = useThemeColor("text");
  const [user] = useAuthState(auth);
  const [sessions, setSessions] = useState<{ id: string; [key: string]: any }[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const fetchAllSessions = async () => {
    if (!user) return;
    try {
      const sessionsRef = collection(db, "studySessions");
      const q = query(
        sessionsRef,
        where("participants", "array-contains", user.uid),
        orderBy("scheduledDate", "asc")
      );

      const querySnapshot = await getDocs(q);
      const allSessions: { id: string; [key: string]: any }[] = [];

      querySnapshot.forEach((doc) => {
        allSessions.push({ id: doc.id, ...doc.data() });
      });

      setSessions(allSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSessions();
  }, [user]);

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

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={accent} />
        <ThemedText style={styles.loadingText}>Loading your schedule...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={wp(6)} color={accent} />
        </TouchableOpacity>
        <ThemedText style={styles.headerText}>Your Full Schedule</ThemedText>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome5 name="calendar-times" size={wp(6)} color="#BDBDBD" />
          <Text style={styles.emptyText}>No study sessions found</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.sessionCard}>
              <View style={styles.sessionTime}>
                <Text style={styles.timeText}>{formatDateTime(item.scheduledDate)}</Text>
              </View>
              <View style={styles.sessionDetails}>
                <Text style={styles.sessionTitle}>
                  {item.subjectEmoji || "📚"} {item.subject} {item.type}
                </Text>
                <Text style={styles.sessionSubtext}>
                  {item.participantNames?.length > 1
                    ? `With ${item.participantNames.slice(0, 2).join(", ")}${
                        item.participantNames.length > 2
                          ? ` & ${item.participantNames.length - 2} others`
                          : ""
                      }`
                    : item.description || "Solo study session"}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: hp(2),
    padding: wp(5),
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: wp(4),
    fontSize: wp(4),
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
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: wp(20),
  },
  emptyText: {
    fontSize: wp(4),
    color: "#757575",
    marginTop: wp(2),
  },
  sessionCard: {
    flexDirection: "row",
    padding: wp(4),
    backgroundColor: "#fff",
    borderRadius: wp(3),
    marginBottom: wp(3),
    elevation: 1,
  },
  sessionTime: {
    marginRight: wp(3),
    justifyContent: "center",
  },
  timeText: {
    fontSize: wp(3.5),
    fontWeight: "600",
    color: "#1976D2",
  },
  sessionDetails: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: wp(4),
    fontWeight: "600",
    color: "#212121",
  },
  sessionSubtext: {
    fontSize: wp(3.3),
    color: "#757575",
    marginTop: wp(0.5),
  },
});
