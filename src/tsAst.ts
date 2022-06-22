import * as ts from "typescript";

export function findFirstChildNode(root: ts.Node, condition: (node: ts.Node) => boolean): ts.Node | undefined {
  const nodes = root.getChildren();
  for (const node of nodes) {
    if (condition(node)) return node;
    const r = findFirstChildNode(node, condition);
    if (r) return r;
  }
}

export type FuncNode = {
  node: ts.Node;
  name: string;
  arguments: ts.NodeArray<ts.Expression>;
};
export function findNodesByFuncNames(funcNames: string[], root: ts.Node, condition: (node: ts.CallExpression) => boolean): FuncNode[] {
  //const node = ts.createSourceFile("_dummy.ts", tsCode, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const nodes: FuncNode[] = [];
  //    const calls: Array<Decoration> = [];
  search(root);
  return nodes;

  function search(node: ts.Node) {
    block: {
      if (ts.isCallExpression(node)) {
        if (!ts.isIdentifier(node.expression)) break block;
        const name = node.expression.text;
        if (!funcNames.includes(name)) break block;
        if (condition(node)) {
          nodes.push({
            name: name,
            node: node,

            arguments: node.arguments,
          });
        }

        // if (node.arguments.length !== 1) break block;
        // const arg0 = node.arguments[0];
        // if (!ts.isStringLiteral(arg0)) break block;
        // const key = arg0.text;
        // //calls.push({ key, start: node.getStart(), end: node.getEnd() });
        // nodes.push(node);
        return;
      }
    }
    ts.forEachChild(node, search);
  }
}
