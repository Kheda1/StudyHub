import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { router } from 'expo-router';
import { wp } from '@/constants/common';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  getDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '@/firebase/FirebaseConfig';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function HomeScreen() {
  const accent = useThemeColor('accent');
  const textColor = useThemeColor('text');
  const [user, loading, error] = useAuthState(auth);

  // State for all data
  //const [groups, setGroups] = useState<{ [key: string]: any; id: string }[]>([]);
  const [userData, setUserData] = useState<Record<string, any> | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<{ id: string; [key: string]: any }[]>([]);
  const [studyProgress, setStudyProgress] = useState<{
    weeklyHours: number;
    weeklySessions: number;
    weeklyGoalHours: number;
    weeklyGoalSessions: number;
  } | null>(null);
  const [activeGroups, setActiveGroups] = useState<{ [key: string]: any; id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Fetch user data
  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Fetch today's schedule
  const fetchTodaySchedule = async () => {
    if (!user) return;
    
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const schedulesRef = collection(db, 'studySessions');
      const q = query(
        schedulesRef,
        where('participants', 'array-contains', user.uid),
        where('scheduledDate', '>=', startOfDay),
        where('scheduledDate', '<', endOfDay),
        orderBy('scheduledDate', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const sessions: { id: string; [key: string]: any }[] = [];
      
      querySnapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() });
      });

      setTodaySchedule(sessions);
    } catch (error) {
      console.error('Error fetching today\'s schedule:', error);
    }
  };

  // Fetch study progress
  const fetchStudyProgress = async () => {
    if (!user) return;
    
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const progressRef = collection(db, 'studyProgress');
      const q = query(
        progressRef,
        where('userId', '==', user.uid),
        where('date', '>=', weekStart),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      let totalHours = 0;
      let totalSessions = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalHours += data.hoursStudied || 0;
        totalSessions += data.sessionsCompleted || 0;
      });

      setStudyProgress({
        weeklyHours: totalHours,
        weeklySessions: totalSessions,
        weeklyGoalHours: userData?.weeklyGoalHours || 30,
        weeklyGoalSessions: userData?.weeklyGoalSessions || 15
      });
    } catch (error) {
      console.error('Error fetching study progress:', error);
    }
  };

  // Fetch active study groups
  const fetchActiveGroups = async () => {
    if (!user) return;
    
    try {
      const groupsRef = collection(db, 'groups');
      const q = query(
        groupsRef,
        where('members', 'array-contains', user.uid),
        limit(5) 
      );

      const querySnapshot = await getDocs(q);
      const groups: { id: string; [key: string]: any }[] = [];
      
      querySnapshot.forEach((doc) => {
        groups.push({ id: doc.id, ...doc.data() });
      });

      setActiveGroups(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchUserData(),
        fetchTodaySchedule(),
        fetchStudyProgress(),
        fetchActiveGroups()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // Real-time updates for study sessions
  useEffect(() => {
    if (!user) return;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const schedulesRef = collection(db, 'studySessions');
    const q = query(
      schedulesRef,
      where('participants', 'array-contains', user.uid),
      where('scheduledDate', '>=', startOfDay),
      where('scheduledDate', '<', endOfDay),
      orderBy('scheduledDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const studySessions: { id: string; [key: string]: any }[] = [];
      querySnapshot.forEach((doc) => {
        studySessions.push({ id: doc.id, ...doc.data() });
      });
      setTodaySchedule(studySessions);
    });

    return () => unsubscribe();
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  // Format time
  const formatTime = (date: any) => {
    return new Date(date.toDate()).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading || isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={accent} />
        <ThemedText style={styles.loadingText}>Loading your study hub...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <FontAwesome5 name="exclamation-triangle" size={wp(8)} color="#FF5722" />
        <ThemedText style={styles.errorText}>Something went wrong</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAllData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Top Header */}
      <ThemedView style={styles.header}>
        <ThemedText style={styles.headerText}>StudyHub</ThemedText>
        <ThemedView style={styles.headerIcons}>
          <TouchableOpacity style={{ marginRight: wp(4) }} onPress={() => console.log('Notifications')}>
            <Ionicons name="notifications-outline" size={wp(6)} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/user/profile')}>
            <Ionicons name="person-circle-outline" size={wp(7.5)} color={accent} />
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

      {/* Search Bar */}
      <ThemedView style={styles.searchContainer}>
        <Ionicons name="search" size={wp(5)} color="#212121" />
        <TextInput placeholder="Search subjects, partners..." style={styles.searchInput} />
      </ThemedView>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[accent]} />
        }
      >
        {/* Enhanced Greeting */}
        <ThemedView style={styles.greetingContainer}>
          <ThemedText style={[styles.heading, { color: textColor }]}>
            {getGreeting()}, {userData?.displayName || userData?.email || 'Student'}!
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: textColor }]}>
            Ready to achieve your study goals today?
          </ThemedText>
          
          {/* Study Streak */}
          <View style={styles.streakCard}>
            <View style={styles.streakContent}>
              <FontAwesome5 name="fire" size={wp(5)} color="#FF6B35" />
              <View style={styles.streakText}>
                <Text style={styles.streakNumber}>{userData?.currentStreak || 0} Days</Text>
                <Text style={styles.streakLabel}>Study Streak <FontAwesome5 name="fire" size={wp(4)} color="#FF6B35" /></Text>
              </View>
            </View>
            <TouchableOpacity style={styles.streakButton}>
              <Text style={styles.streakButtonText}>Keep Going!</Text>
            </TouchableOpacity>
          </View>
        </ThemedView>

        {/* Today's Schedule */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="today" size={wp(5)} color="#4CAF50" />
            <Text style={styles.cardTitle}>Today Schedule</Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          
          {todaySchedule.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome5 name="calendar-times" size={wp(6)} color="#BDBDBD" />
              <Text style={styles.emptyText}>No sessions scheduled for today</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('../user/ScheduleStudySession')}>
                <Text style={styles.emptyButtonText}>Schedule a Session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {todaySchedule.slice(0, 2).map((session) => (
                <View key={session.id} style={styles.scheduleItem}>
                  <View style={styles.timeSlot}>
                    <Text style={styles.timeText}>{formatTime(session.scheduledDate)}</Text>
                  </View>
                  <View style={styles.scheduleDetails}>
                    <Text style={styles.scheduleTitle}>
                      {session.subjectEmoji || '📚'} {session.subject} {session.type}
                    </Text>
                    <Text style={styles.scheduleSubtext}>
                      {session.participantNames?.length > 1 
                        ? `With ${session.participantNames.slice(0, 2).join(', ')}${session.participantNames.length > 2 ? ` & ${session.participantNames.length - 2} others` : ''}`
                        : session.description || 'Solo study session'
                      }
                    </Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={[styles.button, { backgroundColor: '#4CAF50' }]} onPress={() => router.push('../user/ViewFullSchedule')}>
                <Text style={styles.buttonText}>View Full Schedule</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Study Progress */}
        {studyProgress && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FontAwesome5 name="chart-line" size={wp(4.5)} color="#9C27B0" />
              <Text style={styles.cardTitle}>This Week Progress</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Study Hours</Text>
                <Text style={styles.progressValue}>
                  {studyProgress.weeklyHours.toFixed(1)}h / {studyProgress.weeklyGoalHours}h
                </Text>
                <View style={styles.progressBar}>
                  <View style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min((studyProgress.weeklyHours / studyProgress.weeklyGoalHours) * 100, 100)}%`, 
                      backgroundColor: '#9C27B0' 
                    }
                  ]} />
                </View>
              </View>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Sessions</Text>
                <Text style={styles.progressValue}>
                  {studyProgress.weeklySessions} / {studyProgress.weeklyGoalSessions}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min((studyProgress.weeklySessions / studyProgress.weeklyGoalSessions) * 100, 100)}%`, 
                      backgroundColor: '#FF9800' 
                    }
                  ]} />
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#9C27B0' }]} onPress={() => router.push('../user/StudyProgress')}>
              <Text style={styles.buttonText}>View Analytics</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active Study Groups */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="users" size={wp(4.5)} color="#FF5722" />
            <Text style={styles.cardTitle}>Your Study Groups</Text>
          </View>
          
          {activeGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome5 name="users-slash" size={wp(6)} color="#BDBDBD" />
              <Text style={styles.emptyText}>You have not joined any study groups yet</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/groups')}>
                <Text style={styles.emptyButtonText}>Explore Groups</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {activeGroups.slice(0, 2).map((group) => (
                <View key={group.id} style={styles.groupItem}>
                  <View style={styles.groupIcon}>
                    <Text style={styles.groupEmoji}>{group.emoji || '📚'}</Text>
                  </View>
                  <View style={styles.groupDetails}>  
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupMembers}>
                      {group.members?.length || 0} members • {group.onlineMembers?.length || 0} online
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.joinButton}
                   // onPress={() => router.push(`/groups/${group.id}`)}
                    onPress={() => console.log('Open Group')}
                  >
                    <Text style={styles.joinButtonText}>Open</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={[styles.button, { backgroundColor: '#FF5722' }]} onPress={() => router.push('/groups')}>
                <Text style={styles.buttonText}>View All Groups</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Quick Study Tools */}
        {/* <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="tools" size={wp(4.5)} color="#607D8B" />
            <Text style={styles.cardTitle}>Quick Study Tools</Text>
          </View>
          <View style={styles.toolsGrid}>
            <TouchableOpacity style={styles.toolButton} onPress={() => console.log('Pomodoro')}>
              <FontAwesome5 name="clock" size={wp(5)} color="#FF9800" />
              <Text style={styles.toolText}>Upcoming Session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => console.log('Flashcards')}>
              <FontAwesome5 name="sticky-note" size={wp(5)} color="#4CAF50" />
              <Text style={styles.toolText}>Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => console.log('Goals')}>
              <FontAwesome5 name="calendar-check" size={wp(5)} color="#2196F3" />
              <Text style={styles.toolText}>Goals</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => console.log('Share Notes')}>
              <FontAwesome5 name="share-alt" size={wp(5)} color="#9C27B0" />
              <Text style={styles.toolText}>Share Notes</Text>
            </TouchableOpacity>
          </View>
        </View> */}

        {/* Enhanced Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#1E88E5' }]}
            onPress={() => router.push('../user/StartSession')}
          >
            <FontAwesome5 name="plus" size={wp(4)} color="#fff" />
            <Text style={[styles.buttonText, { color: '#fff', marginLeft: wp(2) }]}>Start Session</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => router.push('../user/findPartners')}
          >
            <FontAwesome5 name="search" size={wp(4)} color="#fff" />
            <Text style={[styles.buttonText, { color: '#fff', marginLeft: wp(2) }]}>Find Partner</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'themedColor',
    flex: 1,
    padding: wp(6),
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: wp(4),
    fontSize: wp(4),
    opacity: 0.7,
  },
  errorText: {
    marginTop: wp(4),
    fontSize: wp(4),
    color: '#FF5722',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: wp(4),
    backgroundColor: '#FF5722',
    paddingHorizontal: wp(6),
    paddingVertical: wp(3),
    borderRadius: wp(2.5),
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: wp(3.8),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: wp(5.5),
    fontWeight: 'bold',
    color: '#1E88E5',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: wp(3),
    padding: wp(3),
    alignItems: 'center',
    marginVertical: wp(4),
    elevation: 1,
  },
  searchInput: {
    marginLeft: wp(2),
    fontSize: wp(4),
    flex: 1,
  },
  greetingContainer: {
    marginBottom: wp(4),
  },
  heading: {
    fontSize: wp(5.5),
    fontWeight: '700',
    marginBottom: wp(2),
  },
  subheading: {
    fontSize: wp(3.8),
    marginBottom: wp(4),
    opacity: 0.8,
  },
  streakCard: {
    backgroundColor: '#FFF3E0',
    padding: wp(4),
    borderRadius: wp(3),
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(3),
  },
  streakText: {
    marginLeft: wp(3),
    flex: 1,
  },
  streakNumber: {
    fontSize: wp(4.5),
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  streakLabel: {
    fontSize: wp(3.2),
    color: '#D84315',
  },
  streakButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: wp(4),
    paddingVertical: wp(2),
    borderRadius: wp(2),
    alignSelf: 'flex-start',
  },
  streakButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: wp(3.5),
  },
  card: {
    backgroundColor: '#fff',
    padding: wp(4),
    borderRadius: wp(3),
    marginBottom: wp(4),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(3),
  },
  cardTitle: {
    fontSize: wp(4.2),
    fontWeight: '600',
    color: '#212121',
    marginLeft: wp(2),
    flex: 1,
  },
  dateText: {
    fontSize: wp(3.2),
    color: '#757575',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: wp(6),
  },
  emptyText: {
    fontSize: wp(3.5),
    color: '#757575',
    marginTop: wp(2),
    marginBottom: wp(4),
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: wp(4),
    paddingVertical: wp(2.5),
    borderRadius: wp(2),
  },
  emptyButtonText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: wp(3.5),
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(3),
    paddingBottom: wp(3),
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  timeSlot: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: wp(3),
    paddingVertical: wp(2),
    borderRadius: wp(2),
    marginRight: wp(3),
  },
  timeText: {
    fontSize: wp(3.2),
    fontWeight: '600',
    color: '#1976D2',
  },
  scheduleDetails: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#212121',
    marginBottom: wp(0.5),
  },
  scheduleSubtext: {
    fontSize: wp(3.2),
    color: '#757575',
  },
  progressContainer: {
    marginBottom: wp(3),
  },
  progressItem: {
    marginBottom: wp(3),
  },
  progressLabel: {
    fontSize: wp(3.5),
    color: '#757575',
    marginBottom: wp(1),
  },
  progressValue: {
    fontSize: wp(4.5),
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: wp(2),
  },
  progressBar: {
    height: wp(2),
    backgroundColor: '#E0E0E0',
    borderRadius: wp(1),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: wp(1),
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(3),
    paddingBottom: wp(3),
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  groupIcon: {
    width: wp(12),
    height: wp(12),
    backgroundColor: '#F5F5F5',
    borderRadius: wp(6),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  groupEmoji: {
    fontSize: wp(6),
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#212121',
    marginBottom: wp(0.5),
  },
  groupMembers: {
    fontSize: wp(3.2),
    color: '#757575',
  },
  joinButton: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: wp(4),
    paddingVertical: wp(2),
    borderRadius: wp(2),
  },
  joinButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: wp(3.5),
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: wp(3),
  },
  toolButton: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    padding: wp(4),
    borderRadius: wp(2.5),
    alignItems: 'center',
    marginBottom: wp(3),
  },
  toolText: {
    fontSize: wp(3.5),
    color: '#212121',
    fontWeight: '500',
    marginTop: wp(2),
  },
  button: {
    marginTop: wp(2.5),
    backgroundColor: '#FFC107',
    padding: wp(3),
    borderRadius: wp(2.5),
    alignItems: 'center',
  },
  buttonText: {
    color: '#212121',
    fontWeight: '600',
    fontSize: wp(3.8),
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: wp(2),
    marginBottom: wp(10),
  },
  actionButton: {
    backgroundColor: '#1E88E5',
    padding: wp(3.5),
    borderRadius: wp(2.5),
    flex: 0.48,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});