import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/firebase/FirebaseConfig";
import { useAuthState } from "react-firebase-hooks/auth";
import { wp, hp } from '@/constants/common';

export default function ScheduleStudySession() {
  const [user] = useAuthState(auth);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const handleSchedule = async () => {
    if (!user) return Alert.alert("Error", "You must be logged in to schedule a session");
    if (!subject) return Alert.alert("Missing info", "Please enter a subject");

    try {
      await addDoc(collection(db, "studySessions"), {
        subject,
        description,
        scheduledDate: date,
        participants: [user.uid],
        participantNames: [user.displayName || user.email],
        createdAt: serverTimestamp(),
      });
      Alert.alert("Success", "Study session scheduled!");
      setSubject("");
      setDescription("");
      setDate(new Date());
    } catch (error) {
      console.error("Error scheduling session:", error);
      Alert.alert("Error", "Could not schedule session");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule Study Session</Text>

      <TextInput
        style={styles.input}
        placeholder="Subject"
        value={subject}
        onChangeText={setSubject}
      />
      <TextInput
        style={[styles.input, styles.multilineInput]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateText}>📅 {date.toLocaleString()}</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={date}
          mode="datetime"
          display="default"
          onChange={(e, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={handleSchedule}>
        <Text style={styles.buttonText}>Save Session</Text>
      </TouchableOpacity>
    </View>
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
    marginBottom: hp(2.5)
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: wp(2.5), 
    padding: wp(3),
    marginBottom: hp(1.875),
    fontSize: wp(4),
  },
  multilineInput: {
    height: hp(10), 
    textAlignVertical: 'top',
  },
  dateButton: {
    padding: wp(3), 
    backgroundColor: "#E3F2FD",
    borderRadius: wp(2.5), 
    marginBottom: hp(2.5),
  },
  dateText: { 
    fontSize: wp(4),
    color: "#1976D2" 
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: wp(3.5),
    borderRadius: wp(2.5),
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: wp(4),
    fontWeight: "600" 
  },
});