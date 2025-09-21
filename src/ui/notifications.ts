import * as vscode from "vscode";

export class NotificationManager {
  private config = vscode.workspace.getConfiguration("cyrillicLatin");

  showReplacementComplete(count: number, language: string) {
    if (!this.config.get<boolean>("showNotifications", true)) {
      return;
    }

    if (count > 0) {
      const message = `Заменено ${count} символ${this.pluralize(count)} в ${language} коде`;

      vscode.window.showInformationMessage(message, "Настройки").then((selection) => {
        if (selection === "Настройки") {
          vscode.commands.executeCommand("workbench.action.openSettings", "cyrillicLatin");
        }
      });
    }
  }

  showToggleStatus(isEnabled: boolean) {
    const message = `Автозамена кириллицы ${isEnabled ? "включена" : "отключена"}`;
    vscode.window.showInformationMessage(message);
  }

  showError(error: string, details?: string) {
    const message = `Ошибка автозамены: ${error}`;

    if (details) {
      vscode.window.showErrorMessage(message, "Подробности").then((selection) => {
        if (selection === "Подробности") {
          vscode.window.showInformationMessage(details);
        }
      });
    } else {
      vscode.window.showErrorMessage(message);
    }
  }

  showLanguageNotSupported(languageId: string) {
    const message = `Язык "${languageId}" не поддерживается для автозамены`;

    vscode.window.showWarningMessage(message, "Настроить").then((selection) => {
      if (selection === "Настроить") {
        vscode.commands.executeCommand("workbench.action.openSettings", "cyrillicLatin.languages");
      }
    });
  }

  showFirstTimeWelcome() {
    const message = "Добро пожаловать в Cyrillic → Latin Converter!";
    const detail = "Расширение автоматически заменяет кириллические символы на латинские в коде.";

    vscode.window
      .showInformationMessage(message, { modal: false, detail }, "Настройки", "Не показывать снова")
      .then((selection) => {
        if (selection === "Настройки") {
          vscode.commands.executeCommand("workbench.action.openSettings", "cyrillicLatin");
        } else if (selection === "Не показывать снова") {
          // Сохраняем настройку
          vscode.workspace
            .getConfiguration("cyrillicLatin")
            .update("showWelcome", false, vscode.ConfigurationTarget.Global);
        }
      });
  }

  showKeyboardLayoutSwitched(success: boolean, layoutName?: string) {
    if (!this.config.get<boolean>("showNotifications", true)) {
      return;
    }

    if (success && layoutName) {
      vscode.window.showInformationMessage(`Раскладка переключена на ${layoutName}`);
    } else if (!success) {
      vscode.window.showWarningMessage("Не удалось переключить раскладку клавиатуры", "Настройки").then((selection) => {
        if (selection === "Настройки") {
          vscode.commands.executeCommand("workbench.action.openSettings", "cyrillicLatin.switchKeyboardLayout");
        }
      });
    }
  }

  showKeyboardLayoutError(error: string) {
    const message = "Ошибка переключения раскладки";
    vscode.window.showErrorMessage(message, "Подробности", "Настройки").then((selection) => {
      if (selection === "Подробности") {
        vscode.window.showInformationMessage(error);
      } else if (selection === "Настройки") {
        vscode.commands.executeCommand("workbench.action.openSettings", "cyrillicLatin.switchKeyboardLayout");
      }
    });
  }

  showAccessibilityPermissionRequired() {
    const message = "Для переключения раскладки требуются права доступности";
    const detail = "Перейдите в Системные настройки > Безопасность и конфиденциальность > Конфиденциальность > Универсальный доступ и добавьте VS Code в список разрешенных приложений.";

    vscode.window.showWarningMessage(message, { modal: true, detail }, "Системные настройки", "Отключить функцию").then((selection) => {
      if (selection === "Системные настройки") {
        vscode.env.openExternal(vscode.Uri.parse("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"));
      } else if (selection === "Отключить функцию") {
        vscode.workspace
          .getConfiguration("cyrillicLatin")
          .update("switchKeyboardLayout", false, vscode.ConfigurationTarget.Global);
      }
    });
  }

  private pluralize(count: number): string {
    if (count % 10 === 1 && count % 100 !== 11) {
      return "";
    } else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
      return "а";
    } else {
      return "ов";
    }
  }
}
