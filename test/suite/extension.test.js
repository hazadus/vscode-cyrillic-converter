"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const mappingTable_1 = require("../../src/replacement/mappingTable");
suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");
  test("Mapping Table Tests", () => {
    const mapper = mappingTable_1.MappingTable.getInstance();
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
    const mapper = mappingTable_1.MappingTable.getInstance();
    const longText = "а".repeat(10000);
    const start = Date.now();
    mapper.convertText(longText, "cyrillic-to-latin");
    const duration = Date.now() - start;
    assert.ok(duration < 100, "Conversion should be fast");
  });
});
//# sourceMappingURL=extension.test.js.map
