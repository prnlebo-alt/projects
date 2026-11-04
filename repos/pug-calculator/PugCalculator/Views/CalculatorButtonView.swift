import SwiftUI
import PugCalculatorCore

struct CalculatorButtonView: View {
    let button: CalculatorButton
    let role: CalculatorButtonRole
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(button.rawValue)
                .font(.system(size: button == .zero ? 30 : 28, weight: .bold, design: .rounded))
                .foregroundStyle(role.foreground)
                .frame(maxWidth: .infinity, minHeight: 70)
                .background(role.background, in: RoundedRectangle(cornerRadius: 25, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 25, style: .continuous)
                        .stroke(.white.opacity(0.22), lineWidth: 1.4)
                }
                .shadow(color: .black.opacity(0.20), radius: 12, x: 0, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityName)
    }

    private var accessibilityName: String {
        switch button {
        case .clear: "All clear"
        case .sign: "Toggle sign"
        case .percent: "Percent"
        case .divide: "Divide"
        case .multiply: "Multiply"
        case .subtract: "Subtract"
        case .add: "Add"
        case .equals: "Equals"
        case .decimal: "Decimal"
        default: button.rawValue
        }
    }
}
