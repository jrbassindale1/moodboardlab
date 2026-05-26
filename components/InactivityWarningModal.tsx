import React from 'react';
import { Clock, LogOut } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
};

const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}) => {
  if (!isOpen) return null;

  const isUrgent = secondsRemaining <= 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-md p-8 shadow-xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isUrgent ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <Clock className={`w-8 h-8 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-mono uppercase tracking-widest mb-3">
            Session Expiring
          </h2>
          <p className="text-gray-600 mb-4">
            You've been inactive for a while. Your session will end soon to protect your account.
          </p>
          <div className={`text-3xl font-mono font-bold ${
            isUrgent ? 'text-red-600' : 'text-amber-600'
          }`}>
            {formatTime(secondsRemaining)}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            until automatic logout
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onStayLoggedIn}
            className="w-full py-3 px-4 bg-black text-white font-mono text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            Stay Logged In
          </button>

          <button
            onClick={onLogout}
            className="w-full py-3 px-4 bg-white text-gray-700 border border-gray-300 font-mono text-sm uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityWarningModal;
