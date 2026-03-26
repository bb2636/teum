import { useEffect } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, isVisible, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[70] w-full max-w-sm px-4">
      <div className="bg-gray-500 text-white px-6 py-3 rounded-lg shadow-xl animate-slide-up">
        <p className="text-sm text-center font-medium">{message}</p>
      </div>
    </div>
  );
}
