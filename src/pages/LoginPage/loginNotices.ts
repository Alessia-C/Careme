import type { FeedbackStatus } from '../../components/Feedback/Feedback';
import type { SignOutNotice } from '../../lib/signedOut';

export type LoginNotice = SignOutNotice | 'restore-failed';

export interface NoticeContent {
  status: FeedbackStatus;
  title: string;
  description?: string;
}

export const SIGNED_OUT_MESSAGE_MS = 5000;
export const NOTICE_ID = 'login-notice';

// Built once, outside the component: the copy and tone of each notice.
export const NOTICE_CONTENT: Record<LoginNotice, NoticeContent> = {
  'signed-out': {
    status: 'info',
    title: 'You have been signed out',
  },
  expired: {
    status: 'info',
    title: 'Your session expired due to inactivity',
  },
  'restore-failed': {
    status: 'error',
    title: "We couldn't restore your session",
    description: 'Check your connection and sign in again.',
  },
  unconfirmed: {
    status: 'error',
    title: "We couldn't confirm the sign out",
    description:
      'Your session may still be active on this device. Close this browser window, or sign in and sign out again.',
  },
};
