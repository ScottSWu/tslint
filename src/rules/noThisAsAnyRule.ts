import * as ts from "typescript";
import * as Lint from "../lint";

export class Rule extends Lint.Rules.TypedRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "no-this-as-any",
        description: "Prevents using 'this' when having type 'any'.",
        rationale: Lint.Utils.dedent`
            'this' with type 'any' typically happens outside an instance of an object,
            which suggests misplacement of the function.`,
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: ["true"],
        type: "style",
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE_STRING = "'this' has type 'any'";

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoThisAsAnyWalker(sourceFile, this.getOptions(), program));
    }
}

class NoThisAsAnyWalker extends Lint.ProgramAwareRuleWalker {
    public visitThisKeyword(node: ts.ThisTypeNode) {
        const tc = this.getTypeChecker();
        const type = tc.typeToString(tc.getTypeAtLocation(node));

        if (type === "any") {
            this.createFailure(node.getStart(), node.getWidth(), Rule.FAILURE_STRING);
        }

        super.visitThisKeyword(node);
    }
}
