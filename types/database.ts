import { User } from "firebase/auth"

// Collections structure:
export interface users {
  displayName: string,
  firstName: string,
  currentStreak: number,
  weeklyGoalHours: number,
  weeklyGoalSessions: number
}

export interface studySessions {
  participants: string[],
  scheduledDate: Date,
  subject: string,
  type: string,
  subjectEmoji: string,
  participantNames: string[],
  description: string
}

export interface studyProgress {
  userId: string,
  date: Date,
  hoursStudied: number,
  sessionsCompleted: number
}

export interface studyGroups {
  groupId: string,
  name: string,
  emoji: string,
  members: string[],
  onlineMembers: string[],
  isActive: boolean
}