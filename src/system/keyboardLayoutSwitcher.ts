import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface KeyboardLayoutInfo {
  id: string;
  name: string;
}

export class KeyboardLayoutSwitcher {
  private static instance: KeyboardLayoutSwitcher;
  private isMacOS: boolean;
  private isEnabled: boolean = false;
  private targetLayoutId: string = "com.apple.keylayout.US";

  private constructor() {
    this.isMacOS = process.platform === "darwin";
  }

  static getInstance(): KeyboardLayoutSwitcher {
    if (!KeyboardLayoutSwitcher.instance) {
      KeyboardLayoutSwitcher.instance = new KeyboardLayoutSwitcher();
    }
    return KeyboardLayoutSwitcher.instance;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  setTargetLayout(layoutId: string): void {
    this.targetLayoutId = layoutId;
  }

  async getCurrentLayout(): Promise<KeyboardLayoutInfo | null> {
    if (!this.isMacOS || !this.isEnabled) {
      return null;
    }

    try {
      // Пробуем несколько способов найти меню ввода
      const appleScript = `
        tell application "System Events"
          tell process "SystemUIServer"
            try
              -- Способ 1: ищем по описанию "text input"
              set inputMenu to (first menu bar item of menu bar 1 whose description is "text input")
              set currentSource to name of inputMenu
              return currentSource
            on error
              try
                -- Способ 2: ищем по описанию "input menu"
                set inputMenu to (first menu bar item of menu bar 1 whose description contains "input")
                set currentSource to name of inputMenu
                return currentSource
              on error
                try
                  -- Способ 3: ищем меню с подменю
                  repeat with menuItem in menu bar items of menu bar 1
                    try
                      if (count of menu items of menu 1 of menuItem) > 1 then
                        set currentSource to name of menuItem
                        if currentSource does not contain "Wi-Fi" and currentSource does not contain "Battery" then
                          return currentSource
                        end if
                      end if
                    end try
                  end repeat
                  return "US"
                on error
                  return "Unknown"
                end try
              end try
            end try
          end tell
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      const layoutName = stdout.trim();

      return {
        id: this.getLayoutIdFromName(layoutName),
        name: layoutName,
      };
    } catch (error) {
      console.error("Ошибка при получении текущей раскладки:", error);
      return null;
    }
  }

  async getAvailableLayouts(): Promise<KeyboardLayoutInfo[]> {
    if (!this.isMacOS || !this.isEnabled) {
      return [];
    }

    try {
      const appleScript = `
        tell application "System Events"
          tell process "SystemUIServer"
            try
              set inputMenu to (first menu bar item of menu bar 1 whose description is "text input")
              click inputMenu
              delay 0.1
              set menuItems to name of every menu item of menu 1 of inputMenu
              click inputMenu -- закрываем меню
              return menuItems
            on error
              return {}
            end try
          end tell
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      const layoutNames = stdout
        .trim()
        .split(", ")
        .filter((name) => name && name !== "missing value");

      return layoutNames.map((name) => ({
        id: this.getLayoutIdFromName(name),
        name: name,
      }));
    } catch (error) {
      console.error("Ошибка при получении доступных раскладок:", error);
      return [];
    }
  }

  async switchToLatinLayout(): Promise<boolean> {
    if (!this.isMacOS || !this.isEnabled) {
      console.log("Переключение раскладки отключено или не поддерживается на этой платформе");
      return false;
    }

    try {
      // Метод 1: Попробуем через InputSourceSelector если он установлен
      try {
        await execAsync(`/usr/local/bin/InputSourceSelector select ${this.targetLayoutId}`);
        console.log(`Раскладка переключена на ${this.targetLayoutId} через InputSourceSelector`);
        return true;
      } catch (inputSourceError) {
        console.log("InputSourceSelector не найден, используем AppleScript");
      }

      // Метод 2: Используем AppleScript для переключения через GUI
      const targetLayoutName = this.getLayoutNameFromId(this.targetLayoutId);
      const appleScript = `
        tell application "System Events"
          tell process "SystemUIServer"
            try
              set inputMenu to missing value

              -- Пробуем найти меню ввода несколькими способами
              try
                set inputMenu to (first menu bar item of menu bar 1 whose description is "text input")
              on error
                try
                  set inputMenu to (first menu bar item of menu bar 1 whose description contains "input")
                on error
                  -- Ищем меню ввода по содержимому
                  repeat with menuItem in menu bar items of menu bar 1
                    try
                      if (count of menu items of menu 1 of menuItem) > 1 then
                        set menuName to name of menuItem
                        -- Проверяем, что это не системные меню
                        if menuName does not contain "Wi-Fi" and menuName does not contain "Battery" and menuName does not contain "Volume" and menuName does not contain "Time Machine" and menuName does not contain "Bluetooth" then
                          -- Проверяем содержимое меню на наличие раскладок
                          set hasLayoutItems to false
                          repeat with subMenuItem in menu items of menu 1 of menuItem
                            set subMenuName to name of subMenuItem
                            if subMenuName contains "U.S" or subMenuName contains "ABC" or subMenuName contains "Russian" or subMenuName contains "English" then
                              set hasLayoutItems to true
                              exit repeat
                            end if
                          end repeat

                          if hasLayoutItems then
                            set inputMenu to menuItem
                            exit repeat
                          end if
                        end if
                      end if
                    end try
                  end repeat
                end try
              end try

              if inputMenu is missing value then
                return false
              end if

              click inputMenu
              delay 0.2

              try
                set targetItem to first menu item of menu 1 of inputMenu whose name is "${targetLayoutName}"
                click targetItem
                delay 0.2
                return true
              on error
                -- Пробуем найти элемент по частичному совпадению
                repeat with menuItem in menu items of menu 1 of inputMenu
                  if name of menuItem contains "U.S" or name of menuItem contains "ABC" then
                    click menuItem
                    delay 0.2
                    return true
                  end if
                end repeat
                click inputMenu -- закрываем меню
                return false
              end try

            on error errMsg
              try
                click inputMenu -- пытаемся закрыть меню
              end try
              return false
            end try
          end tell
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      const success = stdout.trim() === "true";

      if (success) {
        console.log(`Раскладка переключена на ${targetLayoutName} через AppleScript`);
        return true;
      } else {
        console.log("Не удалось переключить раскладку через AppleScript, пробуем альтернативный метод");
        // Метод 3: Попробуем использовать JXA (JavaScript for Automation)
        return await this.switchLayoutWithJXA();
      }
    } catch (error) {
      console.error("Ошибка при переключении раскладки:", error);
      return false;
    }
  }

  async switchToLayout(layoutId: string): Promise<boolean> {
    if (!this.isMacOS || !this.isEnabled) {
      return false;
    }

    const oldTargetLayout = this.targetLayoutId;
    this.setTargetLayout(layoutId);
    const result = await this.switchToLatinLayout();
    this.setTargetLayout(oldTargetLayout); // восстанавливаем предыдущую настройку
    return result;
  }

  private getLayoutIdFromName(name: string): string {
    const nameToIdMap: Record<string, string> = {
      "U.S.": "com.apple.keylayout.US",
      ABC: "com.apple.keylayout.ABC",
      Russian: "com.apple.keylayout.Russian",
      "Russian - Phonetic": "com.apple.keylayout.RussianWin",
      Ukrainian: "com.apple.keylayout.Ukrainian-PC",
      Belarusian: "com.apple.keylayout.Belarusian",
    };

    return nameToIdMap[name] || `com.apple.keylayout.${name.replace(/\s+/g, "")}`;
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

  async isAccessibilityEnabled(): Promise<boolean> {
    if (!this.isMacOS) {
      return false;
    }

    try {
      const appleScript = `
        tell application "System Events"
          try
            set proc to first process whose name is "SystemUIServer"
            return true
          on error
            return false
          end try
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      return stdout.trim() === "true";
    } catch (error) {
      return false;
    }
  }

  async debugMenuBarItems(): Promise<string[]> {
    if (!this.isMacOS) {
      return [];
    }

    try {
      const appleScript = `
        tell application "System Events"
          tell process "SystemUIServer"
            try
              set menuItems to {}
              repeat with menuItem in menu bar items of menu bar 1
                try
                  set itemName to name of menuItem as string
                  set itemDesc to description of menuItem as string
                  set itemInfo to itemName & " (" & itemDesc & ")"
                  set end of menuItems to itemInfo
                end try
              end repeat
              return menuItems
            on error
              return {"Ошибка получения элементов меню"}
            end try
          end tell
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      return stdout.trim().split(", ");
    } catch (error) {
      console.error("Ошибка отладки меню:", error);
      return [];
    }
  }

  private async switchLayoutWithJXA(): Promise<boolean> {
    try {
      // Используем более простой подход - создаем временный файл для скрипта
      const jsScript = `
function run() {
  try {
    const SystemEvents = Application('System Events');
    SystemEvents.includeStandardAdditions = true;
    const systemUIServer = SystemEvents.processes.byName('SystemUIServer');
    const menuBar = systemUIServer.menuBars[0];
    const menuItems = menuBar.menuBarItems();

    // Ищем меню ввода более строго
    let inputMenu = null;
    for (let i = 0; i < menuItems.length; i++) {
      try {
        const item = menuItems[i];
        const description = item.description();

        // Проверяем точное соответствие описанию меню ввода
        if (description === 'text input' || description === 'input menu') {
          inputMenu = item;
          break;
        }

        // Если не найдено по описанию, ищем по содержимому меню
        if (!inputMenu) {
          try {
            const subMenu = item.menus[0];
            if (subMenu) {
              const subMenuItems = subMenu.menuItems();
              let hasLayoutItems = false;

              // Проверяем, есть ли в меню элементы раскладок
              for (let j = 0; j < subMenuItems.length; j++) {
                const subItem = subMenuItems[j];
                const subName = subItem.name();
                if (subName.includes('U.S') || subName.includes('ABC') ||
                    subName.includes('Russian') || subName.includes('English')) {
                  hasLayoutItems = true;
                  break;
                }
              }

              if (hasLayoutItems) {
                inputMenu = item;
                break;
              }
            }
          } catch (e) {
            // Игнорируем ошибки для отдельных элементов
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!inputMenu) {
      return false;
    }

    // Кликаем по меню
    inputMenu.click();
    delay(0.3);

    try {
      const menu = inputMenu.menus[0];
      const menuItems = menu.menuItems();

      // Ищем целевую раскладку
      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        const name = item.name();
        if (name === 'U.S.' || name === 'ABC' || name.includes('U.S')) {
          item.click();
          delay(0.2);
          return true;
        }
      }

      // Закрываем меню если ничего не найдено
      inputMenu.click();
      return false;
    } catch (e) {
      // Пытаемся закрыть меню
      try {
        inputMenu.click();
      } catch (e2) {}
      return false;
    }

  } catch (error) {
    return false;
  }
}`;

      // Экранируем кавычки и переносы строк для безопасной передачи
      const escapedScript = jsScript.replace(/'/g, "'\"'\"'").replace(/\n/g, ' ');
      const { stdout } = await execAsync(`osascript -l JavaScript -e '${escapedScript}'`);
      return stdout.trim() === "true";
    } catch (error) {
      console.error("Ошибка JXA метода:", error);
      return false;
    }
  }
}
