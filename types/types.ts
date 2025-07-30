// User Profile
export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  academicLevel: AcademicLevel;
  studyPreferences: StudyPreferences;
  avatarUrl?: string;
  bio?: string;
  joinedAt: Date;
  isOnline?: boolean;
}

// Academic Level Options
 export type AcademicLevel = 
   | 'ZJC'
   | 'O-Level'
   | 'A-Level'
   | 'Undergraduate'
   | 'Postgraduate';

// Study Preferences
export interface StudyPreferences {
  preferredSubjects: string[];
  preferredStudyTimes: StudyTime[];
  studyMode: StudyMode;
  languagesSpoken?: string[];
}

// Time of Study Preference
export type StudyTime = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

// Study Mode
export type StudyMode = 'Buddy' | 'Group' | 'Both';

// Study Group
export interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  createdBy: string; // uid
  members: string[]; // uids
  description?: string;
  createdAt: Date;
  isPrivate: boolean;
  schedule?: GroupSchedule;
}

// Group Schedule
export interface GroupSchedule {
  day: string; // e.g., 'Monday'
  startTime: string; // e.g., '14:00'
  endTime: string;   // e.g., '16:00'
  location?: string;
  onlineLink?: string;
}

// Chat Message
export interface Message {
  id: string;
  senderId: string;
  groupId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  attachmentUrl?: string;
}

// Notification
export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// Resource
export interface Resource {
  id: string;
  title: string;
  subject: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
  fileType: 'pdf' | 'docx' | 'ppt' | 'image' | 'video';
}

// Subject
export interface Subject {
  id: string;
  name: string;
  description?: string;
}

// Enum-style types for UI
export type ThemeMode = 'light' | 'dark';

// Collections structure:
export interface User {
  displayName: string,
  firstName: string,
  currentStreak: number,
  weeklyGoalHours: number,
  weeklyGoalSessions: number
}

export interface StudySession {
  participants: string[],
  scheduledDate: Date,
  subject: string,
  type: string,
  subjectEmoji: string,
  participantNames: string[],
  description: string
}

export interface StudyProgress {
  userId: string,
  date: Date,
  hoursStudied: number,
  sessionsCompleted: number
}

export interface StudyGroupLite {
  groupId: string,
  name: string,
  emoji: string,
  members: string[],
  onlineMembers: string[],
  isActive: boolean
}