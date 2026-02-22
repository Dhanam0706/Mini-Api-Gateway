import React, { useState } from 'react';

const CacheButton = () => {
  const [status, setStatus] = useState(''); // '', 'clearing', 'success', 'error'
  const [loading, setLoading] = useState(false);

  const handleClearCache = async () => {
    setLoading(true);
    setStatus('clearing');
    
    try {
    const response = await fetch('http://127.0.0.1:3000/api/users/update', {
  method: 'POST',
});

      if (response.ok) {
        setStatus('success');
        setTimeout(() => setStatus(''), 3000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-800">
      <div className="flex items-center gap-4">
        <button 
          onClick={handleClearCache}
          disabled={loading}
          className={`
            px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200
            flex items-center gap-2
            ${loading 
              ? 'bg-gray-700 cursor-not-allowed text-gray-400' 
              : 'bg-red-600 hover:bg-red-500 text-white active:scale-95 shadow-lg shadow-red-900/20'}
          `}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            '⚡ Clear Redis Cache'
          )}
        </button>

        {/* Status Messages */}
        {status === 'success' && (
          <span className="text-green-400 text-sm font-medium animate-pulse">
            ✅ Cache Purged Successfully
          </span>
        )}
        {status === 'error' && (
          <span className="text-red-400 text-sm font-medium">
            ❌ Failed to clear cache
          </span>
        )}
      </div>
      <p className="mt-2 text-gray-500 text-xs">
        Clearing the cache will force the Gateway to fetch fresh data from the User Service.
      </p>
    </div>
  );
};

export default CacheButton;