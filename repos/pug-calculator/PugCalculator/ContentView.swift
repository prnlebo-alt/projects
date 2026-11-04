import SwiftUI
import PugCalculatorCore

struct ContentView: View {
    @StateObject private var viewModel = CalculatorViewModel()

    var body: some View {
        ZStack {
            LabBackgroundView()

            VStack(spacing: 14) {
                header

                PugScientistView(
                    reaction: viewModel.reaction,
                    display: viewModel.display,
                    tick: viewModel.experimentCount
                )
                .padding(.top, 2)

                DisplayPanelView(display: viewModel.display, formula: viewModel.formula)

                keypad
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 12)
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Professor Pug's")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(CalculatorTheme.potionGreen)
                Text("Mad Lab Calculator")
                    .font(.system(size: 31, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }

            Spacer()

            Image(systemName: "flask.fill")
                .font(.system(size: 34, weight: .heavy))
                .foregroundStyle(LinearGradient(colors: [CalculatorTheme.potionGreen, CalculatorTheme.beakerBlue], startPoint: .top, endPoint: .bottom))
                .shadow(color: CalculatorTheme.potionGreen.opacity(0.45), radius: 12)
        }
        .accessibilityElement(children: .combine)
    }

    private var keypad: some View {
        VStack(spacing: 12) {
            ForEach(viewModel.rows, id: \.self) { row in
                HStack(spacing: 12) {
                    ForEach(row, id: \.self) { button in
                        CalculatorButtonView(button: button, role: viewModel.role(for: button)) {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.68)) {
                                viewModel.press(button)
                            }
                        }
                        .gridCellColumns(button == .zero ? 2 : 1)
                    }
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
