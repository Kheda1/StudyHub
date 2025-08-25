//import 'react-native-get-random-values';
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
  ScrollView,
  Linking
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
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
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import { v4 as uuidv4 } from 'uuid';
import * as Sharing from 'expo-sharing';
import { Group, GroupMessage, User } from '@/types/types';

// interface User {
//   id: string;
//   name: string;
// }

const GroupsScreen = () => {
  const [message, setMessage] = useState('');
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Helper function for timestamps
  const getTimeString = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Fetch user's groups
  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const groupsQuery = query(
      collection(db, 'groups'),
      where('participantIds', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribeGroups = onSnapshot(groupsQuery, (querySnapshot) => {
      const groupsData: Group[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        groupsData.push({
          id: doc.id,
          name: data.name || 'Group',
          adminId: data.adminId || '',
          participantIds: data.participantIds || [],
          participantNames: data.participantNames || {},
          lastMessage: data.lastMessage || '',
          lastUpdated: data.lastUpdated,
          createdAt: data.createdAt,
          inviteCode: data.inviteCode || ''
        });
      });
      setGroups(groupsData);
    });

    return () => unsubscribeGroups();
  }, []);

  // Fetch group messages when a group is selected
  useEffect(() => {
    if (!currentGroup?.id) return;

    const messagesQuery = query(
      collection(db, 'groups', currentGroup.id, 'messages'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const messagesData: GroupMessage[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messagesData.push({
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId || '',
          senderName: data.senderName || 'Unknown',
          createdAt: data.createdAt,
          timestamp: data.createdAt?.toDate?.() ?? new Date(),
          type: data.type ?? "text",
          attachmentUrl: data.attachmentUrl || '',
        });
      });
      setGroupMessages(messagesData.reverse());
    });

    return () => unsubscribeMessages();
  }, [currentGroup]);

  // Fetch users for adding to groups
  const fetchUsers = async () => {
    const usersQuery = query(collection(db, 'users'));
    const snapshot = await getDocs(usersQuery);
    const usersData: User[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (doc.id !== auth.currentUser?.uid) {
        usersData.push({
          uid: doc.id,
          displayName: data.displayName || 'User',
          email: data.email || ''
        });
      }
    });
    setUsers(usersData);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !currentGroup?.id || !auth.currentUser?.uid) return;

    try {
      // Add new message
      await addDoc(collection(db, 'groups', currentGroup.id, 'messages'), {
        text: message,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'You',
        createdAt: serverTimestamp()
      });

      // Update group last message
      await updateDoc(doc(db, 'groups', currentGroup.id), {
        lastMessage: message,
        lastUpdated: serverTimestamp()
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // const createNewGroup = async () => {
  //   if (!newGroupName.trim() || !auth.currentUser?.uid) return;

  //   try {
  //     const inviteCode = uuidv4();
      
  //     const newGroupRef = await addDoc(collection(db, 'groups'), {
  //       name: newGroupName,
  //       createdBy: auth.currentUser.uid,
  //       adminId: auth.currentUser.uid,
  //       participantIds: [auth.currentUser.uid],
  //       participantNames: {
  //         [auth.currentUser.uid]: auth.currentUser.displayName || 'You'
  //       },
  //       lastMessage: 'Group created',
  //       lastUpdated: serverTimestamp(),
  //       createdAt: serverTimestamp(),
  //       inviteCode
  //     });

  //     setNewGroupName('');
  //     setShowNewGroupModal(false);
  //     setCurrentGroup({
  //       id: newGroupRef.id,
  //       name: newGroupName,
  //       adminId: auth.currentUser.uid,
  //       participantIds: [auth.currentUser.uid],
  //       participantNames: {
  //         [auth.currentUser.uid]: auth.currentUser.displayName || 'You'
  //       },
  //       lastMessage: 'Group created',
  //       lastUpdated: serverTimestamp() as Timestamp,
  //       createdAt: serverTimestamp() as Timestamp,
  //       inviteCode
  //     });
  //   } catch (error) {
  //     console.error('Error creating group:', error);
  //   }
  // };

  // helper to generate a short random code
  function generateInviteCode(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  }

  const createNewGroup = async () => {
    if (!newGroupName.trim() || !auth.currentUser?.uid) return;

    try {
      const inviteCode = generateInviteCode();

      const newGroupRef = await addDoc(collection(db, "groups"), {
        name: newGroupName,
        createdBy: auth.currentUser.uid,
        adminId: auth.currentUser.uid,
        participantIds: [auth.currentUser.uid],
        participantNames: {
          [auth.currentUser.uid]: auth.currentUser.displayName || "You",
        },
        lastMessage: "Group created",
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
        inviteCode,
      });

      setNewGroupName("");
      setShowNewGroupModal(false);

      setCurrentGroup({
        id: newGroupRef.id,
        name: newGroupName,
        adminId: auth.currentUser.uid,
        participantIds: [auth.currentUser.uid],
        participantNames: {
          [auth.currentUser.uid]: auth.currentUser.displayName || "You",
        },
        lastMessage: "Group created",
        lastUpdated: serverTimestamp() as Timestamp,
        createdAt: serverTimestamp() as Timestamp,
        inviteCode,
      });
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const addMembersToGroup = async (userId: string) => {
    if (!currentGroup?.id || !auth.currentUser?.uid) return;

    try {
      await updateDoc(doc(db, 'groups', currentGroup.id), {
        participantIds: arrayUnion(userId),
        [`participantNames.${userId}`]: users.find(u => u.uid === userId)?.displayName || 'User'
      });
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const copyInviteLink = async () => {
    if (!currentGroup?.inviteCode) return;
    
    try {
      const inviteLink = `studyhub://groups/join?code=${currentGroup.inviteCode}`;
      const result = await Clipboard.setStringAsync(inviteLink);
      
      if (result) {
        alert('Invite link copied to clipboard!');
      } else {
        alert('Failed to copy link');
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link');
    }
  };

  const shareInviteLink = async () => {
  if (!currentGroup?.inviteCode) return;

  const inviteLink = `studyhub://groups/join?code=${currentGroup.inviteCode}`;
  try {
    await Sharing.shareAsync(inviteLink);
  } catch (error) {
    console.error('Failed to share link:', error);
  }
};

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity 
      style={styles.groupItem}
      onPress={() => setCurrentGroup(item)}
    >
      <View style={styles.groupAvatar}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.groupContent}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </Text>
        <Text style={styles.memberCount}>
          {item.participantIds?.length || 0} members
        </Text>
      </View>
      <Text style={styles.groupTime}>
        {getTimeString(item.lastUpdated)}
      </Text>
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: GroupMessage }) => (
    <View style={[
      styles.messageBubble,
      item.senderId === auth.currentUser?.uid ? styles.currentUserBubble : styles.otherUserBubble
    ]}>
      <Text style={styles.senderName}>
        {item.senderId === auth.currentUser?.uid ? 'You' : item.senderName}
      </Text>
      <Text style={item.senderId === auth.currentUser?.uid ? styles.currentUserText : styles.otherUserText}>
        {item.text}
      </Text>
      <Text style={styles.messageTime}>
        {getTimeString(item.createdAt)}
      </Text>
    </View>
  );

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => addMembersToGroup(item.uid)}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.avatarText}>
          {item.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.userName}>{item.displayName}</Text>
      {currentGroup?.participantIds.includes(item.uid) ? (
        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
      ) : (
        <Ionicons name="add-circle" size={24} color="#1E88E5" />
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      {!currentGroup ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Groups</Text>
            <TouchableOpacity onPress={() => setShowNewGroupModal(true)}>
              <Ionicons name="add" size={24} color="#1E88E5" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={groups}
            renderItem={renderGroupItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.groupList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No groups yet</Text>
                <TouchableOpacity 
                  style={styles.createGroupButton}
                  onPress={() => setShowNewGroupModal(true)}
                >
                  <Text style={styles.createGroupButtonText}>Create a Group</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </>
      ) : (
        <>
          <View style={styles.groupHeader}>
            <TouchableOpacity onPress={() => setCurrentGroup(null)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.groupHeaderContent}>
              <Text style={styles.groupTitle}>{currentGroup.name}</Text>
              <Text style={styles.groupSubtitle}>
                {currentGroup.participantIds?.length || 0} members
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowInviteModal(true)}>
              <Ionicons name="person-add" size={24} color="#1E88E5" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={groupMessages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContainer}
            inverted={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
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

      {/* New Group Modal */}
      {showNewGroupModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity onPress={() => setShowNewGroupModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group name"
              placeholderTextColor="#999"
            />
            
            <TouchableOpacity 
              style={styles.createButton}
              onPress={createNewGroup}
              disabled={!newGroupName.trim()}
            >
              <Text style={styles.createButtonText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite to Group</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.inviteButton}
              onPress={copyInviteLink}
            >
              <Ionicons name="copy" size={20} color="#1E88E5" />
              <Text style={styles.inviteButtonText}>Copy Invite Link</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.inviteButton}
              onPress={shareInviteLink}
            >
              <Ionicons name="share-social" size={20} color="#1E88E5" />
              <Text style={styles.inviteButtonText}>Share Invite</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.inviteButton, { marginTop: 20 }]}
              onPress={() => {
                setShowInviteModal(false);
                fetchUsers();
                setShowAddMembersModal(true);
              }}
            >
              <Ionicons name="person-add" size={20} color="#1E88E5" />
              <Text style={styles.inviteButtonText}>Add Members Directly</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add Members Modal */}
      {showAddMembersModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Members</Text>
              <TouchableOpacity onPress={() => setShowAddMembersModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={users}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={styles.userList}
            />
          </View>
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: hp(2),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: wp(5),
    fontWeight: 'bold',
  },
  groupList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    color: '#666',
    fontSize: wp(4),
  },
  createGroupButton: {
    marginTop: 20,
    backgroundColor: '#1E88E5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  createGroupButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: wp(4.5),
    fontWeight: 'bold',
  },
  groupContent: {
    flex: 1,
  },
  groupName: {
    fontWeight: '600',
    fontSize: wp(4),
    marginBottom: 4,
  },
  lastMessage: {
    color: '#666',
    fontSize: wp(3.5),
  },
  memberCount: {
    color: '#999',
    fontSize: wp(3),
    marginTop: 4,
  },
  groupTime: {
    color: '#999',
    fontSize: wp(3),
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  groupHeaderContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  groupTitle: {
    fontWeight: '600',
    fontSize: wp(4.5),
  },
  groupSubtitle: {
    color: '#666',
    fontSize: wp(3.5),
  },
  messagesContainer: {
    padding: 15,
    paddingBottom: 80,
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
  senderName: {
    fontWeight: 'bold',
    fontSize: wp(3.5),
    marginBottom: 4,
    color: 'rgba(255,255,255,0.9)',
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
    maxHeight: '50%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: wp(4.5),
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: wp(4),
  },
  createButton: {
    backgroundColor: '#1E88E5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: wp(4),
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E88E5',
    borderRadius: 8,
    marginBottom: 10,
  },
  inviteButtonText: {
    color: '#1E88E5',
    fontWeight: '600',
    fontSize: wp(4),
    marginLeft: 10,
  },
  userList: {
    paddingTop: 10,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E88E5',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    flex: 1,
    fontSize: wp(4),
    fontWeight: '500',
  },
});

export default GroupsScreen;