/**
 * @license
 * Copyright 2013 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as colors from "colors";
import * as diff from "diff";

import {AbstractFormatter} from "../language/formatter/abstractFormatter";
import {RuleFailure} from "../language/rule/rule";

export class Formatter extends AbstractFormatter {
    public format(failures: RuleFailure[]): string {
        const outputLines = failures.map((failure: RuleFailure) => {
            const fileName = failure.getFileName();
            const failureString = failure.getFailure();

            const lineAndCharacter = failure.getStartPosition().getLineAndCharacter();
            const positionTuple = `[${lineAndCharacter.line + 1}, ${lineAndCharacter.character + 1}]`;

            const failureInfo = `${fileName}${positionTuple}: ${failureString}`;

            const fixes = failure.getFixes();
            if (fixes.length > 0) {
                const content = failure.getSourceFile().getFullText();
                const fixesString = fixes.map((fix) => {
                    const description = fix.getDescription();
                    const newContent = fix.apply(content);
                    const diffResults = diff.diffLines(content, newContent);
                    const diffString = diffResults.map(diff => {
                        if (diff.added) {
                            return colors.green(`    ${diff.value}`);
                        } else if (diff.removed) {
                            return colors.red(`    ${diff.value}`);
                        } else {
                            return "";
                        }
                    }).join("");
                    return `- ${description}\n${diffString}`;
                }).join("\n");
                return `${failureInfo}\nSuggested fixes:\n${fixesString}`;
            } else {
                return failureInfo;
            }
        });

        return outputLines.join("\n") + "\n";
    }
}
