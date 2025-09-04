import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "@/firebase/FirebaseConfig";
import { useAuthState } from "react-firebase-hooks/auth";
import { LineChart, BarChart } from "react-native-chart-kit";
import { wp, hp } from '@/constants/common';

export default function StudyProgress() {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<any>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) return;
      try {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, "studyProgress"),
          where("userId", "==", user.uid),
          where("date", ">=", weekStart),
          orderBy("date", "asc")
        );
        const snapshot = await getDocs(q);

        // Build daily data
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dailyHours = Array(7).fill(0);
        const dailySessions = Array(7).fill(0);

        snapshot.forEach((doc) => {
          const data = doc.data();
          const d = data.date.toDate ? data.date.toDate() : new Date(data.date);
          const dayIndex = d.getDay();

          dailyHours[dayIndex] += data.hoursStudied || 0;
          dailySessions[dayIndex] += data.sessionsCompleted || 0;
        });

        setProgressData({
          dailyHours,
          dailySessions,
          totalHours: dailyHours.reduce((a, b) => a + b, 0),
          totalSessions: dailySessions.reduce((a, b) => a + b, 0),
          goals: {
            weeklyGoalHours: 30,
            weeklyGoalSessions: 15,
          },
        });
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [user]);

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  if (!progressData) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Your Weekly Progress</Text>
        <Text>No data yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your Weekly Progress</Text>

      <Text style={styles.metric}>
        ⏱ Hours Studied: {progressData.totalHours} / {progressData.goals.weeklyGoalHours}
      </Text>
      <Text style={styles.metric}>
        📚 Sessions: {progressData.totalSessions} / {progressData.goals.weeklyGoalSessions}
      </Text>

      {/* Line Chart for Hours */}
      <Text style={styles.chartTitle}>Study Hours per Day</Text>
      <LineChart
        data={{
          labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          datasets: [{ data: progressData.dailyHours }],
        }}
        width={wp(90)}
        height={hp(25)} 
        yAxisSuffix="h"
        chartConfig={{
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          decimalPlaces: 1,
          color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
          labelColor: () => "#555",
        }}
        bezier
        style={styles.chart}
      />

      {/* Bar Chart for Sessions */}
      <Text style={styles.chartTitle}>Sessions per Day</Text>
      <BarChart
        data={{
          labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          datasets: [{ data: progressData.dailySessions }],
        }}
        width={wp(90)}
        height={hp(25)}
        yAxisLabel=""
        chartConfig={{
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
          labelColor: () => "#555",
        }}
        style={styles.chart}
        yAxisSuffix={""}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    marginVertical: hp(2), 
    padding: wp(5), 
    backgroundColor: "#fff" 
  },
  title: { 
    fontSize: wp(6), 
    fontWeight: "bold", 
    marginBottom: hp(2)
  },
  metric: { 
    fontSize: wp(4.5), 
    marginBottom: hp(1.5)
  },
  chartTitle: { 
    fontSize: wp(4), 
    fontWeight: "600", 
    marginTop: hp(2.5), 
    marginBottom: hp(1)
  },
  chart: { 
    borderRadius: wp(3)
  },
});