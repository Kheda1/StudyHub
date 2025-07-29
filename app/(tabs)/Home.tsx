import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { router } from 'expo-router';
import { wp } from '@/constants/common';

export default function HomeScreen() {
  const accent = useThemeColor('accent');

  return (
    <ThemedView style={styles.container}>
      {/* Top Header */}
      <ThemedView style={styles.header}>
        <ThemedText style={styles.headerText}>StudyHub</ThemedText>
        <ThemedView style={styles.headerIcons}>
          <TouchableOpacity style={{ marginRight: wp(4) }} onPress={() => router.push('/resources')}>
            <Ionicons name="notifications-outline" size={wp(6)} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Ionicons name="person-circle-outline" size={wp(7.5)} color={accent} />
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

      {/* Search Bar */}
      <ThemedView style={styles.searchContainer}>
        <Ionicons name="search" size={wp(5)} color="#212121" />
        <TextInput placeholder="Search subjects, partners..." style={styles.searchInput} />
      </ThemedView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <ThemedView>
          <ThemedText style={styles.heading}>Welcome back 👋</ThemedText>
          <ThemedText style={styles.subheading}>Let’s make learning collaborative today!</ThemedText>
        </ThemedView>

        {/* Suggested Partners */}
        <ThemedView style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="user-friends" size={wp(4.5)} color={accent} />
            <Text style={styles.cardTitle}>Suggested Study Partners</Text>
          </View>
          <Text style={styles.cardText}>📘 Alex – Biology | 💬 Evening learner</Text>
          <Text style={styles.cardText}>📗 Tino – Math | 💬 Group study</Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Find More</Text>
          </TouchableOpacity>
        </ThemedView>

        {/* Study Sessions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="event-note" size={wp(5)} color="#4CAF50" />
            <Text style={styles.cardTitle}>Upcoming Study Sessions</Text>
          </View>
          <Text style={styles.cardText}>🗓 Chemistry – Friday at 4PM</Text>
          <Text style={styles.cardText}>🗓 History – Saturday at 10AM</Text>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#4CAF50' }]}>
            <Text style={styles.buttonText}>View Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.buttonText}>Join Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.buttonText}>Share Notes</Text>
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
  heading: {
    fontSize: wp(5),
    fontWeight: '600',
    color: 'themedColor',
    marginBottom: wp(2),
  },
  subheading: {
    fontSize: wp(3.5),
    color: 'themedColor',
    marginBottom: wp(4),
  },
  card: {
    backgroundColor: '#fff',
    padding: wp(4),
    borderRadius: wp(3),
    marginBottom: wp(4),
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(2),
  },
  cardTitle: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#212121',
    marginLeft: wp(2),
  },
  cardText: {
    fontSize: wp(3.5),
    color: '#212121',
    marginBottom: wp(1),
  },
  button: {
    marginTop: wp(2.5),
    backgroundColor: '#FFC107',
    padding: wp(3),
    borderRadius: wp(2),
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
    padding: wp(3),
    borderRadius: wp(2.5),
    flex: 0.48,
    alignItems: 'center',
  },
});
