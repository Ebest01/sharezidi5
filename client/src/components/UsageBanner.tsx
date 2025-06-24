import React from 'react';

interface User {
  id: number;
  email: string;
  transferCount: number;
  isPro: boolean;
  isGuest?: boolean;
}

interface UsageBannerProps {
  user: User | null;
  onUpgrade: () => void;
}

export const UsageBanner: React.FC<UsageBannerProps> = ({ user, onUpgrade }) => {
  if (!user || user.isPro) return null;

  const transfersLeft = Math.max(0, 15 - (user.transferCount || 0));
  const isNearLimit = transfersLeft <= 5;
  const isAtLimit = transfersLeft === 0;

  if (isAtLimit) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-900">Transfer Limit Reached</h3>
              <p className="text-sm text-red-700">You've used all 15 free transfers this month.</p>
            </div>
          </div>
          <button
            onClick={onUpgrade}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  if (isNearLimit) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-orange-900">Almost at your limit</h3>
              <p className="text-sm text-orange-700">
                {transfersLeft} transfers remaining this month
              </p>
            </div>
          </div>
          <button
            onClick={onUpgrade}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="font-semibold text-blue-900">Free Plan</h3>
            <p className="text-sm text-blue-700">
              {transfersLeft} transfers remaining this month
            </p>
          </div>
        </div>
        <button
          onClick={onUpgrade}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
};