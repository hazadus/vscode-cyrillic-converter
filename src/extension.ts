import * as vscode from "vscode";
import { ReplacementEngine } from "./replacement/replacementEngine";
import { DecorationManager } from "./ui/decorations";
import { NotificationManager } from "./ui/notifications";
import { StatusBarManager } from "./ui/statusBar";
import { PerformanceManager } from "./utils/performance";

export class CyrillicLatinExtension {
  private replacementEngine!: ReplacementEngine;
  private statusBarManager!: StatusBarManager;
  private decorationManager!: DecorationManager;
  private notificationManager!: NotificationManager;
  private performanceManager!: PerformanceManager;
  private disposables: vscode.Disposable[] = [];
  private isActive: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    this.initialize();
  }

  private initialize() {
    // Инициализируем компоненты
    this.replacementEngine = new ReplacementEngine();
    this.statusBarManager = new StatusBarManager();
    this.decorationManager = new DecorationManager();
    this.notificationManager = new NotificationManager();
    this.performanceManager = new PerformanceManager();

    // Загружаем конфигурацию
    this.loadConfiguration();

    // Регистрируем команды
    this.registerCommands();

    // Регистрируем обработчики событий
    this.registerEventHandlers();

    // Показываем приветствие для новых пользователей
    this.showWelcomeIfNeeded();

    console.log("Cyrillic → Latin Converter активирован");
  }

  private loadConfiguration() {
    const config = vscode.workspace.getConfiguration("cyrillicLatin");
    this.isActive = config.get<boolean>("enabled", true);
    this.statusBarManager.setActive(this.isActive);
  }

  private registerCommands() {
    // Команда переключения активности
    const toggleCommand = vscode.commands.registerCommand("cyrillicLatin.toggle", () => this.toggle());

    // Команда ручной замены выделения
    const convertSelectionCommand = vscode.commands.registerCommand("cyrillicLatin.convertSelection", () =>
      this.convertSelection(),
    );

    // Команда показа статистики
    const showStatsCommand = vscode.commands.registerCommand("cyrillicLatin.showStats", () =>
      this.showPerformanceStats(),
    );

    // Команда открытия настроек
    const openSettingsCommand = vscode.commands.registerCommand("cyrillicLatin.openSettings", () =>
      vscode.commands.executeCommand("workbench.action.openSettings", "cyrillicLatin"),
    );

    this.disposables.push(toggleCommand, convertSelectionCommand, showStatsCommand, openSettingsCommand);
  }

  private registerEventHandlers() {
    // Обработчик изменения текста
    const textChangeHandler = vscode.workspace.onDidChangeTextDocument((event) =>
      this.handleTextChange(event),
    );

    // Обработчик изменения активного редактора
    const activeEditorHandler = vscode.window.onDidChangeActiveTextEditor((editor) =>
      this.handleActiveEditorChange(editor),
    );

    // Обработчик изменения конфигурации
    const configChangeHandler = vscode.workspace.onDidChangeConfiguration((event) =>
      this.handleConfigurationChange(event),
    );

    this.disposables.push(textChangeHandler, activeEditorHandler, configChangeHandler);
  }

  private async handleTextChange(event: vscode.TextDocumentChangeEvent) {
    if (!this.isActive) return;

    try {
      const result = await this.performanceManager.measureAsync("textReplacement", () =>
        this.replacementEngine.processTextChange(event.document, [...event.contentChanges]),
      );

      if (result && result.totalReplacements > 0) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
          // Показываем визуальный фидбек
          this.decorationManager.highlightReplacements(editor, result.replacements);
          this.statusBarManager.showReplacementActivity(result.totalReplacements);

          // Показываем уведомление
          this.notificationManager.showReplacementComplete(
            result.totalReplacements,
            event.document.languageId,
          );
        }
      }
    } catch (error) {
      console.error("Ошибка при замене текста:", error);
      this.notificationManager.showError(
        "Не удалось выполнить замену",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private handleActiveEditorChange(editor: vscode.TextEditor | undefined) {
    if (!editor) return;

    // Проверяем поддержку языка
    const isSupported = this.isSupportedLanguage(editor.document.languageId);
    if (!isSupported && this.isActive) {
      this.notificationManager.showLanguageNotSupported(editor.document.languageId);
    }
  }

  private handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
    if (event.affectsConfiguration("cyrillicLatin")) {
      this.loadConfiguration();
      console.log("Конфигурация обновлена");
    }
  }

  private toggle() {
    this.isActive = !this.isActive;
    this.statusBarManager.setActive(this.isActive);
    this.notificationManager.showToggleStatus(this.isActive);

    // Сохраняем состояние
    vscode.workspace
      .getConfiguration("cyrillicLatin")
      .update("enabled", this.isActive, vscode.ConfigurationTarget.Global);
  }

  private async convertSelection() {
    try {
      await this.replacementEngine.convertSelection();
    } catch (error) {
      this.notificationManager.showError(
        "Не удалось преобразовать выделение",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private showPerformanceStats() {
    const metrics = this.performanceManager.getMetrics();

    const statsMessage = Object.entries(metrics)
      .map(
        ([operation, stats]) =>
          `${operation}: среднее ${stats.avg.toFixed(2)}мс, максимум ${stats.max.toFixed(2)}мс (выполнений: ${
            stats.count
          })`,
      )
      .join("\n");

    vscode.window.showInformationMessage("Статистика производительности", {
      modal: true,
      detail: statsMessage,
    });
  }

  private showWelcomeIfNeeded() {
    const config = vscode.workspace.getConfiguration("cyrillicLatin");
    const showWelcome = config.get<boolean>("showWelcome", true);

    if (showWelcome) {
      this.notificationManager.showFirstTimeWelcome();
    }
  }

  private isSupportedLanguage(languageId: string): boolean {
    const supportedLanguages = ["javascript", "typescript", "vue", "python", "go"];
    return supportedLanguages.includes(languageId);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.statusBarManager.dispose();
    this.decorationManager.dispose();
  }
}

// Функции активации и деактивации расширения
let extension: CyrillicLatinExtension | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("Активация Cyrillic → Latin Converter");
  extension = new CyrillicLatinExtension(context);
}

export function deactivate() {
  console.log("Деактивация Cyrillic → Latin Converter");
  extension?.dispose();
  extension = undefined;
}
