/**
 * API Documentation Endpoint
 * 
 * This endpoint serves the OpenAPI specification for the FX Trading Platform API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportOpenAPISpec } from '@/lib/api/openapi-spec';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';

  try {
    if (format === 'yaml') {
      // In a real implementation, you would use a YAML library like js-yaml
      // For now, we'll return a placeholder
      return new NextResponse('# OpenAPI Specification\n# YAML format would be generated here', {
        status: 200,
        headers: {
          'Content-Type': 'text/yaml',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    } else {
      const spec = exportOpenAPISpec();
      return new NextResponse(spec, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    }
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to generate API documentation' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}