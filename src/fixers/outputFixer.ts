import * as colors from "colors";
import * as diff from "diff";

import {Formatter} from "../formatters/proseFormatter"
import {AbstractFixer} from "../language/fixer/abstractFixer";
import {Fix, FixResult, Replacement} from "../language/fixer/fixer";
import {RuleFailure} from "../language/rule/rule";

export class Fixer extends AbstractFixer {
    public apply(fileName: string, source: string, failures: RuleFailure[]): FixResult {
        const proseFormatter = new Formatter();
        const outputLines = failures.map(failure => {
            const proseOutput = proseFormatter.format([failure]);

            const fixes = failure.getFixes();
            const fixLines = fixes.map((fix, index) => {
                const newSource = fix.apply(source);
                const diffResults = diff.diffLines(source, newSource);

                let lineOffset = 1;
                const diffLines = diffResults.map(diffResult => {
                    let output = "";
                    if (diffResult.added) {
                        output += `Line ${lineOffset}:${colors.green(diffResult.value)}`;
                    } else if (diffResult.removed) {
                        output += `Line ${lineOffset}:${colors.red(diffResult.value)}`;
                    }
                    if (!diffResult.added) {
                        lineOffset += diffResult.value.match(/\n/g).length;
                    }
                    return output;
                });

                return `#${index + 1}: ${fix.getDescription()}\n${diffLines.join("")}`;
            });

            return `${proseOutput}Suggested fixes:\n${fixLines.join("")}`;
        });
        return {
            fileName: fileName,
            content: source,
            message: outputLines.join("") + "\n",
            remaining: []
        };
    }
}
