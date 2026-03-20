/**
 * Mock server setup - initializes MSW for browser mocking.
 * 
 * This is imported conditionally based on VITE_USE_MOCKS environment variable.
 */

export async function setupMocks(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') {
    return;
  }

  const { worker } = await import('./browser');
  
  await worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests (e.g., static assets)
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });
  
  console.log('%c[MSW] Mock server started', 'color: #10b981; font-weight: bold;');
}
