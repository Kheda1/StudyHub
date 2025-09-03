import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/firebase/FirebaseConfig";
import { User, Chat } from "@/types/types";
import { calculateMatchScore } from "@/services/matching";
import { useRouter } from "expo-router";
import { wp, hp } from '@/constants/common';

interface Match {
  id: string;
  userId: string;
  userName: string;
  score: number;
}

export default function FindPartners() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: (User & { id: string })[] = usersSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as User),
      }));

      const me = allUsers.find((u) => u.uid === auth.currentUser?.uid);
      if (!me) return;

      const others = allUsers.filter((u) => u.uid !== auth.currentUser?.uid);

      const scored = others.map((u) => ({
        id: u.uid || u.id,
        userId: u.uid,
        userName: u.displayName || "Unknown",
        score: calculateMatchScore(me, u),
      }));

      scored.sort((a, b) => b.score - a.score);
      setMatches(scored.slice(0, 10));
    } catch (error) {
      console.error("Error fetching matches:", error);
      Alert.alert("Error", "Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  const openOrCreateChat = async (partner: Match) => {
    if (!auth.currentUser) {
      Alert.alert("Error", "You must be logged in to start a chat");
      return;
    }

    try {
      const currentUser = auth.currentUser;
      const currentUid = currentUser.uid;
      const partnerUid = partner.userId;

      // Check if chat already exists between these two users
      const chatsRef = collection(db, "chats");
      const q = query(
        chatsRef, 
        where("participantIds", "array-contains", currentUid)
      );
      
      const querySnap = await getDocs(q);
      let existingChat: any = null;

      querySnap.forEach((doc) => {
        const data = doc.data() as Omit<Chat, "id">;
        if (data.participantIds && data.participantIds.includes(partnerUid)) {
          existingChat = { id: doc.id, ...data };
        }
      });

      if (existingChat) {
        // Navigate to existing chat
        router.push({
          pathname: "../(tabs)/Messages",
          params: { 
            chatId: existingChat.id,
            partnerName: partner.userName 
          }
        });
        return;
      }

      // Create new chat
      const newChatData = {
        participantIds: [currentUid, partnerUid],
        participantNames: {
          [currentUid]: currentUser.displayName || "You",
          [partnerUid]: partner.userName
        },
        lastMessage: "",
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
        isDirectMessage: true
      };

      const newChatRef = await addDoc(collection(db, "chats", currentUid, 'messages'), newChatData);

      // Navigate to new chat
      router.push({
        pathname: "../(tabs)/Messages",
        params: { 
          chatId: newChatRef.id,
            partnerName: partner.userName 
        }
      });
    } catch (error) {
      console.error("Error creating chat:", error);
      Alert.alert("Error", "Failed to start chat");
    }
  };

  const renderMatchItem = ({ item }: { item: Match }) => (
    <TouchableOpacity
      style={[
        styles.matchCard,
        { borderLeftColor: getScoreColor(item.score) }
      ]}
      onPress={() => openOrCreateChat(item)}
    >
      <View style={styles.matchInfo}>
        <Text style={styles.name}>{item.userName}</Text>
        <Text style={styles.score}>Match Score: {item.score}%</Text>
      </View>
      <View style={styles.scoreIndicator}>
        <View style={[
          styles.scoreCircle, 
          { backgroundColor: getScoreColor(item.score) }
        ]}>
          <Text style={styles.scoreText}>{item.score}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getScoreColor = (score: number) => {
    if (score >= 75) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    return '#F44336';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Finding your perfect study partners...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Find Study Partners</Text>
      <Text style={styles.subtitle}>
        Connect with students who match your learning style and preferences
      </Text>
      
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchItem}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.noMatches}>No matches found</Text>
            <Text style={styles.emptySubtext}>
              Update your profile with more details to find better matches
            </Text>
          </View>
        }
        refreshing={loading}
        onRefresh={fetchMatches}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: hp(2),
    padding: wp(4),
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: hp(2),
    color: "#666",
    fontSize: hp(2),
  },
  header: {
    fontSize: hp(3),
    fontWeight: "bold",
    marginBottom: hp(1),
    color: "#333",
  },
  subtitle: {
    fontSize: hp(2),
    color: "#666",
    marginBottom: hp(2.5),
  },
  matchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: wp(4),
    marginBottom: hp(1.5),
    borderRadius: wp(3),
    backgroundColor: "#f8f9fa",
    borderLeftWidth: wp(1),
    borderLeftColor: "#4CAF50",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: hp(0.25),
    },
    shadowOpacity: 0.1,
    shadowRadius: wp(0.75),
    elevation: 2,
  },
  matchInfo: {
    flex: 1,
  },
  name: {
    fontSize: hp(2.25),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp(0.5),
  },
  score: {
    fontSize: hp(1.75),
    color: "#666",
  },
  scoreIndicator: {
    marginLeft: wp(3),
  },
  scoreCircle: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    justifyContent: "center",
    alignItems: "center",
  },
  scoreText: {
    color: "white",
    fontWeight: "bold",
    fontSize: hp(2),
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: wp(10),
  },
  noMatches: {
    fontSize: hp(2.25),
    color: "#666",
    marginBottom: hp(1),
  },
  emptySubtext: {
    fontSize: hp(1.75),
    color: "#999",
    textAlign: "center",
  },
});