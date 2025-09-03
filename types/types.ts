import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  displayName: string;
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

export interface StudyPreferences {
  preferredSubjects: string[];
  preferredStudyTimes: StudyTime[];
  studyMode: StudyMode;
  languagesSpoken?: string[];
}

export type StudyTime = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

export type StudyMode = 'Buddy' | 'Group' | 'Both';

export interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  createdBy: string; 
  members: string[]; 
  description?: string;
  createdAt: Date;
  isPrivate: boolean;
  schedule?: GroupSchedule;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  adminId: string;
  participantIds: string[];
  participantNames: { [key: string]: string };
  lastMessage?: string;
  lastUpdated?: Timestamp;
  createdAt?: Timestamp;
  inviteCode: string;
}

export interface GroupSchedule {
  day: string; 
  startTime: string;
  endTime: string; 
  location?: string;
  onlineLink?: string;
}

export interface GroupMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt?: Timestamp;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  attachmentUrl?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  chatId?: string;
  groupId?: string;
  content?: string;
  createdAt: Timestamp;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  attachmentUrl?: string;
}

export interface Chat {
  id: string;
  participantIds: string[];
  participantNames?: { [key: string]: string };
  lastMessage?: string;
  lastUpdated?: any;
  createdAt?: any;
  unreadCount?: number;
  isDirectMessage?: boolean;
}

export interface Match {
  id: string;
  userId: string;
  userName: string;
}

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


// export interface User {
//   fullName: string;
//   firstName: string;
//   currentStreak: number;
//   weeklyGoalHours: number;
//   weeklyGoalSessions: number;
// }

export interface User {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  level?: AcademicLevel;
  interests?: string[];
  subjects?: string[];
  methods?: string[];
  availability?: string[];
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

export interface CommunityQuestion {
  id: string;                     
  authorId: string;               
  authorDisplayName?: string;     
  authorAvatarUrl?: string;
  title: string;
  body: string;                   
  tags?: string[];                
  topics?: string[];              
  createdAt: Date;
  updatedAt?: Date;
  isPinned?: boolean;
  isAnonymous?: boolean;
  isSolved?: boolean;
  acceptedAnswerId?: string | null;
  answerCount?: number;
  viewCount?: number;
  score?: number;
  commentCount?: number;
  attachmentUrls?: string[];
  visibility?: 'public' | 'private' | 'school' | 'group';
}

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
// export interface CommunityComment {
//   id: string;
//   parentId: string;              
//   parentType: 'question' | 'answer';
//   authorId: string;
//   authorDisplayName?: string;
//   authorAvatarUrl?: string;
//   body: string;
//   createdAt: Date;
//   updatedAt?: Date;
//   score?: number;
// }

export interface CommunityReaction {
  id: string;                     // doc id or composite key
  targetId: string;               // questionId / answerId
  targetType: 'question' | 'answer';
  userId: string;
  type: 'upvote' | 'downvote';
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
