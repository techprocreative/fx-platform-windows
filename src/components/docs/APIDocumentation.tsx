/**
 * API Documentation Component
 * 
 * This component displays the OpenAPI documentation using Swagger UI.
 */

"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Swagger UI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96">Loading documentation...</div>
});

interface APIDocumentationProps {
  /** Custom title for the documentation */
  title?: string;
  /** Custom URL for the OpenAPI spec */
  specUrl?: string;
  /** Whether to show the Try It Out feature */
  tryItOutEnabled?: boolean;
  /** Default model expansion depth */
  defaultModelsExpandDepth?: number;
  /** Custom className */
  className?: string;
}

export function APIDocumentation({
  title = 'NexusTrade API Documentation',
  specUrl = '/api/docs',
  tryItOutEnabled = true,
  defaultModelsExpandDepth = 2,
  className
}: APIDocumentationProps) {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(specUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch API specification: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSpec(data);
      } catch (err) {
        console.error('Error fetching API spec:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSpec();
  }, [specUrl]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center max-w-md">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-medium">Error loading documentation</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">{title}</h1>
        <p className="text-neutral-600">
          Complete API documentation for the NexusTrade AI-Powered Trading Platform.
          Use the interactive documentation below to explore available endpoints.
        </p>
      </div>
      
      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <SwaggerUI
          spec={spec}
          url={specUrl}
          tryItOutEnabled={tryItOutEnabled}
          defaultModelsExpandDepth={defaultModelsExpandDepth}
          docExpansion="list"
          filter={true}
          supportedSubmitMethods={[
            'get',
            'post',
            'put',
            'delete',
            'patch'
          ]}
          onComplete={(system) => {
            // Custom completion handler if needed
            console.log('Swagger UI loaded');
          }}

        />
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">API Usage Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>All API requests must include your JWT token in the Authorization header</li>
          <li>Use the "Try it out" feature to test endpoints directly from this documentation</li>
          <li>Rate limits apply to all endpoints - see headers for current usage</li>
          <li>For production use, please use the production API endpoint</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Lightweight API Documentation Viewer
 * 
 * This component provides a simple view of the API documentation without Swagger UI.
 */
export function APIDocViewer({
  specUrl = '/api/docs',
  className
}: {
  specUrl?: string;
  className?: string;
}) {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(specUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch API specification: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSpec(data);
      } catch (err) {
        console.error('Error fetching API spec:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSpec();
  }, [specUrl]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-800 text-sm">Error: {error}</p>
      </div>
    );
  }

  if (!spec) {
    return null;
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">{spec.info.title}</h2>
        <p className="text-sm text-neutral-600">{spec.info.description}</p>
        <p className="text-xs text-neutral-500 mt-1">Version: {spec.info.version}</p>
      </div>
      
      <div className="space-y-4">
        {Object.entries(spec.paths || {}).map(([path, methods]: [string, any]) => (
          <div key={path} className="border border-neutral-200 rounded-lg p-4">
            <h3 className="font-medium text-neutral-900 mb-2">{path}</h3>
            <div className="space-y-2">
              {Object.entries(methods).map(([method, operation]: [string, any]) => (
                <div key={method} className="flex items-start gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    method === 'get' ? 'bg-green-100 text-green-800' :
                    method === 'post' ? 'bg-blue-100 text-blue-800' :
                    method === 'put' ? 'bg-yellow-100 text-yellow-800' :
                    method === 'delete' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {method.toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{operation.summary}</p>
                    <p className="text-xs text-neutral-600">{operation.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}