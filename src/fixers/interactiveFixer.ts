import {AbstractFixer} from "../language/fixer/abstractFixer";
import {Fix, FixResult, Replacement} from "../language/fixer/fixer";
import {RuleFailure} from "../language/rule/rule";

export class Fixer extends AbstractFixer {
    public apply(fileName: string, source: string, failures: RuleFailure[]): FixResult {
        // TODO
        return {
            fileName: fileName,
            content: source,
            message: "made fixes",
            remaining: []
        };
    }
}
