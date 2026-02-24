import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  attachments?: string[]; // Array of file names/IDs
}

export interface IChatSession extends Document {
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'ai'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  attachments: [String]
});

const ChatSessionSchema = new Schema<IChatSession>({
  title: { type: String, default: 'New Chat' },
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const ChatSession = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
