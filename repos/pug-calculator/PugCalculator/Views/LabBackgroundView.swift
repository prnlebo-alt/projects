import SwiftUI

struct LabBackgroundView: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [CalculatorTheme.labNavy, CalculatorTheme.labPurple, Color(red: 0.03, green: 0.12, blue: 0.18)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            GeometryReader { proxy in
                let size = proxy.size
                Path { path in
                    for row in stride(from: 0, through: size.height + 40, by: 42) {
                        path.move(to: CGPoint(x: 0, y: row))
                        path.addLine(to: CGPoint(x: size.width, y: row + 24))
                    }
                    for column in stride(from: -20, through: size.width + 20, by: 44) {
                        path.move(to: CGPoint(x: column, y: 0))
                        path.addLine(to: CGPoint(x: column + 30, y: size.height))
                    }
                }
                .stroke(.white.opacity(0.035), lineWidth: 1)
            }
            .ignoresSafeArea()

            Circle()
                .fill(CalculatorTheme.potionGreen.opacity(0.18))
                .frame(width: 270)
                .blur(radius: 48)
                .offset(x: -150, y: -280)

            Circle()
                .fill(CalculatorTheme.dangerPink.opacity(0.15))
                .frame(width: 320)
                .blur(radius: 56)
                .offset(x: 170, y: 280)
        }
    }
}
