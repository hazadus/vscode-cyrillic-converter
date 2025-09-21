export class DebounceManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  debounce<T>(key: string, callback: () => Promise<T> | T, delay: number): Promise<T> {
    return new Promise((resolve, reject) => {
      // Очищаем предыдущий таймер
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Устанавливаем новый таймер
      const timer = setTimeout(async () => {
        this.timers.delete(key);

        try {
          const result = await callback();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);

      this.timers.set(key, timer);
    });
  }

  cancel(key: string) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  cancelAll() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
