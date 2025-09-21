import * as vscode from "vscode";

export class DecorationManager {
  private replacedTextDecorationType!: vscode.TextEditorDecorationType;
  private replacedTextWithCheckmarkDecorationType!: vscode.TextEditorDecorationType;
  private processingDecorationType!: vscode.TextEditorDecorationType;
  private inlineCommentDecorationType!: vscode.TextEditorDecorationType;

  constructor() {
    this.initializeDecorationTypes();
  }

  private initializeDecorationTypes() {
    // Декорация без галочки для обычных замененных символов
    this.replacedTextDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(144, 238, 144, 0.3)",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "rgba(144, 238, 144, 0.6)",
      borderRadius: "2px",
      overviewRulerColor: "rgba(144, 238, 144, 0.8)",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    // Декорация с галочкой для последнего символа в группе
    this.replacedTextWithCheckmarkDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(144, 238, 144, 0.3)",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "rgba(144, 238, 144, 0.6)",
      borderRadius: "2px",
      after: {
        contentText: " ✓",
        color: "rgba(0, 128, 0, 0.8)",
        fontWeight: "bold",
      },
      overviewRulerColor: "rgba(144, 238, 144, 0.8)",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    this.processingDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 255, 0, 0.2)",
      borderWidth: "1px",
      borderStyle: "dashed",
      borderColor: "rgba(255, 255, 0, 0.6)",
      after: {
        contentText: " ⏳",
        color: "rgba(255, 165, 0, 0.8)",
      },
    });

    this.inlineCommentDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 192, 203, 0.2)",
      borderWidth: "1px",
      borderStyle: "dotted",
      borderColor: "rgba(255, 192, 203, 0.6)",
      after: {
        contentText: " // пропущен",
        color: "rgba(128, 128, 128, 0.8)",
        fontStyle: "italic",
      },
    });
  }

  highlightReplacements(
    editor: vscode.TextEditor,
    replacements: Array<{
      range: vscode.Range;
      originalText: string;
      newText: string;
    }>,
  ) {
    if (replacements.length === 0) {
      return;
    }

    // Группируем замены по непрерывным последовательностям
    const groups = this.groupConsecutiveReplacements(replacements);
    console.log(`Grouped ${replacements.length} replacements into ${groups.length} groups`);

    const regularDecorations: vscode.DecorationOptions[] = [];
    const checkmarkDecorations: vscode.DecorationOptions[] = [];

    for (const group of groups) {
      const allTextsOriginal = group.map((r) => r.originalText).join("");
      const allTextsNew = group.map((r) => r.newText).join("");

      // Все символы в группе получают обычную декорацию
      for (let i = 0; i < group.length; i++) {
        const replacement = group[i];
        const isLast = i === group.length - 1;

        const decorationOption: vscode.DecorationOptions = {
          range: replacement.range,
          hoverMessage: new vscode.MarkdownString(
            `**Группа замен:** \`${allTextsOriginal}\` → \`${allTextsNew}\``,
          ),
        };

        if (isLast) {
          // Последний символ в группе получает галочку
          checkmarkDecorations.push(decorationOption);
        } else {
          // Остальные символы - без галочки
          regularDecorations.push(decorationOption);
        }
      }
    }

    // Применяем декорации
    editor.setDecorations(this.replacedTextDecorationType, regularDecorations);
    editor.setDecorations(this.replacedTextWithCheckmarkDecorationType, checkmarkDecorations);

    // Автоматически убираем подсветку через 3 секунды
    setTimeout(() => {
      editor.setDecorations(this.replacedTextDecorationType, []);
      editor.setDecorations(this.replacedTextWithCheckmarkDecorationType, []);
    }, 3000);
  }

  private groupConsecutiveReplacements(
    replacements: Array<{
      range: vscode.Range;
      originalText: string;
      newText: string;
    }>,
  ): Array<
    Array<{
      range: vscode.Range;
      originalText: string;
      newText: string;
    }>
  > {
    if (replacements.length === 0) {
      return [];
    }

    // Сортируем замены по позиции
    const sorted = [...replacements].sort((a, b) => {
      const lineDiff = a.range.start.line - b.range.start.line;
      if (lineDiff !== 0) {
        return lineDiff;
      }
      return a.range.start.character - b.range.start.character;
    });

    const groups: Array<Array<(typeof sorted)[0]>> = [];
    let currentGroup: Array<(typeof sorted)[0]> = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];

      // Проверяем, является ли текущая замена соседней с предыдущей
      const isConsecutive =
        current.range.start.line === previous.range.start.line &&
        current.range.start.character === previous.range.end.character;

      if (isConsecutive) {
        currentGroup.push(current);
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }

    groups.push(currentGroup);
    return groups;
  }

  showProcessing(editor: vscode.TextEditor, ranges: vscode.Range[]) {
    const decorationOptions: vscode.DecorationOptions[] = ranges.map((range) => ({
      range,
      hoverMessage: "Обрабатывается замена кириллицы...",
    }));

    editor.setDecorations(this.processingDecorationType, decorationOptions);
  }

  hideProcessing(editor: vscode.TextEditor) {
    editor.setDecorations(this.processingDecorationType, []);
  }

  highlightSkippedInlineComments(editor: vscode.TextEditor, ranges: vscode.Range[]) {
    const decorationOptions: vscode.DecorationOptions[] = ranges.map((range) => ({
      range,
      hoverMessage: "Инлайн комментарий пропущен согласно настройкам",
    }));

    editor.setDecorations(this.inlineCommentDecorationType, decorationOptions);

    setTimeout(() => {
      editor.setDecorations(this.inlineCommentDecorationType, []);
    }, 5000);
  }

  dispose() {
    this.replacedTextDecorationType.dispose();
    this.replacedTextWithCheckmarkDecorationType.dispose();
    this.processingDecorationType.dispose();
    this.inlineCommentDecorationType.dispose();
  }
}
