import * as vscode from "vscode";
import * as ts from "typescript";
import { parse } from "@originjs/vue-sfc-ast-parser/lib/sfcUtils";
import { ESLintProgram } from "vue-eslint-parser/ast";
import * as templateParser from "vue-eslint-parser";
import { /*findFirstChildNode,*/ findNodesByFuncNames, FuncNode } from "./tsAst";
import { glob } from "glob";
import { resolve } from "node:path";
import { dotObject } from "./utils";
import { debounce } from "throttle-debounce";
import * as config from "./config";
import * as sanitizeHtml from "sanitize-html";
import { TargetFuncNames } from "./targetFuncNamesSchema";

const VueCompilerDom = require("@vue/compiler-dom/dist/compiler-dom.cjs.js"); //TODO

type Decoration = {
  start: number;
  end: number;
  key: string;
};

type Dictionary = Record<string, any>;

export function activate(context: vscode.ExtensionContext) {
  config.reloadConfig();

  let dictionaries: Record<string, Dictionary> = {};

  let isActive: boolean = config.getConfig("showDecorator");
  function setup() {
    config.reloadConfig();
    dictionaries = {};
    const pattern = config.getConfig("jsonDictionaries");
    const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (path) {
      glob(resolve(path, pattern), async (er, files) => {
        for (const file of files) {
          const lang = file.split("/").reverse()[0];
          //if (lang === target) {
          const blob = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
          const text = Buffer.from(blob).toString();
          const object = JSON.parse(text);
          const flatten = dotObject(object, { ignoreArrays: true });
          dictionaries[lang] = flatten;
          // } else {
          //   dictionaries[lang] = {};
          // }
        }
        vscode.window.showInformationMessage(`loaded ${pattern} and prepared.(i18n decorator)`);
        setTimeout(() => {
          if (vscode.window.activeTextEditor) showDecorators(vscode.window.activeTextEditor);
        }, 1000);
      });
    }
  }

  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(235, 232, 52,0.2)",
    after: {
      color: "rgba(255,255,255,0.7)",
      backgroundColor: "#333",

      textDecoration: `;
        font-size:7px;
        margin-left:-10px;
      `,
    },
  });
  context.subscriptions.push(decorationType);

  function showDecorators(editor: vscode.TextEditor) {
    if (isActive) {
      const calls = editor.document.languageId === "vue" ? parseVue(editor, config.getConfig("parsedTargetFuncNames") as TargetFuncNames) : [];

      const langs = Object.keys(dictionaries);

      const action = new vscode.MarkdownString(`[[reload](command:sgI18nDecorator.reload)] 
      [[setting](command:workbench.action.openSettings?%5B%22@ext:mosle.sg-i18n-decorator%22%5D)]`);
      action.isTrusted = true;

      if (calls && calls.length > 0) {
        const defaultDict = config.getConfig("baseJsonFile");
        const decorations = calls.map(({ start, end, key }): vscode.DecorationOptions => {
          const range = new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(end));
          //const value = valueOfKey(dictionaries[target], key);
          //const value: string = targetDictionary[key] || "!!NOT FOUND!!";
          const markdowns: vscode.MarkdownString[] = [action];
          langs.forEach((lang) => {
            const value: string = sanitizeHtml(dictionaries[lang]?.[key]) || `<span style="color:#000;background-color:#fff;">!!NOT FOUND!!</span>`;
            const block = new vscode.MarkdownString(`${lang.split(".")[0]} : ${value}`);
            block.isTrusted = true;
            markdowns.push(block);
          });
          const ja = dictionaries[defaultDict]?.[key] || "-";
          return {
            range,
            hoverMessage: markdowns,
            renderOptions: {
              after: {
                contentText: ja.length < 20 ? ja : `${ja.substring(0, 20)}...`,
              },
            },
          };
        });
        editor.setDecorations(decorationType, decorations);
      }
    } else {
      editor.setDecorations(decorationType, []);
    }
  }

  function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    const editor = vscode.window.activeTextEditor;
    if (editor !== undefined) showDecorators(editor);
  }
  // vscode.workspace.onDidChangeTextDocument(
  //   (event) => {
  //     // const editor = vscode.window.visibleTextEditors.find((e) => e.document === event.document);
  //     // if (editor !== undefined) showDecorators(editor);
  //   },
  //   null,
  //   context.subscriptions
  // );

  const onDidChangeTextDocumentDebounced = debounce(250, (event: vscode.TextDocumentChangeEvent) => onDidChangeTextDocument(event));
  vscode.workspace.onDidChangeTextDocument((event) => onDidChangeTextDocumentDebounced(event), null, context.subscriptions);

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) showDecorators(editor);
    },
    null,
    context.subscriptions
  );

  function toggle() {
    isActive = !isActive;
    config.updateConfig("showDecorator", isActive);
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("sgI18nDecorator.toggle", () => {
      toggle();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("sgI18nDecorator.reload", () => {
      setup();
    })
  );

  setup();
}

export function deactivate() {}

function parseVue(editor: vscode.TextEditor, /*composableFuncName: string = "useTranslate",*/ forceFuncNamesConf: TargetFuncNames = {}): Decoration[] | undefined {
  const language = editor.document.languageId;
  if (language !== "vue") return;
  const code = editor.document.getText();

  const { descriptor, errors } = parse(code, { sourceMap: false, compiler: VueCompilerDom });

  const scriptSetupTsNode = descriptor.scriptSetup ? ts.createSourceFile("_setup.ts", descriptor.scriptSetup.content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS) : undefined;
  const scriptTsNode = descriptor.script ? ts.createSourceFile("_script.ts", descriptor.script.content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS) : undefined;

  const calls: Decoration[] = [];

  const funcNodeCondition = (node: ts.CallExpression) => {
    return true; //node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.length > 0;
  };

  function addCalls(findFuncNodes: FuncNode[], offset: number) {
    const validFuncNodes = findFuncNodes.filter((fn) => fn.arguments[forceFuncNamesConf[fn.name]]);
    calls.push(
      ...validFuncNodes
        .map((fn) => ({ key: (fn.arguments[forceFuncNamesConf[fn.name]] as ts.StringLiteral).text, start: fn.node.getStart(), end: fn.node.getEnd() }))
        .map((call) => ({ ...call, ...{ start: call.start + offset, end: call.end + offset } }))
    );
  }
  const forceFuncNames = Object.keys(forceFuncNamesConf);
  if (scriptSetupTsNode) {
    const offset = descriptor.scriptSetup?.loc.start.offset || 0;
    const funcNodes = findNodesByFuncNames([...forceFuncNames], scriptSetupTsNode, funcNodeCondition);
    addCalls(funcNodes, offset);
  }

  if (scriptTsNode) {
    const offset = descriptor.script?.loc.start.offset || 0;
    const funcNodes = findNodesByFuncNames([...forceFuncNames], scriptTsNode, funcNodeCondition);
    addCalls(funcNodes, offset);
  }

  // if (funcNameFromScriptSetup || funcNameFromScriptBody) {
  if (descriptor.template) {
    const offset = descriptor.template.loc.start.offset;
    const callsOfTemplate = parseVueTemplate(descriptor.template.ast.loc.source, forceFuncNamesConf);

    calls.push(
      ...callsOfTemplate.map((call) => ({
        ...call,
        ...{ start: call.start + offset, end: call.end + offset },
      }))
    );
  }
  // }

  return calls;
}

function parseVueTemplate(templateContent: string, forceFuncNamesConf: TargetFuncNames): Decoration[] {
  const calls: Decoration[] = [];

  const options = { sourceType: "module" };
  const templateAST: ESLintProgram = templateParser.parse(templateContent, options);

  if (templateAST.templateBody) {
    const tokens = templateAST.templateBody.tokens;
    const offset = tokens[0].loc.end.column;
    const funcNames = Object.keys(forceFuncNamesConf);
    const candidates = tokens.filter((token) => token.type === "Identifier" && funcNames.includes(token.value));
    candidates
      .map((c) => {
        if (c.start !== undefined && c.end !== undefined) {
          const index = tokens.findIndex((token) => token === c);
          if (index > -1) {
            const sliced = tokens.slice(index);
            const openIndex = sliced.findIndex((token) => token.type === "Punctuator" && token.value === "(");
            const closeIndex = sliced.findIndex((token) => token.type === "Punctuator" && token.value === ")");
            if (openIndex > -1 && closeIndex > -1 && closeIndex > openIndex) {
              const args = [];
              for (let i = index + openIndex + 1; i < index + closeIndex; i++) {
                if (tokens[i].value !== ",") args.push(tokens[i]);
              }
              const targetArg = args[forceFuncNamesConf[c.value]];

              if (targetArg) {
                const close = tokens[index + closeIndex];
                const start = c.start;
                const end = close.end;
                if (end) {
                  const matched = targetArg.value.match(/^["|'|`](.+)["|'|`]/);
                  if (matched) return { start: start - offset - 1, end: end - offset, key: matched[1] };
                }
              }
            }
          }
        }
        return undefined;
      })
      .filter((d) => d)
      .forEach((d) => calls.push(d as Decoration));
  }
  return calls;
}
