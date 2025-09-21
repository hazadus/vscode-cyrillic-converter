export class PerformanceManager {
  private metrics = new Map<string, number[]>();
  private readonly maxMetricCount = 100;

  measureAsync<T>(operation: string, task: () => Promise<T>): Promise<T> {
    const start = performance.now();

    return task().finally(() => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
    });
  }

  measure<T>(operation: string, task: () => T): T {
    const start = performance.now();

    try {
      return task();
    } finally {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
    }
  }

  private recordMetric(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const metrics = this.metrics.get(operation)!;
    metrics.push(duration);

    // Ограничиваем количество метрик
    if (metrics.length > this.maxMetricCount) {
      metrics.shift();
    }

    // Логируем медленные операции
    if (duration > 100) {
      console.warn(`Slow operation: ${operation} took ${duration.toFixed(2)}ms`);
    }
  }

  getAverageTime(operation: string): number {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) {return 0;}

    return metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
  }

  getMetrics(): Record<string, { avg: number; count: number; max: number }> {
    const result: Record<string, { avg: number; count: number; max: number }> = {};

    for (const [operation, metrics] of this.metrics.entries()) {
      result[operation] = {
        avg: this.getAverageTime(operation),
        count: metrics.length,
        max: Math.max(...metrics),
      };
    }

    return result;
  }
}
