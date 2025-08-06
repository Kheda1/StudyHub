// CommunityQuestionList.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  getFirestore,
  runTransaction,
  doc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { router } from 'expo-router';
import { app } from '@/firebase/FirebaseConfig';

const db = getFirestore(app);
const auth = getAuth(app);

type QuestionListItem = {
  id: string;
  title: string;
  body: string;
  authorDisplayName?: string;
  createdAt?: Date | null;
  score: number;
};

const PAGE_SIZE = 10;

export default function Community() {
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const currentUser = auth.currentUser;
  const userId = currentUser ? currentUser.uid : null;

  useEffect(() => {
    loadInitial();
    // Optionally subscribe to auth state changes to re-render UI when user signs in/out:
    // const unsub = onAuthStateChanged(auth, (u) => setUserId(u?.uid ?? null));
    // return () => unsub();
  }, []);

  // Convert a Firestore doc into QuestionListItem
  function convertDocToListItem(docSnap: QueryDocumentSnapshot): QuestionListItem {
    const data = docSnap.data() as any;
    const createdAt =
      data.createdAt instanceof Timestamp ? (data.createdAt as Timestamp).toDate() : data.createdAt || null;

    return {
      id: docSnap.id,
      title: data.title ?? 'Untitled',
      body: data.body ?? '',
      authorDisplayName: data.authorDisplayName ?? 'Unknown',
      createdAt,
      score: typeof data.score === 'number' ? data.score : 0,
    };
  }

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'communityQuestions'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(convertDocToListItem);
      setQuestions(docs);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.warn('loadInitial error', err);
      Alert.alert('Error', 'Failed to load community questions.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'communityQuestions'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(convertDocToListItem);
      setQuestions((prev) => [...prev, ...docs]);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : lastDoc);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.warn('loadMore error', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, lastDoc, loadingMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  // Safe navigation using path strings (avoid route name mismatches)
  function navigateToQuestionDetail(id: string) {
    try {
      router.push({
        pathname: '/Community/[id]',
        params: { id },
      } as const);
    } catch (err) {
      console.warn('Navigation failed, falling back to /Community', err);
      router.replace('/(tabs)/Community/index');
    }
  }

  // Toggle upvote transaction:
  // reaction doc path: communityQuestions/{questionId}/reactions/{userId}
  async function toggleUpvote(questionId: string) {
    const u = auth.currentUser;
    if (!u) {
      Alert.alert('Sign in required', 'Please sign in to upvote.');
      return;
    }
    const uid = u.uid;
    const questionRef = doc(db, 'communityQuestions', questionId);
    const reactionRef = doc(db, 'communityQuestions', questionId, 'reactions', uid);

    try {
      await runTransaction(db, async (t) => {
        const qSnap = await t.get(questionRef);
        if (!qSnap.exists()) throw new Error('Question not found');

        const rSnap = await t.get(reactionRef);
        const currentScore = typeof qSnap.data()?.score === 'number' ? qSnap.data()!.score : 0;

        if (rSnap.exists()) {
          // Reaction exists -> remove it (toggle off)
          const existing = rSnap.data();
          if (existing.type === 'upvote') {
            t.delete(reactionRef);
            t.update(questionRef, { score: currentScore - 1 });
          } else if (existing.type === 'downvote') {
            // If previously downvoted, removing downvote increases score by +1
            t.delete(reactionRef);
            t.update(questionRef, { score: currentScore + 1 });
          } else {
            // other reaction type: delete without changing score
            t.delete(reactionRef);
          }
        } else {
          // Create new upvote
          t.set(reactionRef, {
            userId: uid,
            targetId: questionId,
            targetType: 'question',
            type: 'upvote',
            createdAt: new Date(),
          });
          t.update(questionRef, { score: currentScore + 1 });
        }
      });

      // Optimistic local update: adjust local questions array
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const newScore = q.score !== undefined ? q.score + 1 : 1; // rough optimistic increment
          // Note: this optimistic update assumes a create; could be off if toggling off
          // To keep it simple, re-fetch single doc in production to be accurate.
          return { ...q, score: newScore };
        })
      );
    } catch (err) {
      console.warn('toggleUpvote error', err);
      Alert.alert('Error', 'Failed to toggle upvote. Try again.');
    }
  }

  // Render single question
  const renderItem = ({ item }: { item: QuestionListItem }) => {
    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => navigateToQuestionDetail(item.id)}>
          <Text style={styles.title}>{item.title}</Text>
        </TouchableOpacity>
        <Text numberOfLines={2} style={styles.body}>
          {item.body}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.authorDisplayName}</Text>
          {item.createdAt ? <Text style={styles.metaText}>{item.createdAt.toLocaleDateString()}</Text> : null}
        </View>

        <View style={styles.actionsRow}>
          {/* Upvote button visible only to authenticated users */}
          {userId ? (
            <TouchableOpacity onPress={() => toggleUpvote(item.id)} style={styles.actionBtn}>
              <Text>▲ Upvote</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => Alert.alert('Sign in required', 'Please sign in to upvote or answer.')}
              style={styles.actionBtn}
            >
              <Text>▲ Upvote</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.scoreText}>{item.score ?? 0}</Text>

          <TouchableOpacity
            onPress={() => navigateToQuestionDetail(item.id)}
            style={[styles.actionBtn, styles.secondary]}
          >
            <Text>💬 Answers</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : questions.length === 0 ? (
        // Add this empty state
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No community questions yet</Text>
          <Text style={styles.emptySubtext}>Be the first to ask a question!</Text>
        </View>
      ) : (
        <FlatList
          data={questions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  title: { 
    fontSize: 16, 
    fontWeight: '600' 
  },
  body: { 
    marginTop: 6, 
    color: '#333' 
  },
  metaRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 8 
  },
  metaText: { 
    color: '#666', 
    fontSize: 12 
  },
  actionsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 10 
  },
  actionBtn: { 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 6 
  },
  secondary: { 
    marginLeft: 12 
  },
  scoreText: { 
    marginLeft: 8, 
    marginRight: 8, 
    fontWeight: '600' 
  },
    emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

