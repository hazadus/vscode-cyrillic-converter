import * as assert from "assert";
import * as vscode from "vscode";
import { MappingTable } from "../../src/replacement/mappingTable";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Mapping Table Tests", () => {
    const mapper = MappingTable.getInstance();

    // Тест базовой замены
    assert.strictEqual(mapper.cyrillicToLatin("а"), "a");
    assert.strictEqual(mapper.cyrillicToLatin("А"), "A");

    // Тест определения кириллицы
    assert.strictEqual(mapper.isCyrillic("а"), true);
    assert.strictEqual(mapper.isCyrillic("a"), false);

    // Тест преобразования текста
    const result = mapper.convertText("привет", "cyrillic-to-latin");
    assert.strictEqual(result, "ghbdtn");
  });

  test("Performance Test", async () => {
    const mapper = MappingTable.getInstance();
    const longText = "а".repeat(10000);

    const start = Date.now();
    mapper.convertText(longText, "cyrillic-to-latin");
    const duration = Date.now() - start;

    assert.ok(duration < 100, "Conversion should be fast");
  });
});
