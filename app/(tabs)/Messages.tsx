import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  FlatList, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Text,
  ImageBackground,
  SafeAreaView,
  Image,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { wp, hp } from '@/constants/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, db } from '@/firebase/FirebaseConfig';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  orderBy, 
  updateDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { COLORS } from '@/constants/Colors';
import { Chat, Message, User } from '@/types/types';
import * as ImagePicker from 'expo-image-picker';
import { FileData, uploadImageToSupabase } from '@/services/images';
import { calculateMatchScore } from '@/services/matching'; 

const MessagesScreen = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [matches, setMatches] = useState<any[]>([]); 
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [tempAttachments, setTempAttachments] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const keyboardHeight = useRef(0);

  // Keyboard visibility detection
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        keyboardHeight.current = e.endCoordinates.height;
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        keyboardHeight.current = 0;
        // Scroll to bottom when keyboard hides
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Fetch user's chats and matches
  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    // Fetch chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribeChats = onSnapshot(chatsQuery, (querySnapshot) => {
      const chatsData: Chat[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data) {
          chatsData.push({ id: docSnap.id, ...(data as any) });
        }
      });
      setChats(chatsData);
    });

    const fetchMatches = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        
        // Cast Firestore data to User type
        const allUsers: (User & { id: string })[] = usersSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as User),
        }));

        // Current user
        const me = allUsers.find((u) => u.uid === auth.currentUser?.uid);
        if (!me) return;

        // Other users
        const others = allUsers.filter((u) => u.uid !== auth.currentUser?.uid);

        // Compute match scores
        const scored = others.map((u) => ({
          id: u.id,
          userId: u.uid,
          userName: u.displayName || "Unknown",
          score: calculateMatchScore(me, u),
        }));

        // Sort descending by score and take top 10
        scored.sort((a, b) => b.score - a.score);
        setMatches(scored.slice(0, 10));
      } catch (error) {
        console.error("Error fetching matches:", error);
      }
    };


    fetchMatches();

    return () => unsubscribeChats();
  }, []);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (!currentChat?.id) return;

    const messagesQuery = query(
      collection(db, 'chats', currentChat.id, 'messages'),
      orderBy('createdAt', 'asc') 
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const messagesData: Message[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data) {
          messagesData.push({
            id: docSnap.id,
            senderId: data.senderId ?? "",
            text: data.text ?? "",
            chatId: currentChat?.id ?? "", 
            createdAt: data.createdAt ?? null,
            timestamp: data.createdAt?.toDate?.() ?? new Date(),
            type: data.type ?? "text",
            attachmentUrl: data.attachmentUrl,
          });
        }
      });
      setMessages(messagesData);
      
      // Scroll to bottom when new messages arrive
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribeMessages();
  }, [currentChat]);

  // Scroll to bottom when chat changes
  useEffect(() => {
    if (currentChat && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [currentChat]);

  const pickImages = async () => {
    if (!currentChat?.id || !auth.currentUser?.uid) {
      Alert.alert('Error', 'Please select a chat first');
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
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newFileData: FileData[] = [];
        const newTempUris: string[] = [];
        
        result.assets.forEach(asset => {
          if (asset.uri) {
            const fileData: FileData = {
              uri: asset.uri,
              fileName: asset.fileName || `image-${Date.now()}.jpg`,
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

  const handleSendMessage = async () => {
    if ((!message.trim() && attachments.length === 0) || !currentChat?.id || !auth.currentUser) return;

    setUploading(true);
    try {
      let attachmentUrls: string[] = [];

      // Upload images to Supabase if any
      if (attachments.length > 0) {
        try {
          for (const attachment of attachments) {
            const downloadURL = await uploadImageToSupabase(
              "direct-messages", 
              attachment, 
              `${currentChat.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            );
            if (downloadURL) {
              attachmentUrls.push(downloadURL);
            }
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to upload one or more images. Please try again.');
          setUploading(false);
          return;
        }
      }

      // Add new message
      const messageData: any = {
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      };

      if (attachmentUrls.length > 0) {
        messageData.type = 'image';
        messageData.attachmentUrl = attachmentUrls[0]; // For simplicity, using first image
        messageData.text = message.trim() || 'Sent an image';
      } else {
        messageData.type = 'text';
        messageData.text = message;
      }

      await addDoc(collection(db, 'chats', currentChat.id, 'messages'), messageData);

      // Update chat last message
      const lastMessageText = attachmentUrls.length > 0 ? '📷 Image' : message;
      await updateDoc(doc(db, 'chats', currentChat.id), {
        lastMessage: lastMessageText,
        lastUpdated: serverTimestamp()
      });

      setMessage('');
      setAttachments([]);
      setTempAttachments([]);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setUploading(false);
    }
  };

  const startNewChat = async (match: any) => { // Changed parameter type from Match to any
    try {
      const existingChat = chats.find(chat => 
        chat.participantIds?.includes(match.userId)
      );

      if (existingChat) {
        setCurrentChat(existingChat);
      } else {
        const newChatRef = await addDoc(collection(db, 'chats'), {
          participantIds: [auth.currentUser?.uid, match.userId],
          participantNames: {
            [auth.currentUser?.uid || '']: auth.currentUser?.displayName || 'You',
            [match.userId]: match.userName
          },
          lastMessage: 'Chat started',
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp()
        });

        const newChat: Chat = {
          id: newChatRef.id,
          participantIds: [auth.currentUser?.uid || '', match.userId],
          participantNames: {
            [auth.currentUser?.uid || '']: auth.currentUser?.displayName || 'You',
            [match.userId]: match.userName
          },
          lastMessage: 'Chat started',
          lastUpdated: new Date(),
          createdAt: new Date()
        };
        
        setCurrentChat(newChat);
      }
      setShowNewChatModal(false);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '';
    }
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const messageTime = formatMessageTime(item.createdAt);

    return (
      <View style={[
        styles.messageBubble,
        item.senderId === auth.currentUser?.uid ? styles.currentUserBubble : styles.otherUserBubble
      ]}>
        {item.type === 'image' && item.attachmentUrl ? (
          <View>
            <Image 
              source={{ uri: item.attachmentUrl }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
            {item.text && item.text !== 'Sent an image' && (
              <Text style={[
                styles.messageCaption,
                item.senderId === auth.currentUser?.uid ? styles.currentUserCaption : styles.otherUserCaption
              ]}>
                {item.text}
              </Text>
            )}
          </View>
        ) : (
          <Text style={item.senderId === auth.currentUser?.uid ? styles.currentUserText : styles.otherUserText}>
            {item.text}
          </Text>
        )}
        
        <Text style={[
          styles.messageTime,
          item.senderId === auth.currentUser?.uid ? styles.currentUserTime : styles.otherUserTime
        ]}>
          {messageTime}
        </Text>
      </View>
    );
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherUserId = item.participantIds?.find(id => id !== auth.currentUser?.uid);
    const otherUserName = item.participantNames?.[otherUserId || ''] || 'Unknown';
    const lastUpdated = item.lastUpdated?.toDate ? item.lastUpdated.toDate() : null;

    return (
      <TouchableOpacity 
        style={styles.chatItem}
        onPress={() => setCurrentChat(item)}
      >
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {otherUserName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.chatContent}>
          <Text style={styles.chatName}>{otherUserName}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || ''}
          </Text>
        </View>
        <View style={styles.timeBadge}>
          <Text style={styles.chatTime}>
            {lastUpdated ? formatMessageTime(lastUpdated) : ''}
          </Text>
          {(item.unreadCount ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground 
        source={require('@/assets/images/default-profile.jpg')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <ThemedView style={styles.container}>
          {!currentChat ? (
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
                <TouchableOpacity 
                  style={styles.newChatButton}
                  onPress={() => setShowNewChatModal(true)}
                >
                  <Ionicons name="add" size={24} color={COLORS.white} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.chatScrollView}>
                <FlatList
                  data={chats}
                  renderItem={renderChatItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.chatList}
                  scrollEnabled={false} // Disable FlatList's own scrolling
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name="chatbubbles" size={48} color={COLORS.lightText} />
                      <Text style={styles.emptyText}>No messages yet</Text>
                      <TouchableOpacity 
                        style={styles.startChatButton}
                        onPress={() => setShowNewChatModal(true)}
                      >
                        <Text style={styles.startChatText}>Start a new chat</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              </ScrollView>
            </>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardAvoidingView}
              keyboardVerticalOffset={Platform.OS === 'ios' ? hp(8) : 0}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1 }}>
                  <View style={styles.chatHeader}>
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => setCurrentChat(null)}
                    >
                      <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <View style={styles.chatTitleContainer}>
                      <Text style={styles.chatTitle} numberOfLines={1}>
                        {currentChat.participantNames?.[
                          currentChat.participantIds?.find(id => id !== auth.currentUser?.uid) || ''
                        ] || 'Chat'}
                      </Text>
                    </View>
                    <View style={styles.headerRightPlaceholder} />
                  </View>

                  <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[
                      styles.messagesContainer,
                      keyboardVisible && { paddingBottom: keyboardHeight.current + hp(5) },
                    ]}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    showsVerticalScrollIndicator={false}
                  />

                  {/* Image preview */}
                  {tempAttachments.length > 0 && (
                    <View style={styles.imagePreviewContainer}>
                      {tempAttachments.map((uri, index) => (
                        <View key={index} style={styles.previewImageWrapper}>
                          <Image 
                            source={{ uri }} 
                            style={styles.previewImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity 
                            style={styles.removePreviewButton}
                            onPress={() => removeImage(index)}
                          >
                            <Ionicons name="close-circle" size={wp(5)} color="#F44336" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <View
                    style={[
                      styles.inputContainer,
                      keyboardVisible && styles.inputContainerKeyboardActive,
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.attachButton}
                      onPress={pickImages}
                      disabled={uploading}
                    >
                      <Ionicons name="image" size={wp(8)} color="#1E88E5" />
                    </TouchableOpacity>
                    
                    <TextInput
                      style={styles.input}
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Type a message..."
                      placeholderTextColor={COLORS.lightText}
                      multiline
                      editable={!uploading}
                    />
                    
                    <TouchableOpacity
                      style={[styles.sendButton, uploading && styles.sendButtonDisabled]}
                      onPress={handleSendMessage}
                      disabled={(!message.trim() && attachments.length === 0) || uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons
                          name="send"
                          size={wp(5)}
                          color="#fff"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          )}

          {/* New Chat Modal */}
          {showNewChatModal && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Message</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowNewChatModal(false)}
                  >
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                
                {matches.length > 0 ? (
                  <FlatList
                    data={matches}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.matchItem}
                        onPress={() => startNewChat(item)}
                      >
                        <View style={styles.matchAvatar}>
                          <Text style={styles.avatarText}>
                            {item.userName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.matchName}>{item.userName}</Text>
                          <Text style={{ color: COLORS.lightText, fontSize: 12 }}>
                            Match Score: {item.score}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.matchList}
                    keyboardShouldPersistTaps="handled"
                  />
                ) : (
                  <View style={styles.emptyMatches}>
                    <Ionicons name="people" size={48} color={COLORS.lightText} />
                    <Text style={styles.emptyMatchText}>No matches yet</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ThemedView>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    marginVertical: hp(2),
    backgroundColor: COLORS.primary,
  },
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(248, 249, 250, 0.95)',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: wp(5),
    fontWeight: 'bold',
    color: COLORS.text,
  },
  newChatButton: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatList: {
    paddingTop: hp(1),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(10),
  },
  emptyText: {
    marginTop: hp(2),
    color: COLORS.lightText,
    fontSize: wp(4),
  },
  startChatButton: {
    marginTop: hp(3),
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(6),
    borderRadius: wp(6),
    backgroundColor: COLORS.primary,
  },
  startChatText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: wp(4),
  },
  chatScrollView: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4),
    backgroundColor: COLORS.white,
    marginHorizontal: wp(3),
    marginVertical: hp(0.8),
    borderRadius: wp(3),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarPlaceholder: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: COLORS.primary,
    marginRight: wp(3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: wp(5),
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
  },
  chatName: {
    fontWeight: '600',
    fontSize: wp(4.2),
    color: COLORS.text,
    marginBottom: hp(0.5),
  },
  lastMessage: {
    color: COLORS.lightText,
    fontSize: wp(3.8),
  },
  timeBadge: {
    alignItems: 'flex-end',
  },
  chatTime: {
    color: COLORS.lightText,
    fontSize: wp(3),
    marginBottom: hp(0.5),
  },
  unreadBadge: {
    width: wp(5),
    height: wp(5),
    borderRadius: wp(2.5),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: COLORS.white,
    fontSize: wp(2.8),
    fontWeight: 'bold',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4),
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  backButton: {
    padding: wp(2),
  },
  chatTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chatTitle: {
    fontWeight: '600',
    fontSize: wp(4.5),
    color: COLORS.text,
    marginHorizontal: wp(2),
  },
  headerRightPlaceholder: {
    width: wp(10),
  },
  messagesContainer: {
    padding: wp(4),
    paddingBottom: hp(10),
  },
  messagesContainerKeyboardActive: {
    paddingBottom: hp(25),
  },
  messageBubble: {
    maxWidth: '80%',
    padding: wp(3),
    borderRadius: wp(4),
    marginBottom: hp(1),
  },
  currentUserBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.bubbleRight,
    borderBottomRightRadius: wp(1),
  },
  otherUserBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bubbleLeft,
    borderBottomLeftRadius: wp(1),
  },
  currentUserText: {
    color: COLORS.white,
    fontSize: wp(4),
  },
  otherUserText: {
    color: COLORS.text,
    fontSize: wp(4),
  },
  messageImage: {
    width: wp(60),
    height: wp(60),
    borderRadius: wp(2),
    marginVertical: hp(0.5),
  },
  messageCaption: {
    fontSize: wp(4),
    marginTop: hp(0.5),
    paddingHorizontal: wp(1),
  },
  currentUserCaption: {
    color: 'white',
  },
  otherUserCaption: {
    color: '#333',
  },
  messageTime: {
    fontSize: wp(2.8),
    marginTop: hp(0.5),
    textAlign: 'right',
  },
  currentUserTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherUserTime: {
    color: 'rgba(45,55,72,0.6)',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    padding: wp(2),
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  previewImageWrapper: {
    position: 'relative',
    marginRight: wp(2),
  },
  previewImage: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(2),
  },
  removePreviewButton: {
    position: 'absolute',
    top: -wp(1),
    right: -wp(1),
    backgroundColor: 'white',
    borderRadius: wp(3),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(2.5),
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  inputContainerKeyboardActive: {
    paddingBottom: Platform.OS === 'ios' ? hp(4) : hp(1.5),
  },
  attachButton: {
    padding: wp(2),
    marginRight: wp(1),
  },
  input: {
    flex: 1,
    minHeight: hp(5),
    maxHeight: hp(12),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    marginTop: hp(-1),
    marginVertical: hp(1),
    backgroundColor: COLORS.inputBg,
    borderRadius: wp(5),
    marginRight: wp(2),
    fontSize: wp(4),
    color: COLORS.text,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    padding: wp(2),
    borderRadius: wp(3),
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: wp(10),
    minHeight: wp(10),
  },
  sendButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: COLORS.white,
    borderRadius: wp(4),
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  modalTitle: {
    fontSize: wp(4.5),
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalCloseButton: {
    padding: wp(2),
  },
  matchList: {
    paddingTop: hp(1),
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(2),
    paddingHorizontal: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  matchAvatar: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: COLORS.primary,
    marginRight: wp(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchName: {
    fontSize: wp(4),
    fontWeight: '500',
    color: COLORS.text,
  },
  emptyMatches: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(10),
  },
  emptyMatchText: {
    marginTop: hp(2),
    color: COLORS.lightText,
    fontSize: wp(4),
  },
});

export default MessagesScreen;