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
  Linking,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Alert,
  ActivityIndicator
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
import * as ImagePicker from 'expo-image-picker';
import { Group, GroupMessage, User } from '@/types/types';
import { FileData, uploadImageToSupabase } from '@/services/images';

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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [tempAttachments, setTempAttachments] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Helper function for timestamps
  const getTimeString = (timestamp?: Timestamp) => {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Keyboard visibility detection
  useEffect(() => {
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
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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
          type: data.type || 'text',
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

  const pickImage = async () => {
    if (!currentGroup?.id || !auth.currentUser?.uid) {
      Alert.alert('Error', 'Please select a group first');
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

      if (!result.canceled && result.assets[0].uri) {
        const fileData: FileData = {
          uri: result.assets[0].uri,
          fileName: result.assets[0].fileName || `image-${Date.now()}.jpg`,
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

  const handleSendMessage = async () => {
    if ((!message.trim() && attachments.length === 0) || !currentGroup?.id || !auth.currentUser?.uid) return;

    setUploading(true);
    try {
      let attachmentUrl = '';

      // Upload image to Supabase if attached
      if (attachments.length > 0) {
        try {
          const result = await uploadImageToSupabase(
            "group-messages", 
            attachments[0], 
            `${currentGroup.id}-${Date.now()}`
          );
          if (result === null) {
            throw new Error('Failed to upload image');
          }
          attachmentUrl = result;
        } catch (error) {
          Alert.alert('Error', 'Failed to upload image. Please try again.');
          setUploading(false);
          return;
        }
      }

      // Add new message
      const messageData: any = {
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'You',
        createdAt: serverTimestamp(),
        type: attachmentUrl ? 'image' : 'text',
      };

      if (attachmentUrl) {
        messageData.attachmentUrl = attachmentUrl;
        messageData.text = message.trim() || 'Sent an image';
      } else {
        messageData.text = message;
      }

      await addDoc(collection(db, 'groups', currentGroup.id, 'messages'), messageData);

      // Update group last message
      const lastMessageText = attachmentUrl ? '📷 Image' : message;
      await updateDoc(doc(db, 'groups', currentGroup.id), {
        lastMessage: lastMessageText,
        lastUpdated: serverTimestamp()
      });

      setMessage('');
      setAttachments([]);
      setTempAttachments([]);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setUploading(false);
    }
  };

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
        <Ionicons name="checkmark-circle" size={wp(6)} color="#4CAF50" />
      ) : (
        <Ionicons name="add-circle" size={wp(6)} color="#1E88E5" />
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
              <Ionicons name="add" size={wp(6)} color="#1E88E5" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={groups}
            renderItem={renderGroupItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.groupList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people" size={wp(12)} color="#ccc" />
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? wp(22) : wp(2)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>
              <View style={styles.groupHeader}>
                <TouchableOpacity onPress={() => setCurrentGroup(null)}>
                  <Ionicons name="arrow-back" size={wp(6)} color="#333" />
                </TouchableOpacity>
                <View style={styles.groupHeaderContent}>
                  <Text style={styles.groupTitle}>{currentGroup.name}</Text>
                  <Text style={styles.groupSubtitle}>
                    {currentGroup.participantIds?.length || 0} members
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowInviteModal(true)}>
                  <Ionicons name="person-add" size={wp(6)} color="#1E88E5" />
                </TouchableOpacity>
              </View>

              <FlatList
                ref={flatListRef}
                data={groupMessages}
                renderItem={renderMessageItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                  styles.messagesContainer,
                  keyboardVisible && styles.messagesContainerKeyboardActive,
                ]}
                inverted={false}
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
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
                  onPress={pickImage}
                  disabled={uploading}
                >
                  <Ionicons name="image" size={wp(8)} color="#1E88E5" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Type a message..."
                  placeholderTextColor="#999"
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

      {/* Modals remain the same */}
      {showNewGroupModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity onPress={() => setShowNewGroupModal(false)}>
                <Ionicons name="close" size={wp(6)} color="#333" />
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

      {showInviteModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite to Group</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={wp(6)} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.inviteButton}
              onPress={copyInviteLink}
            >
              <Ionicons name="copy" size={wp(5)} color="#1E88E5" />
              <Text style={styles.inviteButtonText}>Copy Invite Link</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.inviteButton}
              onPress={shareInviteLink}
            >
              <Ionicons name="share-social" size={wp(5)} color="#1E88E5" />
              <Text style={styles.inviteButtonText}>Share Invite</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.inviteButton, { marginTop: hp(2.5) }]}
              onPress={() => {
                setShowInviteModal(false);
                fetchUsers();
                setShowAddMembersModal(true);
              }}
            >
              <Ionicons name="person-add" size={wp(5)} color="#1E88E5" />
              <Text style={styles.inviteButtonText}>Add Members Directly</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showAddMembersModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Members</Text>
              <TouchableOpacity onPress={() => setShowAddMembersModal(false)}>
                <Ionicons name="close" size={wp(6)} color="#333" />
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
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
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
    padding: wp(10),
  },
  emptyText: {
    marginTop: hp(2),
    color: '#666',
    fontSize: wp(4),
  },
  createGroupButton: {
    marginTop: hp(3),
    backgroundColor: '#1E88E5',
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(6),
    borderRadius: wp(6),
  },
  createGroupButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: wp(4),
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  groupAvatar: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: '#4CAF50',
    marginRight: wp(3),
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
    marginBottom: hp(0.5),
  },
  lastMessage: {
    color: '#666',
    fontSize: wp(3.5),
  },
  memberCount: {
    color: '#999',
    fontSize: wp(3),
    marginTop: hp(0.5),
  },
  groupTime: {
    color: '#999',
    fontSize: wp(3),
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  groupHeaderContent: {
    flex: 1,
    marginHorizontal: wp(3),
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
    padding: wp(4),
    paddingBottom: hp(10),
  },
  messagesContainerKeyboardActive: {
    paddingBottom: hp(25),
  },
  messageBubble: {
    maxWidth: '80%',
    padding: wp(3),
    borderRadius: wp(3),
    marginBottom: hp(1),
  },
  currentUserBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E88E5',
    borderBottomRightRadius: wp(1),
  },
  otherUserBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: wp(1),
  },
  senderName: {
    fontWeight: 'bold',
    fontSize: wp(3.5),
    marginBottom: hp(0.5),
    color: 'rgba(255,255,255,0.9)',
  },
  currentUserText: {
    color: 'white',
    fontSize: wp(4),
  },
  otherUserText: {
    color: '#333',
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
    color: 'rgba(255,255,255,0.7)',
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
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
    backgroundColor: '#f5f5f5',
    borderRadius: wp(5),
    marginRight: wp(2),
    fontSize: wp(4),
  },
  sendButton: {
    backgroundColor: '#1E88E5',
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
    maxHeight: '50%',
    backgroundColor: 'white',
    borderRadius: wp(2.5),
    padding: wp(4),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  modalTitle: {
    fontSize: wp(4.5),
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: hp(2.5),
    fontSize: wp(4),
  },
  createButton: {
    backgroundColor: '#1E88E5',
    paddingVertical: hp(1.8),
    paddingHorizontal: wp(4),
    borderRadius: wp(2),
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
    paddingVertical: hp(1.8),
    paddingHorizontal: wp(4),
    borderWidth: 1,
    borderColor: '#1E88E5',
    borderRadius: wp(2),
    marginBottom: hp(1.2),
  },
  inviteButtonText: {
    color: '#1E88E5',
    fontWeight: '600',
    fontSize: wp(4),
    marginLeft: wp(2.5),
  },
  userList: {
    paddingTop: hp(1.2),
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  userAvatar: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1E88E5',
    marginRight: wp(3),
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