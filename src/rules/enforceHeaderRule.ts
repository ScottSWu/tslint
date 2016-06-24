import * as ts from "typescript";
import * as Lint from "../lint";

export class Rule extends Lint.Rules.AbstractRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "enforce-header",
        description: "Enforces a certain header style for all files, matched by a regular expression.",
        optionsDescription: "Regular expression to match the header, and an optional header to fill in.",
        options: {
            type: "array",
            items: {
                type: "string",
            },
            minLength: 1,
            maxLength: 2,
        },
        optionExamples: ["true", "/\\*[\\s\\S]*?Copyright \\d{4}[\\s\\S]*?\\*/"],
        type: "style",
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE_STRING = "missing header";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        const walker = new EnforceHeaderWalker(sourceFile, this.getOptions());
        const options = this.getOptions().ruleArguments;
        walker.setRegex(new RegExp(options[0].toString()));
        if (options.length > 1) {
            walker.setHeader(options[1].toString());
        }
        return this.applyWithWalker(walker);
    }
}

class EnforceHeaderWalker extends Lint.RuleWalker {
    private regex: RegExp;
    private header: string;

    public setRegex(regex: RegExp) {
        this.regex = regex;
    }

    public setHeader(header: string) {
        this.header = header;
    }

    public visitSourceFile(node: ts.SourceFile) {
        if (this.regex) {
            // check for a shebang
            let text = node.getFullText();
            let offset = 0;
            if (text.indexOf("#!") === 0) {
                offset = text.indexOf("\n") + 1;
                text = text.substring(offset);
            }
            // look for the copyright header
            const match = text.match(this.regex);
            if (!match || match.index !== 0) {
                let fixes: Lint.IFix[] = [];
                if (this.header && this.header.length > 0) {
                    fixes.push({
                        description: "Add header",
                        replacements: [
                            {
                                endPosition: offset,
                                startPosition: offset,
                                text: this.header,
                            },
                        ],
                    });
                }
                this.addFailure(this.createFailure(offset, offset + 1, Rule.FAILURE_STRING, fixes));
            }
        }
    }
}
