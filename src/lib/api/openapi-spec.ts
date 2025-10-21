/**
 * OpenAPI Specification Generator
 * 
 * This file contains utilities for generating OpenAPI specifications
 * for the FX Trading Platform API endpoints.
 */

import { Strategy, BacktestConfig, BacktestResults } from '@/types';

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: 'matrix' | 'label' | 'form' | 'simple' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode?: boolean;
  allowReserved?: boolean;
  schema: any;
  example?: any;
  examples?: any;
}

export interface OpenAPIRequestBody {
  description?: string;
  content: Record<string, any>;
  required?: boolean;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<string, any>;
  headers?: Record<string, any>;
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  deprecated?: boolean;
  security?: any[];
  servers?: any[];
}

export interface OpenAPIPathItem {
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
    variables?: Record<string, any>;
  }>;
  paths: Record<string, OpenAPIPathItem>;
  components?: {
    schemas?: Record<string, any>;
    responses?: Record<string, OpenAPIResponse>;
    parameters?: Record<string, OpenAPIParameter>;
    examples?: Record<string, any>;
    requestBodies?: Record<string, OpenAPIRequestBody>;
    headers?: Record<string, any>;
    securitySchemes?: Record<string, any>;
    links?: Record<string, any>;
    callbacks?: Record<string, any>;
  };
  security?: any[];
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: {
      description?: string;
      url?: string;
    };
  }>;
  externalDocs?: {
    description?: string;
    url?: string;
  };
}

/**
 * Generate OpenAPI specification for the FX Trading Platform
 */
export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'NexusTrade API',
      description: 'API for the NexusTrade AI-Powered Trading Platform',
      version: '1.0.0',
      contact: {
        name: 'NexusTrade Support',
        email: 'support@nexustrade.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'https://api.nexustrade.com/v1',
        description: 'Production server'
      },
      {
        url: 'https://staging-api.nexustrade.com/v1',
        description: 'Staging server'
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      }
    ],
    paths: {
      '/strategies': {
        get: {
          tags: ['Strategies'],
          summary: 'Get all strategies',
          description: 'Retrieve all trading strategies for the authenticated user',
          operationId: 'getStrategies',
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number for pagination',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1
              }
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Number of items per page',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 20
              }
            },
            {
              name: 'status',
              in: 'query',
              description: 'Filter by strategy status',
              required: false,
              schema: {
                type: 'string',
                enum: ['draft', 'active', 'paused', 'archived']
              }
            },
            {
              name: 'type',
              in: 'query',
              description: 'Filter by strategy type',
              required: false,
              schema: {
                type: 'string',
                enum: ['manual', 'ai_generated', 'imported']
              }
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          strategies: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Strategy' }
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Strategies'],
          summary: 'Create a new strategy',
          description: 'Create a new trading strategy',
          operationId: 'createStrategy',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateStrategyRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Strategy created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        $ref: '#/components/schemas/Strategy'
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Bad request - Invalid input data',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          description: 'Create a new user account',
          operationId: 'register',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        $ref: '#/components/schemas/User'
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Bad request - Invalid input data',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '409': {
              description: 'Conflict - User already exists',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Strategy: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Strategy ID'
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'Strategy name'
            },
            description: {
              type: 'string',
              description: 'Strategy description'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol'
            },
            timeframe: {
              type: 'string',
              description: 'Timeframe'
            },
            type: {
              type: 'string',
              enum: ['manual', 'ai_generated', 'imported'],
              description: 'Strategy type'
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'paused', 'archived'],
              description: 'Strategy status'
            },
            version: {
              type: 'integer',
              description: 'Strategy version'
            },
            isPublic: {
              type: 'boolean',
              description: 'Whether strategy is public'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update date'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                details: {
                  type: 'object',
                  description: 'Error details'
                }
              }
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total items'
            },
            page: {
              type: 'integer',
              description: 'Current page'
            },
            pages: {
              type: 'integer',
              description: 'Total pages'
            },
            limit: {
              type: 'integer',
              description: 'Items per page'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email'
            },
            firstName: {
              type: 'string',
              description: 'First name'
            },
            lastName: {
              type: 'string',
              description: 'Last name'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date'
            }
          }
        },
        CreateStrategyRequest: {
          type: 'object',
          required: ['name', 'symbol', 'timeframe', 'rules'],
          properties: {
            name: {
              type: 'string',
              description: 'Strategy name'
            },
            description: {
              type: 'string',
              description: 'Strategy description'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol'
            },
            timeframe: {
              type: 'string',
              description: 'Timeframe'
            },
            rules: {
              type: 'object',
              description: 'Strategy rules'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email'
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'User password'
            },
            firstName: {
              type: 'string',
              description: 'First name'
            },
            lastName: {
              type: 'string',
              description: 'Last name'
            }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Strategies',
        description: 'Trading strategy management'
      },
      {
        name: 'Authentication',
        description: 'User authentication'
      }
    ]
  };
}

/**
 * Export OpenAPI specification as JSON
 */
export function exportOpenAPISpec(): string {
  const spec = generateOpenAPISpec();
  return JSON.stringify(spec, null, 2);
}

/**
 * Export OpenAPI specification as YAML
 */
export function exportOpenAPISpecYAML(): string {
  const spec = generateOpenAPISpec();
  // In a real implementation, you would use a YAML library like js-yaml
  // For now, we'll return a placeholder
  return '# OpenAPI Specification\n# YAML format would be generated here';
}