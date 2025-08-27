import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  View,
  TextInput,
  Image,
  Modal,
  Dimensions,
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
  addDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { app } from '@/firebase/FirebaseConfig';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { wp, hp } from '@/constants/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FileData, uploadImageToSupabase } from '@/services/images';

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const { width, height } = Dimensions.get('window');

type QuestionListItem = {
  id: string;
  title: string;
  body: string;
  authorDisplayName?: string;
  createdAt?: Date | null;
  upvotes: number;
  downvotes: number;
  userReaction?: 'upvote' | 'downvote' | null;
  answersCount: number;
  attachments?: string[];
};

const PAGE_SIZE = 10;

const CommunityQuestionList = () => {
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showQuestionForm, setShowQuestionForm] = useState<boolean>(false);
  const [newQuestionTitle, setNewQuestionTitle] = useState<string>('');
  const [newQuestionBody, setNewQuestionBody] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [tempAttachments, setTempAttachments] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomModalVisible, setZoomModalVisible] = useState<boolean>(false);

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
      upvotes: data.upvotes || 0,
      downvotes: data.downvotes || 0,
      userReaction: null,
      answersCount,
      attachments: data.attachments || [],
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

  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
    setZoomModalVisible(true);
  };

  const pickImage = async () => {
    if (!currentUser) {
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
      });

      if (!result.canceled && result.assets[0].fileName) {
        const fileData: FileData = {
          uri: result.assets[0].uri,
          fileName: result.assets[0].fileName,
          type: result.assets[0].type || 'image',
        };
        setAttachments([...attachments, fileData]);
        setTempAttachments([...tempAttachments, result.assets[0].uri]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select image';
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

  const handleCreateQuestion = async () => {
    if (!currentUser) {
      Alert.alert('Authentication Required', 'Please sign in to create a question');
      return;
    }

    if (!newQuestionTitle.trim() || !newQuestionBody.trim()) {
      Alert.alert('Validation Error', 'Please provide both title and body for your question');
      return;
    }

    try {
      setUploading(true);
      
      // Upload attachments to Supabase if any
      const uploadedAttachments = [];
      for (const attachment of attachments) {
        try {
          const downloadURL = await uploadImageToSupabase(
            "community-questions", 
            attachment, 
            `${currentUser.uid}-${Date.now()}`
          );
          uploadedAttachments.push(downloadURL);
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload one or more images');
        }
      }

      await addDoc(collection(db, 'communityQuestions'), {
        title: newQuestionTitle,
        body: newQuestionBody,
        authorId: currentUser.uid,
        authorDisplayName: currentUser.displayName || 'Unknown User',
        createdAt: Timestamp.now(),
        upvotes: 0,
        downvotes: 0,
        attachments: uploadedAttachments,
      });

      setNewQuestionTitle('');
      setNewQuestionBody('');
      setAttachments([]);
      setTempAttachments([]);
      setShowQuestionForm(false);
      loadInitialQuestions();
    } catch (error) {
      console.error('Error creating question:', error);
      Alert.alert('Error', 'Failed to create question. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderQuestionItem = ({ item }: { item: QuestionListItem }) => (
    <ThemedView style={styles.questionCard}>
      <TouchableOpacity onPress={() => navigateToQuestionDetail(item.id)}>
        <ThemedText style={styles.questionTitle}>{item.title}</ThemedText>
        <ThemedText style={styles.questionBody} numberOfLines={2}>
          {item.body}
        </ThemedText>
        
        {item.attachments && item.attachments.length > 0 && (
          <View style={styles.attachmentsContainer}>
            {item.attachments.map((uri, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={(e) => {
                  e.stopPropagation();
                  handleImagePress(uri);
                }}
                activeOpacity={0.8}
              >
                <Image 
                  source={{ uri }} 
                  style={styles.attachmentImage} 
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
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
            onPress={() => {
              if (!currentUser) {
                Alert.alert('Sign In Required', 'Please sign in to answer this question');
                return;
              }
              navigateToQuestionDetail(item.id);
            }}
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
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            if (!currentUser) {
              Alert.alert('Sign In Required', 'Please sign in to create a question');
              return;
            }
            setShowQuestionForm(!showQuestionForm);
          }}
        >
          <MaterialIcons name={showQuestionForm ? 'close' : 'add'} size={wp(6)} color="#333" />
        </TouchableOpacity>
      </View>

      {showQuestionForm && (
        <ThemedView style={styles.questionForm}>
          <TextInput
            style={styles.input}
            placeholder="Question Title"
            value={newQuestionTitle}
            onChangeText={setNewQuestionTitle}
            placeholderTextColor="#999"
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Question Body"
            value={newQuestionBody}
            onChangeText={setNewQuestionBody}
            multiline
            numberOfLines={4}
            placeholderTextColor="#999"
          />
          
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
              onPress={pickImage}
              disabled={uploading}
            >
              <Ionicons name="image-outline" size={wp(5)} color="#333" />
              <ThemedText style={styles.uploadText}>Add Image</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCreateQuestion}
              disabled={uploading || !newQuestionTitle.trim() || !newQuestionBody.trim()}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.submitText}>Post Question</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="help-circle-outline" size={wp(12)} color="#999" />
          <ThemedText style={styles.emptyTitle}>No Questions Yet</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            {currentUser ? 'Be the first to ask a question!' : 'Sign in to ask a question'}
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

      {/* Image Zoom Modal */}
      <Modal
        visible={zoomModalVisible}
        transparent={true}
        onRequestClose={() => setZoomModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setZoomModalVisible(false)}
          >
            <Image 
              source={{ uri: selectedImage || '' }} 
              style={styles.zoomedImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setZoomModalVisible(false)}
          >
            <Ionicons name="close-circle" size={wp(8)} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </ThemedView>
  );
};

export default CommunityQuestionList;

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
    flex: 1,
  },
  addButton: {
    padding: wp(1),
  },
  questionForm: {
    padding: wp(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: wp(3),
    fontSize: wp(4),
  },
  multilineInput: {
    minHeight: hp(10),
    textAlignVertical: 'top',
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
    backgroundColor: '#4285F4',
    paddingVertical: wp(3),
    paddingHorizontal: wp(5),
    borderRadius: wp(2),
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: wp(4),
  },
  attachmentsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: wp(3),
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
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: wp(3),
  },
  attachmentImage: {
    width: wp(25),
    height: wp(25),
    borderRadius: wp(2),
    marginRight: wp(2),
    marginBottom: wp(2),
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    width: width * 0.95,
    height: height * 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: hp(4),
    right: wp(4),
  },
});