import {AbstractFixer} from "../language/fixer/abstractFixer";
import {Fix, FixResult, Replacement} from "../language/fixer/fixer";
import {RuleFailure} from "../language/rule/rule";

export class Fixer extends AbstractFixer {
    private static isConflicting(a: Fix, b: Fix) {
        a.replacements.forEach(aRep => {
            b.replacements.forEach(bRep => {
                if (aRep.end > bRep.start && aRep.start < bRep.end) {
                    return true;
                }
            });
        });
        return false;
    }

    public apply(fileName: string, source: string, failures: RuleFailure[]): FixResult {
        // Take the first suggested fix in all rule failures
        const fixes: Fix[] = [];
        failures.forEach(failure => {
            if (failure.hasFix()) {
                fixes.push(failure.getFix());
            }
        });
        // Select fixes FCFS, removing conflicting fixes
        const selectedFixes: Fix[] = [];
        const remainingFixes: Fix[] = [];
        fixes.forEach(fix => {
            if (!selectedFixes.some(sf => Fixer.isConflicting(fix, sf))) {
                selectedFixes.push(fix);
            } else {
                remainingFixes.push(fix);
            }
        });
        // Flatten all replacements and sort in reverse order by end position
        // NOTE: V8 sort is unstable, which might cause issues when multiple
        // replacements are made at the same place (e.g. multiple imports).
        let replacements: Replacement[] = [];
        for (const fix of selectedFixes) {
            replacements = replacements.concat(fix.replacements);
        }
        replacements.sort(Replacement.compare);

        const newSource = replacements.reduce((acc, r) => r.apply(acc), source);

        return {
            fileName: fileName,
            content: newSource,
            message: `Applied ${selectedFixes.length} fixes, failed ${remainingFixes.length} fixes.
                Run TSLint again to fix the remaining fixes.`,
            remaining: remainingFixes
        };
    }
}
