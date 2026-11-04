import XCTest
@testable import PugCalculatorCore

final class CalculatorEngineTests: XCTestCase {
    func testAddsTwoNumbers() {
        var engine = CalculatorEngine()

        _ = engine.press(.two)
        _ = engine.press(.add)
        _ = engine.press(.three)
        let state = engine.press(.equals)

        XCTAssertEqual(state.display, "5")
        XCTAssertEqual(state.reaction, .resultCelebrate)
    }

    func testChainedOperationsResolvePendingValue() {
        var engine = CalculatorEngine()

        _ = engine.press(.nine)
        _ = engine.press(.subtract)
        _ = engine.press(.four)
        _ = engine.press(.multiply)
        _ = engine.press(.two)
        let state = engine.press(.equals)

        XCTAssertEqual(state.display, "10")
    }

    func testDecimalAndPercent() {
        var engine = CalculatorEngine()

        _ = engine.press(.one)
        _ = engine.press(.decimal)
        _ = engine.press(.five)
        _ = engine.press(.percent)

        XCTAssertEqual(engine.state.display, "0.015")
    }

    func testDivideByZeroReturnsErrorReaction() {
        var engine = CalculatorEngine()

        _ = engine.press(.eight)
        _ = engine.press(.divide)
        _ = engine.press(.zero)
        let state = engine.press(.equals)

        XCTAssertTrue(state.isError)
        XCTAssertEqual(state.display, "Error")
        XCTAssertEqual(state.reaction, .errorSmoke)
    }

    func testRepeatedEqualsRepeatsLastOperation() {
        var engine = CalculatorEngine()

        _ = engine.press(.five)
        _ = engine.press(.add)
        _ = engine.press(.two)
        _ = engine.press(.equals)
        let state = engine.press(.equals)

        XCTAssertEqual(state.display, "9")
    }
}
