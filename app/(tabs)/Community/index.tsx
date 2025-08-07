// CommunityQuestionList.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
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
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { wp, hp } from '@/constants/common';

const db = getFirestore(app);
const auth = getAuth(app);

type QuestionListItem = {
  id: string;
  title: string;
  body: string;
  authorDisplayName?: string;
  createdAt?: Date | null;
  score: number;
  upvotes: number;
  downvotes: number;
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
      upvotes: typeof data.upvotes === 'number' ? data.upvotes : 0,
      downvotes: typeof data.downvotes === 'number' ? data.downvotes : 0,
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

  // Toggle downvote transaction
  async function toggleDownvote(questionId: string) {
    const u = auth.currentUser;
    if (!u) {
      Alert.alert('Sign in required', 'Please sign in to downvote.');
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
        const currentDownvotes = typeof qSnap.data()?.downvotes === 'number' ? qSnap.data()!.downvotes : 0;
        const currentUpvotes = typeof qSnap.data()?.upvotes === 'number' ? qSnap.data()!.upvotes : 0;

        if (rSnap.exists()) {
          // Reaction exists -> remove it (toggle off)
          const existing = rSnap.data();
          if (existing.type === 'downvote') {
            t.delete(reactionRef);
            t.update(questionRef, { 
              downvotes: currentDownvotes - 1,
              score: (currentUpvotes) - (currentDownvotes - 1)
            });
          } else if (existing.type === 'upvote') {
            // Switch from upvote to downvote
            t.update(reactionRef, {
              type: 'downvote',
              createdAt: new Date(),
            });
            t.update(questionRef, { 
              upvotes: currentUpvotes - 1,
              downvotes: currentDownvotes + 1,
              score: (currentUpvotes - 1) - (currentDownvotes + 1)
            });
          } else {
            // other reaction type: delete without changing score
            t.delete(reactionRef);
          }
        } else {
          // Create new downvote
          t.set(reactionRef, {
            userId: uid,
            targetId: questionId,
            targetType: 'question',
            type: 'downvote',
            createdAt: new Date(),
          });
          t.update(questionRef, { 
            downvotes: currentDownvotes + 1,
            score: currentUpvotes - (currentDownvotes + 1)
          });
        }
      });

      // Optimistic local update
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const newDownvotes = q.downvotes + 1;
          const newScore = q.upvotes - newDownvotes;
          return { ...q, downvotes: newDownvotes, score: newScore };
        })
      );
    } catch (err) {
      console.warn('toggleDownvote error', err);
      Alert.alert('Error', 'Failed to toggle downvote. Try again.');
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
        const currentUpvotes = typeof qSnap.data()?.upvotes === 'number' ? qSnap.data()!.upvotes : 0;
        const currentDownvotes = typeof qSnap.data()?.downvotes === 'number' ? qSnap.data()!.downvotes : 0;

        if (rSnap.exists()) {
          // Reaction exists -> remove it (toggle off) or switch
          const existing = rSnap.data();
          if (existing.type === 'upvote') {
            t.delete(reactionRef);
            t.update(questionRef, { 
              upvotes: currentUpvotes - 1,
              score: (currentUpvotes - 1) - currentDownvotes
            });
          } else if (existing.type === 'downvote') {
            // Switch from downvote to upvote
            t.update(reactionRef, {
              type: 'upvote',
              createdAt: new Date(),
            });
            t.update(questionRef, { 
              upvotes: currentUpvotes + 1,
              downvotes: currentDownvotes - 1,
              score: (currentUpvotes + 1) - (currentDownvotes - 1)
            });
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
          t.update(questionRef, { 
            upvotes: currentUpvotes + 1,
            score: (currentUpvotes + 1) - currentDownvotes
          });
        }
      });

      // Optimistic local update: adjust local questions array
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const newUpvotes = q.upvotes + 1;
          const newScore = newUpvotes - q.downvotes;
          // Note: this optimistic update assumes a create; could be off if toggling off
          // To keep it simple, re-fetch single doc in production to be accurate.
          return { ...q, upvotes: newUpvotes, score: newScore };
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
      <ThemedView style={styles.card}>
        <TouchableOpacity onPress={() => navigateToQuestionDetail(item.id)}>
          <ThemedText style={styles.title}>{item.title}</ThemedText>
        </TouchableOpacity>
        <ThemedText numberOfLines={2} style={styles.body}>
          {item.body}
        </ThemedText>
        <ThemedView style={styles.metaRow}>
          <ThemedText style={styles.metaText}>{item.authorDisplayName}</ThemedText>
          {item.createdAt ? (
            <ThemedText style={styles.metaText}>{item.createdAt.toLocaleDateString()}</ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView style={styles.actionsRow}>
          {/* Vote buttons visible only to authenticated users */}
          <ThemedView style={styles.actionsRows}>
          {userId ? (
            <>
              <TouchableOpacity onPress={() => toggleUpvote(item.id)} style={styles.actionBtn}>
                <ThemedText style={styles.actionText}>↑</ThemedText>
              </TouchableOpacity>
              
              <ThemedText style={styles.voteCount}>{item.upvotes ?? 0}</ThemedText>
              
              <ThemedView style={styles.divider} />
              
              <TouchableOpacity onPress={() => toggleDownvote(item.id)} style={styles.actionBtn}>
                <ThemedText style={styles.actionText}>↓ Vote</ThemedText>
              </TouchableOpacity>
              
              <ThemedText style={styles.voteCount}>{item.downvotes ?? 0}</ThemedText>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => Alert.alert('Sign in required', 'Please sign in to vote.')}
                style={styles.actionBtn}
              >
                <ThemedText style={styles.actionText}>↑ Vote</ThemedText>
              </TouchableOpacity>
              
              <ThemedText style={styles.voteCount}>{item.upvotes ?? 0}</ThemedText>
              
              <ThemedView style={styles.divider} />
              
              <TouchableOpacity
                onPress={() => Alert.alert('Sign in required', 'Please sign in to vote.')}
                style={styles.actionBtn}
              >
                <ThemedText style={styles.actionText}>↓ Vote</ThemedText>
              </TouchableOpacity>
              
              <ThemedText style={styles.voteCount}>{item.downvotes ?? 0}</ThemedText>
            </>
          )}
          </ThemedView>

          <ThemedView style={styles.actionsRows}>
            <TouchableOpacity
              onPress={() => navigateToQuestionDetail(item.id)}
              style={[styles.actionBtn, styles.secondary]}
            >
              <ThemedText style={styles.actionText}>💬 Answers</ThemedText>
            </TouchableOpacity>
          </ThemedView>

        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.headerContainer}>
        <ThemedText style={styles.headerTitle}>Community</ThemedText>
      </ThemedView>
      
      <ThemedView style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: hp(3) }} />
        ) : questions.length === 0 ? (
          // Add this empty state
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No community questions yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>Be the first to ask a question!</ThemedText>
          </ThemedView>
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
            showsVerticalScrollIndicator={false}
          />
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: wp(4),
    paddingVertical: wp(4),
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: wp(6),
    fontWeight: 'semibold',
    marginVertical: wp(4),
    //textAlign: 'center',
  },
  card: {
    borderRadius: wp(2),
    padding: wp(3),
    marginHorizontal: wp(3),
    marginVertical: wp(2),
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: wp(1),
    elevation: 1,
  },
  title: { 
    fontSize: wp(4), 
    fontWeight: '600' 
  },
  body: { 
    marginTop: wp(1.5), 
    color: '#333' 
  },
  metaRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: wp(2) 
  },
  metaText: { 
    color: '#666', 
    fontSize: wp(3) 
  },
  actionsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: wp(2.5) 
  },
  actionsRows: { 
    backgroundColor: '#f0f0f0dd',
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: wp(2.5),
    borderRadius: wp(2),
    marginHorizontal: wp(1.5),
  },
  actionBtn: { 
    paddingVertical: wp(1.5), 
    paddingHorizontal: wp(2.5), 
    borderRadius: wp(1.5) 
  },
  actionText: {
    fontSize: wp(3.5),
  },
  secondary: { 
    marginLeft: wp(3) 
  },
  voteCount: { 
    marginLeft: wp(1), 
    marginRight: wp(1), 
    fontWeight: '600',
    fontSize: wp(3.5),
    minWidth: wp(3),
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: wp(4),
    backgroundColor: '#a2a2a2ff',
  },
  scoreText: { 
    marginLeft: wp(2), 
    marginRight: wp(2), 
    fontWeight: '600',
    fontSize: wp(3.5),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(5),
  },
  emptyText: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: '#333',
    marginBottom: wp(2),
  },
  emptySubtext: {
    fontSize: wp(3.5),
    color: '#666',
    textAlign: 'center',
  },
});