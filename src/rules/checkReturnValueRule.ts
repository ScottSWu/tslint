import * as ts from "typescript";

import * as Lint from "../lint";

export class Rule extends Lint.Rules.TypedRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "check-return-value",
        description: "Enforces the return value of certain functions to be used.",
        rationale: Lint.Utils.dedent`
            Certain functions do not change the state of the calling object. If
            these functions' return values are unused, then the function call
            could be removed without any effects, indicating a possible bug.`,
        optionsDescription: Lint.Utils.dedent`
            A list of functions whose return values cannot be thrown away in
            form of ['function'], ['object name', 'function'] or ['type',
            'function'].`,
        options: {
            type: "list",
            listType: {
                type: "array",
            },
        },
        optionExamples: [`[true, ["Array", "join"], ["fn"], ["type", "fn"], ["obj", "fn"]]`],
        type: "functionality",
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FUNCTION_FAILURE_STRING = "return value is unused";

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new CheckReturnValueWalker(sourceFile, this.getOptions(), program));
    }
}

const BUILTIN_BLACKLIST: string[][] = [
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

type AccessExpression = ts.PropertyAccessExpression | ts.ElementAccessExpression;

class CheckReturnValueWalker extends Lint.ProgramAwareRuleWalker {
    // Single function name blacklist
    protected nameBlacklist: {[key: string]: boolean} = {};
    // Property function name / type blacklist
    protected propertyBlacklist: {[key: string]: boolean} = {};

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions, program: ts.Program) {
        super(sourceFile, options, program);

        // Populate blacklists with builtin functions and rule arguments
        if (options.ruleArguments) {
            options.ruleArguments.forEach(arg => {
                if (arg.length === 1) {
                    this.nameBlacklist[arg[0]] = true;
                } else {
                    // Since type / variable names must be proper identifiers, we can
                    // assume they do not contain pound signs.
                    this.propertyBlacklist[arg.join("#")] = true;
                }
            });
        }

        BUILTIN_BLACKLIST.forEach(property => {
            this.propertyBlacklist[property.join("#")] = true;
        });
    }

    public visitCallExpression(node: ts.CallExpression) {
        const tc = this.getTypeChecker();
        const signature = tc.getResolvedSignature(node);
        const type = tc.getReturnTypeOfSignature(signature);

        if (type.flags !== ts.TypeFlags.Void &&
            (this.isBlackListed(node, tc) || this.hasMustUseJSDoc(node, tc) ||
            this.hasMustUseType(node, tc)) && this.isUnused(node)) {
            this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FUNCTION_FAILURE_STRING));
        }

        super.visitCallExpression(node);
    }

    private isBlackListed(node: ts.CallExpression, tc: ts.TypeChecker) {
        switch (node.expression.kind) {
            case ts.SyntaxKind.PropertyAccessExpression:
            case ts.SyntaxKind.ElementAccessExpression:
                let expressionNode: ts.LeftHandSideExpression = (node.expression as AccessExpression).expression;
                const nodeType = tc.getTypeAtLocation(expressionNode);
                const nodeTypeName = tc.typeToString(nodeType);
                const nodeSymbolName = nodeType.symbol ? nodeType.symbol.name : "";
                const nodeObject = expressionNode.getText();
                let nodeFunction = "";
                if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                    nodeFunction = (node.expression as ts.PropertyAccessExpression).name.getText();
                } else if (
                    node.expression.kind === ts.SyntaxKind.ElementAccessExpression) {
                    const accessNode = node.expression as ts.ElementAccessExpression;
                    const argument = accessNode.argumentExpression as ts.Expression;
                    nodeFunction = argument.getText();
                }

                if (this.nameBlacklist.hasOwnProperty(nodeFunction)) {
                    return true;
                } else {
                    if (this.propertyBlacklist.hasOwnProperty(`${nodeTypeName}#${nodeFunction}`) ||
                        this.propertyBlacklist.hasOwnProperty(`${nodeSymbolName}#${nodeFunction}`) ||
                        this.propertyBlacklist.hasOwnProperty(`${nodeObject}#${nodeFunction}`)) {
                        return true;
                    }
                }
                break;
            case ts.SyntaxKind.Identifier:
                const identifier = node.expression as ts.Identifier;
                if (this.nameBlacklist.hasOwnProperty(identifier.text)) {
                    return true;
                }
                break;
            default:
                break;
        }
        return false;
    }

    private hasMustUseJSDoc(node: ts.CallExpression, tc: ts.TypeChecker) {
        const callSymbol = tc.getTypeAtLocation(node.expression).getSymbol();
        if (!callSymbol) {
            return false;
        }
        for (const comment of callSymbol.getDocumentationComment()) {
            if (comment.text.trim().toLocaleUpperCase() === "@MUSTUSE") {
                return true;
            }
        }
        return false;
    }

    private hasMustUseType(node: ts.CallExpression, tc: ts.TypeChecker) {
        const callSymbol = tc.getTypeAtLocation(node.expression).getSymbol();
        if (!callSymbol) {
            return false;
        }
        const typeNode = (callSymbol.valueDeclaration as ts.FunctionDeclaration).type;
        if (typeNode.kind === ts.SyntaxKind.TypeReference) {
            const refNode = (typeNode as ts.TypeReferenceNode).typeName;
            if (refNode.kind === ts.SyntaxKind.Identifier) {
                return (refNode as ts.Identifier).text.toLocaleUpperCase() === "MUSTUSE";
            } else if (refNode.kind === ts.SyntaxKind.QualifiedName) {
                return refNode.getText().toLocaleUpperCase() === "MUSTUSE";
            }
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
