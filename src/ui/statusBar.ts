import * as vscode from "vscode";

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private isActive: boolean = false;

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
    const originalText = this.statusBarItem.text;
    this.statusBarItem.text = `$(sync~spin) Заменено: ${count}`;

    setTimeout(() => {
      this.statusBarItem.text = originalText;
    }, 2000);
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}
