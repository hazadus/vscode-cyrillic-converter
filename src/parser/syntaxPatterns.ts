export class SyntaxPatterns {
  private static patterns = {
    javascript: {
      strings: ['"', "'", "`"],
      comments: {
        line: "//",
        block: { start: "/*", end: "*/" },
      },
      templateLiterals: {
        start: "`",
        expression: { start: "${", end: "}" },
      },
    },
    typescript: {
      strings: ['"', "'", "`"],
      comments: {
        line: "//",
        block: { start: "/*", end: "*/" },
      },
      templateLiterals: {
        start: "`",
        expression: { start: "${", end: "}" },
      },
    },
    python: {
      strings: ['"', "'"],
      rawStrings: ['r"', "r'"],
      multilineStrings: ['"""', "'''"],
      comments: {
        line: "#",
      },
      fStrings: {
        prefix: "f",
        expressions: { start: "{", end: "}" },
      },
    },
    vue: {
      template: {
        expressions: { start: "{{", end: "}}" },
        directives: /v-[\w-]+/,
      },
      script: {
        // Наследует от JavaScript/TypeScript
      },
      style: {
        // CSS синтаксис
      },
    },
    go: {
      strings: ['"'],
      rawStrings: ["`"],
      comments: {
        line: "//",
        block: { start: "/*", end: "*/" },
      },
    },
  };

  static getPatterns(languageId: string) {
    return this.patterns[languageId as keyof typeof this.patterns] || this.patterns.javascript;
  }
}
