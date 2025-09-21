export interface CharacterMapping {
  cyrillic: string;
  latin: string;
  isLowerCase: boolean;
}

export const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  // Строчные буквы
  а: "f",
  б: ",",
  в: "d",
  г: "u",
  д: "l",
  е: "t",
  ё: "\\",
  ж: ";",
  з: "p",
  и: "b",
  й: "q",
  к: "r",
  л: "k",
  м: "v",
  н: "y",
  о: "j",
  п: "g",
  р: "h",
  с: "c",
  т: "n",
  у: "e",
  ф: "a",
  х: "[",
  ц: "w",
  ч: "x",
  ш: "i",
  щ: "o",
  ъ: "]",
  ы: "s",
  ь: "m",
  э: "'",
  ю: ".",
  я: "z",

  // Заглавные буквы
  А: "F",
  Б: "<",
  В: "D",
  Г: "U",
  Д: "L",
  Е: "T",
  Ё: "|",
  Ж: ":",
  З: "P",
  И: "B",
  Й: "Q",
  К: "R",
  Л: "K",
  М: "V",
  Н: "Y",
  О: "J",
  П: "G",
  Р: "H",
  С: "C",
  Т: "N",
  У: "E",
  Ф: "A",
  Х: "{",
  Ц: "W",
  Ч: "X",
  Ш: "I",
  Щ: "O",
  Ъ: "}",
  Ы: "S",
  Ь: "M",
  Э: '"',
  Ю: ">",
  Я: "Z",
};

export const LATIN_TO_CYRILLIC_MAP = Object.fromEntries(
  Object.entries(CYRILLIC_TO_LATIN_MAP).map(([cyr, lat]) => [lat, cyr]),
);

export class MappingTable {
  private static instance: MappingTable;
  private mappings: Map<string, string>;
  private reverseMappings: Map<string, string>;

  private constructor() {
    this.mappings = new Map(Object.entries(CYRILLIC_TO_LATIN_MAP));
    this.reverseMappings = new Map(Object.entries(LATIN_TO_CYRILLIC_MAP));
  }

  static getInstance(): MappingTable {
    if (!MappingTable.instance) {
      MappingTable.instance = new MappingTable();
    }
    return MappingTable.instance;
  }

  cyrillicToLatin(char: string): string {
    return this.mappings.get(char) || char;
  }

  latinToCyrillic(char: string): string {
    return this.reverseMappings.get(char) || char;
  }

  isCyrillic(char: string): boolean {
    return this.mappings.has(char);
  }

  isLatin(char: string): boolean {
    return this.reverseMappings.has(char);
  }

  convertText(text: string, direction: "cyrillic-to-latin" | "latin-to-cyrillic"): string {
    return text
      .split("")
      .map((char) => {
        if (direction === "cyrillic-to-latin") {
          return this.cyrillicToLatin(char);
        } else {
          return this.latinToCyrillic(char);
        }
      })
      .join("");
  }

  hasCyrillicCharacters(text: string): boolean {
    return text.split("").some((char) => this.isCyrillic(char));
  }
}
