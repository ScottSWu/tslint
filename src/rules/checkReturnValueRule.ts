import * as ts from "typescript";
import * as Lint from "../lint";

export class Rule extends Lint.Rules.TypedRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "check-return-value",
        description: "Enforces the return value of certain functions to be used.",
        rationale: Lint.Utils.dedent`
            Certain functions do not change the state of the calling object. If these
            functions' return values are unused, then the function call could be removed
            without any effects, indicating a possible bug.`,
        optionsDescription: Lint.Utils.dedent`
            A list of functions whose return values cannot be thrown away in
            form of ['function'], ['object name', 'function'] or ['type', 'function']. Use
            ['no-built-ins'] to unblacklist a built-in list of common functions.`,
        options: {
            type: "list",
            listType: {
                type: "array",
            },
        },
        optionExamples: [`[true, ["no-built-ins"], ["string", "trim"], ["fn"], ["type", "fn"], ["obj", "fn"]]`],
        type: "functionality",
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FUNCTION_FAILURE_STRING = "return value is unused";
    public static CONSTRUCTOR_FAILURE_STRING = "constructed object is unused";

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new CheckReturnValueWalker(sourceFile, this.getOptions(), program));
    }
}

class CheckReturnValueWalker extends Lint.ProgramAwareRuleWalker {
    protected static builtins = [
        ["string", "trim"],
    ];
    protected nameBlacklist: string[] = [];
    protected propertyBlacklist: string[][] = [];

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions, program: ts.Program) {
        super(sourceFile, options, program);

        let addBuiltins = true;

        options.ruleArguments.forEach(arg => {
            if (arg.length === 1) {
                if (arg[0] === "no-built-ins") {
                    addBuiltins = false;
                } else {
                    this.nameBlacklist.push(arg[0]);
                }
            } else {
                this.propertyBlacklist.push(arg);
            }
        });

        if (addBuiltins) {
            this.propertyBlacklist = this.propertyBlacklist.concat(CheckReturnValueWalker.builtins);
        }
    }

    public visitCallExpression(node: ts.CallExpression) {
        const tc = this.getTypeChecker();
        const signature = tc.getResolvedSignature(node);
        const typeName = tc.typeToString(tc.getReturnTypeOfSignature(signature));

        if (typeName !== "void" && node.parent.kind === ts.SyntaxKind.ExpressionStatement) {
            // parent must not be an ExpressionStatement
            switch (node.expression.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                case ts.SyntaxKind.ElementAccessExpression:
                    let expressionNode: ts.LeftHandSideExpression = undefined;
                    if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                        expressionNode = (node.expression as ts.PropertyAccessExpression).expression;
                    } else if (node.expression.kind === ts.SyntaxKind.ElementAccessExpression) {
                        expressionNode = (node.expression as ts.ElementAccessExpression).expression;
                    }
                    const nodeType = tc.getTypeAtLocation(expressionNode);
                    const nodeTypeName = tc.typeToString(nodeType);
                    const nodeSymbol = nodeType.symbol;
                    const nodeSymbolName = (nodeSymbol) ? nodeSymbol.name : "";
                    const nodeObject = expressionNode.getText();
                    let nodeFunction = "";
                    if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                        nodeFunction = (node.expression as ts.PropertyAccessExpression).name.getText();
                    } else if (node.expression.kind === ts.SyntaxKind.ElementAccessExpression) {
                        nodeFunction = (node.expression as ts.ElementAccessExpression).argumentExpression.getText();
                    }

                    let blacklisted = false;
                    if (this.nameBlacklist.indexOf(nodeFunction) >= 0) {
                        blacklisted = true;
                    } else {
                        for (const property of this.propertyBlacklist) {
                            if (property[1] === nodeFunction && (property[0] === nodeTypeName ||
                                property[0] === nodeSymbolName || property[0] === nodeObject)) {
                                blacklisted = true;
                                break;
                            }
                        }
                    }

                    if (blacklisted) {
                        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FUNCTION_FAILURE_STRING));
                    }
                    break;
                case ts.SyntaxKind.Identifier:
                    const idNode = node.expression as ts.Identifier;
                    if (this.nameBlacklist.indexOf(idNode.text) < 0) {
                        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FUNCTION_FAILURE_STRING));
                    }
                    break;
                default:
                    break;
            }
        }

        super.visitCallExpression(node);
    }

    public visitNewExpression(node: ts.NewExpression) {
        // parent must not be an ExpressionStatement
        switch (node.parent.kind) {
            case ts.SyntaxKind.ExpressionStatement:
                this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.CONSTRUCTOR_FAILURE_STRING));
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                // TODO should this be a failure? e.g. new A().foo
            case ts.SyntaxKind.PropertyAccessExpression:
                // TODO should this be a failure? e.g. new A()["foo"]
            default:
                break;
        }

        super.visitNewExpression(node);
    }

    protected getType(node: ts.Node) {
        const tc = this.getTypeChecker();
        const type = tc.getTypeAtLocation(node);
        return type;
    }

    protected getReturnType(node: ts.CallExpression) {
        const tc = this.getTypeChecker();
        const signature = tc.getResolvedSignature(node);
        const type = tc.typeToString(tc.getReturnTypeOfSignature(signature));
        return type;
    }
}
