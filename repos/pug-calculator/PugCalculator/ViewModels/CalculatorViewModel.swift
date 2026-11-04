import Foundation
import PugCalculatorCore

@MainActor
final class CalculatorViewModel: ObservableObject {
    @Published private(set) var display = "0"
    @Published private(set) var formula = "Ready for science!"
    @Published private(set) var reaction: CalculatorReaction = .idle
    @Published private(set) var experimentCount = 0

    let rows: [[CalculatorButton]] = [
        [.clear, .sign, .percent, .divide],
        [.seven, .eight, .nine, .multiply],
        [.four, .five, .six, .subtract],
        [.one, .two, .three, .add],
        [.zero, .decimal, .equals]
    ]

    private var engine = CalculatorEngine()

    func press(_ button: CalculatorButton) {
        let state = engine.press(button)
        display = state.display
        formula = state.formula
        reaction = state.reaction
        experimentCount += 1
    }

    func role(for button: CalculatorButton) -> CalculatorButtonRole {
        if button.isOperation { return .operation }

        switch button {
        case .clear, .sign, .percent:
            return .utility
        case .equals:
            return .equals
        default:
            return .digit
        }
    }
}
