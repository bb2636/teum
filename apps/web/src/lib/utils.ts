import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripHTML(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export function getFirstLine(diary: {
  title?: string;
  content?: string;
  type?: string;
  answers?: Array<{ answer?: string; question?: { question?: string } }>;
}): string {
  if (diary.title?.trim()) return diary.title.trim();
  if (diary.type === 'question_based' && diary.answers?.length) {
    const firstQuestion = diary.answers[0].question?.question?.trim();
    if (firstQuestion) return firstQuestion;
    const first = diary.answers[0].answer?.trim();
    if (first) {
      const text = stripHTML(first);
      return text.split('\n')[0].trim() || text;
    }
    return '';
  }
  if (diary.content?.trim()) {
    const text = stripHTML(diary.content);
    return text.trim().split('\n')[0].trim();
  }
  if (diary.type === 'question_based') {
    return '';
  }
  return '';
}
