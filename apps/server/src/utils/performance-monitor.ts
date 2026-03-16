import { logger } from '../config/logger';

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: unknown[];
}

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private endpointMetrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics

  /**
   * Record a database query performance metric
   */
  recordQuery(query: string, duration: number, params?: unknown[]): void {
    const metric: QueryMetrics = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      params,
    };

    this.queryMetrics.push(metric);
    if (this.queryMetrics.length > this.maxMetrics) {
      this.queryMetrics.shift();
    }

    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        query: metric.query,
        duration: `${duration}ms`,
        params,
      });
    }
  }

  /**
   * Record an API endpoint performance metric
   */
  recordEndpoint(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number
  ): void {
    const metric: PerformanceMetrics = {
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: new Date(),
    };

    this.endpointMetrics.push(metric);
    if (this.endpointMetrics.length > this.maxMetrics) {
      this.endpointMetrics.shift();
    }

    // Log slow endpoints (> 2000ms)
    if (duration > 2000) {
      logger.warn('Slow endpoint detected', {
        endpoint: `${method} ${endpoint}`,
        duration: `${duration}ms`,
        statusCode,
      });
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): {
    total: number;
    average: number;
    slowest: QueryMetrics[];
    fastest: QueryMetrics[];
  } {
    if (this.queryMetrics.length === 0) {
      return {
        total: 0,
        average: 0,
        slowest: [],
        fastest: [],
      };
    }

    const sorted = [...this.queryMetrics].sort((a, b) => b.duration - a.duration);
    const total = this.queryMetrics.reduce((sum, m) => sum + m.duration, 0);
    const average = total / this.queryMetrics.length;

    return {
      total: this.queryMetrics.length,
      average: Math.round(average),
      slowest: sorted.slice(0, 10),
      fastest: sorted.slice(-10).reverse(),
    };
  }

  /**
   * Get endpoint performance statistics
   */
  getEndpointStats(): {
    total: number;
    average: number;
    byEndpoint: Record<string, { count: number; avgDuration: number }>;
    slowest: PerformanceMetrics[];
  } {
    if (this.endpointMetrics.length === 0) {
      return {
        total: 0,
        average: 0,
        byEndpoint: {},
        slowest: [],
      };
    }

    const total = this.endpointMetrics.reduce((sum, m) => sum + m.duration, 0);
    const average = total / this.endpointMetrics.length;

    // Group by endpoint
    const byEndpoint: Record<string, { count: number; totalDuration: number }> = {};
    this.endpointMetrics.forEach((metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!byEndpoint[key]) {
        byEndpoint[key] = { count: 0, totalDuration: 0 };
      }
      byEndpoint[key].count++;
      byEndpoint[key].totalDuration += metric.duration;
    });

    // Calculate averages
    const byEndpointWithAvg: Record<string, { count: number; avgDuration: number }> = {};
    Object.entries(byEndpoint).forEach(([key, value]) => {
      byEndpointWithAvg[key] = {
        count: value.count,
        avgDuration: Math.round(value.totalDuration / value.count),
      };
    });

    const sorted = [...this.endpointMetrics].sort((a, b) => b.duration - a.duration);

    return {
      total: this.endpointMetrics.length,
      average: Math.round(average),
      byEndpoint: byEndpointWithAvg,
      slowest: sorted.slice(0, 10),
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.queryMetrics = [];
    this.endpointMetrics = [];
  }

  /**
   * Sanitize SQL query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove potential sensitive data from queries
    return query
      .replace(/\$\d+/g, '?') // Replace parameter placeholders
      .replace(/'.*?'/g, "'***'") // Replace string literals
      .substring(0, 200); // Limit length
  }
}

export const performanceMonitor = new PerformanceMonitor();
