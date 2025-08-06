import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/FirebaseConfig';

interface CommunityQuestion {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  userId: string;
  score: number;
}

interface Answer {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
}

export default function CommunityQuestionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [question, setQuestion] = useState<CommunityQuestion | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchQuestionAndAnswers = async () => {
      setLoading(true);

      // Fetch question
      const questionRef = doc(db, 'communityQuestions', id);
      const questionSnap = await getDoc(questionRef);

      if (questionSnap.exists()) {
        const data = questionSnap.data();
        setQuestion({
          id,
          title: data.title,
          content: data.content,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          userId: data.userId,
          score: data.score ?? 0,
        });
      }

      // Fetch answers
      const answersRef = collection(db, 'communityQuestions', id, 'answers');
      const answersQuery = query(answersRef, orderBy('createdAt', 'asc'));
      const answersSnap = await getDocs(answersQuery);

      const loadedAnswers: Answer[] = [];
      answersSnap.forEach(doc => {
        const data = doc.data();
        loadedAnswers.push({
          id: doc.id,
          content: data.content,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          userId: data.userId,
        });
      });

      setAnswers(loadedAnswers);
      setLoading(false);
    };

    fetchQuestionAndAnswers();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!question) {
    return (
      <View style={styles.center}>
        <Text>Question not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{question.title}</Text>
      <Text style={styles.meta}>Asked by: {question.userId}</Text>
      <Text style={styles.content}>{question.content}</Text>
      <Text style={styles.score}>Score: {question.score}</Text>

      <Text style={styles.answersHeader}>Answers ({answers.length})</Text>
      {answers.map(answer => (
        <View key={answer.id} style={styles.answerBox}>
          <Text>{answer.content}</Text>
          <Text style={styles.meta}>By: {answer.userId}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  content: {
    fontSize: 16,
    marginBottom: 12,
  },
  score: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  answersHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  answerBox: {
    padding: 12,
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    marginBottom: 12,
  },
});
