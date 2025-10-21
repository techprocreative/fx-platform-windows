/**
 * API Documentation Page
 * 
 * This page displays the API documentation for the FX Trading Platform.
 */

import { Metadata } from 'next';
import { APIDocumentation } from '@/components/docs/APIDocumentation';

export const metadata: Metadata = {
  title: 'API Documentation | NexusTrade',
  description: 'Complete API documentation for the NexusTrade AI-Powered Trading Platform',
  keywords: ['API', 'Documentation', 'REST', 'OpenAPI', 'Swagger'],
  openGraph: {
    title: 'API Documentation | NexusTrade',
    description: 'Complete API documentation for the NexusTrade AI-Powered Trading Platform',
    type: 'website',
  },
};

export default function APIDocumentationPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <APIDocumentation
        title="NexusTrade API Documentation"
        specUrl="/api/docs"
        tryItOutEnabled={true}
        defaultModelsExpandDepth={2}
      />
    </div>
  );
}
