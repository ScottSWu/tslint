import {AbstractFixer} from "../language/fixer/abstractFixer";
import {Fix, FixResult, Replacement} from "../language/fixer/fixer";
import {RuleFailure} from "../language/rule/rule";

export class Fixer extends AbstractFixer {
    private isConflicting(a: Fix, b: Fix) {
        const aReps = a.getReplacements();
        const bReps = b.getReplacements();
        aReps.forEach(aRep => {
            bReps.forEach(bRep => {
                if (aRep.getEnd() > bRep.getStart() && aRep.getStart() < bRep.getEnd()) {
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
            if (failure.getFixes().length > 0) {
                fixes.push(failure.getFixes()[0]);
            }
        });
        // Select fixes FCFS, removing conflicting fixes
        const selectedFixes: Fix[] = [];
        const remainingFixes: Fix[] = [];
        fixes.forEach(fix => {
            if (!selectedFixes.some(sf => this.isConflicting(fix, sf))) {
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
            replacements = replacements.concat(fix.getReplacements());
        }
        replacements.sort((a, b) => b.getEnd() - a.getEnd());

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
