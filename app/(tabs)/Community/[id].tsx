import { View, ScrollView, TextInput, ActivityIndicator, TouchableOpacity, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, addDoc, runTransaction } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebase/FirebaseConfig';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { wp, hp } from '@/constants/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';

export default function QuestionDetails() {
  const { id } = useLocalSearchParams();
  const [question, setQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [newAnswer, setNewAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  const fetchData = async () => {
    try {
      const questionRef = doc(db, 'communityQuestions', String(id));
      const questionSnap = await getDoc(questionRef);

      if (questionSnap.exists()) {
        setQuestion({ id: questionSnap.id, ...questionSnap.data() });

        const answersRef = collection(questionRef, 'answers');
        const answersSnap = await getDocs(answersRef);
        const loadedAnswers = answersSnap.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        setAnswers(loadedAnswers);
      }
    } catch (error) {
      console.error('Error fetching question and answers:', error);
      Alert.alert('Error', 'Failed to load question details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSubmit = async () => {
    if (!user || !newAnswer.trim()) return;

    setSubmitting(true);
    try {
      const answersRef = collection(doc(db, 'communityQuestions', String(id)), 'answers');
      await addDoc(answersRef, {
        content: newAnswer,
        authorId: user.uid,
        userDisplayName: user.displayName || 'Unknown User',
        createdAt: new Date(),
        upvotes: 0,
        downvotes: 0,
        body: newAnswer,
      });
      setNewAnswer('');
      await fetchData();
    } catch (error) {
      console.error('Error submitting answer:', error);
      Alert.alert('Error', 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (answerId: string, voteType: 'upvote' | 'downvote') => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to vote');
      return;
    }

    try {
      const answerRef = doc(db, 'communityQuestions', String(id), 'answers', answerId);
      const reactionRef = doc(db, 'communityQuestions', String(id), 'answers', answerId, 'reactions', user.uid);

      await runTransaction(db, async (transaction) => {
        const answerDoc = await transaction.get(answerRef);
        if (!answerDoc.exists()) throw new Error('Answer not found');

        const reactionDoc = await transaction.get(reactionRef);
        const currentUpvotes = answerDoc.data()?.upvotes || 0;
        const currentDownvotes = answerDoc.data()?.downvotes || 0;

        if (reactionDoc.exists()) {
          const existingReaction = reactionDoc.data()?.type;
          if (existingReaction === voteType) {
            // Remove vote
            transaction.delete(reactionRef);
            transaction.update(answerRef, {
              [voteType === 'upvote' ? 'upvotes' : 'downvotes']: voteType === 'upvote' ? currentUpvotes - 1 : currentDownvotes - 1,
              score: voteType === 'upvote' 
                ? (currentUpvotes - 1) - currentDownvotes 
                : currentUpvotes - (currentDownvotes - 1)
            });
          } else {
            // Change vote
            transaction.set(reactionRef, { type: voteType });
            transaction.update(answerRef, {
              upvotes: voteType === 'upvote' ? currentUpvotes + 1 : currentUpvotes - 1,
              downvotes: voteType === 'downvote' ? currentDownvotes + 1 : currentDownvotes - 1,
              score: voteType === 'upvote' 
                ? (currentUpvotes + 1) - currentDownvotes 
                : currentUpvotes - (currentDownvotes + 1)
            });
          }
        } else {
          // New vote
          transaction.set(reactionRef, { type: voteType });
          transaction.update(answerRef, {
            [voteType === 'upvote' ? 'upvotes' : 'downvotes']: voteType === 'upvote' ? currentUpvotes + 1 : currentDownvotes + 1,
            score: voteType === 'upvote' 
              ? (currentUpvotes + 1) - currentDownvotes 
              : currentUpvotes - (currentDownvotes + 1)
          });
        }
      });

      await fetchData(); // Refresh data after voting
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to process your vote');
    }
  };

  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!question) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Question not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }}
          colors={['#1E88E5']}
          tintColor="#1E88E5"
        />
      }
    >
      {/* Question Section */}
      <ThemedView style={styles.questionContainer}>
        <ThemedText style={styles.title}>{question.title}</ThemedText>
        <ThemedText style={styles.description}>{question.content || question.description}</ThemedText>
        
        <ThemedView style={styles.questionMeta}>
          <ThemedView style={styles.userInfo}>
            <Octicons name="person" size={wp(4)} color="#666" />
            <ThemedText style={styles.metaText}>{question.userDisplayName || 'Anonymous'}</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.userInfo}>
            <Octicons name="clock" size={wp(3.5)} color="#666" />
            <ThemedText style={styles.metaText}>
              {question.createdAt?.toDate?.().toLocaleDateString() || 'Unknown date'}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      {/* Answers Section */}
      <ThemedView style={styles.answersContainer}>
        <ThemedView style={styles.sectionHeader}>
          <Ionicons name="chatbubble-ellipses" size={wp(5)} color="#333" />
          <ThemedText style={styles.sectionTitle}>
            Answers ({answers.length})
          </ThemedText>
        </ThemedView>

        {answers.length > 0 ? (
          answers.map((answer) => (
            <ThemedView key={answer.id} style={styles.answer}>
              <ThemedText style={styles.answerText}>{answer.content}</ThemedText>
              
              <ThemedView style={styles.answerFooter}>
                <ThemedView style={styles.userInfo}>
                  <Octicons name="person" size={wp(3.5)} color="#666" />
                  <ThemedText style={styles.metaText}>{answer.userDisplayName || 'Anonymous'}</ThemedText>
                  
                  <Octicons name="dot-fill" size={wp(2)} color="#999" style={styles.dotSeparator} />
                  <Octicons name="clock" size={wp(3.5)} color="#666" />
                  <ThemedText style={styles.metaText}>
                    {answer.createdAt?.toLocaleDateString() || 'Unknown date'}
                  </ThemedText>
                </ThemedView>
                
                <ThemedView style={styles.voteContainer}>
                  <TouchableOpacity 
                    style={styles.voteButton}
                    onPress={() => handleVote(answer.id, 'upvote')}
                  >
                    <Ionicons 
                      name="arrow-up-circle-outline" 
                      size={wp(5)} 
                      color="#666" 
                    />
                    <ThemedText style={styles.voteCount}>{answer.upvotes || 0}</ThemedText>
                  </TouchableOpacity>
                  
                  <ThemedView style={styles.scoreBox}>
                    <ThemedText style={styles.scoreText}>{answer.score || 0}</ThemedText>
                  </ThemedView>
                  
                  <TouchableOpacity 
                    style={styles.voteButton}
                    onPress={() => handleVote(answer.id, 'downvote')}
                  >
                    <Ionicons 
                      name="arrow-down-circle-outline" 
                      size={wp(5)} 
                      color="#666" 
                    />
                    <ThemedText style={styles.voteCount}>{answer.downvotes || 0}</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          ))
        ) : (
          <ThemedView style={styles.emptyAnswers}>
            <Ionicons name="help-circle-outline" size={wp(10)} color="#999" />
            <ThemedText style={styles.emptyText}>No answers yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>Be the first to answer this question!</ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      {/* Answer Form */}
      <ThemedView style={styles.answerForm}>
        <ThemedText style={styles.formLabel}>Your Answer</ThemedText>
        {!user ? (
          <ThemedView style={styles.signInPrompt}>
            <Ionicons name="log-in" size={wp(5)} color="#1E88E5" />
            <ThemedText style={styles.signInText}>Sign in to answer this question</ThemedText>
          </ThemedView>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Write your answer..."
              placeholderTextColor="#999"
              value={newAnswer}
              onChangeText={setNewAnswer}
              multiline
              editable={!submitting}
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting || !newAnswer.trim()}
            >
              <ThemedText style={styles.submitButtonText}>
                {submitting ? (
                  <>
                    <ActivityIndicator color="#fff" style={{ marginRight: wp(2) }} />
                    Posting...
                  </>
                ) : (
                  'Post Answer'
                )}
              </ThemedText>
            </TouchableOpacity>
          </>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: hp(3),
    padding: wp(4),
    paddingBottom: hp(5),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionContainer: {
    backgroundColor: '#fff',
    borderRadius: wp(2),
    padding: wp(4),
    marginBottom: hp(2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: wp(0.2) },
    shadowOpacity: 0.1,
    shadowRadius: wp(0.5),
    elevation: 2,
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    marginBottom: hp(1),
  },
  description: {
    fontSize: wp(4),
    color: '#444',
    lineHeight: hp(2.8),
    marginBottom: hp(2),
  },
  questionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: hp(1.5),
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: wp(3.5),
    color: '#666',
    marginLeft: wp(1),
  },
  dotSeparator: {
    marginHorizontal: wp(1.5),
  },
  answersContainer: {
    marginTop: hp(1),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    marginLeft: wp(2),
  },
  answer: {
    backgroundColor: '#fff',
    borderRadius: wp(2),
    padding: wp(4),
    marginBottom: hp(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: wp(0.2) },
    shadowOpacity: 0.05,
    shadowRadius: wp(0.5),
    elevation: 1,
  },
  answerText: {
    fontSize: wp(4),
    color: '#333',
    lineHeight: hp(2.8),
    marginBottom: hp(2),
  },
  answerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: hp(1.5),
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(2),
  },
  voteCount: {
    fontSize: wp(3.5),
    marginLeft: wp(1),
    minWidth: wp(6),
    textAlign: 'center',
  },
  scoreBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: wp(1),
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    marginHorizontal: wp(1),
  },
  scoreText: {
    fontSize: wp(3.8),
    fontWeight: '600',
  },
  emptyAnswers: {
    alignItems: 'center',
    paddingVertical: hp(4),
    backgroundColor: '#fff',
    borderRadius: wp(2),
    marginBottom: hp(1),
  },
  emptyText: {
    fontSize: wp(4.5),
    fontWeight: '600',
    marginTop: hp(1),
    color: '#333',
  },
  emptySubtext: {
    fontSize: wp(4),
    color: '#666',
    marginTop: hp(0.5),
  },
  answerForm: {
    marginTop: hp(2),
    backgroundColor: '#fff',
    borderRadius: wp(2),
    padding: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: wp(0.2) },
    shadowOpacity: 0.1,
    shadowRadius: wp(0.5),
    elevation: 2,
  },
  formLabel: {
    fontSize: wp(4.5),
    fontWeight: '600',
    marginBottom: hp(1),
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: wp(2),
    padding: wp(3),
    minHeight: hp(10),
    fontSize: wp(4),
    textAlignVertical: 'top',
    marginBottom: hp(1.5),
  },
  signInPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(2),
  },
  signInText: {
    fontSize: wp(4),
    color: '#1E88E5',
    marginLeft: wp(2),
  },
  submitButton: {
    backgroundColor: '#1E88E5',
    borderRadius: wp(2),
    padding: wp(3),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '600',
  },
});