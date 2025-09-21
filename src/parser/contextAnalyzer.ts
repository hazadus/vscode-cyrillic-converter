import * as vscode from "vscode";

export enum ContextType {
  CODE = "code",
  COMMENT = "comment",
  STRING = "string",
  TEMPLATE_LITERAL = "template_literal",
  REGEX = "regex",
}

export interface ContextInfo {
  type: ContextType;
  range: vscode.Range;
  isInlineComment?: boolean;
  stringType?: "single" | "double" | "backtick" | "raw";
}

export class ContextAnalyzer {
  private languageParser: LanguageParser;

  constructor() {
    this.languageParser = new LanguageParser();
  }

  async analyzePosition(document: vscode.TextDocument, position: vscode.Position): Promise<ContextInfo> {
    const languageId = document.languageId;
    const line = document.lineAt(position.line);
    const lineText = line.text;
    const characterIndex = position.character;

    // Получаем информацию о синтаксисе от VS Code
    const tokens = await this.getSemanticTokens(document, position);

    // Анализируем локальный контекст
    const localContext = this.analyzeLocalContext(lineText, characterIndex, languageId);

    // Проверяем многострочные конструкции
    const multilineContext = await this.analyzeMultilineContext(document, position, languageId);

    return multilineContext || localContext;
  }

  private analyzeLocalContext(lineText: string, charIndex: number, languageId: string): ContextInfo {
    // Проверяем, находимся ли в строке
    const stringContext = this.findStringContext(lineText, charIndex);
    if (stringContext) {
      return stringContext;
    }

    // Проверяем комментарии
    const commentContext = this.findCommentContext(lineText, charIndex, languageId);
    if (commentContext) {
      return commentContext;
    }

    // По умолчанию - код
    return {
      type: ContextType.CODE,
      range: new vscode.Range(new vscode.Position(0, charIndex), new vscode.Position(0, charIndex + 1)),
    };
  }

  private findStringContext(lineText: string, charIndex: number): ContextInfo | null {
    const quotes = ['"', "'", "`"];

    for (const quote of quotes) {
      let inString = false;
      let stringStart = -1;
      let escaped = false;

      for (let i = 0; i < lineText.length; i++) {
        const char = lineText[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === quote) {
          if (!inString) {
            inString = true;
            stringStart = i;
          } else {
            // Конец строки
            if (charIndex > stringStart && charIndex <= i) {
              return {
                type: quote === "`" ? ContextType.TEMPLATE_LITERAL : ContextType.STRING,
                range: new vscode.Range(new vscode.Position(0, stringStart), new vscode.Position(0, i + 1)),
                stringType: quote === '"' ? "double" : quote === "'" ? "single" : "backtick",
              };
            }
            inString = false;
          }
        }
      }

      // Проверяем незакрытую строку
      if (inString && charIndex > stringStart) {
        return {
          type: quote === "`" ? ContextType.TEMPLATE_LITERAL : ContextType.STRING,
          range: new vscode.Range(
            new vscode.Position(0, stringStart),
            new vscode.Position(0, lineText.length),
          ),
          stringType: quote === '"' ? "double" : quote === "'" ? "single" : "backtick",
        };
      }
    }

    return null;
  }

  private findCommentContext(lineText: string, charIndex: number, languageId: string): ContextInfo | null {
    const commentPatterns = this.getCommentPatterns(languageId);

    // Проверяем однострочные комментарии
    if (commentPatterns.lineComment) {
      const commentIndex = lineText.indexOf(commentPatterns.lineComment);
      if (commentIndex !== -1 && charIndex >= commentIndex) {
        const isInlineComment = this.isInlineComment(lineText, commentIndex);

        return {
          type: ContextType.COMMENT,
          range: new vscode.Range(
            new vscode.Position(0, commentIndex),
            new vscode.Position(0, lineText.length),
          ),
          isInlineComment,
        };
      }
    }

    return null;
  }

  private isInlineComment(lineText: string, commentIndex: number): boolean {
    const codeBeforeComment = lineText.substring(0, commentIndex).trim();
    return codeBeforeComment.length > 0;
  }

  private async analyzeMultilineContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    languageId: string,
  ): Promise<ContextInfo | null> {
    const commentPatterns = this.getCommentPatterns(languageId);

    if (!commentPatterns.blockComment) {
      return null;
    }

    const { start: blockStart, end: blockEnd } = commentPatterns.blockComment;

    // Ищем многострочные комментарии
    const textBefore = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    const textAfter = document.getText(
      new vscode.Range(position, new vscode.Position(document.lineCount, 0)),
    );

    const lastBlockStart = textBefore.lastIndexOf(blockStart);
    const lastBlockEnd = textBefore.lastIndexOf(blockEnd);
    const nextBlockEnd = textAfter.indexOf(blockEnd);

    if (lastBlockStart > lastBlockEnd && nextBlockEnd !== -1) {
      return {
        type: ContextType.COMMENT,
        range: new vscode.Range(
          document.positionAt(lastBlockStart),
          document.positionAt(document.offsetAt(position) + nextBlockEnd + blockEnd.length),
        ),
      };
    }

    return null;
  }

  private getCommentPatterns(languageId: string): {
    lineComment?: string;
    blockComment?: { start: string; end: string };
  } {
    const patterns = {
      javascript: { lineComment: "//", blockComment: { start: "/*", end: "*/" } },
      typescript: { lineComment: "//", blockComment: { start: "/*", end: "*/" } },
      vue: { lineComment: "//", blockComment: { start: "/*", end: "*/" } },
      python: { lineComment: "#", blockComment: { start: '"""', end: '"""' } },
      go: { lineComment: "//", blockComment: { start: "/*", end: "*/" } },
    };

    return patterns[languageId as keyof typeof patterns] || patterns.javascript;
  }

  private async getSemanticTokens(document: vscode.TextDocument, position: vscode.Position): Promise<any> {
    try {
      // Используем VS Code API для получения семантических токенов
      const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens",
        document.uri,
      );
      return tokens;
    } catch (error) {
      return null;
    }
  }
}

class LanguageParser {
  getSupportedLanguages(): string[] {
    return ["javascript", "typescript", "vue", "python", "go"];
  }

  isSupported(languageId: string): boolean {
    return this.getSupportedLanguages().includes(languageId);
  }
}
