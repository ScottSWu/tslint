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
        ["Array", "concat"],
        ["Array", "filter"],
        ["Array", "map"],
        ["Array", "slice"],
        ["Function", "bind"],
        ["Object", "create"],
        ["string", "concat"],
        ["string", "normalize"],
        ["string", "padStart"],
        ["string", "padEnd"],
        ["string", "repeat"],
        ["string", "replace"],
        ["string", "slice"],
        ["string", "split"],
        ["string", "substr"],
        ["string", "substring"],
        ["string", "toLocaleLowerCase"],
        ["string", "toLocaleUpperCase"],
        ["string", "toLowerCase"],
        ["string", "toUpperCase"],
        ["string", "trim"],
    ];
    // Single function name blacklist
    protected nameBlacklist: string[] = [];
    // Property function name / type blacklist
    protected propertyBlacklist: string[][] = [];

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions, program: ts.Program) {
        super(sourceFile, options, program);

        let addBuiltins = true;

        // Populate blacklists with builtin functions and rule arguments
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
        // const typeName = tc.typeToString(tc.getReturnTypeOfSignature(signature));
        const type = tc.getReturnTypeOfSignature(signature);

        if (type.flags !== ts.TypeFlags.Void && this.isBlackListed(node, tc) && this.isUnused(node)) {
            this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FUNCTION_FAILURE_STRING));
        }

        super.visitCallExpression(node);
    }

    private isBlackListed(node: ts.CallExpression, tc: ts.TypeChecker) {
        switch (node.expression.kind) {
            case ts.SyntaxKind.PropertyAccessExpression:
            case ts.SyntaxKind.ElementAccessExpression:
                let expressionNode: ts.LeftHandSideExpression =
                    (node.expression as ts.PropertyAccessExpression | ts.ElementAccessExpression).expression;
                const nodeType = tc.getTypeAtLocation(expressionNode);
                const nodeTypeName = tc.typeToString(nodeType);
                const nodeSymbolName = (nodeType.symbol) ? nodeType.symbol.name : "";
                const nodeObject = expressionNode.getText();
                let nodeFunction = "";
                if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                    nodeFunction = (node.expression as ts.PropertyAccessExpression).name.getText();
                } else if (node.expression.kind === ts.SyntaxKind.ElementAccessExpression) {
                    nodeFunction = (node.expression as ts.ElementAccessExpression).argumentExpression.getText();
                }

                if (this.nameBlacklist.indexOf(nodeFunction) >= 0) {
                    return true;
                } else {
                    for (const property of this.propertyBlacklist) {
                        if (property[1] === nodeFunction && (property[0] === nodeTypeName ||
                            property[0] === nodeSymbolName || property[0] === nodeObject)) {
                            return true;
                        }
                    }
                }
                break;
            case ts.SyntaxKind.Identifier:
                if (this.nameBlacklist.indexOf((node.expression as ts.Identifier).text) >= 0) {
                    return true;
                }
                break;
            default:
                break;
        }
        return false;
    }

    private isUnused(node: ts.Node): boolean {
        // Only SourceFile has an undefined parent
        if (node.parent === undefined) {
            return false;
        }

        switch (node.parent.kind) {
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.SourceFile:
                return true;
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:

            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.ReturnStatement:

            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.PropertyAccessExpression:

            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.ConditionalExpression:

            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:

            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.VariableDeclaration:
                return false;
            case ts.SyntaxKind.BinaryExpression:
                const binaryNode = node.parent as ts.BinaryExpression;
                switch (binaryNode.operatorToken.kind) {
                    case ts.SyntaxKind.FirstAssignment:
                    case ts.SyntaxKind.PlusEqualsToken:
                    case ts.SyntaxKind.MinusEqualsToken:
                    case ts.SyntaxKind.AsteriskEqualsToken:
                    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
                    case ts.SyntaxKind.SlashEqualsToken:
                    case ts.SyntaxKind.PercentEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.LessThanLessThanEqualsToken:
                    case ts.SyntaxKind.AmpersandEqualsToken:
                    case ts.SyntaxKind.BarEqualsToken:
                    case ts.SyntaxKind.CaretEqualsToken:
                        return false;
                    default:
                        break;
                }
                return this.isUnused(node.parent);
            default:
                return this.isUnused(node.parent);
        }
    }
}
