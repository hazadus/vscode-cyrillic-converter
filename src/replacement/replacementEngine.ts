import * as vscode from "vscode";
import { MappingTable } from "./mappingTable";
import { ContextAnalyzer, ContextType } from "../parser/contextAnalyzer";
import { PerformanceManager } from "../utils/performance";
import { DebounceManager } from "../utils/debounce";
import { KeyboardLayoutSwitcher } from "../system/keyboardLayoutSwitcher";

export interface ReplacementResult {
  replacements: Array<{
    range: vscode.Range;
    originalText: string;
    newText: string;
  }>;
  totalReplacements: number;
}

export class ReplacementEngine {
  private mappingTable: MappingTable;
  private contextAnalyzer: ContextAnalyzer;
  private performanceManager: PerformanceManager;
  private debounceManager: DebounceManager;
  private keyboardLayoutSwitcher: KeyboardLayoutSwitcher;
  private processingDocuments = new Set<string>();
  private keyboardSwitchErrorCount = 0;
  private lastErrorTime = 0;
  private readonly MAX_ERRORS = 3;
  private readonly ERROR_RESET_TIME = 60000; // 1 минута

  constructor() {
    this.mappingTable = MappingTable.getInstance();
    this.contextAnalyzer = new ContextAnalyzer();
    this.performanceManager = new PerformanceManager();
    this.debounceManager = new DebounceManager();
    this.keyboardLayoutSwitcher = KeyboardLayoutSwitcher.getInstance();
    this.loadConfiguration();
  }

  async processTextChange(
    document: vscode.TextDocument,
    changes: vscode.TextDocumentContentChangeEvent[],
  ): Promise<ReplacementResult | null> {
    const uri = document.uri.toString();
    console.log(
      `Processing text change in ${document.languageId} document:`,
      changes.map((c) => c.text),
    );

    // Предотвращаем циклические обновления
    if (this.processingDocuments.has(uri)) {
      return null;
    }

    // Проверяем конфигурацию для языка
    const languageEnabled = this.isLanguageEnabled(document.languageId);
    console.log(`Language ${document.languageId} enabled: ${languageEnabled}`);
    if (!languageEnabled) {
      return null;
    }

    const config = vscode.workspace.getConfiguration("cyrillicLatin");
    const triggerLength = config.get<number>("triggerLength", 1);

    // Фильтруем изменения, которые могут содержать кириллицу
    const relevantChanges = changes.filter((change) => {
      // Проверяем либо введенный текст, либо существующий текст в строке после изменения
      const hasMinLength = change.text.length >= triggerLength;
      const hasCyrillicInChange = this.mappingTable.hasCyrillicCharacters(change.text);

      // Также проверяем, есть ли кириллица в строке, где происходит изменение
      const lineNumber = change.range.start.line;
      const line = document.lineAt(lineNumber);
      const hasCyrillicInLine = this.mappingTable.hasCyrillicCharacters(line.text);

      console.log(
        `Change analysis: text="${change.text}", length=${change.text.length}, triggerLength=${triggerLength}, hasMinLength=${hasMinLength}, hasCyrillicInChange=${hasCyrillicInChange}, hasCyrillicInLine=${hasCyrillicInLine}`,
      );

      return hasMinLength && (hasCyrillicInChange || hasCyrillicInLine);
    });

    if (relevantChanges.length === 0) {
      console.log("No relevant changes found");
      return null;
    }

    console.log(`Found ${relevantChanges.length} relevant changes`);

    // Используем debouncing
    return this.debounceManager.debounce(
      `replacement-${uri}`,
      () => this.performReplacement(document, relevantChanges),
      config.get<number>("debounceDelay", 300),
    );
  }

  private async performReplacement(
    document: vscode.TextDocument,
    changes: vscode.TextDocumentContentChangeEvent[],
  ): Promise<ReplacementResult> {
    const uri = document.uri.toString();
    this.processingDocuments.add(uri);

    try {
      const allReplacements = [];

      for (const change of changes) {
        const rangeReplacements = await this.processChange(document, change);
        allReplacements.push(...rangeReplacements);
      }

      // Дедупликация замен - убираем дублирующиеся позиции
      const uniqueReplacements = [];
      const seenPositions = new Set<string>();

      for (const replacement of allReplacements) {
        const positionKey = `${replacement.range.start.line}:${replacement.range.start.character}`;
        if (!seenPositions.has(positionKey)) {
          seenPositions.add(positionKey);
          uniqueReplacements.push(replacement);
        }
      }

      console.log(`Found ${allReplacements.length} total replacements, ${uniqueReplacements.length} unique`);

      if (uniqueReplacements.length > 0) {
        await this.applyReplacements(document, uniqueReplacements);

        // Переключаем раскладку клавиатуры если включена настройка
        const config = vscode.workspace.getConfiguration("cyrillicLatin");
        const shouldSwitchLayout = config.get<boolean>("switchKeyboardLayout", false);

        if (shouldSwitchLayout) {
          try {
            await this.handleKeyboardLayoutSwitch();
          } catch (error) {
            console.error("Ошибка при переключении раскладки:", error);
          }
        }
      }

      return {
        replacements: uniqueReplacements,
        totalReplacements: uniqueReplacements.length,
      };
    } finally {
      this.processingDocuments.delete(uri);
    }
  }

  private async processChange(document: vscode.TextDocument, change: vscode.TextDocumentContentChangeEvent) {
    const replacements = [];
    const lineNumber = change.range.start.line;
    const line = document.lineAt(lineNumber);
    const lineText = line.text;

    console.log(`Processing line ${lineNumber}: "${lineText}"`);

    // Ищем все кириллические символы в строке
    for (let i = 0; i < lineText.length; i++) {
      const char = lineText[i];
      if (this.mappingTable.isCyrillic(char)) {
        const position = new vscode.Position(lineNumber, i);

        const context = await this.contextAnalyzer.analyzePosition(document, position);
        const shouldReplace = this.shouldReplace(context);
        console.log(
          `Position analysis for '${char}' at ${i}: context=${context.type}, shouldReplace=${shouldReplace}`,
        );

        if (shouldReplace) {
          const replacement = this.mappingTable.cyrillicToLatin(char);
          const range = new vscode.Range(
            position,
            new vscode.Position(position.line, position.character + 1),
          );

          replacements.push({
            range,
            originalText: char,
            newText: replacement,
          });
        }
      }
    }

    return replacements;
  }

  private shouldReplace(context: any): boolean {
    const config = vscode.workspace.getConfiguration("cyrillicLatin");

    switch (context.type) {
      case ContextType.CODE:
        return true;

      case ContextType.COMMENT:
        const replaceInComments = config.get<boolean>("replaceInComments", false);
        console.log(
          `Comment context: isInlineComment=${context.isInlineComment}, replaceInComments=${replaceInComments}`,
        );

        // Для инлайн комментариев проверяем настройки
        if (context.isInlineComment) {
          return replaceInComments;
        }
        return replaceInComments;

      case ContextType.STRING:
      case ContextType.TEMPLATE_LITERAL:
        const replaceInStrings = config.get<boolean>("replaceInStrings", false);
        console.log(`String context: type=${context.type}, replaceInStrings=${replaceInStrings}`);
        return replaceInStrings;

      default:
        return false;
    }
  }

  private async applyReplacements(
    document: vscode.TextDocument,
    replacements: Array<{
      range: vscode.Range;
      originalText: string;
      newText: string;
    }>,
  ) {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === document.uri.toString(),
    );

    if (!editor) {return;}

    await editor.edit((editBuilder) => {
      // Применяем замены в обратном порядке для сохранения позиций
      const sortedReplacements = replacements.sort((a, b) => b.range.start.compareTo(a.range.start));

      for (const replacement of sortedReplacements) {
        editBuilder.replace(replacement.range, replacement.newText);
      }
    });
  }

  private isLanguageEnabled(languageId: string): boolean {
    const config = vscode.workspace.getConfiguration("cyrillicLatin");
    const languages = config.get<Record<string, boolean>>("languages", {});
    return languages[languageId] === true;
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration("cyrillicLatin");
    const switchEnabled = config.get<boolean>("switchKeyboardLayout", false);
    const targetLayout = config.get<string>("targetKeyboardLayout", "com.apple.keylayout.US");

    this.keyboardLayoutSwitcher.setEnabled(switchEnabled);
    this.keyboardLayoutSwitcher.setTargetLayout(targetLayout);
  }

  public updateConfiguration(): void {
    this.loadConfiguration();
  }

  public resetKeyboardLayoutErrors(): void {
    this.keyboardSwitchErrorCount = 0;
    this.lastErrorTime = 0;
    console.log("Счетчик ошибок переключения раскладки сброшен");
  }

  private async handleKeyboardLayoutSwitch(): Promise<void> {
    // Проверяем, не превышен ли лимит ошибок
    const now = Date.now();
    if (now - this.lastErrorTime > this.ERROR_RESET_TIME) {
      this.keyboardSwitchErrorCount = 0;
    }

    if (this.keyboardSwitchErrorCount >= this.MAX_ERRORS) {
      console.log("Переключение раскладки временно отключено из-за частых ошибок");
      return;
    }

    const config = vscode.workspace.getConfiguration("cyrillicLatin");
    const targetLayoutId = config.get<string>("targetKeyboardLayout", "com.apple.keylayout.US");

    // Проверяем права доступности (только для macOS)
    if (process.platform === "darwin") {
      const hasAccessibility = await this.keyboardLayoutSwitcher.isAccessibilityEnabled();
      if (!hasAccessibility) {
        // Импортируем NotificationManager для показа уведомления о правах
        const { NotificationManager } = await import("../ui/notifications");
        const notificationManager = new NotificationManager();
        notificationManager.showAccessibilityPermissionRequired();
        return;
      }
    }

    try {
      const success = await this.keyboardLayoutSwitcher.switchToLatinLayout();
      console.log(`Попытка переключения раскладки: ${success ? "успешно" : "неудачно"}`);

      if (success) {
        // Сбрасываем счетчик ошибок при успешном переключении
        this.keyboardSwitchErrorCount = 0;

        // Показываем уведомление только если включены уведомления
        const showNotifications = config.get<boolean>("showNotifications", false);
        if (showNotifications) {
          const currentLayout = await this.keyboardLayoutSwitcher.getCurrentLayout();
          const layoutName = currentLayout?.name || this.getLayoutNameFromId(targetLayoutId);

          const { NotificationManager } = await import("../ui/notifications");
          const notificationManager = new NotificationManager();
          notificationManager.showKeyboardLayoutSwitched(true, layoutName);
        }
      } else {
        this.keyboardSwitchErrorCount++;
        this.lastErrorTime = now;

        if (this.keyboardSwitchErrorCount >= this.MAX_ERRORS) {
          const { NotificationManager } = await import("../ui/notifications");
          const notificationManager = new NotificationManager();
          notificationManager.showKeyboardLayoutError(
            `Переключение раскладки временно отключено после ${this.MAX_ERRORS} неудачных попыток. Проверьте настройки.`
          );
        }
      }
    } catch (error) {
      this.keyboardSwitchErrorCount++;
      this.lastErrorTime = now;

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Ошибка при переключении раскладки:", errorMessage);

      // Показываем уведомление об ошибке только при первых нескольких ошибках
      if (this.keyboardSwitchErrorCount <= 2) {
        const { NotificationManager } = await import("../ui/notifications");
        const notificationManager = new NotificationManager();
        notificationManager.showKeyboardLayoutError(errorMessage);
      } else if (this.keyboardSwitchErrorCount >= this.MAX_ERRORS) {
        const { NotificationManager } = await import("../ui/notifications");
        const notificationManager = new NotificationManager();
        notificationManager.showKeyboardLayoutError(
          `Переключение раскладки отключено после ${this.MAX_ERRORS} ошибок. Проверьте настройки или отключите функцию.`
        );
      }
    }
  }

  private getLayoutNameFromId(layoutId: string): string {
    const idToNameMap: Record<string, string> = {
      "com.apple.keylayout.US": "U.S.",
      "com.apple.keylayout.ABC": "ABC",
      "com.apple.keylayout.Russian": "Russian",
      "com.apple.keylayout.RussianWin": "Russian - Phonetic",
      "com.apple.keylayout.Ukrainian-PC": "Ukrainian",
      "com.apple.keylayout.Belarusian": "Belarusian",
    };

    return idToNameMap[layoutId] || layoutId.replace("com.apple.keylayout.", "");
  }

  // Метод для ручной замены выделенного текста
  async convertSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {return;}

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    if (!text || !this.mappingTable.hasCyrillicCharacters(text)) {
      vscode.window.showInformationMessage("Нет кириллических символов для замены");
      return;
    }

    const convertedText = this.mappingTable.convertText(text, "cyrillic-to-latin");

    await editor.edit((editBuilder) => {
      editBuilder.replace(selection, convertedText);
    });

    vscode.window.showInformationMessage(`Заменено ${text.length} символов`);
  }
}
