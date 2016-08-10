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

            let fixString = "";
            if (failure.hasFix() && !failure.hasAppliedFix()) {
                const fix = failure.getFix();
                const newSource = fix.apply(this.source);
                const diffResults = diff.structuredPatch(fileName, fileName, this.source, newSource,
                    "original", "fixes", { context: 0 });
                const diffString = diffResults.hunks.map(hunk => {
                    return `Line ${hunk.oldStart} (- original, + suggested fix)\n${hunk.lines.join("\n")}`;
                }).join("\n");
                fixString = `\n${diffString}`;
            }

            return `${fileName}${positionTuple}: ${failureString}${fixString}`;
        });

        return outputLines.join("\n") + "\n";
    }
}
