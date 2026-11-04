import SwiftUI

struct DisplayPanelView: View {
    let display: String
    let formula: String

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            Text(formula)
                .font(.system(size: 17, weight: .semibold, design: .rounded))
                .foregroundStyle(CalculatorTheme.potionGreen.opacity(0.92))
                .lineLimit(1)
                .minimumScaleFactor(0.65)
                .frame(maxWidth: .infinity, alignment: .trailing)

            Text(display)
                .font(.system(size: display.count > 7 ? 54 : 72, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.35)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .contentTransition(.numericText())
        }
        .padding(22)
        .background {
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .fill(.black.opacity(0.32))
                .overlay(alignment: .topLeading) {
                    HStack(spacing: 8) {
                        Circle().fill(CalculatorTheme.dangerPink).frame(width: 10)
                        Circle().fill(.yellow).frame(width: 10)
                        Circle().fill(CalculatorTheme.potionGreen).frame(width: 10)
                    }
                    .padding(18)
                }
        }
        .overlay {
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .stroke(CalculatorTheme.potionGreen.opacity(0.28), lineWidth: 1.5)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Display \(display). \(formula)")
    }
}
