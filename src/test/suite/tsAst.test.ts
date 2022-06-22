import * as assert from "assert";
import { parse } from "@originjs/vue-sfc-ast-parser/lib/sfcUtils";
import { findFirstChildNode, findNodesByFuncNames } from "../../tsAst";
import * as ts from "typescript";

//import { TargetFuncNames } from "../../targetFuncNamesSchema";

function createNodeFromVueCode(code: string, type: "setup" | "normal" = "setup") {
  const { descriptor } = parse(code);
  if (type === "setup") return ts.createSourceFile("_.ts", descriptor.scriptSetup!.content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  else return ts.createSourceFile("_.ts", descriptor.script!.content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
}
suite("Test", () => {
  test("not found", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
        a("test");
        b("t(0)");
        </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, () => true);
    assert.strictEqual(values.length, 0);
  });
  test("found", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
        t("test");
        b("t(0)");
        </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, () => true);
    assert.strictEqual(values.length, 1);
  });
  test("found", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
        t("test"  );
        b("t(0)");
        </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, () => true);
    assert.strictEqual(values.length, 1);
  });
  test("found", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
        t(    " test"  );
        b("t(0)");
        </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, () => true);
    assert.strictEqual(values.length, 1);
  });
  test("found", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
        t(    " test"  );
        long(0,    " test"  );
        b("t(0)");
        </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, () => true);
    assert.strictEqual(values.length, 2);
  });
  test("found", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
        t(    " test"  ,0);
        long(0,    " test"  ,0);
        b("t(0)");
        </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, () => true);
    assert.strictEqual(values.length, 2);
  });
  test("works filtering", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
        t(    " test"  ,0);
        long(0,    " test"  ,0);
        b("t(0)");
        </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, (node) => node.arguments.length === 2);
    assert.strictEqual(values.length, 1);
    assert.strictEqual(values[0].arguments[1].getText(), "0");
  });
  test("found", () => {
    const funcNames = { t: 0, $t: 1, long: 2 };
    const code = `
        <script setup lang="ts">
            t(    "test"  );
            long(0,    "test"  );
            b("t(0)");

            </script>
    `;
    const node = createNodeFromVueCode(code);
    const values = findNodesByFuncNames(Object.keys(funcNames), node, () => true);
    const first = values[0];
    assert.strictEqual(first.name, "t");
    assert.strictEqual(first.arguments.length, 1);
    assert.strictEqual(first.arguments[0].getText(), `"test"`);
    const second = values[1];
    assert.strictEqual(second.name, "long");
    assert.strictEqual(second.arguments.length, 2);
    assert.strictEqual(second.arguments[0].getText(), "0");
    assert.strictEqual(second.arguments[1].getText(), `"test"`);
  });
});
