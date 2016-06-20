import * as ts from "typescript";
import * as Lint from "../lint";

export class Rule extends Lint.Rules.TypedRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "check-return-value",
        description: "Enforces the return value of certain functions to be used.",
        optionsDescription: Lint.Utils.dedent`
            A list of functions whose return values cannot be thrown away in
            form of ['function'], ['object name', 'function'] or ['type', 'function']. Use
            ['no-built-ins'] to unwhitelist a built-in list of common functions.`,
        options: {
            type: "list",
            listType: {
                type: "array",
            },
        },
        optionExamples: [`[true, ["no-built-ins"], ["Array", "push"], ["fn"], ["type", "fn"], ["obj", "fn"]]`],
        type: "functionality",
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FUNCTION_FAILURE_STRING = "return value is unused";
    public static CONSTRUCTOR_FAILURE_STRING = "constructed object is unused";

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoUnusedReturnValueWalker(sourceFile, this.getOptions(), program));
    }
}

class NoUnusedReturnValueWalker extends Lint.ProgramAwareRuleWalker {
    protected static builtins = [
        ["string", "trim"],
        ["Array", "pop"],
        ["Array", "sort"],
        ["Array", "unshift"],
    ];
    protected nameWhitelist: string[] = [];
    protected propertyWhitelist: string[][] = [];

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions, program: ts.Program) {
        super(sourceFile, options, program);

        let addBuiltins = true;

        options.ruleArguments.forEach(arg => {
            if (arg.length === 1) {
                if (arg[0] === "no-built-ins") {
                    addBuiltins = false;
                } else {
                    this.nameWhitelist.push(arg[0]);
                }
            } else {
                this.propertyWhitelist.push(arg);
            }
        });

        if (addBuiltins) {
            this.propertyWhitelist = this.propertyWhitelist.concat(NoUnusedReturnValueWalker.builtins);
        }
    }

    public visitCallExpression(node: ts.CallExpression) {
        const typeName = this.getReturnType(node);

        if (typeName !== "void" && typeName !== "any" && node.parent.kind === ts.SyntaxKind.ExpressionStatement) {
            // parent must not be an ExpressionStatement
            switch (node.expression.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                    const propertyNode = node.expression as ts.PropertyAccessExpression;
                    const propertySymbol = this.getType(propertyNode.expression).symbol;
                    let propertyType = propertySymbol ? propertySymbol.name : "";
                    let propertyObject = propertyNode.expression.getText();
                    let propertyFunction = propertyNode.name.text;

                    let propertyWhitelisted = false;
                    if (this.nameWhitelist.indexOf(propertyFunction) >= 0) {
                        propertyWhitelisted = true;
                    } else {
                        for (const property of this.propertyWhitelist) {
                            if (property[1] === propertyFunction &&
                                (property[0] === propertyType || property[0] === propertyObject)) {
                                propertyWhitelisted = true;
                                break;
                            }
                        }
                    }

                    if (!propertyWhitelisted) {
                        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FUNCTION_FAILURE_STRING));
                    }
                    break;
                case ts.SyntaxKind.ElementAccessExpression:
                    const elementNode = node.expression as ts.ElementAccessExpression;
                    const elementSymbol = this.getType(elementNode.expression).symbol;
                    let elementType = elementSymbol ? elementSymbol.name : "";
                    let elementObject = elementNode.expression.getText();
                    let elementFunction = elementNode.argumentExpression.getText();

                    let elementWhitelisted = false;
                    if (this.nameWhitelist.indexOf(elementFunction) >= 0) {
                        elementWhitelisted = true;
                    } else {
                        for (const property of this.propertyWhitelist) {
                            if (property[1] === elementFunction &&
                                (property[0] === elementType || property[0] === elementObject)) {
                                elementWhitelisted = true;
                                break;
                            }
                        }
                    }

                    if (!elementWhitelisted) {
                        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FUNCTION_FAILURE_STRING));
                    }

                    break;
                case ts.SyntaxKind.Identifier:
                    const idNode = node.expression as ts.Identifier;
                    if (this.nameWhitelist.indexOf(idNode.text) < 0) {
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
                // TODO should this be a failure? e.g. new A()["foo"] bad style
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
