import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  FlatList, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { wp, hp } from '@/constants/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, db } from '@/firebase/FirebaseConfig';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, orderBy, updateDoc } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  isCurrentUser: boolean;
}

interface Chat {
  id: string;
  participantIds: string[];
  lastMessage: string;
  lastUpdated: any;
}

const MessagesScreen = () => {
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Fetch user's chats
  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const q = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chatsData: Chat[] = [];
      querySnapshot.forEach((doc) => {
        chatsData.push({ id: doc.id, ...doc.data() } as Chat);
      });
      setChats(chatsData);
    });

    return () => unsubscribe();
  }, []);

  // Fetch messages for current chat
  useEffect(() => {
    if (!currentChatId) return;

    const q = query(
      collection(db, 'chats', currentChatId, 'messages'),
      orderBy('createdAt')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messagesData.push({
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          createdAt: data.createdAt,
          isCurrentUser: data.senderId === auth.currentUser?.uid
        });
      });
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [currentChatId]);

  const handleSendMessage = async () => {
    if (!message.trim() || !currentChatId || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'chats', currentChatId, 'messages'), {
        text: message,
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });

      // Update last message in chat
      await updateDoc(doc(db, 'chats', currentChatId), {
        lastMessage: message,
        lastUpdated: serverTimestamp()
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble,
      item.isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
    ]}>
      <ThemedText style={item.isCurrentUser ? styles.currentUserText : styles.otherUserText}>
        {item.text}
      </ThemedText>
      <ThemedText style={styles.messageTime}>
        {item.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </ThemedText>
    </View>
  );

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => setCurrentChatId(item.id)}
    >
      <View style={styles.avatarPlaceholder} />
      <View style={styles.chatContent}>
        <ThemedText style={styles.chatName}>
          {item.participantIds.find(id => id !== auth.currentUser?.uid) || 'Chat'}
        </ThemedText>
        <ThemedText style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </ThemedText>
      </View>
      <ThemedText style={styles.chatTime}>
        {item.lastUpdated?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      {!currentChatId ? (
        <>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'chats' && styles.activeTab]}
              onPress={() => setActiveTab('chats')}
            >
              <ThemedText style={styles.tabText}>Chats</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'requests' && styles.activeTab]}
              onPress={() => setActiveTab('requests')}
            >
              <ThemedText style={styles.tabText}>Requests</ThemedText>
            </TouchableOpacity>
          </View>

          <FlatList
            data={chats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
          />
        </>
      ) : (
        <>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setCurrentChatId(null)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <ThemedText style={styles.chatTitle}>Messages</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContainer}
            inverted
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inputContainer}
          >
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={handleSendMessage}
              disabled={!message.trim()}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={message.trim() ? '#1E88E5' : '#ccc'} 
              />
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: hp(2),
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1E88E5',
  },
  tabText: {
    fontSize: wp(4),
    fontWeight: '600',
  },
  chatList: {
    paddingTop: 10,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
  },
  chatName: {
    fontWeight: '600',
    fontSize: wp(4),
    marginBottom: 4,
  },
  lastMessage: {
    color: '#666',
    fontSize: wp(3.5),
  },
  chatTime: {
    color: '#999',
    fontSize: wp(3),
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatTitle: {
    fontWeight: '600',
    fontSize: wp(4.5),
  },
  messagesContainer: {
    padding: 15,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  currentUserBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E88E5',
    borderBottomRightRadius: 2,
  },
  otherUserBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 2,
  },
  currentUserText: {
    color: 'white',
  },
  otherUserText: {
    color: '#333',
  },
  messageTime: {
    fontSize: wp(2.8),
    marginTop: 4,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 10,
    fontSize: wp(4),
  },
  sendButton: {
    padding: 8,
  },
});

export default MessagesScreen;