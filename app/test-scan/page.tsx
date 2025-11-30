'use client';

import { useState } from 'react';

export default function TestScanPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const testScan = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    console.log('🧪 TEST: Starting scan test...');

    try {
      console.log('📡 TEST: Calling API...');
      const response = await fetch('/api/scan-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: 'UCm_yUJ38zRtrvQcaCu-Z-Fg', // Technical Guruji
          videoCount: 5,
        }),
      });

      console.log('📊 TEST: Response status:', response.status);

      const data = await response.json();
      console.log('✅ TEST: Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Scan failed');
      }

      setResult(data);
      console.log('🎉 TEST: Scan completed successfully!');
    } catch (err: any) {
      console.error('❌ TEST: Error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🧪 Scan API Test Page
          </h1>

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              This page tests if the scan API is working correctly.
            </p>
            <p className="text-sm text-gray-500">
              It will scan 5 videos from Technical Guruji channel.
            </p>
          </div>

          <button
            onClick={testScan}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '⏳ Testing Scan...' : '▶️ Run Test Scan'}
          </button>

          {loading && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium">⏳ Scanning in progress...</p>
              <p className="text-sm text-blue-600 mt-2">
                This may take 1-2 minutes. Check browser console (F12) for detailed logs.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-bold mb-2">❌ Error:</p>
              <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-bold mb-2">✅ Scan Successful!</p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-3">📊 Statistics:</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Videos Scanned:</p>
                    <p className="text-2xl font-bold text-gray-900">{result.scannedVideos}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Videos with Links:</p>
                    <p className="text-2xl font-bold text-gray-900">{result.videosWithLinks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Links:</p>
                    <p className="text-2xl font-bold text-blue-600">{result.statistics.totalLinks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Broken Links:</p>
                    <p className="text-2xl font-bold text-red-600">{result.statistics.brokenLinks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Warning Links:</p>
                    <p className="text-2xl font-bold text-yellow-600">{result.statistics.warningLinks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Working Links:</p>
                    <p className="text-2xl font-bold text-green-600">{result.statistics.workingLinks}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-3">📝 Full Response:</h3>
                <pre className="text-xs text-gray-600 overflow-auto max-h-96 bg-white p-3 rounded border">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-bold text-yellow-900 mb-2">💡 Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
              <li>Open browser console (Press F12)</li>
              <li>Click "Run Test Scan" button</li>
              <li>Watch console for detailed logs</li>
              <li>Wait 1-2 minutes for results</li>
              <li>If successful, the main scan should work too!</li>
            </ol>
          </div>

          <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <h3 className="font-bold text-gray-900 mb-2">🔍 Troubleshooting:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li>If you see errors, check the browser console</li>
              <li>Make sure dev server is running: <code className="bg-white px-2 py-1 rounded">npm run dev</code></li>
              <li>Check <code className="bg-white px-2 py-1 rounded">.env.local</code> has YouTube API key</li>
              <li>See <code className="bg-white px-2 py-1 rounded">DEBUG_SCAN.md</code> for detailed troubleshooting</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
