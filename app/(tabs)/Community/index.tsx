import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  View,
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
  onSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { router } from 'expo-router';
import { app } from '@/firebase/FirebaseConfig';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { wp, hp } from '@/constants/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';

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
  userReaction?: 'upvote' | 'downvote' | null;
  answersCount: number;
};

const PAGE_SIZE = 10;

export default function CommunityQuestionList() {
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const currentUser = auth.currentUser;
  const userId = currentUser?.uid || null;

  const fetchAnswersCount = async (questionId: string) => {
    const answersSnapshot = await getDocs(
      collection(db, 'communityQuestions', questionId, 'answers')
    );
    return answersSnapshot.size;
  };

  const convertDocToListItem = async (
    docSnap: QueryDocumentSnapshot
  ): Promise<QuestionListItem> => {
    const data = docSnap.data();
    const createdAt =
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt || null;
    const answersCount = await fetchAnswersCount(docSnap.id);

    return {
      id: docSnap.id,
      title: data.title ?? 'Untitled',
      body: data.body ?? '',
      authorDisplayName: data.authorDisplayName ?? 'Anonymous',
      createdAt,
      score: data.score || 0,
      upvotes: data.upvotes || 0,
      downvotes: data.downvotes || 0,
      userReaction: null,
      answersCount,
    };
  };

  const loadInitialQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'communityQuestions'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const questionsWithAnswers = await Promise.all(
        snapshot.docs.map(convertDocToListItem)
      );

      setQuestions(questionsWithAnswers);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreQuestions = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc) return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'communityQuestions'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const newQuestions = await Promise.all(
        snapshot.docs.map(convertDocToListItem)
      );

      setQuestions((prev) => [...prev, ...newQuestions]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more questions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, lastDoc, loadingMore]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialQuestions();
    setRefreshing(false);
  }, [loadInitialQuestions]);

  useEffect(() => {
    loadInitialQuestions();
  }, []);

  // Set up real-time listeners for answers count updates
  useEffect(() => {
    if (questions.length === 0) return;

    const unsubscribeFns = questions.map((question) => {
      const answersRef = collection(db, 'communityQuestions', question.id, 'answers');
      return onSnapshot(answersRef, (snapshot) => {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === question.id ? { ...q, answersCount: snapshot.size } : q
          )
        );
      });
    });

    return () => unsubscribeFns.forEach((unsubscribe) => unsubscribe());
  }, [questions]);

  const handleUpvote = async (questionId: string) => {
    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to vote');
      return;
    }

    try {
      const questionRef = doc(db, 'communityQuestions', questionId);
      const reactionRef = doc(db, 'communityQuestions', questionId, 'reactions', userId);

      await runTransaction(db, async (transaction) => {
        const questionDoc = await transaction.get(questionRef);
        if (!questionDoc.exists()) throw new Error('Question not found');

        const reactionDoc = await transaction.get(reactionRef);
        const currentUpvotes = questionDoc.data()?.upvotes || 0;
        const currentDownvotes = questionDoc.data()?.downvotes || 0;

        if (reactionDoc.exists()) {
          const existingReaction = reactionDoc.data()?.type;
          if (existingReaction === 'upvote') {
            transaction.delete(reactionRef);
            transaction.update(questionRef, {
              upvotes: currentUpvotes - 1,
              score: (currentUpvotes - 1) - currentDownvotes,
            });
          } else {
            transaction.set(reactionRef, { type: 'upvote' });
            transaction.update(questionRef, {
              upvotes: currentUpvotes + 1,
              downvotes: currentDownvotes - 1,
              score: (currentUpvotes + 1) - (currentDownvotes - 1),
            });
          }
        } else {
          transaction.set(reactionRef, { type: 'upvote' });
          transaction.update(questionRef, {
            upvotes: currentUpvotes + 1,
            score: (currentUpvotes + 1) - currentDownvotes,
          });
        }
      });

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;

          const wasUpvoted = q.userReaction === 'upvote';
          const wasDownvoted = q.userReaction === 'downvote';

          return {
            ...q,
            upvotes: wasUpvoted ? q.upvotes - 1 : q.upvotes + 1,
            downvotes: wasDownvoted ? q.downvotes - 1 : q.downvotes,
            score: wasUpvoted
              ? q.upvotes - 1 - q.downvotes
              : wasDownvoted
              ? q.upvotes + 1 - (q.downvotes - 1)
              : q.upvotes + 1 - q.downvotes,
            userReaction: wasUpvoted ? null : 'upvote',
          };
        })
      );
    } catch (error) {
      console.error('Error upvoting:', error);
      Alert.alert('Error', 'Failed to upvote. Please try again.');
    }
  };

  const handleDownvote = async (questionId: string) => {
    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to vote');
      return;
    }

    try {
      const questionRef = doc(db, 'communityQuestions', questionId);
      const reactionRef = doc(db, 'communityQuestions', questionId, 'reactions', userId);

      await runTransaction(db, async (transaction) => {
        const questionDoc = await transaction.get(questionRef);
        if (!questionDoc.exists()) throw new Error('Question not found');

        const reactionDoc = await transaction.get(reactionRef);
        const currentUpvotes = questionDoc.data()?.upvotes || 0;
        const currentDownvotes = questionDoc.data()?.downvotes || 0;

        if (reactionDoc.exists()) {
          const existingReaction = reactionDoc.data()?.type;
          if (existingReaction === 'downvote') {
            transaction.delete(reactionRef);
            transaction.update(questionRef, {
              downvotes: currentDownvotes - 1,
              score: currentUpvotes - (currentDownvotes - 1),
            });
          } else {
            transaction.set(reactionRef, { type: 'downvote' });
            transaction.update(questionRef, {
              upvotes: currentUpvotes - 1,
              downvotes: currentDownvotes + 1,
              score: (currentUpvotes - 1) - (currentDownvotes + 1),
            });
          }
        } else {
          transaction.set(reactionRef, { type: 'downvote' });
          transaction.update(questionRef, {
            downvotes: currentDownvotes + 1,
            score: currentUpvotes - (currentDownvotes + 1),
          });
        }
      });

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;

          const wasUpvoted = q.userReaction === 'upvote';
          const wasDownvoted = q.userReaction === 'downvote';

          return {
            ...q,
            upvotes: wasUpvoted ? q.upvotes - 1 : q.upvotes,
            downvotes: wasDownvoted ? q.downvotes - 1 : q.downvotes + 1,
            score: wasDownvoted
              ? q.upvotes - (q.downvotes - 1)
              : wasUpvoted
              ? q.upvotes - 1 - (q.downvotes + 1)
              : q.upvotes - (q.downvotes + 1),
            userReaction: wasDownvoted ? null : 'downvote',
          };
        })
      );
    } catch (error) {
      console.error('Error downvoting:', error);
      Alert.alert('Error', 'Failed to downvote. Please try again.');
    }
  };

  const navigateToQuestionDetail = (questionId: string) => {
    router.push({
      pathname: '/Community/[id]',
      params: { id: questionId },
    });
  };

  const renderQuestionItem = ({ item }: { item: QuestionListItem }) => (
    <ThemedView style={styles.questionCard}>
      <TouchableOpacity onPress={() => navigateToQuestionDetail(item.id)}>
        <ThemedText style={styles.questionTitle}>{item.title}</ThemedText>
        <ThemedText style={styles.questionBody} numberOfLines={2}>
          {item.body}
        </ThemedText>
      </TouchableOpacity>

      <View style={styles.questionFooter}>
        <View style={styles.userInfo}>
          <Octicons name="person" size={wp(4)} color="#666" />
          <ThemedText style={styles.metaText}>{item.authorDisplayName}</ThemedText>
          
          {item.createdAt && (
            <>
              <Octicons name="dot-fill" size={wp(2)} color="#999" style={styles.dotSeparator} />
              <Octicons name="clock" size={wp(3.5)} color="#666" />
              <ThemedText style={styles.metaText}>
                {item.createdAt.toLocaleDateString()}
              </ThemedText>
            </>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <View style={styles.voteContainer}>
            <TouchableOpacity 
              onPress={() => handleUpvote(item.id)}
              style={styles.voteButton}
            >
              <Ionicons
                name={item.userReaction === 'upvote' ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                size={wp(6)}
                color={item.userReaction === 'upvote' ? '#4CAF50' : '#666'}
              />
            </TouchableOpacity>
            
            <ThemedText style={styles.voteCount}>{item.upvotes}</ThemedText>
            
            <View style={styles.voteDivider} />
            
            <TouchableOpacity 
              onPress={() => handleDownvote(item.id)}
              style={styles.voteButton}
            >
              <Ionicons
                name={item.userReaction === 'downvote' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                size={wp(6)}
                color={item.userReaction === 'downvote' ? '#F44336' : '#666'}
              />
            </TouchableOpacity>
            
            <ThemedText style={styles.voteCount}>{item.downvotes}</ThemedText>
          </View>

          <TouchableOpacity
            onPress={() => navigateToQuestionDetail(item.id)}
            style={styles.commentButton}
          >
            <Octicons name="comment" size={wp(4.5)} color="#666" />
            <ThemedText style={styles.commentText}>
              {item.answersCount} {item.answersCount === 1 ? 'Answer' : 'Answers'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={wp(6)} color="#333" />
        <ThemedText style={styles.headerTitle}>Community Questions</ThemedText>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="help-circle-outline" size={wp(12)} color="#999" />
          <ThemedText style={styles.emptyTitle}>No Questions Yet</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            Be the first to ask a question!
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={questions}
          renderItem={renderQuestionItem}
          keyExtractor={item => item.id}
          onEndReached={loadMoreQuestions}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.loadingMore} /> : null
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: hp(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: wp(5),
    fontWeight: '600',
    marginLeft: wp(3),
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: wp(2),
    marginHorizontal: wp(4),
    marginVertical: wp(2),
    padding: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: wp(0.5),
    elevation: 2,
  },
  questionTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    marginBottom: wp(2),
  },
  questionBody: {
    fontSize: wp(4),
    color: '#444',
    marginBottom: wp(4),
    lineHeight: wp(5.5),
  },
  questionFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: wp(3),
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(3),
  },
  metaText: {
    fontSize: wp(3.5),
    color: '#666',
    marginLeft: wp(1),
    marginRight: wp(2),
  },
  dotSeparator: {
    marginHorizontal: wp(2),
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: wp(5),
    paddingHorizontal: wp(2),
    paddingVertical: wp(1),
  },
  voteButton: {
    padding: wp(1),
  },
  voteCount: {
    fontSize: wp(4),
    fontWeight: '600',
    minWidth: wp(6),
    textAlign: 'center',
    marginHorizontal: wp(1),
  },
  voteDivider: {
    width: 1,
    height: wp(5),
    backgroundColor: '#ddd',
    marginHorizontal: wp(1),
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: wp(5),
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
  },
  commentText: {
    fontSize: wp(3.5),
    color: '#666',
    marginLeft: wp(1.5),
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMore: {
    marginVertical: wp(4),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(8),
  },
  emptyTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    marginTop: wp(4),
    color: '#333',
  },
  emptySubtitle: {
    fontSize: wp(4),
    color: '#666',
    marginTop: wp(2),
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: wp(4),
  },
});