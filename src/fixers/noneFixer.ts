import {AbstractFixer} from "../language/fixer/abstractFixer";
import {FixResult} from "../language/fixer/fixer";
import {RuleFailure} from "../language/rule/rule";

export class Fixer extends AbstractFixer {
    public apply(fileName: string, source: string, failures: RuleFailure[]): FixResult {
        return {
            fileName: fileName,
            content: source,
            message: "",
            remaining: []
        };
    }
}
