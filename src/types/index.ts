export type { AIMode, Message, ConversationContext, ResponseLanguage } from '../services/aiService';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // extracted text content
  uploadedAt: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: import('../services/aiService').AIMode;
  messages: import('../services/aiService').Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ModeConfig {
  id: import('../services/aiService').AIMode;
  label: string;
  labelNe: string;
  description: string;
  descriptionNe: string;
  icon: string;
  color: string;
  bgGradient: string;
  placeholder: string;
  placeholderNe: string;
  placeholderShort: string;
  placeholderShortNe: string;
}
