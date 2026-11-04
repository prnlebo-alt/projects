import SwiftUI

enum CalculatorTheme {
    static let labNavy = Color(red: 0.06, green: 0.08, blue: 0.16)
    static let labPurple = Color(red: 0.28, green: 0.18, blue: 0.48)
    static let potionGreen = Color(red: 0.41, green: 0.95, blue: 0.62)
    static let beakerBlue = Color(red: 0.29, green: 0.78, blue: 0.94)
    static let pugTan = Color(red: 0.79, green: 0.61, blue: 0.43)
    static let pugMuzzle = Color(red: 0.95, green: 0.82, blue: 0.64)
    static let pugMask = Color(red: 0.18, green: 0.14, blue: 0.16)
    static let chalk = Color(red: 0.94, green: 0.97, blue: 0.92)
    static let dangerPink = Color(red: 1.0, green: 0.36, blue: 0.58)
}

enum CalculatorButtonRole {
    case utility
    case operation
    case digit
    case equals

    var foreground: Color {
        switch self {
        case .utility:
            return CalculatorTheme.labNavy
        case .operation, .equals, .digit:
            return .white
        }
    }

    var background: LinearGradient {
        switch self {
        case .utility:
            return LinearGradient(colors: [.white.opacity(0.92), CalculatorTheme.beakerBlue.opacity(0.76)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .operation:
            return LinearGradient(colors: [CalculatorTheme.dangerPink, .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .digit:
            return LinearGradient(colors: [Color.white.opacity(0.20), Color.white.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .equals:
            return LinearGradient(colors: [CalculatorTheme.potionGreen, CalculatorTheme.beakerBlue], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}
