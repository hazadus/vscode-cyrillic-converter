import * as vscode from "vscode";

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private isActive: boolean = false;
  private activityTimer: NodeJS.Timeout | undefined;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = "cyrillicLatin.toggle";
    this.updateStatusBar();
  }

  setActive(active: boolean) {
    this.isActive = active;
    this.updateStatusBar();
  }

  private updateStatusBar() {
    if (this.isActive) {
      this.statusBarItem.text = "$(keyboard) Кир→Лат ВКЛ";
      this.statusBarItem.tooltip = "Автозамена кириллицы включена. Нажмите для отключения.";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.prominentBackground");
    } else {
      this.statusBarItem.text = "$(keyboard) Кир→Лат ВЫКЛ";
      this.statusBarItem.tooltip = "Автозамена кириллицы отключена. Нажмите для включения.";
      this.statusBarItem.backgroundColor = undefined;
    }
    this.statusBarItem.show();
  }

  showReplacementActivity(count: number) {
    // Очищаем предыдущий таймер, если есть
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = undefined;
    }

    const originalText = this.statusBarItem.text;
    this.statusBarItem.text = `$(sync~spin) Заменено: ${count}`;

    this.activityTimer = setTimeout(() => {
      if (this.statusBarItem) {
        this.statusBarItem.text = originalText;
      }
      this.activityTimer = undefined;
    }, 2000);
  }

  dispose() {
    // Очищаем таймер перед освобождением ресурсов
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = undefined;
    }

    this.statusBarItem.dispose();
  }
}
