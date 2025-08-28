import { 
  View, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  TouchableOpacity, 
  RefreshControl, 
  Alert, 
  StyleSheet, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  Keyboard,
  TouchableWithoutFeedback 
} from 'react-native';
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
import * as ImagePicker from 'expo-image-picker';
import { FileData, uploadImageToSupabase } from '@/services/images';

export default function QuestionDetails() {
  const { id } = useLocalSearchParams();
  const [question, setQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [newAnswer, setNewAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [tempAttachments, setTempAttachments] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      unsubscribe();
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
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

  const pickImages = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to upload images');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true, // Enable multiple selection
      });

      if (!result.canceled && result.assets.length > 0) {
        const newFileData: FileData[] = [];
        const newTempUris: string[] = [];
        
        result.assets.forEach(asset => {
          if (asset.fileName) {
            const fileData: FileData = {
              uri: asset.uri,
              fileName: asset.fileName,
              type: asset.type || 'image',
            };
            newFileData.push(fileData);
            newTempUris.push(asset.uri);
          }
        });

        setAttachments([...attachments, ...newFileData]);
        setTempAttachments([...tempAttachments, ...newTempUris]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select images';
      Alert.alert('Error', errorMessage);
    }
  };

  const removeImage = (index: number) => {
    const newAttachments = [...attachments];
    const newTempAttachments = [...tempAttachments];
    newAttachments.splice(index, 1);
    newTempAttachments.splice(index, 1);
    setAttachments(newAttachments);
    setTempAttachments(newTempAttachments);
  };

  const handleSubmit = async () => {
    if (!user || !newAnswer.trim()) return;

    setSubmitting(true);
    try {
      // Upload attachments to Supabase if any
      const uploadedAttachments = [];
      for (const attachment of attachments) {
        try {
          const downloadURL = await uploadImageToSupabase(
            "community-answers", 
            attachment, 
            `${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          );
          uploadedAttachments.push(downloadURL);
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload one or more images');
        }
      }

      const answersRef = collection(doc(db, 'communityQuestions', String(id)), 'answers');
      await addDoc(answersRef, {
        content: newAnswer,
        authorId: user.uid,
        userDisplayName: user.displayName || 'Unknown User',
        createdAt: new Date(),
        upvotes: 0,
        downvotes: 0,
        body: newAnswer,
        attachments: uploadedAttachments,
      });
      
      setNewAnswer('');
      setAttachments([]);
      setTempAttachments([]);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          contentContainerStyle={[styles.container, keyboardVisible && styles.containerKeyboardActive]}
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
            
            {/* Display question images if any */}
            {question.attachments && question.attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {question.attachments.map((uri: string, index: number) => (
                  <Image 
                    key={index} 
                    source={{ uri }} 
                    style={styles.attachmentImage} 
                    resizeMode="cover"
                  />
                ))}
              </View>
            )}
            
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
                  
                  {/* Display answer images if any */}
                  {answer.attachments && answer.attachments.length > 0 && (
                    <View style={styles.attachmentsContainer}>
                      {answer.attachments.map((uri: string, index: number) => (
                        <Image 
                          key={index} 
                          source={{ uri }} 
                          style={styles.attachmentImage} 
                          resizeMode="cover"
                        />
                      ))}
                    </View>
                  )}
                  
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

                      <View style={styles.voteDivider} />

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
          <ThemedView style={[styles.answerForm, keyboardVisible && styles.answerFormKeyboardActive]}>
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
                
                {/* Image attachments preview */}
                {tempAttachments.length > 0 && (
                  <View style={styles.attachmentsPreview}>
                    {tempAttachments.map((uri, index) => (
                      <View key={index} style={styles.previewContainer}>
                        <Image 
                          source={{ uri }} 
                          style={styles.previewImage} 
                          resizeMode="cover"
                        />
                        <TouchableOpacity 
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={wp(5)} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                
                <View style={styles.formActions}>
                  <TouchableOpacity 
                    style={styles.uploadButton}
                    onPress={pickImages}
                    disabled={submitting}
                  >
                    <Ionicons name="image-outline" size={wp(5)} color="#333" />
                    <ThemedText style={styles.uploadText}>Add Images</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.submitButton, (submitting || !newAnswer.trim()) && styles.submitButtonDisabled]}
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
                </View>
              </>
            )}
          </ThemedView>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    marginVertical: hp(3),
    padding: wp(4),
    paddingBottom: hp(5),
  },
  containerKeyboardActive: {
    paddingBottom: hp(25), // Extra padding when keyboard is active
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
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: hp(2),
  },
  attachmentImage: {
    width: wp(25),
    height: wp(25),
    borderRadius: wp(2),
    marginRight: wp(2),
    marginBottom: wp(2),
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
    backgroundColor: '#edededae',
    borderRadius: wp(5),
    paddingVertical: wp(1),
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
  voteDivider: {
    width: 1,
    height: wp(5),
    backgroundColor: '#8d8585ff',
    //marginHorizontal: wp(1),
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
    color: '##333',
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
  answerFormKeyboardActive: {
    marginBottom: hp(5), // Extra margin when keyboard is active
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
  attachmentsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: hp(1.5),
  },
  previewContainer: {
    position: 'relative',
    marginRight: wp(2),
    marginBottom: wp(2),
  },
  previewImage: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(2),
  },
  removeImageButton: {
    position: 'absolute',
    top: -wp(2),
    right: -wp(2),
    backgroundColor: 'white',
    borderRadius: wp(3),
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(2),
    borderRadius: wp(2),
    backgroundColor: '#f0f0f0',
  },
  uploadText: {
    marginLeft: wp(2),
    fontSize: wp(4),
  },
  submitButton: {
    backgroundColor: '#1E88E5',
    borderRadius: wp(2),
    padding: wp(3),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '600',
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
});