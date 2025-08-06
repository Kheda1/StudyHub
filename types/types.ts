// types.ts
// Combined application types for StudyHub, including Community/Q&A types.

// -----------------------------
// User / Profile Types
// -----------------------------
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

// -----------------------------
// Study Group Types
// -----------------------------
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

export interface GroupSchedule {
  day: string; // e.g., 'Monday'
  startTime: string; // e.g., '14:00'
  endTime: string; // e.g., '16:00'
  location?: string;
  onlineLink?: string;
}

// -----------------------------
// Chat & Messaging Types
// -----------------------------
export interface Message {
  id: string;
  senderId: string;
  groupId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  attachmentUrl?: string;
}

// -----------------------------
// Notifications & Resources
// -----------------------------
export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Resource {
  id: string;
  title: string;
  subject: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
  fileType: 'pdf' | 'docx' | 'ppt' | 'image' | 'video';
}

export interface Subject {
  id: string;
  name: string;
  description?: string;
}

export type ThemeMode = 'light' | 'dark';

// -----------------------------
// Collections structure (other existing)
// -----------------------------
export interface User {
  displayName: string;
  firstName: string;
  currentStreak: number;
  weeklyGoalHours: number;
  weeklyGoalSessions: number;
}

export interface StudySession {
  participants: string[];
  scheduledDate: Date;
  subject: string;
  type: string;
  subjectEmoji: string;
  participantNames: string[];
  description: string;
}

export interface StudyProgress {
  userId: string;
  date: Date;
  hoursStudied: number;
  sessionsCompleted: number;
}

export interface StudyGroupLite {
  groupId: string;
  name: string;
  emoji: string;
  members: string[];
  onlineMembers: string[];
  isActive: boolean;
}

// -----------------------------
// Community / Q&A types
// -----------------------------

/** Top-level question in Community */
export interface CommunityQuestion {
  id: string;                     // document id
  authorId: string;               // UserProfile.uid
  authorDisplayName?: string;     // cached for fast UI
  authorAvatarUrl?: string;
  title: string;
  body: string;                   // markdown or plain text
  tags?: string[];                // e.g. ['mathematics','a-level']
  topics?: string[];              // higher-level channels
  createdAt: Date;
  updatedAt?: Date;
  isPinned?: boolean;
  isAnonymous?: boolean;
  isSolved?: boolean;
  acceptedAnswerId?: string | null;
  answerCount?: number;           // denormalized
  viewCount?: number;             // denormalized
  score?: number;                 // upvotes - downvotes (denormalized)
  commentCount?: number;
  attachmentUrls?: string[];
  visibility?: 'public' | 'private' | 'school' | 'group';
}

/** An answer to a question */
export interface CommunityAnswer {
  id: string;
  questionId: string;
  authorId: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: Date;
  updatedAt?: Date;
  isAccepted?: boolean;
  score?: number;
  commentCount?: number;
  attachmentUrls?: string[];
}

/** Comment on a question or an answer */
export interface CommunityComment {
  id: string;
  parentId: string;               // questionId or answerId
  parentType: 'question' | 'answer';
  authorId: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: Date;
  updatedAt?: Date;
  score?: number;
}

/** Reaction (upvote, downvote, bookmark, etc.) */
export interface CommunityReaction {
  id: string;                     // doc id or composite key
  targetId: string;               // questionId / answerId / commentId
  targetType: 'question' | 'answer' | 'comment';
  userId: string;
  type: 'upvote' | 'downvote' | 'helpful' | 'bookmark';
  createdAt: Date;
}

/** Tag metadata */
export interface CommunityTag {
  id: string;                     // slug or UUID
  name: string;
  description?: string;
  usageCount?: number;
  createdAt?: Date;
}
