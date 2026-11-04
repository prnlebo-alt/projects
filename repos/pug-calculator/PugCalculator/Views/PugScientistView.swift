import SwiftUI
import PugCalculatorCore

struct PugScientistView: View {
    let reaction: CalculatorReaction
    let display: String
    let tick: Int

    @State private var bubblePhase = false

    var body: some View {
        ZStack {
            bubblingBackdrop
            pugBody
                .rotationEffect(.degrees(headTilt))
                .scaleEffect(reaction == .resultCelebrate ? 1.06 : 1.0)
                .animation(.spring(response: 0.35, dampingFraction: 0.48), value: tick)
            reactionOverlay
        }
        .frame(height: 265)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
                bubblePhase.toggle()
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Animated mad scientist pug helper showing \(display)")
    }

    private var headTilt: Double {
        switch reaction {
        case .operationZap: -7
        case .resultCelebrate: 6
        case .errorSmoke: 0
        case .cleared: -4
        default: 3
        }
    }

    private var bubblingBackdrop: some View {
        ZStack {
            ForEach(0..<13, id: \.self) { index in
                Circle()
                    .fill(index.isMultiple(of: 2) ? CalculatorTheme.potionGreen.opacity(0.38) : CalculatorTheme.beakerBlue.opacity(0.30))
                    .frame(width: CGFloat(12 + (index % 5) * 8))
                    .offset(
                        x: CGFloat((index % 7) * 48 - 145),
                        y: bubblePhase ? CGFloat(-116 + (index % 4) * 18) : CGFloat(-30 + (index % 5) * 22)
                    )
                    .blur(radius: index.isMultiple(of: 3) ? 0 : 1)
                    .animation(.easeInOut(duration: Double(1.2 + Double(index) * 0.08)).repeatForever(autoreverses: true), value: bubblePhase)
            }
        }
    }

    private var pugBody: some View {
        ZStack {
            coat
                .offset(y: 76)
            head
            goggles
                .offset(y: -39)
            speechBeaker
                .offset(x: 82, y: -72)
            ears
            muzzle
                .offset(y: 18)
            noseAndSmile
                .offset(y: 18)
            hairTufts
                .offset(y: -88)
        }
    }

    private var coat: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(.white)
                .frame(width: 150, height: 92)
                .shadow(color: .black.opacity(0.18), radius: 10, y: 8)
            Rectangle()
                .fill(CalculatorTheme.beakerBlue.opacity(0.28))
                .frame(width: 4, height: 82)
            HStack(spacing: 28) {
                Circle().fill(CalculatorTheme.labPurple).frame(width: 9)
                Circle().fill(CalculatorTheme.labPurple).frame(width: 9)
            }
            .offset(y: 6)
        }
    }

    private var head: some View {
        RoundedRectangle(cornerRadius: 55, style: .continuous)
            .fill(LinearGradient(colors: [CalculatorTheme.pugTan, CalculatorTheme.pugMuzzle], startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: 154, height: 128)
            .overlay(alignment: .top) {
                RoundedRectangle(cornerRadius: 50, style: .continuous)
                    .fill(CalculatorTheme.pugTan.opacity(0.58))
                    .frame(width: 122, height: 38)
                    .offset(y: 6)
            }
            .shadow(color: .black.opacity(0.26), radius: 16, y: 11)
    }

    private var ears: some View {
        HStack(spacing: 98) {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(CalculatorTheme.pugMask)
                .frame(width: 44, height: 62)
                .rotationEffect(.degrees(-24))
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(CalculatorTheme.pugMask)
                .frame(width: 44, height: 62)
                .rotationEffect(.degrees(24))
        }
        .offset(y: -22)
    }

    private var goggles: some View {
        HStack(spacing: 16) {
            goggleLens
            goggleLens
        }
        .overlay {
            Rectangle()
                .fill(CalculatorTheme.labNavy)
                .frame(width: 22, height: 7)
        }
    }

    private var goggleLens: some View {
        Circle()
            .fill(LinearGradient(colors: [CalculatorTheme.beakerBlue.opacity(0.92), .white.opacity(0.75)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: 48, height: 48)
            .overlay(Circle().stroke(CalculatorTheme.labNavy, lineWidth: 6))
            .overlay(alignment: .topLeading) {
                Circle().fill(.white.opacity(0.85)).frame(width: 10).offset(x: 12, y: 10)
            }
    }

    private var muzzle: some View {
        RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(CalculatorTheme.pugMuzzle)
            .frame(width: 82, height: 55)
    }

    private var noseAndSmile: some View {
        VStack(spacing: 2) {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(CalculatorTheme.pugMask)
                .frame(width: 24, height: 16)
            HStack(spacing: 4) {
                ArcSmile()
                    .stroke(CalculatorTheme.pugMask, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(width: 22, height: 12)
                ArcSmile()
                    .stroke(CalculatorTheme.pugMask, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(width: 22, height: 12)
                    .scaleEffect(x: -1)
            }
        }
    }

    private var hairTufts: some View {
        HStack(spacing: -4) {
            Capsule().fill(.white).frame(width: 11, height: 34).rotationEffect(.degrees(-28))
            Capsule().fill(.white).frame(width: 13, height: 43)
            Capsule().fill(.white).frame(width: 11, height: 34).rotationEffect(.degrees(28))
        }
    }

    private var speechBeaker: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(.white.opacity(0.93))
                .frame(width: 116, height: 60)
                .shadow(color: CalculatorTheme.potionGreen.opacity(0.28), radius: 14)
            Text(display)
                .font(.system(size: display.count > 6 ? 19 : 26, weight: .heavy, design: .rounded))
                .foregroundStyle(CalculatorTheme.labPurple)
                .lineLimit(1)
                .minimumScaleFactor(0.45)
                .padding(.horizontal, 10)
        }
    }

    @ViewBuilder
    private var reactionOverlay: some View {
        switch reaction {
        case .digitSparkle:
            SparkleBurst(tick: tick)
        case .operationZap(let operation):
            OperationZap(operation: operation, tick: tick)
        case .resultCelebrate:
            ConfettiPop(tick: tick)
        case .errorSmoke:
            SmokePuffs(tick: tick)
        case .cleared:
            Text("RESET!")
                .font(.system(size: 24, weight: .black, design: .rounded))
                .foregroundStyle(CalculatorTheme.potionGreen)
                .offset(x: -98, y: -90)
                .transition(.scale.combined(with: .opacity))
        case .idle:
            EmptyView()
        }
    }
}

private struct ArcSmile: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addArc(center: CGPoint(x: rect.midX, y: rect.minY), radius: rect.width / 2, startAngle: .degrees(8), endAngle: .degrees(172), clockwise: false)
        return path
    }
}

private struct SparkleBurst: View {
    let tick: Int

    var body: some View {
        ForEach(0..<8, id: \.self) { index in
            Image(systemName: "sparkle")
                .font(.system(size: 16 + index % 3 * 4, weight: .bold))
                .foregroundStyle(index.isMultiple(of: 2) ? CalculatorTheme.potionGreen : .yellow)
                .offset(x: CGFloat(cos(Double(index)) * 104), y: CGFloat(sin(Double(index)) * 78) - 32)
                .scaleEffect(tick.isMultiple(of: 2) ? 1.15 : 0.75)
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.45), value: tick)
    }
}

private struct OperationZap: View {
    let operation: CalculatorOperation
    let tick: Int

    var body: some View {
        Text(operation.rawValue)
            .font(.system(size: 84, weight: .black, design: .rounded))
            .foregroundStyle(LinearGradient(colors: [.yellow, CalculatorTheme.dangerPink], startPoint: .top, endPoint: .bottom))
            .shadow(color: .yellow.opacity(0.55), radius: 18)
            .offset(x: -102, y: -72)
            .rotationEffect(.degrees(tick.isMultiple(of: 2) ? -11 : 11))
            .animation(.spring(response: 0.22, dampingFraction: 0.36), value: tick)
    }
}

private struct ConfettiPop: View {
    let tick: Int

    var body: some View {
        ForEach(0..<18, id: \.self) { index in
            Capsule()
                .fill([CalculatorTheme.potionGreen, CalculatorTheme.beakerBlue, .yellow, CalculatorTheme.dangerPink][index % 4])
                .frame(width: 7, height: 18)
                .rotationEffect(.degrees(Double(index * 23)))
                .offset(x: CGFloat((index % 6) * 52 - 130), y: tick.isMultiple(of: 2) ? CGFloat(-132 + (index % 3) * 18) : CGFloat(-92 + (index % 4) * 14))
        }
        .animation(.interpolatingSpring(stiffness: 170, damping: 8), value: tick)
    }
}

private struct SmokePuffs: View {
    let tick: Int

    var body: some View {
        ForEach(0..<6, id: \.self) { index in
            Circle()
                .fill(.gray.opacity(0.45))
                .frame(width: CGFloat(32 + index * 7))
                .offset(x: CGFloat(index * 18 - 52), y: tick.isMultiple(of: 2) ? CGFloat(-104 - index * 7) : CGFloat(-72 - index * 4))
                .blur(radius: 2)
        }
        .animation(.easeOut(duration: 0.55), value: tick)
    }
}
