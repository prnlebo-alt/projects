import Foundation

public enum CalculatorButton: String, CaseIterable, Sendable {
    case clear = "AC"
    case sign = "+/-"
    case percent = "%"
    case divide = "÷"
    case seven = "7"
    case eight = "8"
    case nine = "9"
    case multiply = "×"
    case four = "4"
    case five = "5"
    case six = "6"
    case subtract = "−"
    case one = "1"
    case two = "2"
    case three = "3"
    case add = "+"
    case zero = "0"
    case decimal = "."
    case equals = "="

    public var isDigit: Bool {
        switch self {
        case .zero, .one, .two, .three, .four, .five, .six, .seven, .eight, .nine:
            return true
        default:
            return false
        }
    }

    public var isOperation: Bool {
        switch self {
        case .divide, .multiply, .subtract, .add:
            return true
        default:
            return false
        }
    }
}

public enum CalculatorOperation: String, Sendable {
    case add = "+"
    case subtract = "−"
    case multiply = "×"
    case divide = "÷"

    init?(button: CalculatorButton) {
        switch button {
        case .add:
            self = .add
        case .subtract:
            self = .subtract
        case .multiply:
            self = .multiply
        case .divide:
            self = .divide
        default:
            return nil
        }
    }

    func apply(_ lhs: Decimal, _ rhs: Decimal) -> Decimal? {
        switch self {
        case .add:
            return lhs + rhs
        case .subtract:
            return lhs - rhs
        case .multiply:
            return lhs * rhs
        case .divide:
            guard rhs != .zero else { return nil }
            return lhs / rhs
        }
    }
}

public enum CalculatorReaction: Equatable, Sendable {
    case idle
    case digitSparkle
    case operationZap(CalculatorOperation)
    case resultCelebrate
    case errorSmoke
    case cleared
}

public struct CalculatorState: Equatable, Sendable {
    public var display: String
    public var formula: String
    public var pendingOperation: CalculatorOperation?
    public var reaction: CalculatorReaction
    public var isError: Bool

    public init(
        display: String = "0",
        formula: String = "Ready for science!",
        pendingOperation: CalculatorOperation? = nil,
        reaction: CalculatorReaction = .idle,
        isError: Bool = false
    ) {
        self.display = display
        self.formula = formula
        self.pendingOperation = pendingOperation
        self.reaction = reaction
        self.isError = isError
    }
}

public struct CalculatorEngine: Sendable {
    public private(set) var state = CalculatorState()

    private var storedValue: Decimal?
    private var input = "0"
    private var shouldStartNewInput = true
    private var lastOperand: Decimal?
    private var lastOperation: CalculatorOperation?

    public init() {}

    public mutating func press(_ button: CalculatorButton) -> CalculatorState {
        if state.isError, button != .clear {
            reset()
        }

        switch button {
        case .clear:
            reset()
            state.reaction = .cleared
        case _ where button.isDigit:
            appendDigit(button.rawValue)
        case .decimal:
            appendDecimal()
        case .sign:
            toggleSign()
        case .percent:
            applyPercent()
        case _ where button.isOperation:
            chooseOperation(button)
        case .equals:
            evaluateEquals()
        default:
            break
        }

        state.display = formattedDisplay(for: input)
        return state
    }

    public mutating func reset() {
        state = CalculatorState(reaction: .cleared)
        storedValue = nil
        input = "0"
        shouldStartNewInput = true
        lastOperand = nil
        lastOperation = nil
    }

    private mutating func appendDigit(_ digit: String) {
        if shouldStartNewInput {
            input = digit
            shouldStartNewInput = false
        } else if input == "0" {
            input = digit
        } else if input == "-0" {
            input = "-" + digit
        } else if input.count < 12 {
            input += digit
        }

        state.formula = "Pug punched in \(digit)"
        state.reaction = .digitSparkle
    }

    private mutating func appendDecimal() {
        if shouldStartNewInput {
            input = "0."
            shouldStartNewInput = false
        } else if !input.contains(".") {
            input += "."
        }

        state.formula = "A tiny decimal potion drop!"
        state.reaction = .digitSparkle
    }

    private mutating func toggleSign() {
        if input.hasPrefix("-") {
            input.removeFirst()
        } else if input != "0" {
            input = "-" + input
        }

        state.formula = "Polarity reversed!"
        state.reaction = .operationZap(.subtract)
    }

    private mutating func applyPercent() {
        guard let value = Decimal(string: input) else { return }
        input = decimalString(value / 100)
        state.formula = "Percent serum applied"
        state.reaction = .operationZap(.divide)
    }

    private mutating func chooseOperation(_ button: CalculatorButton) {
        guard let operation = CalculatorOperation(button: button), let currentValue = Decimal(string: input) else {
            return
        }

        if let pending = state.pendingOperation, !shouldStartNewInput {
            guard let result = pending.apply(storedValue ?? .zero, currentValue) else {
                setError()
                return
            }
            storedValue = result
            input = decimalString(result)
        } else {
            storedValue = currentValue
        }

        state.pendingOperation = operation
        state.formula = "\(formattedDisplay(for: decimalString(storedValue ?? .zero))) \(operation.rawValue)"
        state.reaction = .operationZap(operation)
        shouldStartNewInput = true
        lastOperation = nil
        lastOperand = nil
    }

    private mutating func evaluateEquals() {
        guard let currentValue = Decimal(string: input) else { return }

        let operation = state.pendingOperation ?? lastOperation
        let rhs: Decimal
        if let pending = state.pendingOperation {
            rhs = currentValue
            lastOperand = rhs
            lastOperation = pending
        } else if let repeatedOperand = lastOperand {
            rhs = repeatedOperand
        } else {
            state.formula = "Already perfect!"
            state.reaction = .resultCelebrate
            shouldStartNewInput = true
            return
        }

        guard let operation, let lhs = storedValue ?? Decimal(string: input), let result = operation.apply(lhs, rhs) else {
            setError()
            return
        }

        input = decimalString(result)
        storedValue = result
        state.pendingOperation = nil
        state.formula = "Eureka! \(formattedDisplay(for: decimalString(lhs))) \(operation.rawValue) \(formattedDisplay(for: decimalString(rhs)))"
        state.reaction = .resultCelebrate
        shouldStartNewInput = true
    }

    private mutating func setError() {
        input = "0"
        state.display = "Error"
        state.formula = "The beaker bubbled over!"
        state.pendingOperation = nil
        state.reaction = .errorSmoke
        state.isError = true
        storedValue = nil
        shouldStartNewInput = true
    }

    private func formattedDisplay(for rawValue: String) -> String {
        guard !state.isError else { return "Error" }
        guard let value = Decimal(string: rawValue.replacingOccurrences(of: ",", with: "")) else { return rawValue }

        if rawValue.hasSuffix(".") {
            return rawValue
        }

        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 8
        formatter.minimumFractionDigits = 0
        formatter.usesGroupingSeparator = true

        return formatter.string(from: value as NSDecimalNumber) ?? rawValue
    }

    private func decimalString(_ value: Decimal) -> String {
        let number = value as NSDecimalNumber
        return number.stringValue
    }
}
