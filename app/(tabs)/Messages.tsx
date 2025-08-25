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
  SafeAreaView
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
import { Chat, Message, Match } from '@/types/types'

const MessagesScreen = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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

    // Fetch matches (users who liked each other)
    const fetchMatches = async () => {
      const matchesQuery = query(
        collection(db, 'matches'),
        where('usersMatched', 'array-contains', auth.currentUser?.uid)
      );
      const snapshot = await getDocs(matchesQuery);
      const matchesData: Match[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data) return;
        const otherUserId = data.usersMatched?.find((id: string) => id !== auth.currentUser?.uid);
        if (!otherUserId) return;
        matchesData.push({
          id: docSnap.id,
          userId: otherUserId,
          userName: data.userNames?.[otherUserId] || 'Unknown User'
        });
      });
      setMatches(matchesData);
    };

    fetchMatches();

    return () => unsubscribeChats();
  }, []);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (!currentChat?.id) return;

    const messagesQuery = query(
      collection(db, 'chats', currentChat.id, 'messages'),
      orderBy('createdAt', 'desc')
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
      setMessages(messagesData.reverse());
    });

    return () => unsubscribeMessages();
  }, [currentChat]);

  const handleSendMessage = async () => {
    if (!message.trim() || !currentChat?.id || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'chats', currentChat.id, 'messages'), {
        text: message,
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', currentChat.id), {
        lastMessage: message,
        lastUpdated: serverTimestamp()
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const startNewChat = async (match: Match) => {
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

  const renderMessageItem = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble,
      item.senderId === auth.currentUser?.uid ? styles.currentUserBubble : styles.otherUserBubble
    ]}>
      <Text style={item.senderId === auth.currentUser?.uid ? styles.currentUserText : styles.otherUserText}>
        {item.text}
      </Text>
      <Text style={[
        styles.messageTime,
        item.senderId === auth.currentUser?.uid ? styles.currentUserTime : styles.otherUserTime
      ]}>
        {item.createdAt?.toDate 
          ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : ''}
      </Text>
    </View>
  );

  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherUserId = item.participantIds?.find(id => id !== auth.currentUser?.uid);
    const otherUserName = item.participantNames?.[otherUserId || ''] || 'Unknown';

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
            {item.lastUpdated?.toDate 
              ? item.lastUpdated.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
              : ''}
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

              <FlatList
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
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
            </>
          ) : (
            <>
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
                contentContainerStyle={styles.messagesContainer}
                inverted={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                showsVerticalScrollIndicator={false}
              />

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? hp(8) : 0}
                style={styles.inputContainer}
              >
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Type a message..."
                  placeholderTextColor={COLORS.lightText}
                  multiline
                />
                <TouchableOpacity 
                  style={[
                    styles.sendButton,
                    !message.trim() && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!message.trim()}
                >
                  <Ionicons 
                    name="send" 
                    size={24} 
                    color={message.trim() ? COLORS.primary : COLORS.lightText} 
                  />
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </>
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
                    renderItem={({ item }: { item: Match }) => (
                      <TouchableOpacity 
                        style={styles.matchItem}
                        onPress={() => startNewChat(item)}
                      >
                        <View style={styles.matchAvatar}>
                          <Text style={styles.avatarText}>
                            {item.userName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.matchName}>{item.userName}</Text>
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
    //marginVertical: hp(2),
    flex: 1,
    backgroundColor: 'rgba(248, 249, 250, 0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatList: {
    flexGrow: 1,
    paddingTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    color: COLORS.lightText,
    fontSize: wp(4),
  },
  startChatButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
  },
  startChatText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: wp(4),
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: COLORS.white,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    marginRight: 12,
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
    marginBottom: 4,
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
    marginBottom: 4,
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    padding: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  backButton: {
    padding: 8,
  },
  chatTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chatTitle: {
    fontWeight: '600',
    fontSize: wp(4.5),
    color: COLORS.text,
    marginHorizontal: 8,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  messagesContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  currentUserBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.bubbleRight,
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bubbleLeft,
    borderBottomLeftRadius: 4,
  },
  currentUserText: {
    color: COLORS.white,
    fontSize: wp(4),
  },
  otherUserText: {
    color: COLORS.text,
    fontSize: wp(4),
  },
  currentUserTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherUserTime: {
    color: 'rgba(45,55,72,0.6)',
  },
  messageTime: {
    fontSize: wp(2.8),
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.inputBg,
    borderRadius: 24,
    marginRight: 10,
    fontSize: wp(4),
    color: COLORS.text,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
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
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  modalTitle: {
    fontSize: wp(4.5),
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalCloseButton: {
    padding: 8,
  },
  matchList: {
    paddingTop: 8,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  matchAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    marginRight: 16,
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
    padding: 40,
  },
  emptyMatchText: {
    marginTop: 16,
    color: COLORS.lightText,
    fontSize: wp(4),
  },
});

export default MessagesScreen;