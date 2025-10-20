import { Strategy } from '@prisma/client';

export interface StrategyExport {
  version: string;
  exportedAt: string;
  strategies: ExportedStrategy[];
  metadata: {
    totalStrategies: number;
    exportFormat: 'nextrade';
    description?: string;
  };
}

export interface ExportedStrategy {
  id: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  parameters: Record<string, any>;
  indicators: string[];
  timeframe: string;
  symbols: string[];
  riskSettings: {
    maxDrawdown: number;
    riskPerTrade: number;
    stopLoss: number;
    takeProfit: number;
  };
  performance?: {
    totalReturn: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  backtestResults?: Array<{
    id: string;
    period: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    trades: number;
  }>;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  conflicts: Array<{
    strategyName: string;
    reason: string;
    existingId?: string;
    newId?: string;
  }>;
}

export interface ConflictResolution {
  strategyId: string;
  action: 'skip' | 'overwrite' | 'rename' | 'create_new';
  newName?: string;
}

// Export strategies to different formats
export class StrategyExporter {
  static async exportToStrategies(
    strategies: Strategy[],
    format: 'json' | 'xml' | 'csv' = 'json',
    includeBacktests = true
  ): Promise<string> {
    const exportData: StrategyExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      strategies: strategies.map(strategy => this.convertToExportedStrategy(strategy, includeBacktests)),
      metadata: {
        totalStrategies: strategies.length,
        exportFormat: 'nextrade',
        description: `Exported ${strategies.length} strategies from NexusTrade platform`,
      },
    };

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      
      case 'xml':
        return this.convertToXML(exportData);
      
      case 'csv':
        return this.convertToCSV(exportData);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private static convertToExportedStrategy(
    strategy: Strategy,
    includeBacktests: boolean
  ): ExportedStrategy {
    const rules = typeof strategy.rules === 'string' 
      ? JSON.parse(strategy.rules) 
      : strategy.rules || {};
    
    const config = {
      indicators: rules.indicators || [],
      timeframe: strategy.timeframe || '1h',
      symbols: [strategy.symbol],
      maxDrawdown: rules.maxDrawdown || 20,
      riskPerTrade: rules.riskPerTrade || 2,
      stopLoss: rules.stopLoss || 0,
      takeProfit: rules.takeProfit || 0,
    };

    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description || undefined,
      config,
      parameters: rules.parameters || {},
      indicators: config.indicators,
      timeframe: config.timeframe,
      symbols: config.symbols,
      riskSettings: {
        maxDrawdown: config.maxDrawdown,
        riskPerTrade: config.riskPerTrade,
        stopLoss: config.stopLoss,
        takeProfit: config.takeProfit,
      },
      tags: [],
      notes: strategy.aiPrompt || undefined,
      createdAt: strategy.createdAt.toISOString(),
      updatedAt: strategy.updatedAt.toISOString(),
    };
  }

  private static convertToXML(data: StrategyExport): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<strategyExport version="${data.version}" exportedAt="${data.exportedAt}">\n`;
    xml += `  <metadata>\n`;
    xml += `    <totalStrategies>${data.metadata.totalStrategies}</totalStrategies>\n`;
    xml += `    <exportFormat>${data.metadata.exportFormat}</exportFormat>\n`;
    if (data.metadata.description) {
      xml += `    <description>${this.escapeXML(data.metadata.description)}</description>\n`;
    }
    xml += `  </metadata>\n`;
    xml += `  <strategies>\n`;

    data.strategies.forEach(strategy => {
      xml += `    <strategy id="${strategy.id}">\n`;
      xml += `      <name>${this.escapeXML(strategy.name)}</name>\n`;
      if (strategy.description) {
        xml += `      <description>${this.escapeXML(strategy.description)}</description>\n`;
      }
      xml += `      <config>${this.escapeXML(JSON.stringify(strategy.config))}</config>\n`;
      xml += `      <parameters>${this.escapeXML(JSON.stringify(strategy.parameters))}</parameters>\n`;
      xml += `      <indicators>${strategy.indicators.join(',')}</indicators>\n`;
      xml += `      <timeframe>${strategy.timeframe}</timeframe>\n`;
      xml += `      <symbols>${strategy.symbols.join(',')}</symbols>\n`;
      xml += `      <riskSettings>\n`;
      xml += `        <maxDrawdown>${strategy.riskSettings.maxDrawdown}</maxDrawdown>\n`;
      xml += `        <riskPerTrade>${strategy.riskSettings.riskPerTrade}</riskPerTrade>\n`;
      xml += `        <stopLoss>${strategy.riskSettings.stopLoss}</stopLoss>\n`;
      xml += `        <takeProfit>${strategy.riskSettings.takeProfit}</takeProfit>\n`;
      xml += `      </riskSettings>\n`;
      if (strategy.tags && strategy.tags.length > 0) {
        xml += `      <tags>${strategy.tags.join(',')}</tags>\n`;
      }
      xml += `      <createdAt>${strategy.createdAt}</createdAt>\n`;
      xml += `      <updatedAt>${strategy.updatedAt}</updatedAt>\n`;
      xml += `    </strategy>\n`;
    });

    xml += `  </strategies>\n`;
    xml += `</strategyExport>\n`;
    return xml;
  }

  private static convertToCSV(data: StrategyExport): string {
    const headers = [
      'ID', 'Name', 'Description', 'Timeframe', 'Symbols', 'Indicators',
      'Max Drawdown', 'Risk Per Trade', 'Stop Loss', 'Take Profit',
      'Tags', 'Created At', 'Updated At'
    ];

    const rows = data.strategies.map(strategy => [
      strategy.id,
      strategy.name,
      strategy.description || '',
      strategy.timeframe,
      strategy.symbols.join(';'),
      strategy.indicators.join(';'),
      strategy.riskSettings.maxDrawdown.toString(),
      strategy.riskSettings.riskPerTrade.toString(),
      strategy.riskSettings.stopLoss.toString(),
      strategy.riskSettings.takeProfit.toString(),
      strategy.tags ? strategy.tags.join(';') : '',
      strategy.createdAt,
      strategy.updatedAt,
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }
  private static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

}

// Import strategies from different formats
export class StrategyImporter {
  static async importStrategies(
    data: string,
    format: 'json' | 'xml' | 'csv' = 'json',
    conflictResolution: ConflictResolution[] = []
  ): Promise<ImportResult> {
    try {
      let exportData: StrategyExport;

      switch (format) {
        case 'json':
          exportData = JSON.parse(data);
          break;
        
        case 'xml':
          exportData = this.parseFromXML(data);
          break;
        
        case 'csv':
          exportData = this.parseFromCSV(data);
          break;
        
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Validate export data
      if (!this.validateExportData(exportData)) {
        throw new Error('Invalid strategy export data');
      }

      // Process strategies and handle conflicts
      return await this.processImport(exportData, conflictResolution);
    } catch (error) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        conflicts: [],
      };
    }
  }

  private static parseFromXML(xmlData: string): StrategyExport {
    // Basic XML parsing - in a real implementation, use a proper XML parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlData, 'text/xml');
    
    const root = doc.querySelector('strategyExport');
    if (!root) {
      throw new Error('Invalid XML format');
    }

    const version = root.getAttribute('version') || '1.0';
    const exportedAt = root.getAttribute('exportedAt') || new Date().toISOString();

    const strategies: ExportedStrategy[] = [];
    const strategyElements = doc.querySelectorAll('strategy');
    
    strategyElements.forEach(element => {
      const id = element.getAttribute('id') || '';
      const name = element.querySelector('name')?.textContent || '';
      const description = element.querySelector('description')?.textContent || undefined;
      const configText = element.querySelector('config')?.textContent || '{}';
      const parametersText = element.querySelector('parameters')?.textContent || '{}';
      const indicatorsText = element.querySelector('indicators')?.textContent || '';
      const timeframe = element.querySelector('timeframe')?.textContent || '1h';
      const symbolsText = element.querySelector('symbols')?.textContent || '';
      const maxDrawdown = parseFloat(element.querySelector('maxDrawdown')?.textContent || '20');
      const riskPerTrade = parseFloat(element.querySelector('riskPerTrade')?.textContent || '2');
      const stopLoss = parseFloat(element.querySelector('stopLoss')?.textContent || '0');
      const takeProfit = parseFloat(element.querySelector('takeProfit')?.textContent || '0');
      const tagsText = element.querySelector('tags')?.textContent || '';
      const createdAt = element.querySelector('createdAt')?.textContent || new Date().toISOString();
      const updatedAt = element.querySelector('updatedAt')?.textContent || new Date().toISOString();

      strategies.push({
        id,
        name,
        description,
        config: JSON.parse(configText),
        parameters: JSON.parse(parametersText),
        indicators: indicatorsText ? indicatorsText.split(',') : [],
        timeframe,
        symbols: symbolsText ? symbolsText.split(',') : [],
        riskSettings: {
          maxDrawdown,
          riskPerTrade,
          stopLoss,
          takeProfit,
        },
        tags: tagsText ? tagsText.split(',') : [],
        createdAt,
        updatedAt,
      });
    });

    return {
      version,
      exportedAt,
      strategies,
      metadata: {
        totalStrategies: strategies.length,
        exportFormat: 'nextrade',
      },
    };
  }

  private static parseFromCSV(csvData: string): StrategyExport {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV data must contain at least a header and one data row');
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const strategies: ExportedStrategy[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      if (values.length !== headers.length) continue;

      const strategy: ExportedStrategy = {
        id: values[headers.indexOf('ID')] || '',
        name: values[headers.indexOf('Name')] || '',
        description: values[headers.indexOf('Description')] || undefined,
        timeframe: values[headers.indexOf('Timeframe')] || '1h',
        symbols: values[headers.indexOf('Symbols')] ? values[headers.indexOf('Symbols')].split(';') : [],
        indicators: values[headers.indexOf('Indicators')] ? values[headers.indexOf('Indicators')].split(';') : [],
        riskSettings: {
          maxDrawdown: parseFloat(values[headers.indexOf('Max Drawdown')] || '20'),
          riskPerTrade: parseFloat(values[headers.indexOf('Risk Per Trade')] || '2'),
          stopLoss: parseFloat(values[headers.indexOf('Stop Loss')] || '0'),
          takeProfit: parseFloat(values[headers.indexOf('Take Profit')] || '0'),
        },
        tags: values[headers.indexOf('Tags')] ? values[headers.indexOf('Tags')].split(';') : [],
        config: {},
        parameters: {},
        createdAt: values[headers.indexOf('Created At')] || new Date().toISOString(),
        updatedAt: values[headers.indexOf('Updated At')] || new Date().toISOString(),
      };

      strategies.push(strategy);
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      strategies,
      metadata: {
        totalStrategies: strategies.length,
        exportFormat: 'nextrade',
      },
    };
  }

  private static validateExportData(data: any): data is StrategyExport {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.version === 'string' &&
      typeof data.exportedAt === 'string' &&
      Array.isArray(data.strategies) &&
      typeof data.metadata === 'object' &&
      typeof data.metadata.totalStrategies === 'number'
    );
  }

  private static async processImport(
    exportData: StrategyExport,
    conflictResolution: ConflictResolution[]
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
      conflicts: [],
    };

    for (const strategy of exportData.strategies) {
      try {
        // Check for existing strategy with same name
        const existingStrategy = await this.findExistingStrategy(strategy.name);
        
        if (existingStrategy) {
          const resolution = conflictResolution.find(r => r.strategyId === strategy.id);
          
          if (!resolution || resolution.action === 'skip') {
            result.skipped++;
            result.conflicts.push({
              strategyName: strategy.name,
              reason: 'Strategy with same name already exists',
              existingId: existingStrategy.id,
            });
            continue;
          }

          if (resolution.action === 'overwrite') {
            await this.updateStrategy(existingStrategy.id, strategy);
            result.imported++;
            result.conflicts.push({
              strategyName: strategy.name,
              reason: 'Existing strategy overwritten',
              existingId: existingStrategy.id,
            });
            continue;
          }

          if (resolution.action === 'rename' && resolution.newName) {
            strategy.name = resolution.newName;
          }
        }

        // Create new strategy
        const newId = await this.createStrategy(strategy);
        result.imported++;
        
        if (existingStrategy) {
          result.conflicts.push({
            strategyName: strategy.name,
            reason: 'Created new strategy with different name',
            existingId: existingStrategy.id,
            newId,
          });
        }
      } catch (error) {
        result.errors.push(
          `Failed to import strategy "${strategy.name}": ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return result;
  }

  private static async findExistingStrategy(name: string): Promise<{ id: string } | null> {
    // In a real implementation, this would query the database
    // For now, return null to simulate no existing strategy
    return null;
  }

  private static async createStrategy(strategy: ExportedStrategy): Promise<string> {
    // In a real implementation, this would create the strategy in the database
    // For now, return a mock ID
    return `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async updateStrategy(id: string, strategy: ExportedStrategy): Promise<void> {
    // In a real implementation, this would update the strategy in the database
    console.log(`Updating strategy ${id} with new data`);
  }
}

// Utility functions for file handling
export class StrategyFileHandler {
  static downloadFile(content: string, filename: string, format: 'json' | 'xml' | 'csv') {
    const mimeTypes = {
      json: 'application/json',
      xml: 'application/xml',
      csv: 'text/csv',
    };

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  static async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsText(file);
    });
  }

  static detectFormat(filename: string): 'json' | 'xml' | 'csv' {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'json':
        return 'json';
      case 'xml':
        return 'xml';
      case 'csv':
        return 'csv';
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }
}

// Validation utilities
export class StrategyValidator {
  static validateExportedStrategy(strategy: ExportedStrategy): string[] {
    const errors: string[] = [];

    if (!strategy.name || strategy.name.trim().length === 0) {
      errors.push('Strategy name is required');
    }

    if (!strategy.config || typeof strategy.config !== 'object') {
      errors.push('Strategy config is required and must be an object');
    }

    if (!strategy.parameters || typeof strategy.parameters !== 'object') {
      errors.push('Strategy parameters are required and must be an object');
    }

    if (!Array.isArray(strategy.indicators)) {
      errors.push('Strategy indicators must be an array');
    }

    if (!Array.isArray(strategy.symbols) || strategy.symbols.length === 0) {
      errors.push('Strategy symbols must be a non-empty array');
    }

    if (typeof strategy.riskSettings !== 'object') {
      errors.push('Risk settings are required');
    } else {
      if (typeof strategy.riskSettings.maxDrawdown !== 'number' || 
          strategy.riskSettings.maxDrawdown < 0 || 
          strategy.riskSettings.maxDrawdown > 100) {
        errors.push('Max drawdown must be a number between 0 and 100');
      }

      if (typeof strategy.riskSettings.riskPerTrade !== 'number' || 
          strategy.riskSettings.riskPerTrade < 0 || 
          strategy.riskSettings.riskPerTrade > 100) {
        errors.push('Risk per trade must be a number between 0 and 100');
      }
    }

    return errors;
  }

  static validateImportData(data: string, format: 'json' | 'xml' | 'csv'): string[] {
    const errors: string[] = [];

    if (!data || data.trim().length === 0) {
      errors.push('Import data is empty');
      return errors;
    }

    try {
      switch (format) {
        case 'json':
          JSON.parse(data);
          break;
        case 'xml':
          const parser = new DOMParser();
          const doc = parser.parseFromString(data, 'text/xml');
          if (doc.querySelector('parsererror')) {
            errors.push('Invalid XML format');
          }
          break;
        case 'csv':
          const lines = data.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            errors.push('CSV must contain at least a header and one data row');
          }
          break;
      }
    } catch (error) {
      errors.push(`Invalid ${format.toUpperCase()} format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return errors;
  }
}